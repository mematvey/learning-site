import { describe, expect, it } from 'vitest';
import { rat } from '$lib/prob/rational';
import { clampTrials, formatDecimal, formatFraction } from './format';

describe('formatFraction', () => {
	it('prints a reduced fraction or an integer', () => {
		expect(formatFraction(rat(12n, 17n))).toBe('12/17');
		expect(formatFraction(rat(1n, 34n))).toBe('1/34');
		expect(formatFraction(rat(4n, 2n))).toBe('2');
	});
});

describe('formatDecimal', () => {
	it('rounds to significant digits and drops trailing zeros', () => {
		expect(formatDecimal(rat(12n, 17n))).toBe('0.7059');
		expect(formatDecimal(rat(1n, 34n))).toBe('0.02941');
		expect(formatDecimal(rat(9n, 25n))).toBe('0.36');
		expect(formatDecimal(rat(1n, 1n))).toBe('1');
		expect(formatDecimal(rat(0n, 1n))).toBe('0');
	});

	it('takes the number of digits as argument', () => {
		expect(formatDecimal(rat(2n, 3n), 2)).toBe('0.67');
	});
});

describe('clampTrials', () => {
	it('keeps the value inside the range and falls back to the minimum for NaN', () => {
		expect(clampTrials(10_000)).toBe(10_000);
		expect(clampTrials(5)).toBe(100);
		expect(clampTrials(5_000_000)).toBe(1_000_000);
		expect(clampTrials(Number.NaN)).toBe(100);
		expect(clampTrials(1234.6)).toBe(1235);
	});
});
