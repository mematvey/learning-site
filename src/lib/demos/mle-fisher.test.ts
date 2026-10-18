import { describe, expect, it } from 'vitest';
import {
	clampN,
	clampS,
	curvature,
	curve,
	describeFisher,
	fisherPerObs,
	gaussianApprox,
	logLik,
	mle,
	nForHalfSE,
	relLik,
	standardError,
	waldInterval,
} from './mle-fisher';

describe('maximum likelihood for Bernoulli data', () => {
	it('the MLE is the sample share, 49/80 = 0.6125 from the chapter', () => {
		expect(mle(49, 80)).toBeCloseTo(0.6125, 10);
	});

	it('the log-likelihood is largest at p̂', () => {
		const phat = mle(49, 80);
		for (const p of [0.3, 0.5, 0.55, 0.7, 0.9]) {
			expect(logLik(p, 49, 80)).toBeLessThan(logLik(phat, 49, 80));
		}
	});

	it('the normalised likelihood equals 1 at p̂ and is below 1 elsewhere', () => {
		expect(relLik(mle(49, 80), 49, 80)).toBeCloseTo(1, 12);
		expect(relLik(0.5, 49, 80)).toBeLessThan(1);
	});
});

describe('curvature and standard error', () => {
	it('the Fisher information of one observation is 1 / (p(1 - p))', () => {
		expect(fisherPerObs(0.5)).toBeCloseTo(4, 10);
	});

	it('curvature at the maximum equals n times Fisher information at p̂', () => {
		const n = 80;
		const phat = 49 / 80;
		expect(curvature(49, 80)).toBeCloseTo(n * fisherPerObs(phat), 8);
	});

	it('SE for 49 of 80 is about 0.054 and equals sqrt(p̂(1 - p̂)/n)', () => {
		const se = standardError(49, 80);
		expect(se).toBeCloseTo(0.054, 3);
		expect(se).toBeCloseTo(Math.sqrt((0.6125 * 0.3875) / 80), 12);
	});

	it('SE for 6 of 8 is about 0.153, as in the chapter note', () => {
		expect(standardError(6, 8)).toBeCloseTo(0.153, 3);
	});

	it('SE falls as 1/sqrt(n): four times the data halves the error', () => {
		expect(standardError(196, 320)).toBeCloseTo(standardError(49, 80) / 2, 10);
	});

	it('nForHalfSE gives 4n', () => {
		expect(nForHalfSE(80)).toBe(320);
	});
});

describe('Wald interval', () => {
	it('for 49 of 80 gives about [0.506; 0.719], as in the chapter', () => {
		const [lo, hi] = waldInterval(49, 80);
		expect(lo).toBeCloseTo(0.506, 3);
		expect(hi).toBeCloseTo(0.719, 3);
	});

	it('is centred on p̂', () => {
		const [lo, hi] = waldInterval(6, 8);
		expect((lo + hi) / 2).toBeCloseTo(0.75, 10);
	});
});

describe('Gaussian approximation', () => {
	it('is 1 at p̂ and about exp(-1/2) at one SE away', () => {
		const phat = mle(49, 80);
		const se = standardError(49, 80);
		expect(gaussianApprox(phat, 49, 80)).toBeCloseTo(1, 12);
		expect(gaussianApprox(phat + se, 49, 80)).toBeCloseTo(Math.exp(-0.5), 10);
	});

	it('is close to the exact curve near p̂ for large n', () => {
		const pts = curve(490, 800);
		const near = pts.filter((q) => Math.abs(q.p - 0.6125) < 0.02);
		for (const q of near) expect(Math.abs(q.exact - q.approx)).toBeLessThan(0.02);
	});
});

describe('curve and clamping', () => {
	it('the grid stays strictly inside (0, 1)', () => {
		const pts = curve(49, 80);
		expect(Math.min(...pts.map((q) => q.p))).toBeGreaterThan(0);
		expect(Math.max(...pts.map((q) => q.p))).toBeLessThan(1);
	});

	it('clampS keeps 1 <= s <= n - 1 so the maximum is never on the boundary', () => {
		expect(clampS(0, 8)).toBe(1);
		expect(clampS(8, 8)).toBe(7);
		expect(clampS(6, 8)).toBe(6);
	});

	it('clampN rounds and clamps to the slider range', () => {
		expect(clampN(1)).toBe(2);
		expect(clampN(500)).toBe(200);
		expect(clampN(Number.NaN)).toBe(80);
	});
});

describe('description', () => {
	it('contains the computed numbers in Russian decimal form', () => {
		const text = describeFisher(49, 80);
		expect(text).toContain('0,6125');
		expect(text).toContain('SE = 0,054');
		expect(text).toContain('[0,506; 0,719]');
	});
});
