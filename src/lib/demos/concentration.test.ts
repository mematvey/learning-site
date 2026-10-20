import { describe, expect, it } from 'vitest';
import {
	ALPHA,
	N_MAX,
	boundsAt,
	chebyshevBound,
	chebyshevSampleSize,
	cltTail,
	curveSeries,
	exactSampleSize,
	exactTail,
	formatProb,
	hoeffdingBound,
	hoeffdingSampleSize,
	markovBound,
	nFromPos,
	plotBox,
	posFromN,
	snapEps,
	snapP,
	yOfProb,
	xOfN,
} from './concentration';

describe('exact tail of the mean of Bernoulli values (p = 0.5, eps = 0.1)', () => {
	it('matches the chapter table', () => {
		expect(exactTail(10, 0.5, 0.1)).toBeCloseTo(0.754, 3);
		expect(exactTail(100, 0.5, 0.1)).toBeCloseTo(0.0569, 4);
		// relative check for a tiny value
		expect(exactTail(1000, 0.5, 0.1) / 2.7e-10).toBeCloseTo(1, 1);
	});

	it('is the first n with P <= 0.05 at 92, and P rises again at 93', () => {
		expect(exactSampleSize(0.5, 0.1, ALPHA)).toBe(92);
		expect(exactTail(92, 0.5, 0.1)).toBeLessThanOrEqual(ALPHA);
		expect(exactTail(93, 0.5, 0.1)).toBeGreaterThan(ALPHA);
	});

	it('is symmetric in p and 1 - p', () => {
		expect(exactTail(50, 0.3, 0.1)).toBeCloseTo(exactTail(50, 0.7, 0.1), 12);
	});
});

describe('bounds at p = 0.5, eps = 0.1', () => {
	it('gives the chapter values for n = 100', () => {
		const b = boundsAt(100, 0.5, 0.1);
		expect(b.markov).toBeCloseTo(0.5, 10);
		expect(b.chebyshev).toBeCloseTo(0.25, 10);
		expect(b.hoeffding).toBeCloseTo(0.271, 3);
		expect(b.clt).toBeCloseTo(0.0455, 4);
	});

	it('gives the chapter values for n = 1000', () => {
		const b = boundsAt(1000, 0.5, 0.1);
		expect(b.markov).toBeCloseTo(0.158, 3);
		expect(b.chebyshev).toBeCloseTo(0.025, 10);
		expect(b.hoeffding / 4.1e-9).toBeCloseTo(1, 1);
		expect(b.clt / 2.5e-10).toBeCloseTo(1, 1);
	});

	it('gives uncapped values above 1 at n = 10, as the chapter says (Chebyshev 2.5)', () => {
		expect(chebyshevBound(10, 0.5, 0.1)).toBeCloseTo(2.5, 10);
		expect(hoeffdingBound(10, 0.1)).toBeGreaterThan(1);
		expect(markovBound(10, 0.5, 0.1)).toBeGreaterThan(1);
		expect(cltTail(10, 0.5, 0.1)).toBeCloseTo(0.527, 3);
	});

	it('gives Hoeffding below Chebyshev for large n and above it at n = 100', () => {
		expect(hoeffdingBound(100, 0.1)).toBeGreaterThan(chebyshevBound(100, 0.5, 0.1));
		expect(hoeffdingBound(120, 0.1)).toBeLessThan(chebyshevBound(120, 0.5, 0.1));
		expect(hoeffdingBound(1000, 0.1)).toBeLessThan(chebyshevBound(1000, 0.5, 0.1));
	});

	it('keeps every bound above the exact tail (they are valid bounds)', () => {
		for (const p of [0.1, 0.5, 0.9]) {
			for (const t of [0.05, 0.1, 0.2]) {
				for (let n = 1; n <= 300; n += 1) {
					const b = boundsAt(n, p, t);
					expect(b.exact).toBeLessThanOrEqual(Math.min(b.markov, b.chebyshev, b.hoeffding) + 1e-12);
				}
			}
		}
	});
});

describe('sample sizes for P <= 0.05 at p = 0.5, eps = 0.1', () => {
	it('gives Chebyshev 500, Hoeffding 185', () => {
		expect(chebyshevSampleSize(0.5, 0.1, ALPHA)).toBe(500);
		expect(hoeffdingSampleSize(0.1, ALPHA)).toBe(185);
	});

	it('keeps the sample size above N_MAX as a number', () => {
		expect(exactSampleSize(0.5, 0.01, ALPHA)).toBeNull();
		expect(chebyshevSampleSize(0.5, 0.02, ALPHA)).toBeGreaterThan(N_MAX);
	});
});

describe('n slider', () => {
	it('maps the chapter values n = 10, 100, 92, 185, 500, 1000 back within 1%', () => {
		// The slider grid is coarse (about 1.2% per step), so exact round trips are not possible.
		for (const n of [10, 100, 92, 185, 500, 1000]) {
			const back = nFromPos(posFromN(n));
			expect(Math.abs(back - n)).toBeLessThanOrEqual(Math.max(1, n * 0.01));
		}
	});

	it('changes the displayed n on every slider step for n from 100 to 1000', () => {
		for (let pos = posFromN(100); pos < posFromN(1000); pos += 1) {
			expect(nFromPos(pos + 1)).not.toBe(nFromPos(pos));
		}
	});

	it('clamps positions to the range', () => {
		expect(nFromPos(-5)).toBe(1);
		expect(nFromPos(1e9)).toBe(N_MAX);
	});
});

describe('snapping and curves', () => {
	it('snaps p and eps to the slider steps', () => {
		expect(snapP(0.52)).toBe(0.5);
		expect(snapP(0.15)).toBe(0.15);
		expect(snapEps(0.123)).toBe(0.12);
		expect(snapEps(Number.NaN)).toBe(0.1);
	});

	it('builds log-spaced curves over 1..N_MAX with the same length for all series', () => {
		const s = curveSeries(0.5, 0.1);
		expect(s.ns[0]).toBe(1);
		expect(s.ns[s.ns.length - 1]).toBe(N_MAX);
		expect(s.exact.length).toBe(s.ns.length);
		expect(s.hoeffding.length).toBe(s.ns.length);
	});
});

describe('formatting and plot geometry', () => {
	it('formats probabilities in the chapter style', () => {
		expect(formatProb(0.0569)).toBe('0,0569');
		expect(formatProb(0.25)).toBe('0,25');
		expect(formatProb(0.5)).toBe('0,5');
		expect(formatProb(0.271)).toBe('0,271');
		expect(formatProb(2.7e-10)).toBe('2,7·10⁻¹⁰');
		expect(formatProb(0)).toBe('0');
		expect(formatProb(3)).toBe('1');
	});

	it('puts a larger probability higher on the chart and clamps values', () => {
		const box = plotBox(300);
		expect(yOfProb(0.5, box)).toBeLessThan(yOfProb(0.001, box));
		expect(yOfProb(5, box)).toBe(yOfProb(1, box));
		expect(yOfProb(0, box)).toBe(yOfProb(1e-12, box));
		expect(xOfN(1, box)).toBeCloseTo(box.left, 6);
		expect(xOfN(N_MAX, box)).toBeCloseTo(box.w - box.right, 6);
	});
});
