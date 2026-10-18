import { describe, expect, it } from 'vitest';
import { BP_DEFAULT, bpBars, mergeBpState, totalVariation } from './binom-poisson';
import {
	binomCdf,
	binomQuantile,
	mergeCdfState,
	sampleCounts,
	uniformSequence,
} from './cdf-quantile';

describe('binomCdf and binomQuantile', () => {
	it('gives F(5) = 638/1024 for Bin(10, 1/2)', () => {
		expect(binomCdf(10, 0.5, 5)).toBeCloseTo(638 / 1024, 12);
		expect(binomCdf(10, 0.5, -1)).toBe(0);
		expect(binomCdf(10, 0.5, 10)).toBe(1);
	});

	it('returns the smallest k with F(k) >= u', () => {
		expect(binomQuantile(10, 0.5, 0.5)).toBe(5);
		expect(binomQuantile(10, 0.5, 0.62)).toBe(5);
		expect(binomQuantile(10, 0.5, 0.63)).toBe(6);
		expect(binomQuantile(10, 0.5, 0.99)).toBe(9);
	});

	it('counts every draw exactly once', () => {
		const counts = sampleCounts(10, 0.5, 300);
		expect(counts.reduce((a, b) => a + b, 0)).toBe(300);
		expect(counts).toHaveLength(11);
	});

	it('is deterministic and uniform enough', () => {
		const a = uniformSequence(1000);
		expect(uniformSequence(1000)).toEqual(a);
		const mean = a.reduce((x, y) => x + y, 0) / a.length;
		expect(mean).toBeGreaterThan(0.45);
		expect(mean).toBeLessThan(0.55);
	});

	it('clamps the state', () => {
		const s = mergeCdfState({ n: 10, p: 0.5, u: 0.5, m: 200 }, { n: 999, u: 5 });
		expect(s.n).toBe(30);
		expect(s.u).toBe(0.99);
	});
});

describe('Binomial to Poisson', () => {
	it('distance shrinks as n grows', () => {
		const d5 = totalVariation(3, 5);
		const d50 = totalVariation(3, 50);
		const d200 = totalVariation(3, 200);
		expect(d5).toBeGreaterThan(d50);
		expect(d50).toBeGreaterThan(d200);
		expect(d200).toBeLessThan(0.01);
	});

	it('keeps n >= lambda so that p <= 1', () => {
		expect(mergeBpState(BP_DEFAULT, { lambda: 10, n: 2 }).n).toBe(10);
	});

	it('builds bars for k = 0..axis max', () => {
		const bars = bpBars(3, 50);
		expect(bars[0].k).toBe(0);
		expect(bars[0].poisson).toBeCloseTo(Math.exp(-3), 12);
	});
});
