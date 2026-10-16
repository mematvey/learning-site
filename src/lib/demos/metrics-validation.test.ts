import { describe, expect, it } from 'vitest';
import {
	DEFAULT_THRESHOLD,
	N_NEG,
	N_POS,
	THRESHOLD_MAX,
	THRESHOLD_MIN,
	THRESHOLD_STEP,
	confusion,
	curvePath,
	describeState,
	makeSamples,
	metrics,
	prCurve,
	prevalence,
	rocAuc,
	rocCurve,
	snapThreshold,
	sweep,
	toPixel,
	type Sample,
} from './metrics-validation';

const samples = makeSamples();

/** Probability that a random positive outranks a random negative, ties count one half. */
function pairwiseAuc(xs: readonly Sample[]): number {
	const pos = xs.filter((s) => s.label === 1);
	const neg = xs.filter((s) => s.label === 0);
	let wins = 0;
	for (const p of pos) {
		for (const n of neg) {
			if (p.score > n.score) wins += 1;
			else if (p.score === n.score) wins += 0.5;
		}
	}
	return wins / (pos.length * neg.length);
}

/** Last element of a non-empty array. */
function last<T>(xs: readonly T[]): T {
	const v = xs[xs.length - 1];
	if (v === undefined) throw new Error('empty array');
	return v;
}

/** Thresholds of the slider, from the lowest to the highest. */
function sliderGrid(): number[] {
	const grid: number[] = [];
	for (let t = THRESHOLD_MIN; t <= THRESHOLD_MAX + 1e-9; t += THRESHOLD_STEP) {
		grid.push(snapThreshold(t));
	}
	return grid;
}

describe('makeSamples', () => {
	it('is deterministic for a seed and has the configured class sizes', () => {
		expect(makeSamples()).toEqual(samples);
		expect(samples.filter((s) => s.label === 1)).toHaveLength(N_POS);
		expect(samples.filter((s) => s.label === 0)).toHaveLength(N_NEG);
	});

	it('gives scores strictly inside (0, 1) and a 20% positive share', () => {
		expect(samples.every((s) => s.score > 0 && s.score < 1)).toBe(true);
		expect(prevalence(samples)).toBeCloseTo(0.2, 10);
	});
});

describe('confusion', () => {
	it('splits every sample into exactly one cell at any threshold', () => {
		for (const t of sliderGrid()) {
			const c = confusion(samples, t);
			expect(c.tp + c.fp + c.tn + c.fn).toBe(samples.length);
			expect(c.tp + c.fn).toBe(N_POS);
			expect(c.fp + c.tn).toBe(N_NEG);
		}
	});

	it('marks everything positive at the lowest threshold and nothing above the highest score', () => {
		const all = confusion(samples, 0);
		expect(all.tn + all.fn).toBe(0);
		const none = confusion(samples, 1);
		expect(none.tp + none.fp).toBe(0);
	});

	it('counts a score equal to the threshold as positive', () => {
		const one: Sample[] = [
			{ score: 0.5, label: 1 },
			{ score: 0.5, label: 0 },
		];
		expect(confusion(one, 0.5)).toEqual({ tp: 1, fp: 1, tn: 0, fn: 0 });
	});

	it('moves recall and FPR down monotonically as the threshold rises', () => {
		let prevRecall = Infinity;
		let prevFpr = Infinity;
		for (const t of sliderGrid()) {
			const m = metrics(confusion(samples, t));
			expect(m.recall).toBeLessThanOrEqual(prevRecall);
			expect(m.fpr).toBeLessThanOrEqual(prevFpr);
			prevRecall = m.recall;
			prevFpr = m.fpr;
		}
	});
});

