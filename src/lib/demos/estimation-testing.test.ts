import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	REPS,
	criticalZ,
	ciHalfWidth,
	coverageShare,
	describeTest,
	mulberry32,
	normalCdf,
	normalQuantile,
	simulateIntervals,
	snapAlpha,
	snapEffect,
	snapN,
	testOutcome,
} from './estimation-testing';

describe('normal distribution helpers', () => {
	it('Φ(1.96) is about 0.975 and the quantile inverts the CDF', () => {
		expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
		expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 4);
		expect(normalCdf(normalQuantile(0.3))).toBeCloseTo(0.3, 6);
	});

	it('critical value for α = 0.05 is 1.96 (two-sided)', () => {
		expect(criticalZ(0.05)).toBeCloseTo(1.96, 2);
	});
});

describe('confidence interval', () => {
	it('half-width shrinks as 1/√n and grows as α shrinks', () => {
		expect(ciHalfWidth(100, 0.05)).toBeCloseTo(ciHalfWidth(25, 0.05) / 2, 10);
		expect(ciHalfWidth(20, 0.01)).toBeGreaterThan(ciHalfWidth(20, 0.1));
	});

	it('the same seed gives the same series, another seed gives another one', () => {
		const a = simulateIntervals(20, 0.05, 0, 7);
		const b = simulateIntervals(20, 0.05, 0, 7);
		const c = simulateIntervals(20, 0.05, 0, 8);
		expect(a).toEqual(b);
		expect(a).not.toEqual(c);
		expect(a).toHaveLength(REPS);
	});

	it('covers the true mean in about 1 − α of many repetitions', () => {
		const cov = coverageShare(simulateIntervals(30, 0.05, 0, 7, 2000));
		expect(cov.share).toBeGreaterThan(0.92);
		expect(cov.share).toBeLessThan(0.98);
	});

	it('covers flag matches the interval bounds', () => {
		for (const iv of simulateIntervals(10, 0.1, 0.3, 3, 50)) {
			expect(iv.covers).toBe(iv.lo <= 0.3 && 0.3 <= iv.hi);
		}
	});

	it('empty series gives zero share, not NaN', () => {
		expect(coverageShare([]).share).toBe(0);
	});
});

describe('two-sided z-test with σ = 1', () => {
	it('type I error equals α, and power equals α when the effect is zero', () => {
		const out = testOutcome(20, 0.05, 0);
		expect(out.alphaErr).toBeCloseTo(0.05, 5);
		expect(out.power).toBeCloseTo(0.05, 5);
		expect(out.shift).toBe(0);
	});

	it('power grows with n and with the effect size', () => {
		const small = testOutcome(10, 0.05, 0.5).power;
		const bigN = testOutcome(40, 0.05, 0.5).power;
		const bigEffect = testOutcome(10, 0.05, 1).power;
		expect(bigN).toBeGreaterThan(small);
		expect(bigEffect).toBeGreaterThan(small);
	});

	it('a larger α gives more power and a smaller β at the same n and effect', () => {
		const strict = testOutcome(20, 0.01, 0.5);
		const loose = testOutcome(20, 0.1, 0.5);
		expect(loose.power).toBeGreaterThan(strict.power);
		expect(loose.betaErr).toBeLessThan(strict.betaErr);
		expect(strict.betaErr + strict.power).toBeCloseTo(1, 10);
	});

	it('known value: n = 16, δ = 0.5, α = 0.05 gives power about 0.52', () => {
		// shift = 2, power = Φ(2 − 1.96) + Φ(−2 − 1.96) ≈ 0.5199
		expect(testOutcome(16, 0.05, 0.5).power).toBeCloseTo(0.52, 2);
	});
});

describe('snapping and text', () => {
	it('snaps inputs to the slider grids and falls back on NaN', () => {
		expect(snapN(0)).toBe(5);
		expect(snapN(500)).toBe(100);
		expect(snapN(Number.NaN)).toBe(DEFAULT_STATE.n);
		expect(snapAlpha(0.0537)).toBe(0.05);
		expect(snapEffect(0.37)).toBe(0.35);
		expect(snapEffect(3)).toBe(1);
	});

	it('mulberry32 stays in [0, 1)', () => {
		const rand = mulberry32(42);
		for (let i = 0; i < 1000; i++) {
			const v = rand();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('describes zero effect without a misleading β value', () => {
		const text = describeTest(20, 0.05, 0, testOutcome(20, 0.05, 0));
		expect(text).toContain('мощность равна α');
	});
});
