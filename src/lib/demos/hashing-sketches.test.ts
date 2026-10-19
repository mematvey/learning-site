import { describe, expect, it } from 'vitest';
import {
	DEFAULT_K,
	DEFAULT_M,
	N_ITEMS,
	SET_A,
	SET_B,
	absentKeys,
	binDensity,
	bitsPerElement,
	bloomPositions,
	bloomTheory,
	countMinParams,
	jaccard,
	measureBloom,
	minhashEstimate,
	minhashSignature,
	minhashSpreadMeasured,
	minhashSpreadTheory,
	optimalK,
	probe,
	snapK,
	snapM,
	snapN,
	snapT,
} from './hashing-sketches';

describe('Bloom filter theory', () => {
	it('gives f ≈ 0,0082 for m/n = 10 and k = 7', () => {
		expect(bloomTheory(10 * N_ITEMS, N_ITEMS, 7)).toBeCloseTo(0.0082, 4);
	});

	it('needs about 9,6 bits per element for a 1% false-positive rate', () => {
		expect(bitsPerElement(0.01)).toBeCloseTo(9.6, 1);
	});

	it('takes the optimal k = round(ln2 · m/n), at least 1', () => {
		expect(optimalK(10 * N_ITEMS, N_ITEMS)).toBe(7);
		expect(optimalK(1, 1000)).toBe(1);
	});

	it('gives f = (1/2)^k at the optimal k', () => {
		const m = 10 * N_ITEMS;
		const k = optimalK(m, N_ITEMS);
		expect(bloomTheory(m, N_ITEMS, k)).toBeCloseTo(Math.pow(0.5, k), 2);
	});
});

describe('Bloom filter measurement', () => {
	it('has no false negatives at any setting', () => {
		const cases: [number, number][] = [
			[300, 1],
			[1200, 4],
			[DEFAULT_M, DEFAULT_K],
			[3000, 12],
		];
		for (const [m, k] of cases) {
			expect(measureBloom(m, k).falseNegatives).toBe(0);
		}
	});

	it('measures a false-positive rate close to the theory at m/n = 10, k = 7', () => {
		const r = measureBloom(DEFAULT_M, DEFAULT_K);
		expect(Math.abs(r.fpMeasured - r.fpTheory)).toBeLessThan(0.01);
	});

	it('false-positive rate grows with n at fixed m and k', () => {
		const few = measureBloom(DEFAULT_M, DEFAULT_K, 300);
		const many = measureBloom(DEFAULT_M, DEFAULT_K, 900);
		expect(many.fpMeasured).toBeGreaterThan(few.fpMeasured);
		expect(many.fpTheory).toBeGreaterThan(few.fpTheory);
	});

	it('measured rate follows the theory when n changes', () => {
		const r = measureBloom(DEFAULT_M, DEFAULT_K, 600);
		expect(Math.abs(r.fpMeasured - r.fpTheory)).toBeLessThan(0.02);
		expect(r.falseNegatives).toBe(0);
	});

	it('keeps the measured fill close to 1 - e^{-kn/m}', () => {
		const r = measureBloom(DEFAULT_M, DEFAULT_K);
		expect(Math.abs(r.fillMeasured - r.fillTheory)).toBeLessThan(0.03);
	});

	it('absent keys are distinct and not inserted', () => {
		const absent = absentKeys(50);
		expect(absent).toHaveLength(50);
		expect(new Set(absent).size).toBe(50);
	});

	it('probe reports present only when all positions are set', () => {
		const m = 64;
		const k = 3;
		const bits = new Uint8Array(m);
		const key = 12345;
		const pos = bloomPositions(key, m, k);
		expect(probe(bits, m, k, key).present).toBe(false);
		for (const p of pos) bits[p] = 1;
		expect(probe(bits, m, k, key).present).toBe(true);
	});

	it('binDensity averages set bits over equal ranges', () => {
		const bits = new Uint8Array([1, 1, 0, 0, 1, 0, 0, 0]);
		expect(binDensity(bits, 4)).toEqual([1, 0, 0.5, 0]);
	});
});

describe('Slider snapping', () => {
	it('keeps m on the step grid inside the range', () => {
		expect(snapM(10000)).toBe(3000);
		expect(snapM(0)).toBe(300);
		expect(snapM(Number.NaN)).toBe(3000);
		expect(snapM(1000)).toBe(1020);
	});

	it('keeps n on the step grid of 50 inside [50, 1000]', () => {
		expect(snapN(10)).toBe(50);
		expect(snapN(5000)).toBe(1000);
		expect(snapN(320)).toBe(300);
		expect(snapN(Number.NaN)).toBe(N_ITEMS);
	});

	it('clamps k and t and falls back on non-finite input', () => {
		expect(snapK(0)).toBe(1);
		expect(snapK(99)).toBe(12);
		expect(snapK(Number.NaN)).toBe(DEFAULT_K);
		expect(snapT(0)).toBe(1);
		expect(snapT(500)).toBe(200);
	});
});

describe('MinHash', () => {
	it('computes the exact Jaccard index 1/3 for the demo sets', () => {
		expect(jaccard(SET_A, SET_B)).toBeCloseTo(1 / 3, 10);
	});

	it('estimate is the share of equal positions and lies in [0, 1]', () => {
		const t = 50;
		const e = minhashEstimate(minhashSignature(SET_A, t, 1), minhashSignature(SET_B, t, 1));
		expect(e).toBeGreaterThanOrEqual(0);
		expect(e).toBeLessThanOrEqual(1);
	});

	it('identical sets give estimate 1', () => {
		expect(minhashEstimate(minhashSignature(SET_A, 40, 2), minhashSignature(SET_A, 40, 2))).toBe(1);
	});

	it('theoretical spread for J = 1/3 and t = 100 is about 0,047', () => {
		expect(minhashSpreadTheory(1 / 3, 100)).toBeCloseTo(0.047, 3);
	});

	it('measured spread at t = 100 is close to the theory', () => {
		const measured = minhashSpreadMeasured(100, 200);
		expect(Math.abs(measured - minhashSpreadTheory(1 / 3, 100))).toBeLessThan(0.01);
	});
});

describe('Count-Min parameters', () => {
	it('gives w = 272, d = 5, 1360 counters for eps = delta = 0,01', () => {
		expect(countMinParams(0.01, 0.01)).toEqual({ w: 272, d: 5, counters: 1360 });
	});
});
