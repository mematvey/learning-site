import { describe, expect, it } from 'vitest';
import {
	ALPHA,
	INITIAL_POINTS,
	analyze,
	bandHalfWidth,
	describeFit,
	fitOls,
	fmt,
	fmtP,
	regIncBeta,
	residuals,
	snapX,
	snapY,
	tCdf,
	tQuantile,
} from './regression';

describe('t distribution', () => {
	it('is symmetric around zero', () => {
		expect(tCdf(0, 5)).toBeCloseTo(0.5, 12);
		expect(tCdf(1.3, 7) + tCdf(-1.3, 7)).toBeCloseTo(1, 12);
	});

	it('matches tabulated 97.5% quantiles', () => {
		expect(tQuantile(0.975, 3)).toBeCloseTo(3.182446, 4);
		expect(tQuantile(0.975, 10)).toBeCloseTo(2.228139, 4);
		expect(tQuantile(0.975, 1)).toBeCloseTo(12.7062, 3);
	});

	it('inverts the cdf', () => {
		const q = tQuantile(0.9, 4);
		expect(tCdf(q, 4)).toBeCloseTo(0.9, 8);
	});

	it('gives the regularised incomplete beta bounds and a known value', () => {
		expect(regIncBeta(0, 2, 3)).toBe(0);
		expect(regIncBeta(1, 2, 3)).toBe(1);
		// I_x(1, 1) = x
		expect(regIncBeta(0.37, 1, 1)).toBeCloseTo(0.37, 6);
	});
});

describe('least squares fit', () => {
	it('reproduces the chapter numbers for the demo data', () => {
		const fit = fitOls(INITIAL_POINTS);
		expect(fit).not.toBeNull();
		if (!fit) return;
		expect(fit.intercept).toBeCloseTo(0.05, 10);
		expect(fit.slope).toBeCloseTo(1.99, 10);
	});

	it('has residuals that sum to zero and are orthogonal to x', () => {
		const fit = fitOls(INITIAL_POINTS);
		if (!fit) throw new Error('fit is null');
		const res = residuals(INITIAL_POINTS, fit);
		const sum = res.reduce((s, e) => s + e, 0);
		const dot = res.reduce((s, e, i) => s + e * (INITIAL_POINTS[i]?.x ?? 0), 0);
		expect(sum).toBeCloseTo(0, 10);
		expect(dot).toBeCloseTo(0, 10);
	});

	it('returns null when all x are equal', () => {
		expect(
			fitOls([
				{ x: 2, y: 1 },
				{ x: 2, y: 5 },
				{ x: 2, y: 3 },
			]),
		).toBeNull();
	});
});

describe('slope analysis', () => {
	const a = analyze(INITIAL_POINTS);

	it('gives the chapter numbers', () => {
		expect(a).not.toBeNull();
		if (!a) return;
		expect(a.df).toBe(3);
		expect(a.sse).toBeCloseTo(0.107, 10);
		expect(a.se).toBeCloseTo(0.0597, 3);
		expect(a.tq).toBeCloseTo(3.182, 3);
		expect(a.ci.lo).toBeCloseTo(1.8, 1);
		expect(a.ci.hi).toBeCloseTo(2.18, 2);
	});

	it('gives a tiny p-value for the clear slope in the demo', () => {
		expect(a).not.toBeNull();
		if (!a) return;
		expect(a.t).toBeGreaterThan(30);
		expect(a.p).toBeLessThan(0.001);
	});

	it('gives a p-value above 0.05 for a flat cloud', () => {
		const flat = analyze([
			{ x: 1, y: 3 },
			{ x: 2, y: 1 },
			{ x: 3, y: 4 },
			{ x: 4, y: 2 },
			{ x: 5, y: 3 },
		]);
		expect(flat).not.toBeNull();
		if (!flat) return;
		expect(flat.p).toBeGreaterThan(ALPHA);
		expect(flat.ci.lo).toBeLessThan(0);
		expect(flat.ci.hi).toBeGreaterThan(0);
	});

	it('returns null with fewer than three points or no x spread', () => {
		expect(
			analyze([
				{ x: 1, y: 1 },
				{ x: 2, y: 2 },
			]),
		).toBeNull();
		expect(
			analyze([
				{ x: 1, y: 1 },
				{ x: 1, y: 2 },
				{ x: 1, y: 3 },
			]),
		).toBeNull();
	});

	it('band is narrowest at the mean of x and widens away from it', () => {
		if (!a) throw new Error('analysis is null');
		const atMean = bandHalfWidth(a, a.meanX);
		const far = bandHalfWidth(a, a.meanX + 2);
		expect(atMean).toBeLessThan(far);
		expect(atMean).toBeCloseTo((a.tq * a.sigma) / Math.sqrt(a.n), 10);
	});
});

describe('formatting and snapping', () => {
	it('uses a decimal comma and dashes for non-finite values', () => {
		expect(fmt(1.99)).toBe('1,99');
		expect(fmt(Number.NaN)).toBe('—');
	});

	it('shows tiny p-values as an inequality', () => {
		expect(fmtP(0.0000001)).toBe('< 0,001');
		expect(fmtP(0.2)).toBe('0,200');
	});

	it('clamps and rounds dragged coordinates', () => {
		expect(snapX(-3)).toBe(0);
		expect(snapX(7)).toBe(6);
		expect(snapX(2.04)).toBe(2);
		expect(snapY(13)).toBe(12);
		expect(snapY(Number.NaN)).toBe(0);
	});

	it('describes the fit for screen readers', () => {
		expect(describeFit(analyze(INITIAL_POINTS))).toContain('Наклон 1,99');
		expect(describeFit(null)).toContain('не определён');
	});
});
