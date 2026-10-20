import { describe, expect, it } from 'vitest';
import {
	N_FEATURES,
	N_SAMPLES,
	NOISE_MAX_BOUND,
	THRESHOLD_DEFAULT,
	evaluate,
	fitVote,
	formatRu,
	isSelectionMode,
	mulberry32,
	noiseMaxMean,
	reps,
	selectAbove,
	snapThreshold,
	sortedCurve,
} from './feature-selection';

describe('snapThreshold', () => {
	it('rounds to the 0.01 step and clamps to the slider range', () => {
		expect(snapThreshold(0.3349)).toBe(0.33);
		expect(snapThreshold(0.337)).toBe(0.34);
		expect(snapThreshold(0.01)).toBe(0.15);
		expect(snapThreshold(9)).toBe(0.55);
	});

	it('gives the default for non-finite input', () => {
		expect(snapThreshold(Number.NaN)).toBe(THRESHOLD_DEFAULT);
		expect(snapThreshold(Number.POSITIVE_INFINITY)).toBe(THRESHOLD_DEFAULT);
	});
});

describe('formatRu and mode guard', () => {
	it('uses a decimal comma', () => {
		expect(formatRu(0.9, 2)).toBe('0,90');
	});

	it('accepts only the two selection modes', () => {
		expect(isSelectionMode('before')).toBe(true);
		expect(isSelectionMode('inside')).toBe(true);
		expect(isSelectionMode('after')).toBe(false);
	});
});

describe('mulberry32', () => {
	it('gives the same sequence for the same seed, in [0, 1)', () => {
		const a = mulberry32(7);
		const b = mulberry32(7);
		for (let i = 0; i < 100; i++) {
			const v = a();
			expect(v).toBe(b());
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('selectAbove', () => {
	it('keeps features at or above the threshold, in index order', () => {
		const scores = Float64Array.from([0.1, 0.5, 0.3, 0.5]);
		expect(selectAbove(scores, 0.3)).toEqual([1, 2, 3]);
		expect(selectAbove(scores, 0.6)).toEqual([]);
	});
});

describe('fitVote', () => {
	it('learns a feature that carries the target', () => {
		const n = N_SAMPLES;
		const x = new Float32Array(n * N_FEATURES);
		const y = new Uint8Array(n);
		for (let i = 0; i < n; i++) {
			y[i] = i % 2;
			x[i * N_FEATURES + 3] = y[i] ? 1 : -1;
		}
		const rows = Array.from({ length: n }, (_, i) => i);
		const predict = fitVote(x, y, [3], rows);
		for (const i of rows) expect(predict(i)).toBe(y[i]);
	});

	it('with no features always predicts 0', () => {
		const x = new Float32Array(N_SAMPLES * N_FEATURES);
		const y = new Uint8Array(N_SAMPLES);
		const predict = fitVote(x, y, [], [0, 1]);
		expect(predict(0)).toBe(0);
	});
});

describe('noise and the demo numbers', () => {
	it('the largest noise |corr| is close to the bound sqrt(2 ln p / n)', () => {
		expect(reps()).toHaveLength(50);
		const m = noiseMaxMean();
		expect(m).toBeGreaterThan(0.42);
		expect(m).toBeLessThan(0.52);
		expect(NOISE_MAX_BOUND).toBeGreaterThan(m);
	});

	it('sorted curve is descending and has one value per feature', () => {
		const c = sortedCurve('before');
		expect(c).toHaveLength(N_FEATURES);
		for (let i = 1; i < c.length; i++) expect(c[i]).toBeLessThanOrEqual(c[i - 1] as number);
	});

	it('at the default threshold: about 20 features before the split, CV about 0.9 before and 0.5 inside', () => {
		const o = evaluate(THRESHOLD_DEFAULT);
		expect(o.beforeCount).toBeGreaterThan(17);
		expect(o.beforeCount).toBeLessThan(23);
		expect(o.before).toBeGreaterThan(0.88);
		expect(o.before).toBeLessThan(0.96);
		expect(o.inside).toBeGreaterThan(0.45);
		expect(o.inside).toBeLessThan(0.55);
		expect(o.before - o.inside).toBeGreaterThan(0.3);
	});

	it('a higher threshold keeps fewer features before the split', () => {
		const low = evaluate(0.25);
		const high = evaluate(0.45);
		expect(high.beforeCount).toBeLessThan(low.beforeCount);
		expect(high.runCount).toBeLessThanOrEqual(low.runCount);
	});
});
