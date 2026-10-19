import { describe, expect, it } from 'vitest';
import {
	criticalZ,
	falsePositiveRate,
	mulberry32,
	nullZPaths,
	normCdf,
	normInv,
	power,
	powerCurve,
	sampleSize,
	simulatePeeking,
	snapDelta,
	snapLooks,
	snapSigma,
} from './ab-testing';

describe('normal distribution helpers', () => {
	it('matches known values of the CDF and its inverse', () => {
		expect(normCdf(0)).toBeCloseTo(0.5, 6);
		expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
		expect(normInv(0.975)).toBeCloseTo(1.959964, 4);
		expect(normInv(0.8)).toBeCloseTo(0.841621, 4);
		expect(normCdf(normInv(0.3))).toBeCloseTo(0.3, 6);
	});

	it('gives the two-sided critical value for alpha 0.05 and the Bonferroni value for ten looks', () => {
		expect(criticalZ(0.05)).toBeCloseTo(1.96, 2);
		expect(normInv(1 - 0.05 / 20)).toBeCloseTo(2.81, 2);
	});
});

describe('sampleSize', () => {
	it('gives the sample sizes from the text: delta 0.2 sigma -> 393, delta 0.5 sigma -> 63', () => {
		expect(sampleSize(1, 0.2)).toBe(393);
		expect(sampleSize(1, 0.5)).toBe(63);
	});

	it('gives about 14 130 per group for conversion 10% -> 11% (sigma^2 = p(1-p) = 0.09)', () => {
		const n = sampleSize(Math.sqrt(0.09), 0.01);
		expect(n).toBeGreaterThan(14_100);
		expect(n).toBeLessThan(14_160);
	});

	it('grows as 1/delta^2: halving the effect multiplies the size by about four', () => {
		const big = sampleSize(1, 0.4);
		const small = sampleSize(1, 0.2);
		expect(small / big).toBeGreaterThan(3.9);
		expect(small / big).toBeLessThan(4.1);
	});

	it('rejects non-positive inputs', () => {
		expect(() => sampleSize(0, 0.1)).toThrow();
		expect(() => sampleSize(1, 0)).toThrow();
	});
});

describe('power', () => {
	it('is about 0.8 at the computed sample size', () => {
		const n = sampleSize(1, 0.2);
		expect(power(n, 1, 0.2)).toBeGreaterThan(0.79);
		expect(power(n, 1, 0.2)).toBeLessThan(0.82);
	});

	it('grows with n and with the effect', () => {
		expect(power(200, 1, 0.2)).toBeLessThan(power(400, 1, 0.2));
		expect(power(200, 1, 0.2)).toBeLessThan(power(200, 1, 0.3));
	});

	it('gives a monotone curve from near 0 to near 1', () => {
		const curve = powerCurve(1, 0.2, 1000, 50);
		const powers = curve.map((pt) => pt.power);
		expect(powers[0]).toBeLessThan(0.1);
		expect(powers[powers.length - 1]).toBeGreaterThan(0.99);
		for (let i = 1; i < powers.length; i++) {
			expect(powers[i]).toBeGreaterThanOrEqual(powers[i - 1] ?? 0);
		}
	});
});

describe('peeking simulation', () => {
	it('keeps the usual 5% for a single look, within sampling noise of 8000 runs', () => {
		const { single } = simulatePeeking(10, 1);
		expect(single).toBeGreaterThan(0.04);
		expect(single).toBeLessThan(0.06);
	});

	it('gives about 19% false wins for ten looks without correction', () => {
		const { peeking } = simulatePeeking(10, 1);
		expect(peeking).toBeGreaterThan(0.16);
		expect(peeking).toBeLessThan(0.22);
	});

	it('brings the rate back to at most about 5% with the Bonferroni value', () => {
		const result = simulatePeeking(10, 1);
		expect(result.zBonferroni).toBeCloseTo(2.81, 2);
		expect(result.bonferroni).toBeLessThanOrEqual(0.06);
	});

	it('is deterministic for the same seed and differs for another seed', () => {
		const a = nullZPaths(5, 200, 7);
		const b = nullZPaths(5, 200, 7);
		const c = nullZPaths(5, 200, 8);
		expect(Array.from(a)).toEqual(Array.from(b));
		expect(Array.from(a)).not.toEqual(Array.from(c));
	});

	it('uses the final look for the single rate', () => {
		const paths = nullZPaths(4, 1000, 3);
		const finalOnly = new Float64Array(1000);
		for (let r = 0; r < 1000; r++) finalOnly[r] = paths[r * 4 + 3] ?? 0;
		expect(simulatePeeking(4, 3, 1000).single).toBeCloseTo(
			falsePositiveRate(finalOnly, 1, 1.96),
			10,
		);
	});

	it('produces unit-variance z at each look (the first look is standard normal)', () => {
		const paths = nullZPaths(1, 20_000, 11);
		let sum = 0;
		let sq = 0;
		for (const z of paths) {
			sum += z;
			sq += z * z;
		}
		expect(sum / paths.length).toBeCloseTo(0, 1);
		expect(sq / paths.length).toBeCloseTo(1, 1);
	});
});

describe('mulberry32', () => {
	it('returns values in [0, 1)', () => {
		const rnd = mulberry32(42);
		for (let i = 0; i < 1000; i++) {
			const v = rnd();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('input snapping', () => {
	it('clamps and rounds to the slider steps', () => {
		expect(snapSigma(5)).toBe(2);
		expect(snapSigma(0.34)).toBe(0.3);
		expect(snapDelta(-1)).toBe(0.01);
		expect(snapDelta(0.2049)).toBe(0.2);
		expect(snapLooks(20)).toBe(10);
		expect(snapLooks(0)).toBe(1);
		expect(snapLooks(Number.NaN)).toBe(10);
	});
});
