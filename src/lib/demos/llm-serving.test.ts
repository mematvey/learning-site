import { describe, expect, it } from 'vitest';
import {
	BATCH_OPTIONS,
	DEFAULTS,
	LOAD_CURVE,
	apiCost,
	breakEvenShare,
	costCurve,
	costPerMillion,
	describeState,
	latencySeconds,
	logDomain,
	snapApi,
	snapBatch,
	snapGpu,
	snapLoad,
	stepTimeMs,
	tokensPerSecond,
	tokensPerSecondFull,
	ttftSeconds,
	verdict,
} from './llm-serving';

describe('step time and throughput', () => {
	it('gives the text example: 25 ms at batch 1 and 30 ms at batch 16', () => {
		expect(stepTimeMs(1)).toBeCloseTo(25, 10);
		expect(stepTimeMs(16)).toBeCloseTo(30, 10);
	});

	it('gives 40 and about 533 tokens per second at batch 1 and 16', () => {
		expect(tokensPerSecondFull(1)).toBeCloseTo(40, 10);
		expect(tokensPerSecondFull(16)).toBeCloseTo(533.33, 1);
		expect(tokensPerSecondFull(16) / tokensPerSecondFull(1)).toBeCloseTo(13.33, 1);
	});

	it('grows throughput with batch while step time grows too', () => {
		BATCH_OPTIONS.forEach((next, i) => {
			const prev = BATCH_OPTIONS[i - 1];
			if (prev === undefined) return;
			expect(tokensPerSecondFull(next)).toBeGreaterThan(tokensPerSecondFull(prev));
			expect(stepTimeMs(next)).toBeGreaterThan(stepTimeMs(prev));
		});
	});

	it('scales delivered tokens linearly with load', () => {
		expect(tokensPerSecond(16, 50)).toBeCloseTo(tokensPerSecondFull(16) / 2, 10);
		expect(tokensPerSecond(16, 100)).toBeCloseTo(tokensPerSecondFull(16), 10);
	});
});

describe('cost per million tokens', () => {
	it('reproduces the text table for 2.5 per hour and 1000 tokens per second', () => {
		expect(costPerMillion(2.5, 1000)).toBeCloseTo(0.694, 3);
		expect(costPerMillion(2.5, 0.3 * 1000)).toBeCloseTo(2.315, 3);
		expect(costPerMillion(2.5, 0.1 * 1000)).toBeCloseTo(6.944, 3);
	});

	it('falls as load rises and is infinite at zero load', () => {
		expect(costPerMillion(2.5, tokensPerSecond(16, 20))).toBeGreaterThan(
			costPerMillion(2.5, tokensPerSecond(16, 80)),
		);
		expect(costPerMillion(2.5, 0)).toBe(Number.POSITIVE_INFINITY);
	});

	it('gives the same cost at 100% load for batch 16 as the formula', () => {
		expect(costPerMillion(2.5, tokensPerSecondFull(16))).toBeCloseTo(1.302, 3);
	});
});

describe('break-even against the API', () => {
	it('reproduces the text value 4.6% for 1000 tokens per second and API price 15', () => {
		expect(breakEvenShare(2.5, 1000, 15)).toBeCloseTo(0.0463, 4);
	});

	it('is above 1 when the API is cheaper even at full load', () => {
		expect(breakEvenShare(10, tokensPerSecondFull(1), 15)).toBeGreaterThan(1);
	});
});

describe('latency', () => {
	it('reproduces the text example: TTFT 0.4 s, TPOT 25 ms, 300 tokens give 7.875 s', () => {
		expect(latencySeconds(0.4, 25, 300)).toBeCloseTo(7.875, 10);
	});

	it('TTFT is the base at zero load and grows near full load', () => {
		expect(ttftSeconds(0)).toBeCloseTo(0.4, 10);
		expect(ttftSeconds(90)).toBeGreaterThan(ttftSeconds(50));
		expect(Number.isFinite(ttftSeconds(100))).toBe(true);
	});
});

describe('API cost', () => {
	it('reproduces the text example: 0.0135 per request and 40500 per month', () => {
		const perRequest = apiCost(2000, 500, 3, 15);
		expect(perRequest).toBeCloseTo(0.0135, 10);
		expect(perRequest * 100_000 * 30).toBeCloseTo(40_500, 6);
	});
});

describe('snapping and defaults', () => {
	it('snaps batch to the nearest allowed value', () => {
		expect(snapBatch(10)).toBe(8);
		expect(snapBatch(100)).toBe(64);
		expect(snapBatch(Number.NaN)).toBe(DEFAULTS.batch);
	});

	it('snaps load to steps of 5 within 5..100', () => {
		expect(snapLoad(0)).toBe(5);
		expect(snapLoad(73)).toBe(75);
		expect(snapLoad(250)).toBe(100);
		expect(snapLoad(Number.POSITIVE_INFINITY)).toBe(DEFAULTS.load);
	});

	it('snaps prices to their steps and ranges', () => {
		expect(snapGpu(2.3)).toBe(2.5);
		expect(snapGpu(99)).toBe(10);
		expect(snapApi(0)).toBe(1);
		expect(snapApi(14.6)).toBe(15);
	});

	it('the default cost curve covers 5% to 100% in steps of 5', () => {
		expect(LOAD_CURVE[0]).toBe(5);
		expect(LOAD_CURVE[LOAD_CURVE.length - 1]).toBe(100);
		expect(LOAD_CURVE).toHaveLength(20);
		const curve = costCurve(DEFAULTS.gpuPrice, DEFAULTS.batch);
		expect(curve.every((p) => Number.isFinite(p.cost) && p.cost > 0)).toBe(true);
	});
});

describe('logDomain', () => {
	it('covers all values with whole powers of ten', () => {
		expect(logDomain([0.5, 3000])).toEqual({ lo: -1, hi: 4 });
	});

	it('always spans at least one decade and ignores non-positive input', () => {
		expect(logDomain([2, 2])).toEqual({ lo: 0, hi: 1 });
		expect(logDomain([0, -1])).toEqual({ lo: -1, hi: 2 });
	});
});

describe('verdict and description', () => {
	it('says the GPU is cheaper at high load and the API is cheaper at low load', () => {
		const high = { ...DEFAULTS, load: 60 };
		const low = { ...DEFAULTS, load: 5 };
		expect(verdict(high)).toContain('дешевле API');
		expect(verdict(high)).toContain('При загрузке 60%');
		expect(verdict(low)).toContain('API дешевле');
	});

	it('says the GPU never wins when even full load at batch 1 is dearer than the API', () => {
		expect(verdict({ ...DEFAULTS, batch: 1, load: 100 })).toContain('Даже при 100%');
	});

	it('describes the state with computed numbers', () => {
		const text = describeState(DEFAULTS);
		expect(text).toContain('Батч 16, загрузка 60%');
		expect(text).toContain('TPOT 30.0 мс');
	});
});
