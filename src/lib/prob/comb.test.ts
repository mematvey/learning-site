import { describe, expect, it } from 'vitest';
import { factorial, logFactorial, multinomial, nCr, nPr } from './comb';
import { hypergeomAtLeast, hypergeomPmf } from './hypergeom';
import { rat } from './rational';
import { mulberry32, sampleWithoutReplacement, shuffle } from './rng';

describe('combinatorics', () => {
	it('computes small values', () => {
		expect(factorial(0)).toBe(1n);
		expect(factorial(6)).toBe(720n);
		expect(nCr(17, 9)).toBe(24310n);
		expect(nPr(6, 3)).toBe(120n);
		expect(multinomial([3, 2, 1])).toBe(60n);
	});

	it('returns zero for out-of-range arguments', () => {
		expect(nCr(5, -1)).toBe(0n);
		expect(nCr(5, 6)).toBe(0n);
		expect(nPr(3, 4)).toBe(0n);
	});

	it('is exact for large n', () => {
		expect(nCr(100, 50)).toBe(100891344545564193334812497256n);
		expect(nCr(60, 30) * 2n).toBeGreaterThan(0n);
		expect(factorial(30)).toBe(265252859812191058636308480000000n);
	});

	it('logFactorial matches the exact value for moderate n', () => {
		expect(logFactorial(100)).toBeCloseTo(Math.log(Number(factorial(100))), 6);
		expect(logFactorial(1)).toBe(0);
	});

	it('logFactorial is finite for huge n', () => {
		expect(Number.isFinite(logFactorial(10_000_000))).toBe(true);
	});
});

describe('hypergeometric', () => {
	it('pmf at the defaults of task 3 and task 9', () => {
		expect(hypergeomPmf(25, 20, 2, 2)).toEqual(rat(19, 30));
		expect(hypergeomPmf(30, 10, 5, 2)).toEqual(rat(950, 2639));
	});

	it('at least one manager at the defaults of task 9', () => {
		expect(hypergeomAtLeast(30, 10, 5, 1)).toEqual(rat(21167, 23751));
	});

	it('is zero for impossible arguments', () => {
		expect(hypergeomPmf(5, 2, 6, 1)).toEqual(rat(0));
	});
});

describe('rng', () => {
	it('is reproducible and stays in [0, 1)', () => {
		const a = mulberry32(42);
		const b = mulberry32(42);
		for (let i = 0; i < 100; i++) {
			const x = a();
			expect(x).toBe(b());
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThan(1);
		}
	});

	it('shuffle keeps the multiset', () => {
		const arr = [1, 1, 2, 3];
		shuffle(arr, mulberry32(7));
		expect([...arr].sort()).toEqual([1, 1, 2, 3]);
	});

	it('sampleWithoutReplacement returns distinct indices', () => {
		const rng = mulberry32(3);
		for (let t = 0; t < 50; t++) {
			const s = sampleWithoutReplacement(10, 4, rng);
			expect(new Set(s).size).toBe(4);
			expect(s.every((i) => i >= 0 && i < 10)).toBe(true);
		}
		expect(() => sampleWithoutReplacement(3, 4, rng)).toThrow(RangeError);
	});
});
