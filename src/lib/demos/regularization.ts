/**
 * Math of the regularisation demo: polynomial fits with a ridge (L2) or lasso (L1) penalty.
 * Pure functions only: no DOM, no Svelte.
 *
 * Data: noisy samples of sin(2*pi*x) on [0, 1], fixed by a seed, so every page load shows the same picture.
 * Objective: ||y - X w||^2 + lambda * P(w). The intercept (the constant basis function) is not penalised.
 * Ridge: P(w) = sum w_j^2, solved exactly by least squares on an augmented matrix.
 * Lasso: P(w) = sum |w_j|, solved by cyclic coordinate descent with soft-thresholding.
 */

import { mulberry32 } from './attention';
import { type Dataset, evalPoly, legendreRow, lstsq, trueFn } from './bias-variance';

export const DEG_MIN = 1;
export const DEG_MAX = 12;
export const DEFAULT_DEGREE = 9;

export const LOG_LAMBDA_MIN = -4;
export const LOG_LAMBDA_MAX = 1;
export const LOG_LAMBDA_STEP = 0.25;
export const DEFAULT_LOG_LAMBDA = -2;

export type Penalty = 'l1' | 'l2';
export const DEFAULT_PENALTY: Penalty = 'l2';

/** Training points: few enough that a high degree overfits. */
export const N_TRAIN = 20;
/** Fresh points from the same distribution, used to measure the error on unseen data. */
export const N_TEST = 200;
export const SIGMA = 0.3;
export const TRAIN_SEED = 20240916;
export const TEST_SEED = 777;

/** Grid on [0, 1] where the fitted curve is drawn. */
export const GRID_N = 81;

/** Coordinate descent limits. */
export const CD_MAX_SWEEPS = 5000;
export const CD_TOL = 1e-10;
/** Weights below this magnitude count as zero. */
export const ZERO_TOL = 1e-8;

export interface RegularizationDemoState {
	/** Polynomial degree k, integer in [DEG_MIN, DEG_MAX]. */
	degree: number;
	/** Decimal logarithm of the penalty weight: lambda = 10^logLambda. */
	logLambda: number;
	/** Penalty type: ridge (L2) or lasso (L1). */
	penalty: Penalty;
}

