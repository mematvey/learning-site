import { describe, expect, it } from 'vitest';
import {
	type Mat2,
	type Vec2,
	applyMat,
	describeMatrix,
	ellipsePoints,
	eigen2,
	formatNumber,
	frobenius,
	gridLines,
	lowRankApprox,
	lowRankError,
	snapEntry,
	svd2,
} from './linear-algebra-essentials';

const PHI = (1 + Math.sqrt(5)) / 2;
const SYM: Mat2 = { a: 2, b: 1, c: 1, d: 2 };
const SHEAR: Mat2 = { a: 1, b: 1, c: 0, d: 1 };
const ROT: Mat2 = { a: 0, b: -1, c: 1, d: 0 };

function expectClose(actual: readonly number[], expected: readonly number[], digits = 9) {
	expect(actual.length).toBe(expected.length);
	actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? NaN, digits));
}

describe('eigen2', () => {
	it('gives eigenvalues 3 and 1 for [[2,1],[1,2]]', () => {
		const e = eigen2(SYM);
		expect(e.real).toBe(true);
		expectClose(e.values, [3, 1]);
	});

	it('gives eigenvectors that satisfy A v = λ v', () => {
		const e = eigen2(SYM);
		e.vectors.forEach((v, i) => {
			const lam = e.values[i] ?? NaN;
			const [x, y] = applyMat(SYM, v);
			expect(x).toBeCloseTo(lam * v[0], 9);
			expect(y).toBeCloseTo(lam * v[1], 9);
		});
	});

	it('matches the chapter eigenvectors (1,1)/√2 and (1,-1)/√2', () => {
		const e = eigen2(SYM);
		const s = Math.SQRT1_2;
		expectClose(e.vectors[0].map(Math.abs), [s, s]);
		expectClose(e.vectors[1].map(Math.abs), [s, s]);
		// The two eigenvectors are orthogonal for a symmetric matrix.
		const dot = e.vectors[0][0] * e.vectors[1][0] + e.vectors[0][1] * e.vectors[1][1];
		expect(dot).toBeCloseTo(0, 9);
	});

	it('gives the double eigenvalue 1 for the shear and keeps the horizontal direction', () => {
		const e = eigen2(SHEAR);
		expectClose(e.values, [1, 1]);
		expectClose(e.vectors[0].map(Math.abs), [1, 0]);
	});

	it('reports complex eigenvalues for a rotation by 90 degrees', () => {
		expect(eigen2(ROT).real).toBe(false);
	});

	it('uses the standard basis for a scalar matrix', () => {
		const e = eigen2({ a: 2, b: 0, c: 0, d: 2 });
		expectClose(e.values, [2, 2]);
		expectClose(e.vectors[0], [1, 0]);
		expectClose(e.vectors[1], [0, 1]);
	});
});

describe('svd2', () => {
	it('gives singular values φ and 1/φ for the shear', () => {
		const s = svd2(SHEAR);
		expectClose(s.sigma, [PHI, 1 / PHI]);
	});

	it('keeps sigma sorted and non-negative', () => {
		for (const m of [SYM, SHEAR, ROT, { a: 3, b: -2, c: 0.5, d: 4 }]) {
			const s = svd2(m);
			expect(s.sigma[0]).toBeGreaterThanOrEqual(s.sigma[1]);
			expect(s.sigma[1]).toBeGreaterThanOrEqual(0);
		}
	});

	it('gives orthonormal U and V', () => {
		for (const m of [SYM, SHEAR, ROT, { a: 3, b: -2, c: 0.5, d: 4 }]) {
			const s = svd2(m);
			for (const [p, q] of [s.u, s.v]) {
				expect(Math.hypot(p[0], p[1])).toBeCloseTo(1, 9);
				expect(Math.hypot(q[0], q[1])).toBeCloseTo(1, 9);
				expect(p[0] * q[0] + p[1] * q[1]).toBeCloseTo(0, 9);
			}
		}
	});

	it('reconstructs A from U Σ Vᵀ, including a zero matrix and a rank-1 matrix', () => {
		const rank1: Mat2 = { a: 1, b: 2, c: 2, d: 4 };
		const zero: Mat2 = { a: 0, b: 0, c: 0, d: 0 };
		for (const m of [SYM, SHEAR, ROT, rank1, zero]) {
			const k2 = lowRankApprox(m, 2);
			expect(k2.a).toBeCloseTo(m.a, 9);
			expect(k2.b).toBeCloseTo(m.b, 9);
			expect(k2.c).toBeCloseTo(m.c, 9);
			expect(k2.d).toBeCloseTo(m.d, 9);
		}
	});

	it('has the second singular value zero for a rank-1 matrix', () => {
		const s = svd2({ a: 1, b: 2, c: 2, d: 4 });
		expect(s.sigma[1]).toBeCloseTo(0, 9);
	});
});

describe('low-rank approximation', () => {
	it('gives rank-1 error equal to σ2 ≈ 0,618 for the shear', () => {
		expect(lowRankError(SHEAR, 1)).toBeCloseTo(1 / PHI, 9);
		expect(lowRankError(SHEAR, 1)).toBeCloseTo(0.618, 3);
	});

	it('has squared Frobenius norm equal to the sum of squared singular values (3 for the shear)', () => {
		const s = svd2(SHEAR);
		expect(frobenius(SHEAR) ** 2).toBeCloseTo(3, 9);
		expect(s.sigma[0] ** 2 + s.sigma[1] ** 2).toBeCloseTo(3, 9);
	});

	it('has zero error for full rank', () => {
		expect(lowRankError(SYM, 2)).toBeCloseTo(0, 9);
	});
});

describe('geometry helpers', () => {
	it('maps the unit circle onto an ellipse with semi-axes σ1 and σ2', () => {
		const pts = ellipsePoints(SHEAR, 3600);
		const radii = pts.map(([x, y]) => Math.hypot(x, y));
		expect(Math.max(...radii)).toBeCloseTo(PHI, 3);
		expect(Math.min(...radii)).toBeCloseTo(1 / PHI, 3);
	});

	it('keeps grid lines parallel after the map', () => {
		const lines = gridLines(SYM, 4);
		// Vertical lines are pairs at indices 0,2,4,...; their directions must match.
		const dir = (l: [Vec2, Vec2]): Vec2 => [l[1][0] - l[0][0], l[1][1] - l[0][1]];
		const d0 = dir(lines[0] as [Vec2, Vec2]);
		const d1 = dir(lines[2] as [Vec2, Vec2]);
		expect(d0[0] * d1[1] - d0[1] * d1[0]).toBeCloseTo(0, 9);
	});

	it('snaps entries to the step and clamps them', () => {
		expect(snapEntry(0.04)).toBe(0);
		expect(snapEntry(0.26)).toBe(0.3);
		expect(snapEntry(9)).toBe(3);
		expect(snapEntry(-9)).toBe(-3);
		expect(snapEntry(Number.NaN)).toBe(0);
	});

	it('formats numbers with a decimal comma and no minus sign on zero', () => {
		expect(formatNumber(1.618)).toBe('1,62');
		expect(formatNumber(-0.001)).toBe('0,00');
	});

	it('describes the default matrix with the chapter numbers', () => {
		const text = describeMatrix(SHEAR);
		expect(text).toContain('1,62');
		expect(text).toContain('0,62');
	});
});
