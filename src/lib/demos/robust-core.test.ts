import { describe, expect, it } from 'vitest';
import { mulberry32 } from '$lib/prob/rng';
import {
	PHI75,
	drho,
	dpsi,
	iqrn,
	jointM,
	locationIrls,
	madn,
	mScale,
	normalCdf,
	normalQuantile,
	psi,
	rho,
	weight,
	type PsiKind,
	type RhoKind,
} from './robust-core';

const C_BISQ = 1.54764;

function normalSample(n: number, seed: number): Float64Array {
	const rng = mulberry32(seed);
	const out = new Float64Array(n);
	for (let i = 0; i < n; i += 2) {
		const u1 = Math.max(rng(), 1e-300);
		const u2 = rng();
		const r = Math.sqrt(-2 * Math.log(u1));
		out[i] = r * Math.cos(2 * Math.PI * u2);
		if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * u2);
	}
	return out;
}

function numericDerivative(f: (u: number) => number, u: number): number {
	const h = 1e-6;
	return (f(u + h) - f(u - h)) / (2 * h);
}

describe('normal helpers', () => {
	it('matches table values of the normal CDF', () => {
		expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
		expect(normalCdf(0)).toBeCloseTo(0.5, 15);
		expect(normalCdf(-3)).toBeCloseTo(0.0013498980316301, 12);
		expect(normalCdf(3) + normalCdf(-3)).toBeCloseTo(1, 14);
	});

	it('inverts the CDF and gives Phi^{-1}(0.75)', () => {
		expect(normalQuantile(0.75)).toBeCloseTo(0.67449, 5);
		expect(normalQuantile(0.75)).toBeCloseTo(PHI75, 10);
		for (const p of [1e-6, 0.01, 0.2, 0.5, 0.9, 0.999]) {
			expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 10);
		}
	});
});

describe('scale estimators: equivariance S(aX+d) = |a| S(X)', () => {
	const x = normalSample(301, 7).map((v) => 2 + 3 * v);
	const cases: [string, number][] = [
		['positive a', 2.5],
		['negative a', -2.3],
	];
	for (const [name, a] of cases) {
		const d = 4.7;
		const y = x.map((v) => a * v + d);
		it(`madn, iqrn, mScale: ${name}`, () => {
			expect(madn(y)).toBeCloseTo(Math.abs(a) * madn(x), 9);
			expect(iqrn(y)).toBeCloseTo(Math.abs(a) * iqrn(x), 9);
			const opts = { kind: 'bisquare' as const, c: C_BISQ, b: 0.5 };
			expect(mScale(y, opts)).toBeCloseTo(Math.abs(a) * mScale(x, opts), 9);
		});
	}
});

describe('scale estimators on N(0,1)', () => {
	const z = normalSample(50000, 142);
	it('madn and iqrn are close to 1', () => {
		expect(Math.abs(madn(z) - 1)).toBeLessThan(0.05);
		expect(Math.abs(iqrn(z) - 1)).toBeLessThan(0.05);
	});
	it('bisquare M-scale with b = 0.5 is close to 1', () => {
		const s = mScale(z, { kind: 'bisquare', c: C_BISQ, b: 0.500001 });
		expect(Math.abs(s - 1)).toBeLessThan(0.05);
	});
	it('degenerate samples give 0 or a finite positive value', () => {
		expect(mScale([5, 5, 5, 5], { kind: 'bisquare', c: C_BISQ, b: 0.5 })).toBe(0);
		// More than half of the residuals are zero, so no positive root exists for b = 0.5.
		expect(mScale([0, 0, 0, 1, -5], { kind: 'bisquare', c: C_BISQ, b: 0.5 })).toBe(0);
		const s = mScale([0, 0, 1, 2, -3, 4, -5], { kind: 'bisquare', c: C_BISQ, b: 0.5 });
		expect(Number.isFinite(s) && s > 0).toBe(true);
	});
});

describe('psi, rho and their derivatives', () => {
	const psiCases: [PsiKind, number][] = [
		['huber', 1.5],
		['bisquare', 4.685],
	];
	for (const [kind, c] of psiCases) {
		it(`dpsi matches numeric derivative of psi: ${kind}`, () => {
			for (const u of [-6, -2.3, -0.7, 0.2, 1.1, 3.9, 5.5]) {
				// Skip points near the kinks, where the numeric derivative is not defined.
				if (Math.abs(Math.abs(u) - c) < 1e-3) continue;
				expect(dpsi(kind, u, c)).toBeCloseTo(
					numericDerivative((v) => psi(kind, v, c), u),
					5,
				);
			}
		});
		it(`weight equals psi(u)/u: ${kind}`, () => {
			expect(weight(kind, 0, c)).toBe(1);
			for (const u of [-5, -1.2, 0.4, 2.9]) {
				expect(weight(kind, u, c)).toBeCloseTo(psi(kind, u, c) / u, 12);
			}
		});
	}
	const rhoCases: RhoKind[] = ['bisquare', 'clipped'];
	for (const kind of rhoCases) {
		it(`drho matches numeric derivative of rho: ${kind}`, () => {
			const c = kind === 'clipped' ? 2 : C_BISQ;
			for (const u of [-3, -1.3, -0.4, 0.5, 1.2, 2.7]) {
				if (Math.abs(Math.abs(u) - c) < 1e-3) continue;
				expect(drho(kind, u, c)).toBeCloseTo(
					numericDerivative((v) => rho(kind, v, c), u),
					5,
				);
			}
		});
	}
});

describe('locationIrls', () => {
	const x = [1, 2, 3, 4, 100];
	const scale = madn(x);
	it('Huber c=1.5 on an outlier sample gives mu between 2 and 4', () => {
		const { mu } = locationIrls(x, scale, { kind: 'huber', c: 1.5 });
		expect(mu).toBeGreaterThan(2);
		expect(mu).toBeLessThan(4);
	});
	it('bisquare c=4.685 from the median ignores 100 and gives 2.5', () => {
		// Outlier 100 gets zero weight; the M-estimate is the mean of 1..4 = 2.5.
		const { mu, trace } = locationIrls(x, scale, { kind: 'bisquare', c: 4.685 });
		expect(Math.abs(mu - 2.5)).toBeLessThan(0.05);
		expect(trace[trace.length - 1]!.weights[4]).toBe(0);
		expect(trace[0]!.mu).toBe(3);
		expect(trace[0]!.weights).toHaveLength(x.length);
	});
	it('does not diverge on a constant sample', () => {
		const r = locationIrls([5, 5, 5, 5], 0, { kind: 'huber', c: 1.5 });
		expect(r.mu).toBe(5);
		const r2 = locationIrls([5, 5, 5, 5], 1, { kind: 'bisquare', c: 4.685 });
		expect(r2.mu).toBe(5);
		expect(Number.isFinite(r2.iterations)).toBe(true);
	});
});

describe('jointM', () => {
	it('recovers location and scale of a clean normal sample', () => {
		const z = normalSample(2000, 3).map((v) => 2 + 3 * v);
		const r = jointM(z, {
			psi: { kind: 'huber', c: 1.5 },
			rho: { kind: 'bisquare', c: C_BISQ, b: 0.5 },
		});
		expect(Math.abs(r.mu - 2)).toBeLessThan(0.2);
		expect(Math.abs(r.sigma - 3)).toBeLessThan(0.3);
		expect(r.trace.length).toBe(r.iterations + 1);
	});
});
