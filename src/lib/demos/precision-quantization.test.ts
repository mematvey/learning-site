import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	FORMATS,
	VECTOR_N,
	bitPattern,
	bitString,
	formatNumber,
	makeVector,
	parseDecimal,
	quantTable,
	quantizeSymmetric,
	relativeError,
	roundToFormat,
	roundingReport,
	sanitizeState,
	seededRandom,
	unitRoundoff,
} from './precision-quantization';

describe('format limits', () => {
	it('gives the known maximum values', () => {
		expect(FORMATS.fp16.maxFinite).toBe(65504);
		expect(FORMATS.e4m3.maxFinite).toBe(448);
		expect(FORMATS.e5m2.maxFinite).toBe(57344);
		expect(FORMATS.bf16.maxFinite).toBeCloseTo(3.39e38, -36);
		expect(FORMATS.fp32.maxFinite).toBeCloseTo(3.4028234663852886e38, -30);
	});

	it('gives the unit roundoff 2^-(m+1)', () => {
		expect(unitRoundoff(FORMATS.fp16)).toBeCloseTo(4.88e-4, 5);
		expect(unitRoundoff(FORMATS.bf16)).toBeCloseTo(3.9e-3, 4);
	});
});

describe('roundToFormat', () => {
	it('rounds 1000.7 to 1000.5 in fp16 and to 1000 in bf16', () => {
		expect(roundToFormat(1000.7, FORMATS.fp16)).toBe(1000.5);
		expect(roundToFormat(1000.7, FORMATS.bf16)).toBe(1000);
	});

	it('overflows 70000 to infinity in fp16 but keeps it finite in bf16', () => {
		expect(roundToFormat(70000, FORMATS.fp16)).toBe(Infinity);
		expect(roundToFormat(70000, FORMATS.bf16)).toBe(70144);
	});

	it('switches to infinity only past the halfway point above the maximum', () => {
		expect(roundToFormat(65519, FORMATS.fp16)).toBe(65504);
		expect(roundToFormat(65520, FORMATS.fp16)).toBe(Infinity);
	});

	it('rounds ties to the even mantissa', () => {
		// Halfway between 1 and 1 + 2^-10 in fp16: the even neighbour is 1.
		expect(roundToFormat(1 + 2 ** -11, FORMATS.fp16)).toBe(1);
		// Halfway between 1 + 2^-10 and 1 + 2^-9: the even neighbour is 1 + 2^-9.
		expect(roundToFormat(1 + 3 * 2 ** -11, FORMATS.fp16)).toBe(1 + 2 ** -9);
	});

	it('gives subnormal numbers with fixed spacing 2^-24 in fp16', () => {
		const r = roundToFormat(1e-6, FORMATS.fp16);
		expect(r).toBe(17 * 2 ** -24);
		expect(roundToFormat(1e-9, FORMATS.fp16)).toBe(0);
	});

	it('makes E4M3 overflow into NaN and E5M2 into infinity', () => {
		expect(roundToFormat(1000, FORMATS.e4m3)).toBeNaN();
		expect(roundToFormat(1000, FORMATS.e5m2)).toBe(1024);
		expect(roundToFormat(70000, FORMATS.e5m2)).toBe(Infinity);
		expect(roundToFormat(3.2, FORMATS.e4m3)).toBe(3.25);
		expect(roundToFormat(3.2, FORMATS.e5m2)).toBe(3);
	});

	it('keeps the sign and special values', () => {
		expect(roundToFormat(-1000.7, FORMATS.fp16)).toBe(-1000.5);
		expect(roundToFormat(-Infinity, FORMATS.fp16)).toBe(-Infinity);
		expect(roundToFormat(Infinity, FORMATS.e4m3)).toBeNaN();
		expect(roundToFormat(NaN, FORMATS.bf16)).toBeNaN();
		expect(roundToFormat(0, FORMATS.bf16)).toBe(0);
	});

	it('matches Math.fround for fp32 on a sample of values', () => {
		const rnd = seededRandom(7);
		for (let i = 0; i < 2000; i++) {
			const x = (rnd() - 0.5) * 10 ** Math.floor(rnd() * 60 - 30);
			expect(roundToFormat(x, FORMATS.fp32)).toBe(Math.fround(x));
		}
	});

	it('keeps the relative error within the unit roundoff for normal numbers', () => {
		const rnd = seededRandom(11);
		for (const fmt of [FORMATS.fp16, FORMATS.bf16, FORMATS.e5m2]) {
			for (let i = 0; i < 500; i++) {
				const x = 1 + rnd() * 1000;
				const rel = Math.abs(roundToFormat(x, fmt) - x) / x;
				expect(rel).toBeLessThanOrEqual(unitRoundoff(fmt) + 1e-15);
			}
		}
	});
});

