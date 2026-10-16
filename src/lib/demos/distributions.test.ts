import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	NORM_AXIS,
	binomBars,
	binomPmf,
	binomSegmentProb,
	describeBinomial,
	describeNormal,
	describePoisson,
	formatNumber,
	mergeState,
	normalCurve,
	normalPdf,
	normalSegmentProb,
	poissonAxisMax,
	poissonBars,
	poissonPmf,
	poissonSegmentProb,
} from './distributions';

describe('binomPmf', () => {
	it('gives 252/1024 for n = 10, p = 1/2, k = 5 (chapter value 0,246)', () => {
		expect(binomPmf(10, 0.5, 5)).toBeCloseTo(252 / 1024, 12);
		expect(formatNumber(binomPmf(10, 0.5, 5), 3)).toBe('0,246');
	});

	it('sums to one over k = 0..n', () => {
		for (const [n, p] of [
			[1, 0.3],
			[10, 0.5],
			[40, 0.07],
			[25, 0.93],
		] as const) {
			let s = 0;
			for (let k = 0; k <= n; k++) s += binomPmf(n, p, k);
			expect(s).toBeCloseTo(1, 10);
		}
	});

	it('is zero outside 0..n and for non-integer k', () => {
		expect(binomPmf(10, 0.5, -1)).toBe(0);
		expect(binomPmf(10, 0.5, 11)).toBe(0);
		expect(binomPmf(10, 0.5, 2.5)).toBe(0);
	});

	it('handles the boundary probabilities p = 0 and p = 1', () => {
		expect(binomPmf(5, 0, 0)).toBe(1);
		expect(binomPmf(5, 0, 1)).toBe(0);
		expect(binomPmf(5, 1, 5)).toBe(1);
		expect(binomPmf(5, 1, 4)).toBe(0);
	});
});

describe('poissonPmf', () => {
	it('gives e^-3 for lambda = 3, k = 0 (chapter value 0,050)', () => {
		expect(poissonPmf(3, 0)).toBeCloseTo(Math.exp(-3), 12);
		expect(formatNumber(poissonPmf(3, 0), 3)).toBe('0,050');
	});

	it('sums to one over a long enough range', () => {
		let s = 0;
		for (let k = 0; k <= 80; k++) s += poissonPmf(3, k);
		expect(s).toBeCloseTo(1, 12);
	});

	it('is zero for negative or non-integer k', () => {
		expect(poissonPmf(3, -1)).toBe(0);
		expect(poissonPmf(3, 1.5)).toBe(0);
	});
});

describe('normalPdf and normal segments', () => {
	it('peaks at mu with height 1 / (sigma sqrt(2 pi))', () => {
		expect(normalPdf(0, 0, 1)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 12);
		expect(normalPdf(0, 0, 2)).toBeCloseTo(1 / (2 * Math.sqrt(2 * Math.PI)), 12);
	});

	it('gives P(-1 <= X <= 1) = 0,683 for the standard normal', () => {
		expect(normalSegmentProb(0, 1, -1, 1)).toBeCloseTo(0.682689, 5);
		expect(formatNumber(normalSegmentProb(0, 1, -1, 1), 3)).toBe('0,683');
	});

	it('integrates to one over a wide segment, also for a small sigma', () => {
		expect(normalSegmentProb(0, 1, -10, 10)).toBeCloseTo(1, 6);
		expect(normalSegmentProb(2, 0.2, -10, 10)).toBeCloseTo(1, 6);
	});

	it('is zero for an empty or reversed segment and for a non-positive sigma', () => {
		expect(normalSegmentProb(0, 1, 1, 1)).toBe(0);
		expect(normalSegmentProb(0, 1, 2, -2)).toBe(0);
		expect(normalSegmentProb(0, 0, -1, 1)).toBe(0);
	});
});

describe('segment probabilities', () => {
	it('binomial segment is the sum of its PMF values, clipped to 0..n', () => {
		expect(binomSegmentProb(10, 0.5, 5, 5)).toBeCloseTo(binomPmf(10, 0.5, 5), 12);
		expect(binomSegmentProb(10, 0.5, -3, 20)).toBeCloseTo(1, 10);
	});

	it('Poisson segment starting at 0 up to 0 gives e^-3', () => {
		expect(poissonSegmentProb(3, 0, 0)).toBeCloseTo(Math.exp(-3), 12);
	});
});

describe('bars', () => {
	it('binomial bars cover k = 0..n and mark only the segment as inside', () => {
		const bars = binomBars(10, 0.5, 5, 5);
		expect(bars).toHaveLength(11);
		expect(bars.filter((b) => b.inside).map((b) => b.k)).toEqual([5]);
	});

	it('Poisson axis grows with lambda and stays within 10..40', () => {
		expect(poissonAxisMax(0.1)).toBe(10);
		expect(poissonAxisMax(20)).toBe(38);
		expect(poissonAxisMax(20)).toBeLessThanOrEqual(40);
		expect(poissonBars(3, 0, 0)[0]).toMatchObject({ k: 0, inside: true });
	});

	it('normal curve spans the axis and is symmetric around mu', () => {
		const pts = normalCurve(0, 1, 241);
		expect(pts[0]?.x).toBeCloseTo(-NORM_AXIS, 12);
		expect(pts.at(-1)?.x).toBeCloseTo(NORM_AXIS, 12);
		expect(pts[120]?.y).toBeCloseTo(normalPdf(0, 0, 1), 12);
	});
});

describe('mergeState', () => {
	it('snaps values to the slider grid and clamps to the ranges', () => {
		const s = mergeState(DEFAULT_STATE, { p: 1.7, lambda: -4, sigma: 0.234, mu: Number.NaN });
		expect(s.p).toBe(0.99);
		expect(s.lambda).toBe(0.1);
		expect(s.sigma).toBe(0.2);
		expect(s.mu).toBe(DEFAULT_STATE.mu);
	});

	it('keeps the binomial segment inside 0..n when n shrinks', () => {
		const s = mergeState(DEFAULT_STATE, { binomLo: 9, binomHi: 9, n: 4 });
		expect(s.n).toBe(4);
		expect(s.binomHi).toBeLessThanOrEqual(4);
		expect(s.binomLo).toBeLessThanOrEqual(s.binomHi);
	});

	it('pushes the upper end up when the lower end is moved above it', () => {
		const s = mergeState(DEFAULT_STATE, { normLo: 2 });
		expect(s.normLo).toBe(2);
		expect(s.normHi).toBe(2);
	});

	it('pulls the lower end down when the upper end is moved below it', () => {
		const s = mergeState(DEFAULT_STATE, { binomHi: 2 });
		expect(s.binomLo).toBe(2);
		expect(s.binomHi).toBe(2);
	});
});

describe('descriptions', () => {
	it('describe the state with a decimal comma', () => {
		expect(describeBinomial(DEFAULT_STATE)).toBe('Bin(n = 10, p = 0,50): P(5 ≤ X ≤ 5) = 0,246.');
		expect(describePoisson(DEFAULT_STATE)).toBe('Pois(λ = 3,0): P(0 ≤ X ≤ 0) = 0,050.');
		expect(describeNormal(DEFAULT_STATE)).toBe('N(μ = 0,0, σ = 1,0): P(-1,0 ≤ X ≤ 1,0) = 0,683.');
	});
});
