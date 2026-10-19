import { describe, expect, it } from 'vitest';
import {
	BOOT_B,
	SAMPLE_A,
	SAMPLE_B,
	binomial,
	bootstrapMeans,
	bootstrapRun,
	bootstrapSe,
	diffForLabels,
	exactPermutationDiffs,
	histogram,
	mean,
	mulberry32,
	observedDiff,
	percentileInterval,
	pooled,
	randomLabelsA,
	sampleSd,
	twoSidedP,
} from './bootstrap-permutation';

describe('mulberry32', () => {
	it('gives the same stream for the same seed and values in [0, 1)', () => {
		const a = mulberry32(0);
		const b = mulberry32(0);
		for (let i = 0; i < 100; i++) {
			const v = a();
			expect(v).toBe(b());
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('chapter sample', () => {
	it('matches the stated mean, SD and difference of means', () => {
		expect(mean(SAMPLE_A)).toBeCloseTo(14.75, 10);
		expect(sampleSd(SAMPLE_A)).toBeCloseTo(2.82, 2);
		expect(mean(SAMPLE_B)).toBeCloseTo(20.875, 10);
		expect(observedDiff(SAMPLE_A, SAMPLE_B)).toBeCloseTo(6.125, 10);
	});
});

describe('bootstrapMeans', () => {
	it('gives the same first values for a shorter run with the same seed', () => {
		const short = bootstrapMeans(SAMPLE_A, 100, 0);
		const long = bootstrapMeans(SAMPLE_A, BOOT_B, 0);
		expect(Array.from(long.slice(0, 100))).toEqual(Array.from(short));
	});

	it('gives bootstrap SE near 0.93 and the plug-in value sqrt((n-1)/n) * s / sqrt(n)', () => {
		const means = bootstrapMeans(SAMPLE_A, BOOT_B, 0);
		const se = bootstrapSe(means);
		const plugIn = Math.sqrt(7 / 8) * (sampleSd(SAMPLE_A) / Math.sqrt(8));
		expect(se).toBeCloseTo(0.93, 1);
		expect(se).toBeCloseTo(plugIn, 1);
	});

	it('gives a percentile 95% interval around 13 to 16.6 for the mean of group A', () => {
		const means = bootstrapMeans(SAMPLE_A, BOOT_B, 0);
		const [lo, hi] = percentileInterval(means, 0.05) ?? [NaN, NaN];
		expect(lo).toBeGreaterThan(12.5);
		expect(lo).toBeLessThan(13.1);
		expect(hi).toBeGreaterThan(16.5);
		expect(hi).toBeLessThan(16.7);
	});
});

describe('percentileInterval', () => {
	it('takes the 2.5% and 97.5% order statistics of a sorted grid', () => {
		const grid = Array.from({ length: 1000 }, (_, i) => i);
		expect(percentileInterval(grid, 0.05)).toEqual([25, 974]);
	});

	it('returns null for an empty input', () => {
		expect(percentileInterval([], 0.05)).toBeNull();
	});
});

describe('histogram', () => {
	it('counts values into bins and drops values outside the range', () => {
		const counts = histogram([0.05, 0.15, 0.16, 0.95, 2], 0, 1, 0.1);
		expect(counts.length).toBe(10);
		expect(counts[0]).toBe(1);
		expect(counts[1]).toBe(2);
		expect(counts[9]).toBe(1);
		expect(counts.reduce((s, c) => s + c, 0)).toBe(4);
	});
});

describe('exact permutation test', () => {
	const pool = pooled(SAMPLE_A, SAMPLE_B);

	it('enumerates C(16, 8) = 12870 relabellings', () => {
		expect(binomial(16, 8)).toBe(12870);
		expect(exactPermutationDiffs(pool, 8).length).toBe(12870);
	});

	it('gives the observed difference for the observed split', () => {
		const inA = Array.from({ length: 8 }, (_, i) => i);
		expect(diffForLabels(pool, inA)).toBeCloseTo(6.125, 10);
	});

	it('gives two-sided p = 22 / 12870 for the chapter example', () => {
		const diffs = exactPermutationDiffs(pool, 8);
		const { count, p } = twoSidedP(diffs, observedDiff(SAMPLE_A, SAMPLE_B));
		expect(count).toBe(22);
		expect(p).toBeCloseTo(22 / 12870, 10);
		expect(p).toBeCloseTo(0.0017, 4);
	});
});

describe('randomLabelsA', () => {
	it('returns nA distinct sorted positions inside 0..N-1', () => {
		const labels = randomLabelsA(mulberry32(7), 16, 8);
		expect(labels.length).toBe(8);
		expect(new Set(labels).size).toBe(8);
		expect([...labels].sort((x, y) => x - y)).toEqual(labels);
		for (const i of labels) {
			expect(i).toBeGreaterThanOrEqual(0);
			expect(i).toBeLessThan(16);
		}
	});
});

describe('bootstrapRun', () => {
	it('gives the same means as bootstrapMeans for the same seed', () => {
		const run = bootstrapRun(SAMPLE_A, 500, 0);
		expect(Array.from(run.means)).toEqual(Array.from(bootstrapMeans(SAMPLE_A, 500, 0)));
	});
});
