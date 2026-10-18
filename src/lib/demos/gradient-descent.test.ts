import { describe, expect, it } from 'vitest';
import {
	ETA_MAX,
	ETA_MIN,
	STEPS_MAX,
	contourRadii,
	describeState,
	fmt,
	grad1d,
	isOutside1d,
	itemAt,
	lastStepText1d,
	loss1d,
	loss2d,
	lossY,
	regimeOf,
	snapEta,
	snapSteps,
	stabilityLimits,
	trajectory1d,
	trajectory2d,
} from './gradient-descent';

describe('1D loss (w - 3)^2', () => {
	it('has zero loss and zero gradient at the minimum w = 3', () => {
		expect(loss1d(3)).toBe(0);
		expect(grad1d(3)).toBe(0);
	});

	it('gradient is 2 (w - 3)', () => {
		expect(grad1d(0)).toBe(-6);
		expect(grad1d(5)).toBe(4);
	});
});

describe('trajectory1d', () => {
	it('reproduces the numbers of the chapter example for eta = 0.1', () => {
		const w = trajectory1d(0.1, 4);
		expect(itemAt(w, 0)).toBe(0);
		expect(itemAt(w, 1)).toBeCloseTo(0.6, 10);
		expect(itemAt(w, 2)).toBeCloseTo(1.08, 10);
		expect(itemAt(w, 3)).toBeCloseTo(1.464, 10);
		expect(itemAt(w, 4)).toBeCloseTo(1.7712, 10);
	});

	it('returns steps + 1 values and moves monotonically towards 3 for small eta', () => {
		const w = trajectory1d(0.1, 50);
		expect(w).toHaveLength(51);
		for (let k = 1; k < w.length; k++) expect(itemAt(w, k)).toBeGreaterThan(itemAt(w, k - 1));
		expect(itemAt(w, 50)).toBeLessThan(3);
	});

	it('shrinks the distance by 0.98 per step for eta = 0.01 (about 0.40 after 100 steps)', () => {
		const err = Math.abs(itemAt(trajectory1d(0.01, 100), 100) - 3);
		expect(err).toBeGreaterThan(0.39);
		expect(err).toBeLessThan(0.41);
	});

	it('eta = 1 jumps between 0 and 6 and does not converge', () => {
		const w = trajectory1d(1, 4);
		expect(w.map((v) => Math.round(v))).toEqual([0, 6, 0, 6, 0]);
	});

	it('eta = 1.1 grows the distance by 1.2 per step (about 115 after 20 steps)', () => {
		const err = Math.abs(itemAt(trajectory1d(1.1, 20), 20) - 3);
		expect(err).toBeGreaterThan(114);
		expect(err).toBeLessThan(116);
	});
});

describe('trajectory2d', () => {
	it('converges for eta = 0.1', () => {
		const [a, b] = itemAt(trajectory2d(0.1, 100), 100);
		expect(a).toBeCloseTo(3, 6);
		expect(b).toBeCloseTo(3, 6);
	});

	it('starts at the start point and diverges for eta above 2 / 8', () => {
		const path = trajectory2d(0.3, 30);
		expect(itemAt(path, 0)).toEqual([0, 0]);
		expect(Math.abs(itemAt(path, 30)[1] - 3)).toBeGreaterThan(1000);
	});

	it('loss2d is 45 at the start point (9 + 4 * 9)', () => {
		expect(loss2d(0, 0)).toBe(45);
	});
});

describe('stability', () => {
	it('gives the thresholds 1 / curvature and 2 / curvature', () => {
		expect(stabilityLimits(1)).toEqual({ smooth: 0.5, limit: 1 });
		expect(stabilityLimits(2)).toEqual({ smooth: 0.125, limit: 0.25 });
	});

	it('classifies the chapter examples in 1D', () => {
		expect(regimeOf(1, 0.1)).toBe('smooth');
		expect(regimeOf(1, 0.01)).toBe('smooth');
		expect(regimeOf(1, 0.7)).toBe('oscillate');
		expect(regimeOf(1, 1)).toBe('bounce');
		expect(regimeOf(1, 1.1)).toBe('diverge');
	});

	it('classifies the 2D thresholds', () => {
		expect(regimeOf(2, 0.1)).toBe('smooth');
		expect(regimeOf(2, 0.2)).toBe('oscillate');
		expect(regimeOf(2, 0.25)).toBe('bounce');
		expect(regimeOf(2, 0.3)).toBe('diverge');
	});
});

describe('snapping and formatting', () => {
	it('clamps eta to the slider range and rounds to two decimals', () => {
		expect(snapEta(5)).toBe(ETA_MAX);
		expect(snapEta(-1)).toBe(ETA_MIN);
		expect(snapEta(0.456)).toBe(0.46);
		expect(snapEta(Number.NaN)).toBe(0.1);
	});

	it('clamps steps to 1..100', () => {
		expect(snapSteps(0)).toBe(1);
		expect(snapSteps(500)).toBe(STEPS_MAX);
		expect(snapSteps(20.4)).toBe(20);
	});

	it('formats numbers with a decimal comma and a minus sign', () => {
		expect(fmt(0.6)).toBe('0,60');
		expect(fmt(-1.5)).toBe('−1,50');
		expect(fmt(-0.001)).toBe('0,00');
		expect(fmt(115000)).toBe('1,2e+5');
	});

	it('gives a text with numbers for the last step', () => {
		const w = trajectory1d(0.1, 2);
		expect(lastStepText1d(w, 0.1)).toBe('w = 0,60 − 0,10·2·(−2,40) = 1,08');
	});
});

describe('aria description and geometry', () => {
	it('describes divergence in words', () => {
		const text = describeState(1, 1.1, 20, trajectory1d(1.1, 20));
		expect(text).toContain('расходится');
		expect(text).toContain('η < 1,00');
	});

	it('marks points beyond the chart domain or above the loss axis', () => {
		expect(isOutside1d(3, 0)).toBe(false);
		expect(isOutside1d(9, 36)).toBe(true);
		expect(isOutside1d(3, 40)).toBe(true);
	});

	it('keeps the loss inside the drawing area', () => {
		expect(lossY(100, 240)).toBe(lossY(18, 240));
		expect(lossY(0, 240)).toBe(240 - 28);
	});

	it('scales contour radii with the level set of the 2D loss', () => {
		const a = contourRadii(4, 300);
		const b = contourRadii(16, 300);
		expect(b.rx / a.rx).toBeCloseTo(2, 10);
		expect(b.ry / a.ry).toBeCloseTo(2, 10);
		expect(a.ry / a.rx).toBeCloseTo(0.5, 10);
	});
});
