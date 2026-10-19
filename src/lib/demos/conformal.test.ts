import { describe, expect, it } from 'vitest';
import {
	DEFAULT_N,
	N_SHOW,
	conformalQuantile,
	evaluateConformal,
	minCalibrationSize,
	rankK,
	snapAlpha,
	snapN,
} from './conformal';

describe('rank of the threshold (chapter numbers)', () => {
	it('gives k = 9, 9, 18, 90, 900 for n = 8, 9, 19, 99, 999 at α = 0.1', () => {
		expect([8, 9, 19, 99, 999].map((n) => rankK(n, 0.1))).toEqual([9, 9, 18, 90, 900]);
	});

	it('needs at least 9 calibration points for α = 0.1', () => {
		expect(minCalibrationSize(0.1)).toBe(9);
		expect(minCalibrationSize(0.5)).toBe(1);
	});
});

describe('conformal quantile', () => {
	it('returns the k-th smallest score without changing the input', () => {
		const scores = [5, 1, 3, 2, 4];
		expect(conformalQuantile(scores, 3)).toBe(3);
		expect(scores).toEqual([5, 1, 3, 2, 4]);
	});

	it('returns Infinity when k is larger than n', () => {
		expect(conformalQuantile([1, 2, 3], 4)).toBe(Infinity);
	});
});

describe('snapping of the controls', () => {
	it('rounds α to 0.01 and clamps it', () => {
		expect(snapAlpha(0.104)).toBe(0.1);
		expect(snapAlpha(0)).toBe(0.01);
		expect(snapAlpha(2)).toBe(0.5);
		expect(snapAlpha(Number.NaN)).toBe(0.1);
	});

	it('snaps n to the nearest chapter size', () => {
		expect(snapN(50)).toBe(19);
		expect(snapN(1000)).toBe(999);
		expect(snapN(Number.NaN)).toBe(DEFAULT_N);
	});
});

describe('evaluateConformal', () => {
	it('gives unbounded intervals for n = 8 and α = 0.1', () => {
		const r = evaluateConformal({ alpha: 0.1, n: 8, seed: 1 });
		expect(r.k).toBe(9);
		expect(r.kValid).toBe(false);
		expect(r.fixed.q).toBe(Infinity);
		expect(r.adaptive.q).toBe(Infinity);
		expect(r.fixed.coverage).toBe(1);
	});

	it('is deterministic for one state and changes with the seed', () => {
		const a = evaluateConformal({ alpha: 0.1, n: 99, seed: 1 });
		const b = evaluateConformal({ alpha: 0.1, n: 99, seed: 1 });
		const c = evaluateConformal({ alpha: 0.1, n: 99, seed: 2 });
		expect(b).toEqual(a);
		expect(c.fixed.q).not.toBe(a.fixed.q);
	});

	it('fits the model on the training sample only, so n does not move the curve', () => {
		const small = evaluateConformal({ alpha: 0.1, n: 8, seed: 1 });
		const large = evaluateConformal({ alpha: 0.1, n: 999, seed: 1 });
		expect(large.curve.map((p) => p.mu)).toEqual(small.curve.map((p) => p.mu));
	});

	it('shows the story at the default state: constant band uneven across x, adaptive band even', () => {
		const r = evaluateConformal({ alpha: 0.1, n: 99, seed: 1 });
		const spread = (v: readonly number[]) => Math.max(...v) - Math.min(...v);
		expect(r.fixed.byRegion[0]).toBeGreaterThan(r.fixed.byRegion[2] + 0.1);
		expect(spread(r.fixed.byRegion)).toBeGreaterThan(2 * spread(r.adaptive.byRegion));
		expect(r.fixed.coverage).toBeGreaterThan(0.85);
		expect(r.adaptive.coverage).toBeGreaterThan(0.85);
	});

	it('returns one dot per shown test point with boolean miss flags', () => {
		const r = evaluateConformal({ alpha: 0.2, n: 19, seed: 3 });
		expect(r.points).toHaveLength(N_SHOW);
		for (const p of r.points) {
			expect(typeof p.missFixed).toBe('boolean');
			expect(typeof p.missAdaptive).toBe('boolean');
		}
	});
});
