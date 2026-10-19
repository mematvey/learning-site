/**
 * Math of the gradient boosting demo: 1D regression with small regression trees, boosting with
 * shrinkage nu, a validation curve and early stopping with patience. Pure functions only: no DOM,
 * no Svelte.
 *
 * Everything is deterministic: the data and the noise come from a seed, so every page load shows
 * the same picture. The boosting is built once for MAX_ROUNDS trees (per nu and depth); the
 * slider only chooses a prefix of the trees.
 */

import { mulberry32 } from './attention';
import { clampInt } from './ensembles';

export const SEED = 20241104;
export const N_TRAIN = 40;
export const N_VAL = 40;
/** Standard deviation of the Gaussian noise added to the targets. */
export const NOISE_SD = 0.2;
/** Largest number of boosting rounds (trees) that the demo fits. */
export const MAX_ROUNDS = 60;
/** Rounds without improvement on the validation set before early stopping fires. */
export const PATIENCE = 5;
/** Smallest number of training points in a leaf. */
export const MIN_LEAF = 2;

export const NU_MIN = 0.05;
export const NU_MAX = 1;
export const NU_STEP = 0.05;
export const NU_DEFAULT = 0.3;

export const DEPTH_MIN = 1;
export const DEPTH_MAX = 3;
export const DEPTH_DEFAULT = 2;

export const STEP_MIN = 0;
export const STEP_MAX = MAX_ROUNDS;
export const STEP_DEFAULT = 10;

export interface GbDemoState {
	/** Shrinkage nu: every tree is multiplied by it. */
	nu: number;
	/** Depth of every tree. Depth 1 is a stump (one split). */
	depth: number;
	/** Number of trees added so far (the prefix of the fitted sequence). */
	step: number;
}

export const DEFAULT_STATE: GbDemoState = {
	nu: NU_DEFAULT,
	depth: DEPTH_DEFAULT,
	step: STEP_DEFAULT,
};

/** Shrinkage on the NU_STEP grid inside [NU_MIN, NU_MAX]. Non-numbers give the default. */
export function snapNu(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return NU_DEFAULT;
	const steps = Math.round(Math.min(NU_MAX, Math.max(NU_MIN, v)) / NU_STEP);
	return Math.round(steps * NU_STEP * 100) / 100;
}

export function snapDepth(v: unknown): number {
	return clampInt(v, DEPTH_MIN, DEPTH_MAX, DEPTH_DEFAULT);
}

export function snapStep(v: unknown): number {
	return clampInt(v, STEP_MIN, STEP_MAX, STEP_DEFAULT);
}

export interface Point1 {
	x: number;
	y: number;
}

export interface GbDataset {
	train: Point1[];
	val: Point1[];
}

/** The true curve: one period of a sine on [0, 1]. */
export function trueF(x: number): number {
	return Math.sin(2 * Math.PI * x);
}