export function isPenalty(v: unknown): v is Penalty {
	return v === 'l1' || v === 'l2';
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Clamps and rounds a degree to an integer in [DEG_MIN, DEG_MAX]. Non-numbers give the default. */
export function snapDegree(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_DEGREE;
	return clamp(Math.round(v), DEG_MIN, DEG_MAX);
}

/** Clamps log10(lambda) to the slider range and snaps it to the slider step. */
export function snapLogLambda(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_LOG_LAMBDA;
	const c = clamp(v, LOG_LAMBDA_MIN, LOG_LAMBDA_MAX);
	const steps = Math.round((c - LOG_LAMBDA_MIN) / LOG_LAMBDA_STEP);
	// Two decimals remove floating-point noise such as -2.0000000000000004.
	return Math.round((LOG_LAMBDA_MIN + steps * LOG_LAMBDA_STEP) * 100) / 100;
}

/** Penalty weight lambda = 10^logLambda. */
export function lambdaOf(logLambda: number): number {
	return 10 ** logLambda;
}

/** Short text for lambda: two significant digits. */
export function formatLambda(lambda: number): string {
	return lambda.toPrecision(2);
}

/** Standard normal N(0, 1) via Box-Muller on the given generator. */
function gauss(rand: () => number): number {
	const u = Math.max(rand(), 1e-12);
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Noisy samples of sin(2*pi*x) with x stratified on [0, 1]. */
export function makeDataset(seed: number, n: number, sigma: number = SIGMA): Dataset {
	const rand = mulberry32(seed);
	const xs: number[] = [];
	const ys: number[] = [];
	for (let i = 0; i < n; i++) {
		const x = (i + rand()) / n;
		xs.push(x);
		ys.push(trueFn(x) + sigma * gauss(rand));
	}
	return { xs, ys };
}

export function trainSet(): Dataset {
	return makeDataset(TRAIN_SEED, N_TRAIN);
}

export function testSet(): Dataset {
	return makeDataset(TEST_SEED, N_TEST);
}

/** Soft-thresholding operator S(v, t) = sign(v) * max(|v| - t, 0). */
export function softThreshold(v: number, t: number): number {
	return Math.sign(v) * Math.max(Math.abs(v) - t, 0);
}

/**
 * Ridge fit of degree k in the Legendre basis. Minimises ||y - X w||^2 + lambda * sum_{j>=1} w_j^2.
 * The penalty rows sqrt(lambda) * e_j with zero targets turn it into an ordinary least-squares
 * problem, so the QR solver is used and no normal equations are formed.
 */
export function ridgeFit(set: Dataset, k: number, lambda: number): number[] {
	const p = k + 1;
	const rows = set.xs.map((x) => legendreRow(x, k));
	const ys = set.ys.slice();
	for (let j = 1; j < p; j++) {
		const row = new Array<number>(p).fill(0);
		row[j] = Math.sqrt(lambda);
		rows.push(row);
		ys.push(0);
	}
	return lstsq(rows, ys);
}

/**
 * Lasso fit of degree k. Minimises ||y - X w||^2 + lambda * sum_{j>=1} |w_j| by cyclic coordinate
 * descent. Update for a penalised coordinate: w_j = S(rho_j, lambda / 2) / z_j, where
 * z_j = sum_i x_ij^2 and rho_j = sum_i x_ij * (partial residual). The intercept is not thresholded.
 */
export function lassoFit(set: Dataset, k: number, lambda: number): number[] {
	const p = k + 1;
	const X = set.xs.map((x) => legendreRow(x, k));
	const n = X.length;
	const w = new Array<number>(p).fill(0);
	/** Residual y - X w, kept up to date after every coordinate step. */
	const r = set.ys.slice();
	const z = new Array<number>(p).fill(0);
	for (let j = 0; j < p; j++) {
		for (let i = 0; i < n; i++) z[j] = (z[j] ?? 0) + (X[i]?.[j] ?? 0) ** 2;
	}
	for (let sweep = 0; sweep < CD_MAX_SWEEPS; sweep++) {
		let maxDelta = 0;
		for (let j = 0; j < p; j++) {
			const zj = z[j] ?? 0;
			if (zj === 0) continue;
			const wOld = w[j] ?? 0;
			let rho = 0;
			for (let i = 0; i < n; i++) {
				const xij = X[i]?.[j] ?? 0;
				rho += xij * ((r[i] ?? 0) + xij * wOld);
			}
			const wNew = j === 0 ? rho / zj : softThreshold(rho, lambda / 2) / zj;
			const delta = wNew - wOld;
			if (delta !== 0) {
				for (let i = 0; i < n; i++) r[i] = (r[i] ?? 0) - (X[i]?.[j] ?? 0) * delta;
			}
			w[j] = wNew;
			maxDelta = Math.max(maxDelta, Math.abs(delta));
		}
		if (maxDelta < CD_TOL) break;
	}
	return w;
}

/** Fit with the chosen penalty. Coefficients are in the Legendre basis, w[0] is the intercept. */
export function fitModel(set: Dataset, k: number, logLambda: number, penalty: Penalty): number[] {
	const lambda = lambdaOf(logLambda);
	return penalty === 'l2' ? ridgeFit(set, k, lambda) : lassoFit(set, k, lambda);
}

/** Mean squared error of the model w on a dataset. */
export function mse(set: Dataset, w: readonly number[]): number {
	const n = set.xs.length;
	if (n === 0) return 0;
	let s = 0;
	for (let i = 0; i < n; i++) {
		const d = evalPoly(w, set.xs[i] ?? 0) - (set.ys[i] ?? 0);
		s += d * d;
	}
	return s / n;
}

/** Euclidean norm of the penalised weights (the intercept is excluded). */
export function penalisedNorm(w: readonly number[]): number {
	let s = 0;
	for (let j = 1; j < w.length; j++) s += (w[j] ?? 0) ** 2;
	return Math.sqrt(s);
}

/** Number of penalised weights (not the intercept) whose magnitude exceeds ZERO_TOL. */
export function nonZeroCount(w: readonly number[]): number {
	let c = 0;
	for (let j = 1; j < w.length; j++) if (Math.abs(w[j] ?? 0) > ZERO_TOL) c++;
	return c;
}

/** Points of the fitted curve on a grid of GRID_N equally spaced x in [0, 1]. */
export function curvePoints(w: readonly number[], n: number = GRID_N): [number, number][] {
	return Array.from({ length: n }, (_, i) => {
		const x = i / (n - 1);
		return [x, evalPoly(w, x)] as [number, number];
	});
}

/** Text of the description line under the charts. Numbers are computed, not typed. */
export function describeModel(
	penalty: Penalty,
	k: number,
	w: readonly number[],
	train: number,
	test: number,
): string {
	const nz = nonZeroCount(w);
	const errors = `Ошибка на обучении ${train.toFixed(3)}, на новых точках ${test.toFixed(3)}.`;
	if (penalty === 'l1') {
		return (
			`Lasso: ненулевых весов ${nz} из ${k}. ` +
			'Штраф |w| обнуляет часть весов точно, так что модель отбирает члены полинома. ' +
			errors
		);
	}
	return (
		`Ridge: ‖w‖ = ${penalisedNorm(w).toFixed(2)}, ненулевых весов ${nz} из ${k}. ` +
		'Штраф на квадрат сжимает веса к нулю, но редко обнуляет их точно. ' +
		errors
	);
}
