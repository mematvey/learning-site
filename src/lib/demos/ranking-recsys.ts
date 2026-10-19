/**
 * Math of the ranking and recommender demo: NDCG@k for one list, and a rank-k approximation
 * of a full rating matrix (one-sided Jacobi SVD). Pure functions only: no DOM, no Svelte.
 * Index accesses below stay inside the bounds given by the loops and the array shapes.
 */

/** Length of the list whose NDCG is shown. */
export const K = 5;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RANK_MIN = 1;
export const RANK_MAX = 4;

export interface Item {
	id: string;
	/** Relevance of the item for the user: 0, 1 or 2. */
	rel: number;
}

/** Five items; their default order is the chapter's list with relevances 0, 2, 1, 0, 0. */
export const ITEMS: readonly Item[] = [
	{ id: 'A', rel: 0 },
	{ id: 'B', rel: 2 },
	{ id: 'C', rel: 1 },
	{ id: 'D', rel: 0 },
	{ id: 'E', rel: 0 },
];

/** Default order: indices into ITEMS. */
export const DEFAULT_ORDER: readonly number[] = [0, 1, 2, 3, 4];

/** Four users (rows) and four objects (columns). Rows 1–2 like columns 1–2; rows 3–4 like columns 3–4. */
export const DEFAULT_RATINGS: readonly (readonly number[])[] = [
	[5, 4, 1, 1],
	[4, 5, 1, 2],
	[1, 1, 4, 5],
	[2, 1, 5, 4],
];

export const DEFAULT_RANK = 2;

export interface RankingRecsysState {
	/** Rank of the approximation, from RANK_MIN to RANK_MAX. */
	rank: number;
	/** Order of ITEMS in the list: a permutation of 0..n-1. */
	order: number[];
	/** Rating matrix, RATING_MIN..RATING_MAX integers. */
	ratings: number[][];
}

export function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Discount of position `position` (counted from 1): 1 / log2(position + 1). */
export function weight(position: number): number {
	return 1 / Math.log2(position + 1);
}

/** Contribution rel_i / log2(i + 1) of each of the first k positions; rel[0] is the first position. */
export function dcgTerms(rel: readonly number[], k: number = K): number[] {
	return rel.slice(0, k).map((r, i) => r * weight(i + 1));
}

/** DCG of the first k relevances of a list. */
export function dcg(rel: readonly number[], k: number = K): number {
	return dcgTerms(rel, k).reduce((s, v) => s + v, 0);
}

/** Relevances sorted in descending order: the ideal list. */
export function idealRel(rel: readonly number[]): number[] {
	return [...rel].sort((a, b) => b - a);
}

/** NDCG@k = DCG@k / IDCG@k. Returns 0 when the list has no relevant items (IDCG is 0). */
export function ndcg(rel: readonly number[], k: number = K): number {
	const ideal = dcg(idealRel(rel), k);
	return ideal === 0 ? 0 : dcg(rel, k) / ideal;
}

/** Relevances of the items in the given order. */
export function relInOrder(items: readonly Item[], order: readonly number[]): number[] {
	return order.map((i) => items[i]!.rel);
}

/** Moves the element at `from` to `to`; returns a new array. Out-of-range indices give a copy. */
export function moveItem(order: readonly number[], from: number, to: number): number[] {
	const next = [...order];
	if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
	const [x] = next.splice(from, 1);
	next.splice(to, 0, x!);
	return next;
}

/** True when `order` is a permutation of 0..n-1. */
export function isPermutation(order: unknown, n: number): order is number[] {
	if (!Array.isArray(order) || order.length !== n) return false;
	const seen = new Set<number>();
	for (const v of order) {
		if (!Number.isInteger(v) || v < 0 || v >= n || seen.has(v)) return false;
		seen.add(v);
	}
	return true;
}

/** Sets one rating; the value is rounded and clamped to RATING_MIN..RATING_MAX. Returns a new matrix. */
export function setRating(
	ratings: readonly (readonly number[])[],
	row: number,
	col: number,
	value: number,
): number[][] {
	const v = Number.isFinite(value) ? clamp(Math.round(value), RATING_MIN, RATING_MAX) : RATING_MIN;
	return ratings.map((r, i) => r.map((x, j) => (i === row && j === col ? v : x)));
}

export function snapRank(k: unknown): number {
	if (typeof k !== 'number' || !Number.isFinite(k)) return DEFAULT_RANK;
	return clamp(Math.round(k), RANK_MIN, RANK_MAX);
}

/**
 * Returns a complete state from a partial one (for example, from a prop).
 * Invalid parts fall back to the defaults.
 */
