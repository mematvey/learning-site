/**
 * Math of the bias-variance demo. Pure functions only: no DOM, no Svelte.
 *
 * Setup: the true function is sin(2*pi*x) on [0, 1]. Many training sets of the same size are
 * drawn with Gaussian noise. For each polynomial degree k we fit every set by least squares
 * and measure, on a grid, the squared bias of the average fit and the variance across fits.
 * The data are fixed by a seed, so every page load shows the same picture.
 */

import { mulberry32 } from './attention';

export const DEG_MIN = 1;
export const DEG_MAX = 15;
export const DEFAULT_DEGREE = 1;
/** Points per training set. */
export const N_POINTS = 25;
/** Number of training sets (the cloud of fits). */
export const TRIALS = 40;
/** Standard deviation of the label noise. */
export const SIGMA = 0.3;
export const SEED = 20240915;
/** Grid on [0, 1] where bias and variance are averaged. */
export const GRID_N = 101;

export interface Dataset {
	xs: number[];
	ys: number[];
}

export interface DegreeStats {
	degree: number;
	/** Mean over the grid of (average fit - true function)^2. */
	bias2: number;
	/** Mean over the grid and trials of (fit - average fit)^2. */
	variance: number;
	/** bias2 + variance (noise excluded). */
	sum: number;
}

export interface BiasVarianceDemoState {
	/** Polynomial degree k, integer in [DEG_MIN, DEG_MAX]. */
	degree: number;
}

/** True function of the demo. */
export function trueFn(x: number): number {
	return Math.sin(2 * Math.PI * x);
}

/** Grid of GRID_N equally spaced points on [0, 1]. */
export function gridXs(n: number = GRID_N): number[] {
	return Array.from({ length: n }, (_, i) => i / (n - 1));
}

/** Clamps and rounds a degree to an integer in [DEG_MIN, DEG_MAX]. Non-numbers give the default. */
export function snapDegree(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_DEGREE;
	return Math.min(DEG_MAX, Math.max(DEG_MIN, Math.round(v)));
}

