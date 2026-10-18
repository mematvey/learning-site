import { describe, expect, it } from 'vitest';
import {
	betaCdf,
	betaPdf,
	betaQuantile,
	credibleInterval,
	densityCurve,
	describeState,
	logBeta,
	logGamma,
	makeRng,
	posterior,
	simulateHeads,
	snapParam,
	summarize,
	TRUE_HEADS_P,
	SIM_SEED,
} from './bayesian-inference';

describe('special functions', () => {
	it('logGamma matches known factorials', () => {
		expect(Math.exp(logGamma(5))).toBeCloseTo(24, 9);
		expect(Math.exp(logGamma(1))).toBeCloseTo(1, 12);
		expect(Math.exp(logGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 10);
	});

	it('logBeta(1, 1) is zero and logBeta(a, b) is symmetric', () => {
		expect(logBeta(1, 1)).toBeCloseTo(0, 12);
		expect(logBeta(3, 7)).toBeCloseTo(logBeta(7, 3), 12);
	});
});

describe('Beta density and CDF', () => {
	it('uniform prior Beta(1, 1) has density 1 and CDF equal to x', () => {
		expect(betaPdf(0.3, 1, 1)).toBeCloseTo(1, 12);
		expect(betaCdf(0.3, 1, 1)).toBeCloseTo(0.3, 10);
		expect(betaCdf(0.5, 1, 1)).toBeCloseTo(0.5, 10);
	});

	it('density integrates to one (trapezoid rule) for a skewed Beta(8, 4)', () => {
		const curve = densityCurve(8, 4, 2001);
		let area = 0;
		for (let i = 1; i < curve.length; i++) {
			const prev = curve[i - 1]!;
			const cur = curve[i]!;
			area += ((prev.y + cur.y) / 2) * (cur.x - prev.x);
		}
		expect(area).toBeCloseTo(1, 3);
	});

	it('CDF of Beta(8, 4) at 0.5 matches the exact value 0.1138 (binomial identity)', () => {
		// For integer a, b: I_x(a, b) = P(Binomial(a + b - 1, x) >= a). Here n = 11, a = 8.
		let tail = 0;
		const n = 11;
		for (let j = 8; j <= n; j++) {
			let c = 1;
			for (let i = 1; i <= j; i++) c = (c * (n - j + i)) / i;
			tail += c * 0.5 ** n;
		}
		expect(betaCdf(0.5, 8, 4)).toBeCloseTo(tail, 9);
	});

	it('returns 0 and 1 outside the support', () => {
		expect(betaPdf(0, 2, 2)).toBe(0);
		expect(betaPdf(1, 2, 2)).toBe(0);
		expect(betaCdf(-0.1, 2, 2)).toBe(0);
		expect(betaCdf(1.2, 2, 2)).toBe(1);
	});
});

describe('quantiles and credible intervals', () => {
	it('quantile inverts the CDF', () => {
		const q = betaQuantile(0.975, 9, 11);
		expect(betaCdf(q, 9, 11)).toBeCloseTo(0.975, 6);
	});

	it('uniform prior quantiles are the probabilities themselves', () => {
		expect(betaQuantile(0.025, 1, 1)).toBeCloseTo(0.025, 6);
		expect(betaQuantile(0.975, 1, 1)).toBeCloseTo(0.975, 6);
	});

	it('reproduces the chapter numbers for 7 heads in 10 flips', () => {
		// Beta(1, 1) + 7/10 -> Beta(8, 4): mean 0.667, 95% interval (0.390; 0.891)
		const p1 = posterior(1, 1, 7, 3);
		expect(p1).toEqual({ a: 8, b: 4 });
		const s1 = summarize(p1.a, p1.b);
		expect(s1.mean).toBeCloseTo(0.667, 3);
		expect(s1.lo).toBeCloseTo(0.39, 2);
		expect(s1.hi).toBeCloseTo(0.891, 2);

		// Beta(2, 8) + 7/10 -> Beta(9, 11): mean 0.450, interval (0.245; 0.665)
		const p2 = posterior(2, 8, 7, 3);
		expect(p2).toEqual({ a: 9, b: 11 });
		const s2 = summarize(p2.a, p2.b);
		expect(s2.mean).toBeCloseTo(0.45, 3);
		expect(s2.lo).toBeCloseTo(0.245, 2);
		expect(s2.hi).toBeCloseTo(0.665, 2);

		// Beta(10, 10) + 7/10 -> Beta(17, 13): mean 0.567
		const p3 = posterior(10, 10, 7, 3);
		expect(p3).toEqual({ a: 17, b: 13 });
		expect(summarize(p3.a, p3.b).mean).toBeCloseTo(0.567, 3);
	});

	it('with 700 of 1000 flips the posterior means of different priors almost coincide', () => {
		const p1 = posterior(1, 1, 700, 300);
		const p2 = posterior(2, 8, 700, 300);
		const m1 = summarize(p1.a, p1.b).mean;
		const m2 = summarize(p2.a, p2.b).mean;
		expect(Math.abs(m1 - m2)).toBeLessThan(0.01);
	});

	it('interval narrows as data grow', () => {
		const small = credibleInterval(8, 4);
		const big = credibleInterval(701, 301);
		expect(big.hi - big.lo).toBeLessThan(small.hi - small.lo);
	});
});

describe('helpers', () => {
	it('snapParam rounds, clamps and handles non-finite input', () => {
		expect(snapParam(3.6, 1)).toBe(4);
		expect(snapParam(0, 1)).toBe(1);
		expect(snapParam(99, 1)).toBe(20);
		expect(snapParam(Number.NaN, 5)).toBe(5);
	});

	it('simulated coin is deterministic and close to the hidden probability', () => {
		const rng1 = makeRng(SIM_SEED);
		const rng2 = makeRng(SIM_SEED);
		expect(simulateHeads(rng1, 50)).toBe(simulateHeads(rng2, 50));
		const heads = simulateHeads(makeRng(SIM_SEED), 2000);
		expect(heads / 2000).toBeCloseTo(TRUE_HEADS_P, 1);
	});

	it('describeState reports the flips and the interval', () => {
		const text = describeState({ a: 1, b: 1, heads: 7, tails: 3 });
		expect(text).toContain('После 10 бросков');
		expect(text).toContain('0,390');
	});
});
