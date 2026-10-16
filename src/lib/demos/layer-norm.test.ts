import { describe, expect, it } from 'vitest';
import {
	barLayout,
	describeNorm,
	domainMax,
	layerNorm,
	makeToken,
	mean,
	normalize,
	rms,
	rmsNorm,
	snapBeta,
	snapGamma,
	variance,
	vectorStats,
} from './layer-norm';

const x = makeToken();

describe('layerNorm', () => {
	it('gives mean about 0 and variance about 1 over the feature axis with gamma 1, beta 0', () => {
		const y = layerNorm(x, 1, 0);
		expect(mean(y)).toBeCloseTo(0, 10);
		expect(variance(y)).toBeCloseTo(1, 3);
	});

	it('gamma sets the standard deviation and beta sets the mean of the output', () => {
		const y = layerNorm(x, 2.5, -1.5);
		expect(mean(y)).toBeCloseTo(-1.5, 10);
		expect(Math.sqrt(variance(y))).toBeCloseTo(2.5, 3);
	});

	it('a constant input gives beta at every feature (no division by zero thanks to eps)', () => {
		const y = layerNorm([3, 3, 3, 3], 1.7, 0.4);
		for (const v of y) expect(v).toBeCloseTo(0.4, 12);
		expect(y.every(Number.isFinite)).toBe(true);
	});

	it('is stable for a large common offset (two-pass variance)', () => {
		const shifted = x.map((v) => v + 1e6);
		const a = layerNorm(x, 1, 0);
		const b = layerNorm(shifted, 1, 0);
		a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 4));
	});
});

describe('rmsNorm', () => {
	it('gives root mean square about 1 with gamma 1 and does not centre the vector', () => {
		const y = rmsNorm(x, 1);
		expect(rms(y)).toBeCloseTo(1, 3);
		expect(Math.abs(mean(y))).toBeGreaterThan(1e-3);
	});

	it('gamma scales the output and a zero vector stays finite thanks to eps', () => {
		const y = rmsNorm(x, 3);
		expect(rms(y)).toBeCloseTo(3, 3);
		const zero = rmsNorm([0, 0, 0], 1);
		expect(zero.every((v) => v === 0)).toBe(true);
	});
});

describe('normalize and helpers', () => {
	it('RMSNorm ignores beta', () => {
		expect(normalize('rms', x, 1, 1.5)).toEqual(normalize('rms', x, 1, -0.5));
	});

	it('makeToken is deterministic and contains one clear outlier', () => {
		expect(makeToken()).toEqual(x);
		const sorted = [...x].sort((a, b) => b - a);
		expect(x[5]).toBe(sorted[0]);
	});

	it('vectorStats matches the direct formulas', () => {
		const s = vectorStats([1, 2, 3, 4]);
		expect(s.mean).toBeCloseTo(2.5, 12);
		expect(s.std).toBeCloseTo(Math.sqrt(1.25), 12);
		expect(s.rms).toBeCloseTo(Math.sqrt(7.5), 12);
	});

	it('snapGamma and snapBeta clamp and round to the slider steps', () => {
		expect(snapGamma(0)).toBe(0.2);
		expect(snapGamma(9)).toBe(3);
		expect(snapGamma(1.04)).toBe(1);
		expect(snapBeta(-7)).toBe(-2);
		expect(snapBeta(0.26)).toBe(0.3);
		expect(snapBeta(Number.NaN)).toBe(0);
	});

	it('domainMax covers all values and never drops below 1', () => {
		expect(domainMax([0.1, -0.2])).toBe(1);
		expect(domainMax([4], [-5])).toBeCloseTo(5 * 1.12, 12);
	});

	it('barLayout puts zero in the middle and bar heights follow |value|', () => {
		const layout = barLayout([1, -2], 100, 2);
		expect(layout.zeroY).toBeCloseTo(10 + (170 - 10 - 24) / 2, 12);
		const [a, b] = layout.bars;
		expect(a?.h).toBeCloseTo(1 * layout.scale, 12);
		expect(b?.h).toBeCloseTo(2 * layout.scale, 12);
		expect(a?.y).toBeLessThan(layout.zeroY);
		expect(b?.y).toBe(layout.zeroY);
	});

	it('describeNorm quotes the computed statistics', () => {
		const y = layerNorm(x, 2, 0.5);
		expect(describeNorm('layer', x, y, 2, 0.5)).toContain('равно β = 0.5');
		expect(describeNorm('rms', x, rmsNorm(x, 2), 2, 0.5)).toContain('RMS = 2.00');
	});
});