describe('metrics', () => {
	it('computes precision, recall, F1 and FPR from the four cells', () => {
		const m = metrics({ tp: 6, fp: 2, tn: 10, fn: 4 });
		expect(m.precision).toBeCloseTo(6 / 8, 12);
		expect(m.recall).toBeCloseTo(6 / 10, 12);
		expect(m.f1).toBeCloseTo((2 * 0.75 * 0.6) / (0.75 + 0.6), 12);
		expect(m.fpr).toBeCloseTo(2 / 12, 12);
		expect(m.accuracy).toBeCloseTo(16 / 22, 12);
	});

	it('gives 0 instead of NaN when a denominator is empty', () => {
		const m = metrics({ tp: 0, fp: 0, tn: 5, fn: 3 });
		expect(m.precision).toBe(0);
		expect(m.f1).toBe(0);
		expect(Number.isFinite(m.fpr)).toBe(true);
	});

	it('shows the imbalance trap: always-negative gets accuracy 1 minus the prevalence', () => {
		const m = metrics(confusion(samples, 1));
		expect(m.accuracy).toBeCloseTo(1 - prevalence(samples), 12);
		expect(m.recall).toBe(0);
	});
});

describe('sweep, ROC and PR curves', () => {
	it('visits each distinct score once, from the highest down, and ends with every sample positive', () => {
		const steps = sweep(samples);
		const distinct = new Set(samples.map((s) => s.score)).size;
		expect(steps).toHaveLength(distinct);
		for (let i = 1; i < steps.length; i++) {
			const prev = steps[i - 1];
			const cur = steps[i];
			if (prev && cur) expect(cur.threshold).toBeLessThan(prev.threshold);
		}
		const end = last(steps).c;
		expect(end.tn).toBe(0);
		expect(end.fn).toBe(0);
	});

	it('runs the ROC curve from (0, 0) to (1, 1)', () => {
		const roc = rocCurve(samples);
		expect(roc[0]).toEqual({ x: 0, y: 0 });
		expect(last(roc).x).toBeCloseTo(1, 12);
		expect(last(roc).y).toBeCloseTo(1, 12);
	});

	it('ends the PR curve at full recall with precision equal to the prevalence', () => {
		const pr = prCurve(samples);
		const end = last(pr);
		expect(end.x).toBeCloseTo(1, 12);
		expect(end.y).toBeCloseTo(prevalence(samples), 12);
	});

	it('gives the same ROC AUC as the pairwise definition with ties counted as one half', () => {
		expect(rocAuc(samples)).toBeCloseTo(pairwiseAuc(samples), 10);
	});

	it('gives AUC 1 for perfect separation, 0 for reversed scores, and handles ties', () => {
		const perfect: Sample[] = [
			{ score: 0.9, label: 1 },
			{ score: 0.8, label: 1 },
			{ score: 0.3, label: 0 },
			{ score: 0.1, label: 0 },
		];
		expect(rocAuc(perfect)).toBeCloseTo(1, 12);
		const reversed: Sample[] = perfect.map((s) => ({ score: 1 - s.score, label: s.label }));
		expect(rocAuc(reversed)).toBeCloseTo(0, 12);
		const tied: Sample[] = [
			{ score: 0.5, label: 1 },
			{ score: 0.5, label: 0 },
		];
		expect(rocAuc(tied)).toBeCloseTo(0.5, 12);
	});
});

describe('snapThreshold', () => {
	it('rounds to the slider step and clamps to the range', () => {
		expect(snapThreshold(0.34)).toBeCloseTo(0.35, 12);
		expect(snapThreshold(-1)).toBeCloseTo(THRESHOLD_MIN, 12);
		expect(snapThreshold(2)).toBeCloseTo(THRESHOLD_MAX, 12);
	});

	it('gives the default for non-finite input', () => {
		expect(snapThreshold(Number.NaN)).toBe(DEFAULT_THRESHOLD);
		expect(snapThreshold(Number.POSITIVE_INFINITY)).toBe(DEFAULT_THRESHOLD);
	});
});

describe('geometry and text', () => {
	it('maps the unit square into the padded chart with y pointing up', () => {
		expect(toPixel({ x: 0, y: 0 }, 260, 34)).toEqual({ px: 34, py: 226 });
		expect(toPixel({ x: 1, y: 1 }, 260, 34)).toEqual({ px: 226, py: 34 });
	});

	it('builds an SVG path that starts with a move and continues with lines', () => {
		const d = curvePath([
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
		]);
		expect(d.startsWith('M')).toBe(true);
		expect(d).toContain(' L');
	});

	it('describes the threshold and the metrics in words', () => {
		const c = confusion(samples, 0.5);
		const text = describeState(c, metrics(c), 0.5);
		expect(text).toContain('Порог 0.50');
		expect(text).toContain(`из ${N_POS}`);
	});
});