/** Standard normal draw (Box-Muller) from a uniform generator. */
function gauss(rand: () => number): number {
	const u = Math.max(rand(), 1e-12);
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Training and validation sets: uniform x on [0, 1], y = sin(2 pi x) + Gaussian noise. */
export function makeData(seed: number = SEED, nTrain = N_TRAIN, nVal = N_VAL): GbDataset {
	const rand = mulberry32(seed);
	const make = (n: number): Point1[] =>
		Array.from({ length: n }, () => {
			const x = rand();
			const y = trueF(x) + NOISE_SD * gauss(rand);
			return { x, y };
		});
	const train = make(nTrain);
	const val = make(nVal);
	return { train, val };
}

/* ---------- Regression tree (least squares, 1D) ---------- */

export type RegTree =
	{ leaf: true; value: number } | { leaf: false; threshold: number; left: RegTree; right: RegTree };

interface Sample {
	x: number;
	r: number;
}

function leafValue(samples: readonly Sample[]): number {
	if (samples.length === 0) return 0;
	let sum = 0;
	for (const s of samples) sum += s.r;
	return sum / samples.length;
}

/** Grows one node: the split with the largest drop of the squared error, or a leaf with the mean. */
function growNode(samples: Sample[], depth: number): RegTree {
	const n = samples.length;
	if (depth <= 0 || n < 2 * MIN_LEAF) return { leaf: true, value: leafValue(samples) };
	const sorted = [...samples].sort((a, b) => a.x - b.x);
	let total = 0;
	for (const s of sorted) total += s.r;
	let sumL = 0;
	let best: { threshold: number; gain: number } | null = null;
	for (let i = 0; i < n - 1; i++) {
		const cur = sorted[i];
		const next = sorted[i + 1];
		if (cur === undefined || next === undefined) continue;
		sumL += cur.r;
		if (cur.x === next.x) continue;
		const nl = i + 1;
		const nr = n - nl;
		if (nl < MIN_LEAF || nr < MIN_LEAF) continue;
		const sumR = total - sumL;
		// The squared error drops by sumL²/nL + sumR²/nR - (sumL + sumR)²/n, the last term is fixed.
		const gain = (sumL * sumL) / nl + (sumR * sumR) / nr;
		if (best === null || gain > best.gain + 1e-12) {
			best = { threshold: (cur.x + next.x) / 2, gain };
		}
	}
	if (best === null) return { leaf: true, value: leafValue(samples) };
	const threshold = best.threshold;
	return {
		leaf: false,
		threshold,
		left: growNode(
			samples.filter((s) => s.x <= threshold),
			depth - 1,
		),
		right: growNode(
			samples.filter((s) => s.x > threshold),
			depth - 1,
		),
	};
}

/** Fits a tree of the given depth to targets r at points xs (least squares, leaves hold means). */
export function fitRegTree(
	xs: readonly number[],
	rs: readonly number[],
	maxDepth: number,
): RegTree {
	const samples: Sample[] = xs.map((x, i) => ({ x, r: rs[i] ?? 0 }));
	return growNode(samples, maxDepth);
}

export function predictRegTree(tree: RegTree, x: number): number {
	let cur: RegTree = tree;
	while (!cur.leaf) {
		cur = x <= cur.threshold ? cur.left : cur.right;
	}
	return cur.value;
}

/* ---------- Gradient boosting with regression trees ---------- */

export interface GbFit {
	/** Start value F_0: the mean of the training targets. */
	base: number;
	/** Shrinkage nu. */
	nu: number;
	/** Depth of every tree. */
	depth: number;
	/** Trees in the order they were added; tree k (1-based) fits the residuals of F_{k-1}. */
	trees: RegTree[];
}

/**
 * Gradient boosting with squared loss. Starts from the mean; each round fits a tree to the
 * residuals y - F and adds nu times it. The first k trees do not depend on the total number of
 * rounds, so the model is refit only when nu or the depth change.
 */
export function fitBoost(
	train: readonly Point1[],
	maxRounds: number,
	nu: number,
	depth: number,
): GbFit {
	const n = train.length;
	const base = n === 0 ? 0 : train.reduce((a, p) => a + p.y, 0) / n;
	const f = train.map(() => base);
	const xs = train.map((p) => p.x);
	const trees: RegTree[] = [];
	for (let m = 0; m < maxRounds && n > 0; m++) {
		const residual = train.map((p, i) => p.y - (f[i] ?? base));
		const tree = fitRegTree(xs, residual, depth);
		trees.push(tree);
		train.forEach((p, i) => {
			f[i] = (f[i] ?? base) + nu * predictRegTree(tree, p.x);
		});
	}
	return { base, nu, depth, trees };
}

/** F_k(x): the start value plus the first k trees, each multiplied by nu. */
export function boostPredict(fit: GbFit, k: number, x: number): number {
	const m = Math.max(0, Math.min(k, fit.trees.length));
	let f = fit.base;
	for (const tree of fit.trees.slice(0, m)) f += fit.nu * predictRegTree(tree, x);
	return f;
}

/** Contribution nu * h_k(x) of the k-th tree (1-based). Zero outside the fitted range. */
export function contribution(fit: GbFit, k: number, x: number): number {
	const tree = fit.trees[k - 1];
	if (k < 1 || tree === undefined) return 0;
	return fit.nu * predictRegTree(tree, x);
}

/** Mean squared error of a prediction on a set of points. */
export function mse(points: readonly Point1[], predict: (x: number) => number): number {
	if (points.length === 0) return 0;
	let sum = 0;
	for (const p of points) {
		const d = p.y - predict(p.x);
		sum += d * d;
	}
	return sum / points.length;
}

/** Errors after k trees for k = 0..(number of trees): index k is the model with k trees. */
export interface Curves {
	train: number[];
	val: number[];
}

/** Training and validation MSE of every prefix of the fitted sequence, computed incrementally. */
export function validationCurves(fit: GbFit, data: GbDataset): Curves {
	const ftr = data.train.map(() => fit.base);
	const fva = data.val.map(() => fit.base);
	const train = [mse(data.train, () => fit.base)];
	const val = [mse(data.val, () => fit.base)];
	for (const tree of fit.trees) {
		data.train.forEach((p, i) => {
			ftr[i] = (ftr[i] ?? fit.base) + fit.nu * predictRegTree(tree, p.x);
		});
		data.val.forEach((p, i) => {
			fva[i] = (fva[i] ?? fit.base) + fit.nu * predictRegTree(tree, p.x);
		});
		train.push(mseOfValues(data.train, ftr));
		val.push(mseOfValues(data.val, fva));
	}
	return { train, val };
}

function mseOfValues(points: readonly Point1[], values: readonly number[]): number {
	if (points.length === 0) return 0;
	let sum = 0;
	points.forEach((p, i) => {
		const d = p.y - (values[i] ?? 0);
		sum += d * d;
	});
	return sum / points.length;
}

export interface EarlyStop {
	/** Round with the lowest validation error seen before the stop (or over the whole curve). */
	best: number;
	/** Round where patience ran out, or null when the curve never stops improving for PATIENCE. */
	stopAt: number | null;
}

/**
 * Early stopping on a validation curve: walk the rounds in order and stop once PATIENCE rounds
 * have passed since the last improvement. Ties keep the earlier round.
 */
export function earlyStop(valCurve: readonly number[], patience: number = PATIENCE): EarlyStop {
	let best = 0;
	let bestVal = valCurve[0] ?? Infinity;
	for (let k = 1; k < valCurve.length; k++) {
		const v = valCurve[k];
		if (v === undefined) continue;
		if (v < bestVal - 1e-12) {
			bestVal = v;
			best = k;
		} else if (k - best >= patience) {
			return { best, stopAt: k };
		}
	}
	return { best, stopAt: null };
}

/* ---------- Drawing helpers ---------- */

/** Linear map from [d0, d1] to [r0, r1]. A degenerate domain maps to the middle of the range. */
export function linearScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
	const span = d1 - d0;
	if (span === 0) return () => (r0 + r1) / 2;
	return (v) => r0 + ((v - d0) * (r1 - r0)) / span;
}

