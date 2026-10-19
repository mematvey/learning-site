/**
 * Math of the linear-algebra demo: a 2×2 matrix as a map of the plane.
 * Eigenvalues and singular values of a 2×2 matrix are computed in closed form.
 * Pure functions only: no DOM, no Svelte.
 */

export interface Mat2 {
	a: number;
	b: number;
	c: number;
	d: number;
}

export type Vec2 = [number, number];

/** Coordinates of the matrix entries and of the handles are kept inside [-MAT_LIMIT, MAT_LIMIT]. */
export const MAT_LIMIT = 3;
/** Step of the entries (and of the keyboard nudge) in the demo. */
export const ENTRY_STEP = 0.1;

const EPS = 1e-12;

export const PRESETS: ReadonlyArray<{ id: string; label: string; m: Mat2 }> = [
	{ id: 'shear', label: 'Сдвиг', m: { a: 1, b: 1, c: 0, d: 1 } },
	{ id: 'symmetric', label: 'Симметричная', m: { a: 2, b: 1, c: 1, d: 2 } },
	{ id: 'identity', label: 'Единичная', m: { a: 1, b: 0, c: 0, d: 1 } },
];

export const DEFAULT_MATRIX: Mat2 = { a: 1, b: 1, c: 0, d: 1 };

/** Rounds to one decimal step and clamps to [-MAT_LIMIT, MAT_LIMIT]. Non-finite input gives 0. */
export function snapEntry(v: number): number {
	if (!Number.isFinite(v)) return 0;
	const r = Math.round(v / ENTRY_STEP) * ENTRY_STEP;
	return Math.min(MAT_LIMIT, Math.max(-MAT_LIMIT, Math.round(r * 10) / 10));
}

export function applyMat(m: Mat2, p: Vec2): Vec2 {
	return [m.a * p[0] + m.b * p[1], m.c * p[0] + m.d * p[1]];
}

export function det(m: Mat2): number {
	return m.a * m.d - m.b * m.c;
}

export function frobenius(m: Mat2): number {
	return Math.sqrt(m.a * m.a + m.b * m.b + m.c * m.c + m.d * m.d);
}

export function subMat(m: Mat2, n: Mat2): Mat2 {
	return { a: m.a - n.a, b: m.b - n.b, c: m.c - n.c, d: m.d - n.d };
}

function normalize(v: Vec2): Vec2 | null {
	const len = Math.hypot(v[0], v[1]);
	if (len < EPS) return null;
	return [v[0] / len, v[1] / len];
}

/**
 * Unit vector v with (A - λI)v = 0, or null when A - λI is zero (then every vector is an eigenvector).
 * Each row of A - λI gives a perpendicular vector; the longer one is taken for stability.
 */
function nullVector(m: Mat2, lambda: number): Vec2 | null {
	const r1: Vec2 = [m.b, lambda - m.a];
	const r2: Vec2 = [m.d - lambda, -m.c];
	const pick = Math.hypot(r1[0], r1[1]) >= Math.hypot(r2[0], r2[1]) ? r1 : r2;
	return normalize(pick);
}

export interface Eigen2 {
	/** False when the eigenvalues are complex (the matrix turns the plane by a non-zero angle). */
	real: boolean;
	/** Eigenvalues, the larger first. NaN when not real. */
	values: [number, number];
	/** Unit eigenvectors for the values in the same order. */
	vectors: [Vec2, Vec2];
}

/** Eigenvalues and eigenvectors of a 2×2 matrix: λ² − tr(A)·λ + det(A) = 0. */
export function eigen2(m: Mat2): Eigen2 {
	const tr = m.a + m.d;
	const disc = (tr * tr) / 4 - det(m);
	if (disc < -EPS) {
		return {
			real: false,
			values: [NaN, NaN],
			vectors: [
				[NaN, NaN],
				[NaN, NaN],
			],
		};
	}
	const s = Math.sqrt(Math.max(0, disc));
	const values: [number, number] = [tr / 2 + s, tr / 2 - s];
	// For a scalar matrix every vector is an eigenvector: the standard basis is used.
	const v1 = nullVector(m, values[0]) ?? [1, 0];
	const v2 = nullVector(m, values[1]) ?? [0, 1];
	return { real: true, values, vectors: [v1, v2] };
}

