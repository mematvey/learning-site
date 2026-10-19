import { describe, expect, it } from 'vitest';
import {
	DEFAULT_COUNTS,
	X_VALUES,
	bandPath,
	describeGlm,
	fitGlm,
	fmt,
	normalizeCounts,
	plotPoints,
	predictiveBand,
	setCount,
	snapAlpha,
	snapCount,
	summarize,
	xToPx,
	yToPx,
} from './glm';

const y = DEFAULT_COUNTS;
const intercept = { slope: false, link: 'log' as const, alpha: 0 };
const first = (a: number[]): number => a[0] ?? Number.NaN;

describe('Poisson GLM on the chapter example (intercept only)', () => {
	const s = summarize(fitGlm(X_VALUES, y, intercept));

	it('gives exp(beta0) equal to the sample mean 2.667', () => {
		expect(s.level).toBeCloseTo(16 / 6, 6);
		expect(s.level).toBeCloseTo(2.667, 3);
	});

	it('gives Pearson dispersion 3.25 and a factor of about 1.80', () => {
		expect(s.phi).toBeCloseTo(3.25, 6);
		expect(s.factor).toBeCloseTo(1.8, 2);
	});

	it('gives standard errors 0.667 without and 1.20 with the correction', () => {
		expect(s.levelRaw.se).toBeCloseTo(0.667, 3);
		expect(s.levelScaled.se).toBeCloseTo(1.2, 2);
	});

	it('gives the intervals [1.36; 3.97] and [0.31; 5.02]', () => {
		expect(s.levelRaw.lo).toBeCloseTo(1.36, 2);
		expect(s.levelRaw.hi).toBeCloseTo(3.97, 2);
		expect(s.levelScaled.lo).toBeCloseTo(0.31, 2);
		expect(s.levelScaled.hi).toBeCloseTo(5.02, 2);
	});
});

describe('negative-binomial comparison', () => {
	it('for an intercept-only model the NB mean equals the Poisson mean, but phi is lower', () => {
		const p = fitGlm(X_VALUES, y, intercept);
		const n = fitGlm(X_VALUES, y, { ...intercept, alpha: 0.3 });
		expect(Math.max(...n.mu)).toBeCloseTo(Math.max(...p.mu), 6);
		expect(n.phi).toBeLessThan(p.phi);
	});

	it('a larger alpha widens the predictive band of the same mean', () => {
		const narrow = predictiveBand([4], 0);
		const wide = predictiveBand([4], 0.5);
		expect(first(wide.hi) - first(wide.lo)).toBeGreaterThan(first(narrow.hi) - first(narrow.lo));
	});
});

describe('link function', () => {
	it('identity link with a falling slope gives a non-positive mean and is flagged', () => {
		const counts = [8, 4, 2, 1, 1, 0];
		const identity = fitGlm(X_VALUES, counts, { slope: true, link: 'identity', alpha: 0 });
		expect(identity.valid).toBe(false);
		const log = fitGlm(X_VALUES, counts, { slope: true, link: 'log', alpha: 0 });
		expect(log.valid).toBe(true);
	});

	it('the note names the overdispersion and the factor for the default data', () => {
		const fitP = fitGlm(X_VALUES, y, intercept);
		const fitN = fitGlm(X_VALUES, y, { ...intercept, alpha: 0.3 });
		const text = describeGlm(fitP, fitN, summarize(fitP));
		expect(text).toContain('Переразброс');
		expect(text).toContain('3,25');
		expect(text).toContain('1,80');
	});
});

describe('count editing helpers', () => {
	it('drag values are rounded to integers and clamped', () => {
		expect(snapCount(3.6)).toBe(4);
		expect(snapCount(-2)).toBe(0);
		expect(snapCount(99)).toBe(20);
		expect(snapCount(Number.NaN)).toBe(0);
	});

	it('setCount does not change the original array', () => {
		const next = setCount(DEFAULT_COUNTS, 0, 5);
		expect(next).toEqual([5, 1, 1, 2, 4, 8]);
		expect(DEFAULT_COUNTS).toEqual([0, 1, 1, 2, 4, 8]);
	});

	it('normalizeCounts falls back to the default for a wrong length', () => {
		expect(normalizeCounts([1, 2])).toEqual(DEFAULT_COUNTS);
	});

	it('plotPoints pairs each count with its feature value', () => {
		expect(plotPoints([3, 5]).slice(0, 2)).toEqual([
			{ index: 0, x: 1, value: 3 },
			{ index: 1, x: 2, value: 5 },
		]);
	});

	it('snapAlpha rounds to the slider step', () => {
		expect(snapAlpha(0.333)).toBe(0.35);
		expect(snapAlpha(2)).toBe(1);
	});
});

describe('geometry', () => {
	it('closes the band path and keeps the axes ordered', () => {
		const path = bandPath([1, 2, 3], [0, 1, 2], [3, 4, 5]);
		expect(path.endsWith('Z')).toBe(true);
		expect(xToPx(1)).toBeLessThan(xToPx(6));
		expect(yToPx(0)).toBeGreaterThan(yToPx(24));
		expect(fmt(1.5)).toBe('1,50');
	});
});