/** SVG path "M x y L x y ..." through the points, coordinates rounded to one decimal. */
export function polylinePath(points: readonly { x: number; y: number }[]): string {
	return points
		.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
		.join(' ');
}

/** Evenly spaced abscissas on [0, 1] for drawing curves. */
export function gridX(n: number): number[] {
	return Array.from({ length: n }, (_, i) => i / (n - 1));
}

/* ---------- Text ---------- */

export function percent(v: number): string {
	return `${Math.round(v * 100)}%`;
}

/** One sentence for the SVG description and the live region. */
export function describeBoost(state: GbDemoState, curves: Curves, stop: EarlyStop): string {
	const k = Math.min(state.step, curves.val.length - 1);
	const tr = curves.train[k] ?? 0;
	const va = curves.val[k] ?? 0;
	const parts = [
		`Деревьев: ${k} из ${MAX_ROUNDS}, сжатие ν = ${state.nu.toFixed(2)}, глубина ${state.depth}.`,
		`Ошибка на обучении ${tr.toFixed(3)}, на контроле ${va.toFixed(3)}.`,
		`Лучший шаг по контролю: ${stop.best}.`,
	];
	if (stop.stopAt !== null) {
		parts.push(`При терпении ${PATIENCE} остановка на шаге ${stop.stopAt}.`);
	}
	return parts.join(' ');
}
