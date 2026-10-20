import { describe, expect, it } from 'vitest';
import { mulberry32 } from '$lib/prob/rng';
import {
	locationFactor,
	madLimitRatio,
	makeMixture,
	medianFactor,
	scaleFactor,
	scaleLimitRatio,
} from './robust-model';

// Psi / rho helpers written inline: the module under test must not depend on robust-core.
const huberPsi = (c: number) => (u: number) => Math.max(-c, Math.min(c, u));
const huberDpsi = (c: number) => (u: number) => (Math.abs(u) < c ? 1 : 0);
const bisquarePsi = (c: number) => (u: number) => {
	const z = u / c;
	return Math.abs(z) < 1 ? u * (1 - z * z) ** 2 : 0;
};
const bisquareDpsi = (c: number) => (u: number) => {
	const z = u / c;
	return Math.abs(z) < 1 ? (1 - z * z) * (1 - 5 * z * z) : 0;
};
const bisquareRho = (c: number) => (u: number) => {
	const z = u / c;
	return Math.abs(z) < 1 ? 1 - (1 - z * z) ** 3 : 1;
};
const bisquareDrho = (c: number) => (u: number) => {
	const z = u / c;
	return Math.abs(z) < 1 ? ((6 * u) / (c * c)) * (1 - z * z) ** 2 : 0;
};
const clippedRho = (c: number) => (u: number) => Math.min((u / c) ** 2, 1);
const clippedDrho = (c: number) => (u: number) => (Math.abs(u) < c ? (2 * u) / (c * c) : 0);

describe('contaminated mixture: normalisation and tails', () => {
	const m = makeMixture();

	it('matches the notebook constants for eps=0.05, df=3, raw scale 2', () => {
		expect(m.c2).toBeCloseTo(1.55, 9);
		expect(m.usualSd).toBeCloseTo(0.803219, 6);
		expect(m.outlierScale).toBeCloseTo(1.606439, 6);
	});

	it('integrates bounded functions to 1e-6 and agrees with the tail function', () => {
		for (const k of [2, 3, 5]) {
			expect(m.expect((u) => (Math.abs(u) <= k ? 1 : 0))).toBeCloseTo(1 - m.tailProb(k), 6);
		}
		const bounded = m.expect((u) => Math.tanh(u) ** 2);
		expect(bounded).toBeGreaterThan(0);
		expect(bounded).toBeLessThan(1);
	});

	it('evaluates one expectation in under 20 ms', () => {
		const rho = bisquareRho(1.54764);
		m.expect(rho);
		const t0 = performance.now();
		m.expect(rho);
		expect(performance.now() - t0).toBeLessThan(20);
	});

	it('gives the tail probabilities of the notebook', () => {
		expect(m.tailProb(2)).toBeCloseTo(0.027213, 4);
		expect(m.tailProb(3)).toBeCloseTo(0.008111, 4);
		expect(m.tailProb(5)).toBeCloseTo(0.002639, 4);
	});

	it('gives the MAD calibration numbers of the notebook', () => {
		expect(m.quantile(0.75)).toBeCloseTo(0.55858, 4);
		expect(madLimitRatio(m)).toBeCloseTo(0.828151, 4);
	});

	it('gives the bisquare scale calibration b_F and the M-scale limit', () => {
		const rho = bisquareRho(1.54764);
		expect(makeMixture({ eps: 0 }).expect(rho)).toBeCloseTo(0.500001, 5);
		expect(m.expect(rho)).toBeCloseTo(0.426796, 4);
		expect(scaleLimitRatio(m, rho, 0.500001)).toBeCloseTo(0.829914, 4);
	});

	it('has symmetric CDF and CDF(quantile(p)) = p', () => {
		for (const x of [0.1, 0.7, 2.5, 6]) {
			expect(m.cdf(x) + m.cdf(-x)).toBeCloseTo(1, 12);
		}
		for (const p of [0.01, 0.3, 0.5, 0.9, 0.99]) {
			expect(m.cdf(m.quantile(p))).toBeCloseTo(p, 9);
		}
	});

	it('gives a deterministic expectation that handles jump discontinuities', () => {
		// Indicator of u <= 0.5 has a jump inside the integration range.
		expect(m.expect((u) => (u <= 0.5 ? 1 : 0))).toBeCloseTo(m.cdf(0.5), 6);
		expect(m.expect(() => 1)).toBeCloseTo(1, 9);
	});

	it('samples with variance close to 1', () => {
		const xs = m.sample(200000, mulberry32(7));
		let sum = 0;
		let sumSq = 0;
		for (const v of xs) {
			sum += v;
			sumSq += v * v;
		}
		const mean = sum / xs.length;
		const variance = sumSq / xs.length - mean * mean;
		expect(Math.abs(variance - 1)).toBeLessThan(0.03);
	});

	it('shifts and scales samples with sampleX', () => {
		const rng = mulberry32(3);
		const xs = m.sampleX(1000, rng, 2, 3);
		expect(xs.length).toBe(1000);
		const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
		expect(Math.abs(mean - 2)).toBeLessThan(0.6);
	});

	it('rejects invalid parameters', () => {
		expect(() => makeMixture({ df: 2 })).toThrow(RangeError);
		expect(() => makeMixture({ eps: 1 })).toThrow(RangeError);
		expect(() => makeMixture({ eps: -0.1 })).toThrow(RangeError);
	});
});

describe('asymptotic variance factors', () => {
	const m = makeMixture();

	it('gives Huber and bisquare location factors from the notebook', () => {
		expect(locationFactor(m, huberPsi(1.5), huberDpsi(1.5))).toBeCloseTo(0.72445, 4);
		expect(locationFactor(m, huberPsi(0.8), huberDpsi(0.8))).toBeCloseTo(0.769102, 4);
		expect(locationFactor(m, bisquarePsi(4.685), bisquareDpsi(4.685))).toBeCloseTo(0.716601, 4);
		expect(locationFactor(m, bisquarePsi(2.0), bisquareDpsi(2.0))).toBeCloseTo(1.073196, 4);
	});

	it('gives the median factor from the notebook', () => {
		expect(medianFactor(m)).toBeCloseTo(1.07037, 4);
	});

	it('gives the scale factors from the notebook', () => {
		expect(scaleFactor(m, bisquareRho(1.54764), bisquareDrho(1.54764))).toBeCloseTo(0.812193, 4);
		expect(scaleFactor(m, clippedRho(2), clippedDrho(2))).toBeCloseTo(0.635925, 4);
		expect(m.expect(clippedRho(2))).toBeCloseTo(0.173965, 4);
	});

	it('reduces to the normal case when eps = 0', () => {
		const normal = makeMixture({ eps: 0 });
		expect(
			locationFactor(
				normal,
				(u) => u,
				() => 1,
			),
		).toBeCloseTo(1, 9);
		expect(medianFactor(normal)).toBeCloseTo(Math.PI / 2, 6);
	});
});