/** Standard normal N(0, 1) via Box-Muller on the given generator. */
function gauss(rand: () => number): number {
	const u = Math.max(rand(), 1e-12);
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Training sets: x stratified on [0, 1], y = sin(2*pi*x) + N(0, sigma^2).
 * The same sets are used for every degree, so the degrees are compared on equal data.
 */
export function makeDatasets(
	seed: number = SEED,
	n: number = N_POINTS,
	trials: number = TRIALS,
	sigma: number = SIGMA,
): Dataset[] {
	const rand = mulberry32(seed);
	const sets: Dataset[] = [];
	for (let t = 0; t < trials; t++) {
		const xs: number[] = [];
		const ys: number[] = [];
		for (let i = 0; i < n; i++) {
			// Stratified: one jittered point per stratum keeps the design spread out.
			const x = (i + rand()) / n;
			xs.push(x);
			ys.push(trueFn(x) + sigma * gauss(rand));
		}
		sets.push({ xs, ys });
	}
	return sets;
}

/**
 * Legendre polynomials P_0..P_k at x in [0, 1] (mapped to [-1, 1]).
 * They span the same space as the powers 1, x, ..., x^k, but are much better conditioned.
 */
export function legendreRow(x: number, k: number): number[] {
	const t = 2 * x - 1;
	const row = [1];
	if (k >= 1) row.push(t);
	for (let n = 1; n < k; n++) {
		const prev = row[n - 1] ?? 0;
		const cur = row[n] ?? 0;
		row.push(((2 * n + 1) * t * cur - n * prev) / (n + 1));
	}
	return row;
}

/**
 * Least squares min ||A w - y|| by Householder QR (no normal equations, so no squared condition
 * number). `rows` is an m x p matrix with m >= p. Returns w of length p.
 */
export function lstsq(rows: number[][], y: number[]): number[] {
	const m = rows.length;
	const p = rows[0]?.length ?? 0;
	const A = rows.map((r) => r.slice());
	const b = y.slice();
	for (let j = 0; j < p; j++) {
		let norm = 0;
		for (let i = j; i < m; i++) norm += (A[i]?.[j] ?? 0) ** 2;
		norm = Math.sqrt(norm);
		if (norm === 0) continue;
		const pivot = A[j]?.[j] ?? 0;
		const alpha = pivot > 0 ? -norm : norm;
		const v: number[] = [];
		for (let i = j; i < m; i++) v.push(A[i]?.[j] ?? 0);
		v[0] = (v[0] ?? 0) - alpha;
		let vv = 0;
		for (const c of v) vv += c * c;
		if (vv === 0) continue;
		for (let c = j; c < p; c++) {
			let s = 0;
			for (let i = j; i < m; i++) s += (v[i - j] ?? 0) * (A[i]?.[c] ?? 0);
			const f = (2 * s) / vv;
			for (let i = j; i < m; i++) {
				const row = A[i];
				if (row) row[c] = (row[c] ?? 0) - f * (v[i - j] ?? 0);
			}
		}
		let s = 0;
		for (let i = j; i < m; i++) s += (v[i - j] ?? 0) * (b[i] ?? 0);
		const f = (2 * s) / vv;
		for (let i = j; i < m; i++) b[i] = (b[i] ?? 0) - f * (v[i - j] ?? 0);
	}
	const w = new Array<number>(p).fill(0);
	for (let i = p - 1; i >= 0; i--) {
		let s = b[i] ?? 0;
		for (let c = i + 1; c < p; c++) s -= (A[i]?.[c] ?? 0) * (w[c] ?? 0);
		const diag = A[i]?.[i] ?? 0;
		w[i] = Math.abs(diag) < 1e-12 ? 0 : s / diag;
	}
	return w;
}

/** Least-squares fit of degree k on one set; returns the coefficients in the Legendre basis. */
export function fitPoly(set: Dataset, k: number): number[] {
	return lstsq(
		set.xs.map((x) => legendreRow(x, k)),
		set.ys,
	);
}

/** Value of the fitted polynomial with coefficients w at x. */
export function evalPoly(w: readonly number[], x: number): number {
	const row = legendreRow(x, w.length - 1);
	let s = 0;
	for (let i = 0; i < w.length; i++) s += (w[i] ?? 0) * (row[i] ?? 0);
	return s;
}

/** Fits of every trial on the grid: fits[t][g]. */
export function fitsOnGrid(
	datasets: readonly Dataset[],
	k: number,
	grid: readonly number[],
): number[][] {
	return datasets.map((set) => {
		const w = fitPoly(set, k);
		return grid.map((x) => evalPoly(w, x));
	});
}

/** Bias^2, variance and their sum for one degree. */
export function statsForDegree(
	datasets: readonly Dataset[],
	k: number,
	grid: readonly number[] = gridXs(),
): DegreeStats {
	const fits = fitsOnGrid(datasets, k, grid);
	const T = fits.length;
	const G = grid.length;
	let bias2 = 0;
	let variance = 0;
	for (let g = 0; g < G; g++) {
		let mean = 0;
		for (let t = 0; t < T; t++) mean += fits[t]?.[g] ?? 0;
		mean /= T;
		const diff = mean - trueFn(grid[g] ?? 0);
		bias2 += diff * diff;
		for (let t = 0; t < T; t++) {
			const d = (fits[t]?.[g] ?? 0) - mean;
			variance += d * d;
		}
	}
	bias2 /= G;
	variance /= G * T;
	return { degree: k, bias2, variance, sum: bias2 + variance };
}

/** Stats for every degree from DEG_MIN to DEG_MAX on the same datasets. */
export function allStats(datasets: readonly Dataset[]): DegreeStats[] {
	const grid = gridXs();
	const out: DegreeStats[] = [];
	for (let k = DEG_MIN; k <= DEG_MAX; k++) out.push(statsForDegree(datasets, k, grid));
	return out;
}

/** Short Russian reading of the current degree: which error term dominates. */
export function describeRegime(s: Pick<DegreeStats, 'bias2' | 'variance'>): string {
	if (s.bias2 > 2 * s.variance) {
		return 'Смещение доминирует: модель слишком простая и систематически промахивается мимо кривой.';
	}
	if (s.variance > 2 * s.bias2) {
		return 'Разброс доминирует: модель слишком гибкая и сильно меняется от выборки к выборке.';
	}
	return 'Смещение и разброс сопоставимы: ни одна из составляющих не доминирует.';
}
