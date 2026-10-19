import { describe, expect, it } from 'vitest';
import {
	FORMATS,
	bitsOf,
	formatAt,
	decompose,
	fsum,
	kahanSum,
	machineEpsilon,
	naiveSum,
	relativeRoundingError,
	roundTo,
	softmaxNaive,
	softmaxStable,
	valueOf,
} from './floating-point';

const F16 = formatAt(0);
const BF16 = formatAt(1);
const F32 = formatAt(2);
const F64 = formatAt(3);

/** The sum of 0.1 one million times, as in the chapter. */
const TENTHS = Array.from({ length: 1_000_000 }, () => 0.1);

describe('formats', () => {
	it('gives the machine epsilon values from the chapter table', () => {
		expect(machineEpsilon(F16)).toBe(2 ** -10);
		expect(machineEpsilon(BF16)).toBe(2 ** -7);
		expect(machineEpsilon(F32)).toBe(2 ** -23);
		expect(machineEpsilon(F64)).toBe(2 ** -52);
	});

	it('rounds 0.1 to the nearest value of each format', () => {
		expect(roundTo(0.1, F16)).toBe(0.0999755859375);
		expect(roundTo(0.1, BF16)).toBe(0.10009765625);
		expect(roundTo(0.1, F32)).toBe(Math.fround(0.1));
		expect(roundTo(0.1, F64)).toBe(0.1);
	});

	it('overflows float16 above 65504 to Infinity', () => {
		expect(roundTo(65504, F16)).toBe(65504);
		expect(roundTo(65520, F16)).toBe(Infinity);
	});

	it('keeps the relative rounding error below half the machine epsilon', () => {
		for (const fmt of FORMATS) {
			for (const x of [0.1, 0.2, 0.3, 1000, 12345.678]) {
				expect(Math.abs(relativeRoundingError(x, fmt))).toBeLessThanOrEqual(
					machineEpsilon(fmt) / 2,
				);
			}
		}
	});
});

describe('bit patterns', () => {
	it('encodes 1.0 and 0.1 in float64 with the IEEE layout', () => {
		const one = bitsOf(1, F64);
		expect(one.length).toBe(64);
		expect(one.slice(0, 12).join('')).toBe('0' + '01111111111');
		expect(one.slice(12).every((b) => b === 0)).toBe(true);
		expect(valueOf(bitsOf(0.1, F64), F64)).toBe(0.1);
	});

	it('round-trips every value that is representable in float16', () => {
		for (const x of [0, 1, -2.5, 0.0999755859375, 65504, 2 ** -24, -(2 ** -14)]) {
			expect(valueOf(bitsOf(x, F16), F16)).toBe(x);
		}
	});

	it('gives Infinity and NaN their reserved exponent', () => {
		expect(valueOf(bitsOf(Infinity, F32), F32)).toBe(Infinity);
		expect(Number.isNaN(valueOf(bitsOf(NaN, F32), F32))).toBe(true);
		expect(decompose(bitsOf(-Infinity, F16), F16).kind).toBe('inf');
	});

	it('decomposes 1.5 into sign 0, exponent 0 and significand 1.5', () => {
		const d = decompose(bitsOf(1.5, F32), F32);
		expect(d).toEqual({ kind: 'normal', sign: 0, exponent: 0, significand: 1.5 });
	});

	it('flips the value when the sign bit is clicked', () => {
		const bits = bitsOf(2, F32);
		bits[0] = 1;
		expect(valueOf(bits, F32)).toBe(-2);
	});
});

describe('the four experiments', () => {
	it('gives 0,1 + 0,2 != 0,3 and 1e16 + 1 == 1e16', () => {
		expect(0.1 + 0.2).toBe(0.30000000000000004);
		expect(0.1 + 0.2 === 0.3).toBe(false);
		expect(1e16 + 1).toBe(1e16);
	});

	it('gives the naive sum of a million 0.1 about 1.3e-6 off the exact 100000', () => {
		const naive = naiveSum(TENTHS, F64);
		expect(naive).toBeCloseTo(100000.0000013, 6);
		expect(Math.abs(naive - 100000)).toBeGreaterThan(1e-6);
		expect(Math.abs(naive - 100000)).toBeLessThan(2e-6);
	});

	it('gives exactly 100000 with Kahan and with fsum', () => {
		expect(kahanSum(TENTHS)).toBe(100000);
		expect(fsum(TENTHS)).toBe(100000);
	});

	it('gives a float32 naive sum off by about 1 percent', () => {
		const f32 = naiveSum(TENTHS, F32);
		expect(Math.abs(f32 - 100000) / 100000).toBeGreaterThan(0.005);
	});

	it('gives nan for softmax without the shift and 0,269 / 0,731 with it', () => {
		const naive = softmaxNaive([1000, 1001]);
		expect(naive.some((v) => Number.isNaN(v))).toBe(true);
		const stable = softmaxStable([1000, 1001]);
		expect(stable[0]).toBeCloseTo(0.26894142, 7);
		expect(stable[1]).toBeCloseTo(0.73105858, 7);
	});
});
