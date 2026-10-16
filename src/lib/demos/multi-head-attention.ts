/**
 * Math of the multi-head attention demo. Pure functions only: no DOM, no Svelte.
 * X, W_Q, W_K are fixed pseudo-random Gaussians (seeded PRNG), so every page load shows
 * the same heads. Weights of head t are softmax(Q_t K_tᵀ / sqrt(d_k)), where Q_t and K_t are
 * the column slices of X·W_Q and X·W_K (the same split as `split_heads` in the lab).
 */

import { mulberry32 } from './attention';

export const TOKENS = ['кот', 'сел', 'на', 'коврик', 'потому', 'что'] as const;
export const TOKEN_COUNT = TOKENS.length;

/** Model width d_model. Divisible by every allowed head count. */
export const D_MODEL = 64;
export const HEAD_COUNTS = [1, 2, 4, 8] as const;
export const DEFAULT_HEADS = 4;
export const SEED = 20241014;

export type Matrix = number[][];

export interface MhaModel {
	/** Token representations, TOKEN_COUNT × D_MODEL. */
	X: Matrix;
	/** Query projection, D_MODEL × D_MODEL. */
	WQ: Matrix;
	/** Key projection, D_MODEL × D_MODEL. */
	WK: Matrix;
}

/** Standard normal N(0, 1) via Box-Muller on the given generator. */
function gauss(rand: () => number): number {
	let u = 0;
	while (u === 0) u = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

function randMatrix(rows: number, cols: number, scale: number, rand: () => number): Matrix {
	const M: Matrix = [];
	for (let i = 0; i < rows; i++) {
		const row: number[] = [];
		for (let j = 0; j < cols; j++) row.push(gauss(rand) * scale);
		M.push(row);
	}
	return M;
}

/**
 * Builds X, W_Q, W_K. Entries of W are N(0, 1/d_model), so the entries of Q and K have unit
 * variance. With the 1/sqrt(d_k) scale the logits of every head have unit spread.
 */
export function makeModel(seed: number = SEED): MhaModel {
	const rand = mulberry32(seed);
	const wScale = 1 / Math.sqrt(D_MODEL);
	const X = randMatrix(TOKEN_COUNT, D_MODEL, 1, rand);
	const WQ = randMatrix(D_MODEL, D_MODEL, wScale, rand);
	const WK = randMatrix(D_MODEL, D_MODEL, wScale, rand);
	return { X, WQ, WK };
}

/** Plain matrix product A (n×k) · B (k×m). */
export function matmul(A: Matrix, B: Matrix): Matrix {
	const n = A.length;
	const k = B.length;
	const m = B[0]?.length ?? 0;
	const C: Matrix = [];
	for (let i = 0; i < n; i++) {
		const row = new Array<number>(m).fill(0);
		for (let p = 0; p < k; p++) {
			const a = A[i]?.[p] ?? 0;
			const bp = B[p] ?? [];
			for (let j = 0; j < m; j++) row[j] = (row[j] ?? 0) + a * (bp[j] ?? 0);
		}
		C.push(row);
	}
	return C;
}

export function transpose(A: Matrix): Matrix {
	const rows = A.length;
	const cols = A[0]?.length ?? 0;
	const T: Matrix = [];
	for (let j = 0; j < cols; j++) {
		const col: number[] = [];
		for (let i = 0; i < rows; i++) col.push(A[i]?.[j] ?? 0);
		T.push(col);
	}
	return T;
}

/** True for a head count from the slider. */
export function isHeadCount(h: unknown): h is (typeof HEAD_COUNTS)[number] {
	return typeof h === 'number' && (HEAD_COUNTS as readonly number[]).includes(h);
}

/** Nearest allowed head count (ties go to the smaller one). */
export function snapHeads(h: number): number {
	let best: number = HEAD_COUNTS[0];
	for (const c of HEAD_COUNTS) {
		if (Math.abs(c - h) < Math.abs(best - h)) best = c;
	}
	return best;
}

/** Key dimension d_k = d_model / h. */
export function headDim(h: number, dModel: number = D_MODEL): number {
	return dModel / h;
}

/**
 * Splits (n × d_model) into h matrices (n × d_k): head t takes the columns
 * [t·d_k, (t+1)·d_k). Result: `heads[t][i][k]`.
 */
export function splitHeads(M: Matrix, h: number): Matrix[] {
	const dk = (M[0]?.length ?? 0) / h;
	const heads: Matrix[] = [];
	for (let t = 0; t < h; t++) {
		heads.push(M.map((row) => row.slice(t * dk, (t + 1) * dk)));
	}
	return heads;
}

/** Inverse of `splitHeads`: concatenates the head outputs along the feature axis. */
export function mergeHeads(heads: Matrix[]): Matrix {
	const n = heads[0]?.length ?? 0;
	const out: Matrix = [];
	for (let i = 0; i < n; i++) {
		out.push(heads.flatMap((H) => H[i] ?? []));
	}
	return out;
}

/** Row-wise softmax with the row maximum subtracted before exp (numerically stable). */
export function softmaxRows(S: Matrix): Matrix {
	return S.map((row) => {
		const max = Math.max(...row);
		const e = row.map((v) => Math.exp(v - max));
		const sum = e.reduce((s, v) => s + v, 0);
		return e.map((v) => v / sum);
	});
}

/** Attention weights of every head: `result[t][i][j]` = α for query i and key j in head t. */
export function headWeights(model: MhaModel, h: number): Matrix[] {
	const dk = headDim(h);
	const scale = 1 / Math.sqrt(dk);
	const Q = splitHeads(matmul(model.X, model.WQ), h);
	const K = splitHeads(matmul(model.X, model.WK), h);
	return Q.map((Qt, t) => {
		const KT = transpose(K[t] ?? []);
		const scores = matmul(Qt, KT).map((row) => row.map((v) => v * scale));
		return softmaxRows(scores);
	});
}

/** Index of the largest value in a row (first one on ties). */
export function argmaxRow(row: readonly number[]): number {
	let best = 0;
	for (let j = 1; j < row.length; j++) {
		if ((row[j] ?? 0) > (row[best] ?? 0)) best = j;
	}
	return best;
}

export interface ShapeInfo {
	h: number;
	n: number;
	dModel: number;
	dk: number;
	/** Shape of Q, K, V after the split: [h, n, d_k]. */
	headsShape: [number, number, number];
	/** Shape of the weights: [h, n, n]. */
	scoresShape: [number, number, number];
	/** Parameters of W_Q, W_K, W_V, W_O without biases: 4·d_model². Independent of h. */
	params: number;
	/** Multiply-adds of all QKᵀ products: h·n²·d_k = n²·d_model. Independent of h. */
	scoreMacs: number;
}

export function shapeInfo(h: number, n: number = TOKEN_COUNT, dModel: number = D_MODEL): ShapeInfo {
	const dk = headDim(h, dModel);
	return {
		h,
		n,
		dModel,
		dk,
		headsShape: [h, n, dk],
		scoresShape: [h, n, n],
		params: 4 * dModel * dModel,
		scoreMacs: h * n * n * dk,
	};
}
