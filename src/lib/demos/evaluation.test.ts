import { describe, expect, it } from 'vitest';
import {
	accuracyCi,
	accuracySe,
	describeState,
	expectedCounts,
	fmt,
	intervalsOverlap,
	pairedSe,
	sampleCounts,
	scaleX,
	snapN,
	snapSeed,
	summarize,
	unpairedSe,
	verdictOf,
} from './evaluation';

/** The example of the chapter: 100 examples, A right in 80, B right in 76, paired b = 7, c = 3. */
const chapter100 = { n: 100, both: 73, onlyA: 7, onlyB: 3, neither: 17 };

describe('expected composition', () => {
	it('gives the chapter example for n = 100', () => {
		expect(expectedCounts(100)).toEqual(chapter100);
	});

	it('always sums to n and keeps accuracies 0.80 and 0.76', () => {
		for (const n of [100, 400, 1000]) {
			const c = expectedCounts(n);
			expect(c.both + c.onlyA + c.onlyB + c.neither).toBe(n);
			const s = summarize(c);
			expect(s.accA).toBeCloseTo(0.8, 10);
			expect(s.accB).toBeCloseTo(0.76, 10);
		}
	});
});

describe('accuracy intervals', () => {
	it('standard errors for n = 100 / 400 / 1000 match the chapter table', () => {
		expect(accuracySe(0.8, 100)).toBeCloseTo(0.04, 10);
		expect(accuracySe(0.8, 400)).toBeCloseTo(0.02, 10);
		expect(accuracySe(0.8, 1000)).toBeCloseTo(0.013, 3);
	});

	it('95 % intervals for p = 0.8 match the chapter table', () => {
		const [lo100, hi100] = accuracyCi(0.8, 100);
		expect(lo100).toBeCloseTo(0.722, 3);
		expect(hi100).toBeCloseTo(0.878, 3);
		const [lo400, hi400] = accuracyCi(0.8, 400);
		expect(lo400).toBeCloseTo(0.761, 3);
		expect(hi400).toBeCloseTo(0.839, 3);
		const [lo1000, hi1000] = accuracyCi(0.8, 1000);
		expect(lo1000).toBeCloseTo(0.775, 3);
		expect(hi1000).toBeCloseTo(0.825, 3);
	});

	it('the interval narrows as n grows', () => {
		const w = (n: number) => {
			const [lo, hi] = accuracyCi(0.8, n);
			return hi - lo;
		};
		expect(w(1000)).toBeLessThan(w(400));
		expect(w(400)).toBeLessThan(w(100));
	});

	it('clips intervals to [0, 1]', () => {
		const [lo, hi] = accuracyCi(0.99, 50);
		expect(lo).toBeGreaterThanOrEqual(0);
		expect(hi).toBeLessThanOrEqual(1);
	});
});

describe('difference of two models', () => {
	it('paired SE is about 0.031 and unpaired SE about 0.059 for b = 7, c = 3', () => {
		expect(pairedSe(7, 3, 100)).toBeCloseTo(0.031, 3);
		expect(unpairedSe(0.8, 0.76, 100)).toBeCloseTo(0.059, 3);
	});

	it('paired SE is not larger than unpaired SE on the same data', () => {
		const s = summarize(chapter100);
		expect(s.pairedSe).toBeLessThanOrEqual(s.unpairedSe);
	});

	it('difference is 0.04 and the ratio to the paired SE is about 1.3', () => {
		const s = summarize(chapter100);
		expect(s.diff).toBeCloseTo(0.04, 10);
		expect(s.ratio).toBeCloseTo(1.3, 1);
	});

	it('paired interval for the chapter example is about [-0.02, 0.10] and includes zero', () => {
		const s = summarize(chapter100);
		expect(s.pairedCi[0]).toBeCloseTo(-0.02, 2);
		expect(s.pairedCi[1]).toBeCloseTo(0.1, 2);
		expect(verdictOf(s)).toBe('includesZero');
	});

	it('the unpaired interval is wider than the paired one', () => {
		const s = summarize(chapter100);
		expect(s.unpairedCi[1] - s.unpairedCi[0]).toBeGreaterThan(s.pairedCi[1] - s.pairedCi[0]);
	});

	it('with n = 1000 the paired interval no longer contains zero', () => {
		const s = summarize(expectedCounts(1000));
		expect(s.pairedCi[0]).toBeGreaterThan(0);
		expect(verdictOf(s)).toBe('aBetter');
	});

	it('a set with more discordant pairs for B gives a negative verdict', () => {
		const s = summarize({ n: 1000, both: 700, onlyA: 30, onlyB: 90, neither: 180 });
		expect(s.diff).toBeLessThan(0);
		expect(verdictOf(s)).toBe('bBetter');
	});

	it('handles zero discordant pairs without NaN', () => {
		const s = summarize({ n: 100, both: 80, onlyA: 0, onlyB: 0, neither: 20 });
		expect(s.pairedSe).toBe(0);
		expect(s.ratio).toBe(0);
		expect(Number.isNaN(s.pairedCi[0])).toBe(false);
	});
});

describe('sampling with a seed', () => {
	it('the same seed gives the same set', () => {
		expect(sampleCounts(400, 7)).toEqual(sampleCounts(400, 7));
	});

	it('different seeds give different sets', () => {
		expect(sampleCounts(400, 1)).not.toEqual(sampleCounts(400, 2));
	});

	it('every drawn set sums to n', () => {
		for (let seed = 0; seed < 20; seed++) {
			const c = sampleCounts(100, seed);
			expect(c.both + c.onlyA + c.onlyB + c.neither).toBe(100);
		}
	});

	it('averaged over many large sets, the difference is close to 0.04', () => {
		let total = 0;
		const runs = 100;
		for (let seed = 0; seed < runs; seed++) total += summarize(sampleCounts(1000, seed)).diff;
		expect(total / runs).toBeCloseTo(0.04, 1);
	});
});

describe('helpers', () => {
	it('snapN rounds to steps of 50 and clamps to [100, 1000]', () => {
		expect(snapN(100)).toBe(100);
		expect(snapN(130)).toBe(150);
		expect(snapN(10)).toBe(100);
		expect(snapN(5000)).toBe(1000);
		expect(snapN(Number.NaN)).toBe(100);
	});

	it('snapSeed keeps null and non-negative integers', () => {
		expect(snapSeed(null)).toBeNull();
		expect(snapSeed(3.7)).toBe(3);
		expect(snapSeed(-2)).toBe(0);
		expect(snapSeed(Number.NaN)).toBeNull();
	});

	it('scaleX maps the domain ends to the pixel ends and clamps outside', () => {
		expect(scaleX(0.5, [0.5, 1], 10, 110)).toBe(10);
		expect(scaleX(1, [0.5, 1], 10, 110)).toBe(110);
		expect(scaleX(2, [0.5, 1], 10, 110)).toBe(110);
	});

	it('intervalsOverlap detects touching and separated intervals', () => {
		expect(intervalsOverlap([0.7, 0.8], [0.75, 0.9])).toBe(true);
		expect(intervalsOverlap([0.7, 0.8], [0.81, 0.9])).toBe(false);
	});

	it('fmt uses a decimal comma and a true minus sign', () => {
		expect(fmt(0.04)).toBe('0,04');
		expect(fmt(-0.02)).toBe('−0,02');
	});

	it('describeState names the verdict and the set size', () => {
		const text = describeState(chapter100, summarize(chapter100));
		expect(text).toContain('100 примеров');
		expect(text).toContain('включает ноль');
	});
});