export interface Svd2 {
	/** Singular values σ1 ≥ σ2 ≥ 0. */
	sigma: [number, number];
	/** Left singular vectors (columns of U), orthonormal. */
	u: [Vec2, Vec2];
	/** Right singular vectors (columns of V), orthonormal. */
	v: [Vec2, Vec2];
}

/**
 * SVD of a 2×2 matrix: A = U Σ Vᵀ. V and σ² come from the eigen-decomposition of AᵀA,
 * then uᵢ = A vᵢ / σᵢ. When σᵢ = 0, uᵢ is completed to an orthonormal pair.
 */
export function svd2(m: Mat2): Svd2 {
	const p = m.a * m.a + m.c * m.c;
	const q = m.a * m.b + m.c * m.d;
	const r = m.b * m.b + m.d * m.d;
	const e = eigen2({ a: p, b: q, c: q, d: r });
	const sigma: [number, number] = [
		Math.sqrt(Math.max(0, e.values[0])),
		Math.sqrt(Math.max(0, e.values[1])),
	];
	const v = e.vectors;
	const av0 = applyMat(m, v[0]);
	const av1 = applyMat(m, v[1]);
	const u1: Vec2 = sigma[0] > EPS ? [av0[0] / sigma[0], av0[1] / sigma[0]] : [1, 0];
	const u2: Vec2 = sigma[1] > EPS ? [av1[0] / sigma[1], av1[1] / sigma[1]] : [-u1[1], u1[0]];
	return { sigma, u: [u1, u2], v: [v[0], v[1]] };
}

/** Sum of the first k terms σᵢ uᵢ vᵢᵀ. k = 2 gives A back (up to rounding). */
export function lowRankApprox(m: Mat2, k: number): Mat2 {
	const s = svd2(m);
	const out: Mat2 = { a: 0, b: 0, c: 0, d: 0 };
	const terms = [
		[s.u[0], s.v[0], s.sigma[0]],
		[s.u[1], s.v[1], s.sigma[1]],
	] as const;
	for (const [[ux, uy], [vx, vy], sg] of terms.slice(0, Math.min(k, 2))) {
		out.a += sg * ux * vx;
		out.b += sg * ux * vy;
		out.c += sg * uy * vx;
		out.d += sg * uy * vy;
	}
	return out;
}

/** Error of the best rank-k approximation in the Frobenius norm, ‖A − A_k‖_F. */
export function lowRankError(m: Mat2, k: number): number {
	return frobenius(subMat(m, lowRankApprox(m, k)));
}

/** The unit circle after the map: an ellipse with semi-axes σ1 and σ2. */
export function ellipsePoints(m: Mat2, n = 96): Vec2[] {
	const pts: Vec2[] = [];
	for (let i = 0; i <= n; i++) {
		const t = (2 * Math.PI * i) / n;
		pts.push(applyMat(m, [Math.cos(t), Math.sin(t)]));
	}
	return pts;
}

/**
 * Grid lines of the plane, mapped by the matrix. Lines x = i and y = i for i in [-k, k],
 * each drawn from -k to k. Parallel lines stay parallel and evenly spaced.
 */
export function gridLines(m: Mat2, k = 4): Array<[Vec2, Vec2]> {
	const lines: Array<[Vec2, Vec2]> = [];
	for (let i = -k; i <= k; i++) {
		lines.push([applyMat(m, [i, -k]), applyMat(m, [i, k])]);
		lines.push([applyMat(m, [-k, i]), applyMat(m, [k, i])]);
	}
	return lines;
}

/** Formats with a decimal comma (as in the chapter text) and no minus sign on zero. */
export function formatNumber(v: number, digits = 2): string {
	if (!Number.isFinite(v)) return '—';
	const value = Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v;
	return value.toFixed(digits).replace('.', ',');
}

/** Text of the description line under the plot. Numbers are computed, not typed. */
export function describeMatrix(m: Mat2): string {
	const e = eigen2(m);
	const s = svd2(m);
	const area = Math.abs(det(m));
	const eigenPart = e.real
		? `Собственные числа: ${formatNumber(e.values[0])} и ${formatNumber(e.values[1])}.`
		: 'Собственных направлений нет: собственные числа комплексные, поворот.';
	return (
		`Единичный круг переходит в эллипс с полуосями ${formatNumber(s.sigma[0])} и ${formatNumber(s.sigma[1])}. ` +
		`Площадь меняется в |det A| = ${formatNumber(area)} раз. ${eigenPart}`
	);
}
