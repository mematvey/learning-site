import { describe, expect, it } from 'vitest';
import { add, div, formatRational, fromDecimal, gcd, mul, rat, sub, toNumber } from './rational';

describe('rat', () => {
	it('reduces by gcd and keeps the denominator positive', () => {
		expect(rat(6, -8)).toEqual({ num: -3n, den: 4n });
		expect(rat(0, 7)).toEqual({ num: 0n, den: 1n });
		expect(rat(10n, 4n)).toEqual({ num: 5n, den: 2n });
	});

	it('rejects a zero denominator', () => {
		expect(() => rat(1, 0)).toThrow(RangeError);
	});
});

describe('arithmetic', () => {
	it('adds, subtracts, multiplies and divides exactly', () => {
		const a = rat(1, 3);
		const b = rat(1, 6);
		expect(add(a, b)).toEqual(rat(1, 2));
		expect(sub(a, b)).toEqual(rat(1, 6));
		expect(mul(a, b)).toEqual(rat(1, 18));
		expect(div(a, b)).toEqual(rat(2));
	});

	it('refuses division by zero', () => {
		expect(() => div(rat(1, 2), rat(0))).toThrow(RangeError);
	});

	it('gcd ignores signs', () => {
		expect(gcd(-12n, 18n)).toBe(6n);
		expect(gcd(0n, 5n)).toBe(5n);
	});
});

describe('toNumber and formatRational', () => {
	it('converts ordinary fractions', () => {
		expect(toNumber(rat(13, 25))).toBeCloseTo(0.52, 15);
		expect(toNumber(rat(-1, 4))).toBe(-0.25);
		expect(toNumber(rat(0))).toBe(0);
	});

	it('stays accurate for huge numerators and denominators', () => {
		const huge = rat(10n ** 300n + 1n, 10n ** 300n);
		expect(toNumber(huge)).toBeCloseTo(1, 15);
		expect(toNumber(rat(1, 2n ** 1000n))).toBeCloseTo(2 ** -1000, 300);
	});

	it('formats as a/b or as an integer', () => {
		expect(formatRational(rat(5, 204))).toBe('5/204');
		expect(formatRational(rat(4, 2))).toBe('2');
	});
});

describe('fromDecimal', () => {
	it('turns decimals into exact fractions', () => {
		expect(fromDecimal(0.3)).toEqual(rat(3, 10));
		expect(fromDecimal(0.12)).toEqual(rat(3, 25));
		expect(fromDecimal(-0.5)).toEqual(rat(-1, 2));
		expect(fromDecimal(1)).toEqual(rat(1));
	});

	it('rounds to the given number of places', () => {
		expect(fromDecimal(0.1234567, 2)).toEqual(rat(12, 100));
	});

	it('rejects non-finite input', () => {
		expect(() => fromDecimal(Number.NaN)).toThrow(RangeError);
		expect(() => fromDecimal(Infinity)).toThrow(RangeError);
	});
});