describe('bit layout', () => {
	it('gives the fp32 pattern of 1.0 and -2 in fp16', () => {
		expect(bitString(bitPattern(1, FORMATS.fp32), FORMATS.fp32)).toBe(
			'0' + '01111111' + '0'.repeat(23),
		);
		expect(bitString(bitPattern(-2, FORMATS.fp16), FORMATS.fp16)).toBe(
			'1' + '10000' + '0'.repeat(10),
		);
	});

	it('gives the bits of 1000,5 in fp16', () => {
		expect(bitString(bitPattern(1000.5, FORMATS.fp16), FORMATS.fp16)).toBe('0110001111010001');
	});

	it('gives the largest finite codes of E4M3 and E5M2', () => {
		expect(bitString(bitPattern(448, FORMATS.e4m3), FORMATS.e4m3)).toBe('01111110');
		expect(bitString(bitPattern(57344, FORMATS.e5m2), FORMATS.e5m2)).toBe('01111011');
	});

	it('gives the reserved NaN and infinity codes', () => {
		expect(bitString(bitPattern(NaN, FORMATS.e4m3), FORMATS.e4m3)).toBe('01111111');
		expect(bitString(bitPattern(Infinity, FORMATS.fp16), FORMATS.fp16)).toBe('0111110000000000');
	});

	it('reports overflow and the error of a rounding', () => {
		const r = roundingReport(70000, FORMATS.fp16);
		expect(r.overflow).toBe(true);
		const b = roundingReport(1000.7, FORMATS.bf16);
		expect(b.overflow).toBe(false);
		expect(b.absError).toBeCloseTo(0.7, 6);
		expect(b.relError).toBeCloseTo(0.7 / 1000.7, 6);
	});
});

describe('integer quantization', () => {
	it('uses the scale max|x| / (2^(b-1) - 1)', () => {
		// s = 1/127; 0.5 / s = 63.5 rounds to the even 64.
		const out = quantizeSymmetric([1, -1, 0.5], 8, 'tensor');
		expect(out[0]).toBeCloseTo(1, 12);
		expect(out[1]).toBeCloseTo(-1, 12);
		expect(out[2]).toBeCloseTo(64 / 127, 12);
	});

	it('keeps values within the int4 range -7..7', () => {
		const out = quantizeSymmetric([7, 3.5, -7, 0], 4, 'tensor');
		expect(out).toEqual([7, 4, -7, 0]);
	});

	it('gives all-zero output for an all-zero input', () => {
		expect(quantizeSymmetric([0, 0, 0], 4, 32)).toEqual([0, 0, 0]);
	});

	it('gives each group its own scale', () => {
		// The first 32 values are small, the next 32 contain one large value.
		const xs = [...Array<number>(32).fill(0.1), ...Array<number>(32).fill(0.1)];
		xs[40] = 10;
		const one = relativeError(xs, quantizeSymmetric(xs, 4, 'tensor'));
		const grouped = relativeError(xs, quantizeSymmetric(xs, 4, 32));
		expect(grouped).toBeLessThan(one);
	});

	it('gives a deterministic vector with outliers at every 256th index', () => {
		const a = makeVector();
		const b = makeVector();
		expect(a).toEqual(b);
		expect(a.length).toBe(VECTOR_N);
		expect(Math.abs(a[0] ?? 0)).toBeGreaterThan(5);
		expect(Math.abs(a[1] ?? 0)).toBeLessThan(5);
	});

	it('orders the errors: one scale int4 is worst, int8 with groups is best', () => {
		const table = quantTable(makeVector());
		const err = (bits: number, group: string | number): number =>
			table.find((r) => r.bits === bits && r.group === group)?.error ?? NaN;
		expect(err(4, 'tensor')).toBeGreaterThan(err(4, 32));
		expect(err(4, 32)).toBeGreaterThan(err(8, 32));
		expect(err(8, 32)).toBeLessThan(0.02);
		expect(err(4, 'tensor')).toBeGreaterThan(0.6);
	});
});

describe('parseDecimal and sanitizeState', () => {
	it('accepts a decimal comma, a dot and exponent form, and rejects text', () => {
		expect(parseDecimal('1000,7')).toBe(1000.7);
		expect(parseDecimal('1000.7')).toBe(1000.7);
		expect(parseDecimal('1e-6')).toBe(1e-6);
		expect(parseDecimal('')).toBeNaN();
		expect(parseDecimal('12abc')).toBeNaN();
	});

	it('replaces invalid fields with defaults', () => {
		expect(sanitizeState({ format: 'nope' as never, value: NaN, intBits: 2 as never })).toEqual(
			DEFAULT_STATE,
		);
		expect(sanitizeState({ format: 'bf16', value: 70000, group: 32 })).toEqual({
			format: 'bf16',
			value: 70000,
			intBits: 4,
			group: 32,
		});
	});
});

describe('formatNumber', () => {
	it('uses a decimal comma for moderate values and exponent form for extreme ones', () => {
		expect(formatNumber(1000.5)).toBe('1000,5');
		expect(formatNumber(0.25)).toBe('0,25');
		expect(formatNumber(70000)).toBe('70000');
		expect(formatNumber(1e6)).toBe('1.000 · 10^6');
		expect(formatNumber(Infinity)).toBe('∞');
		expect(formatNumber(NaN)).toBe('NaN');
	});
});
