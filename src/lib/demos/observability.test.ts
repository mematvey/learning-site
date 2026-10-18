import { describe, expect, it } from 'vitest';
import {
	ROOT_ID,
	TAIL_SAMPLE,
	bottleneck,
	buildTrace,
	describeSpeedup,
	describeTrace,
	duration,
	fmt,
	isTraceDemoState,
	mean,
	modelShare,
	percentile,
	speedupSaving,
	speedupSavingShare,
	summarizeLatency,
	sumChildSeconds,
	totalSeconds,
} from './observability';

const SEQ = { parallel: false, fastSearch: false };
const PAR = { parallel: true, fastSearch: false };

describe('buildTrace (sequential)', () => {
	const spans = buildTrace(SEQ);

	it('has the root and four steps, all children of the root', () => {
		expect(spans.map((s) => s.id)).toEqual([ROOT_ID, 'retrieve', 'rerank', 'llm', 'check']);
		for (const s of spans.slice(1)) expect(s.parent).toBe(ROOT_ID);
	});

	it('the root lasts 9.40 s, the chapter example', () => {
		expect(totalSeconds(spans)).toBe(9.4);
	});

	it('steps follow each other without gaps', () => {
		const steps = spans.slice(1);
		steps.forEach((s, i) => {
			const prev = steps[i - 1];
			if (prev) expect(s.start).toBeCloseTo(prev.end, 9);
		});
	});

	it('sum of the steps equals the root', () => {
		expect(sumChildSeconds(spans)).toBe(totalSeconds(spans));
	});

	it('the model call is the bottleneck with share about 0.89', () => {
		expect(bottleneck(spans).id).toBe('llm');
		expect(duration(spans.find((s) => s.id === 'llm')!)).toBe(8.4);
		expect(modelShare(spans)).toBeCloseTo(0.89, 2);
	});
});

describe('speed-up of the search', () => {
	it('halving the search saves 0.175 s, less than 2% of the request', () => {
		expect(speedupSaving(false)).toBeCloseTo(0.175, 9);
		expect(speedupSavingShare(false)).toBeLessThan(0.02);
	});

	it('the fast search shortens only the search steps', () => {
		const fast = buildTrace({ parallel: false, fastSearch: true });
		expect(duration(fast.find((s) => s.id === 'retrieve')!)).toBeCloseTo(0.175, 9);
		expect(duration(fast.find((s) => s.id === 'llm')!)).toBe(8.4);
	});

	it('describeSpeedup states the saving with a decimal comma', () => {
		expect(describeSpeedup(false)).toContain('0,175 с');
	});
});

describe('buildTrace (parallel searches)', () => {
	const spans = buildTrace(PAR);

	it('two searches start at the same moment', () => {
		const a = spans.find((s) => s.id === 'retrieve')!;
		const b = spans.find((s) => s.id === 'retrieve-b')!;
		expect(a.start).toBe(0);
		expect(b.start).toBe(0);
	});

	it('the rerank waits for the longer search', () => {
		const rerank = spans.find((s) => s.id === 'rerank')!;
		expect(rerank.start).toBe(0.35);
	});

	it('the sum of durations is larger than the root, so shares do not add up to 100%', () => {
		expect(sumChildSeconds(spans)).toBe(9.7);
		expect(totalSeconds(spans)).toBe(9.4);
		expect(sumChildSeconds(spans)).toBeGreaterThan(totalSeconds(spans));
	});

	it('describeTrace warns about overlapping steps', () => {
		expect(describeTrace(PAR)).toContain('перекрываются');
		expect(describeTrace(SEQ)).not.toContain('перекрываются');
	});
});

describe('percentile (nearest rank)', () => {
	it('reproduces the chapter example for n = 10', () => {
		expect(percentile(TAIL_SAMPLE, 95)).toBe(9);
		expect(percentile(TAIL_SAMPLE, 90)).toBe(1);
	});

	it('the mean of the sample is 1.8 s while p95 is 9 s', () => {
		const s = summarizeLatency(TAIL_SAMPLE);
		expect(s.mean).toBeCloseTo(1.8, 10);
		expect(s.p50).toBe(1);
		expect(s.p95).toBe(9);
		expect(s.max).toBe(9);
	});

	it('handles a single value and the boundary p = 100', () => {
		expect(percentile([4], 50)).toBe(4);
		expect(percentile([3, 1, 2], 100)).toBe(3);
	});

	it('does not change its input', () => {
		const xs = [3, 1, 2];
		percentile(xs, 50);
		expect(xs).toEqual([3, 1, 2]);
	});

	it('throws on an empty list', () => {
		expect(() => percentile([], 50)).toThrow();
	});
});

describe('helpers', () => {
	it('mean of an empty list is 0', () => {
		expect(mean([])).toBe(0);
	});

	it('fmt uses a decimal comma', () => {
		expect(fmt(9.4, 2)).toBe('9,40');
		expect(fmt(0.0186, 1)).toBe('0,0');
	});

	it('describeTrace reports the model share', () => {
		expect(describeTrace(SEQ)).toContain('Доля модели: 0,89');
	});

	it('isTraceDemoState accepts only the two flags', () => {
		expect(isTraceDemoState(SEQ)).toBe(true);
		expect(isTraceDemoState({ parallel: 1, fastSearch: false })).toBe(false);
		expect(isTraceDemoState(null)).toBe(false);
	});
});