export function resolveState(initial?: Partial<RankingRecsysState>): RankingRecsysState {
	const order =
		initial && isPermutation(initial.order, ITEMS.length) ? [...initial.order] : [...DEFAULT_ORDER];
	const width = DEFAULT_RATINGS[0]!.length;
	const ratings =
		initial?.ratings &&
		initial.ratings.length === DEFAULT_RATINGS.length &&
		initial.ratings.every((r) => Array.isArray(r) && r.length === width)
			? initial.ratings.map((r) => r.map((v) => clamp(Math.round(v), RATING_MIN, RATING_MAX)))
			: DEFAULT_RATINGS.map((r) => [...r]);
	return { rank: snapRank(initial?.rank), order, ratings };
}

/**
 * One-sided Jacobi SVD of a real matrix with m rows and n columns.
 * Returns the singular values in descending order, and for each of them the column
 * s_j * u_j (`left`) and the column v_j of V (`right`), so that A = sum_j left_j right_j^T.
 */
export function jacobiSvd(a: readonly (readonly number[])[]): {
	s: number[];
	left: number[][];
	right: number[][];
} {
	const m = a.length;
	const n = a[0]?.length ?? 0;
	const cols: number[][] = Array.from({ length: n }, (_, j) => a.map((row) => row[j]!));
	const vcols: number[][] = Array.from({ length: n }, (_, j) =>
		Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)),
	);

	for (let sweep = 0; sweep < 60; sweep++) {
		let rotated = false;
		for (let p = 0; p < n; p++) {
			for (let q = p + 1; q < n; q++) {
				const cp = cols[p]!;
				const cq = cols[q]!;
				let alpha = 0;
				let beta = 0;
				let gamma = 0;
				for (let i = 0; i < m; i++) {
					alpha += cp[i]! * cp[i]!;
					beta += cq[i]! * cq[i]!;
					gamma += cp[i]! * cq[i]!;
				}
				if (gamma === 0 || Math.abs(gamma) <= 1e-15 * Math.sqrt(alpha * beta)) continue;
				rotated = true;
				const zeta = (beta - alpha) / (2 * gamma);
				const t = (zeta >= 0 ? 1 : -1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
				const c = 1 / Math.sqrt(1 + t * t);
				const s = c * t;
				rotatePair(cp, cq, c, s);
				rotatePair(vcols[p]!, vcols[q]!, c, s);
			}
		}
		if (!rotated) break;
	}

	const ranked = cols
		.map((col, j) => ({ j, norm: Math.sqrt(col.reduce((acc, v) => acc + v * v, 0)) }))
		.sort((x, y) => y.norm - x.norm);
	return {
		s: ranked.map((r) => r.norm),
		left: ranked.map((r) => cols[r.j]!),
		right: ranked.map((r) => vcols[r.j]!),
	};
}

function rotatePair(x: number[], y: number[], c: number, s: number): void {
	for (let i = 0; i < x.length; i++) {
		const xi = x[i]!;
		const yi = y[i]!;
		x[i] = c * xi - s * yi;
		y[i] = s * xi + c * yi;
	}
}

/** Singular values of the matrix, descending. */
export function singularValues(a: readonly (readonly number[])[]): number[] {
	return jacobiSvd(a).s;
}

/** Best rank-k approximation of the matrix (Eckart–Young), as a new matrix. */
export function lowRank(a: readonly (readonly number[])[], k: number): number[][] {
	const m = a.length;
	const n = a[0]?.length ?? 0;
	const { left, right } = jacobiSvd(a);
	const out: number[][] = Array.from({ length: m }, () => new Array<number>(n).fill(0));
	const terms = Math.min(k, left.length);
	for (let j = 0; j < terms; j++) {
		const lj = left[j]!;
		const rj = right[j]!;
		for (let i = 0; i < m; i++) {
			const row = out[i]!;
			for (let l = 0; l < n; l++) row[l] = row[l]! + lj[i]! * rj[l]!;
		}
	}
	return out;
}

/** Frobenius norm: square root of the sum of squared entries. */
export function frobenius(a: readonly (readonly number[])[]): number {
	let s = 0;
	for (const row of a) for (const v of row) s += v * v;
	return Math.sqrt(s);
}

/** Frobenius norm of A − B. */
export function frobeniusDiff(
	a: readonly (readonly number[])[],
	b: readonly (readonly number[])[],
): number {
	let s = 0;
	a.forEach((row, i) =>
		row.forEach((v, j) => {
			const d = v - b[i]![j]!;
			s += d * d;
		}),
	);
	return Math.sqrt(s);
}

/** Error of the best rank-k approximation: ||A − A_k||_F. */
export function rankError(a: readonly (readonly number[])[], k: number): number {
	return frobeniusDiff(a, lowRank(a, k));
}

/** Formats a number with a decimal comma, as the chapter does: 0,670. */
export function formatNum(x: number, digits: number): string {
	return x.toFixed(digits).replace('.', ',');
}
