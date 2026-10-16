/**
 * Math of the logistic regression demo. Pure functions only: no DOM, no Svelte.
 * The dataset is a fixed pseudo-random sample (seeded PRNG), so every page load shows the same points.
 */
import { mulberry32 } from './attention';

export type Label = 0 | 1;

export interface Point {
	x: number;
	y: number;
	label: Label;
}

/** Weights of the linear score z = w1·x1 + w2·x2 + b. */
export interface LogisticParams {
	w1: number;
	w2: number;
	b: number;
}

/** Full state of the demo: parameters, classification threshold and GD step size. */
export interface LogisticDemoState extends LogisticParams {
	/** Probability threshold: predict class 1 when p >= threshold. */
	threshold: number;
	/** Gradient descent step size α. */
	lr: number;
}

export interface Confusion {
	tp: number;
	fp: number;
	tn: number;
	fn: number;
}

export const SEED = 20241107;
export const N_PER_CLASS = 20;
export const SPREAD = 0.75;
/** Coordinates are clipped to ±CLIP so that no point leaves the plot. */
const CLIP = 2.9;
const CENTERS: Record<Label, [number, number]> = {
	0: [-1.1, -0.6],
	1: [1.1, 0.6],
};

/** Visible square of the plot in data units (both axes). */
export const DOMAIN_MIN = -3;
export const DOMAIN_MAX = 3;
/** Cells per side of the probability background. */
export const GRID_N = 30;

/** Slider ranges. Weights are kept in the same range (GD steps are clamped to it). */
export const PARAM_MIN = -4;
export const PARAM_MAX = 4;
export const PARAM_STEP = 0.1;
export const THRESHOLD_MIN = 0.05;
export const THRESHOLD_MAX = 0.95;
export const THRESHOLD_STEP = 0.05;
export const LR_MIN = 0.05;
export const LR_MAX = 2;
export const LR_STEP = 0.05;

/** Start of the demo: a tilted boundary. */
export const DEFAULT_STATE: LogisticDemoState = { w1: 0.5, w2: 0.5, b: 0, threshold: 0.5, lr: 0.5 };
/** Zero weights: p = 0.5 everywhere, the start of gradient descent. */
export const ZERO_PARAMS: LogisticParams = { w1: 0, w2: 0, b: 0 };

const EPS = 1e-9;

/** Standard normal N(0, 1) via Box-Muller on the given generator. */
function gauss(rand: () => number): number {
	let u = 0;
	while (u === 0) u = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

function clip(v: number): number {
	return Math.min(CLIP, Math.max(-CLIP, v));
}

/** Two Gaussian clouds of equal size with a moderate overlap. */
export function makeDataset(seed: number = SEED): Point[] {
	const rand = mulberry32(seed);
	const points: Point[] = [];
	for (let k = 0; k < N_PER_CLASS; k++) {
		for (const label of [0, 1] as const) {
			const [cx, cy] = CENTERS[label];
			points.push({
				x: clip(cx + SPREAD * gauss(rand)),
				y: clip(cy + SPREAD * gauss(rand)),
				label,
			});
		}
	}
	return points;
}

/** Stable sigmoid: never computes exp of a large positive number. */
export function sigmoid(z: number): number {
	if (z >= 0) return 1 / (1 + Math.exp(-z));
	const e = Math.exp(z);
	return e / (1 + e);
}

/** log(1 + exp(x)) without overflow; softplus(-z) = -log sigmoid(z). */
export function softplus(x: number): number {
	return Math.max(x, 0) + Math.log1p(Math.exp(-Math.abs(x)));
}

/** Inverse of the sigmoid: the score at which the probability equals `p`. */
export function logit(p: number): number {
	return Math.log(p / (1 - p));
}

/** Linear score z = w1·x1 + w2·x2 + b. */
export function scoreAt(params: LogisticParams, x: number, y: number): number {
	return params.w1 * x + params.w2 * y + params.b;
}

/** Probability of class 1 at (x, y). */
export function predictProba(params: LogisticParams, x: number, y: number): number {
	return sigmoid(scoreAt(params, x, y));
}

/** Mean log-loss, computed from the score with softplus (no log(0) for large scores). */
export function logLoss(points: readonly Point[], params: LogisticParams): number {
	if (points.length === 0) return 0;
	let sum = 0;
	for (const p of points) {
		const z = scoreAt(params, p.x, p.y);
		sum += p.label === 1 ? softplus(-z) : softplus(z);
	}
	return sum / points.length;
}

/** Gradient of the mean log-loss: Xᵀ(p − y)/n for the weights, mean(p − y) for the bias. */
export function gradient(points: readonly Point[], params: LogisticParams): LogisticParams {
	const n = Math.max(points.length, 1);
	let gw1 = 0;
	let gw2 = 0;
	let gb = 0;
	for (const p of points) {
		const r = sigmoid(scoreAt(params, p.x, p.y)) - p.label;
		gw1 += r * p.x;
		gw2 += r * p.y;
		gb += r;
	}
	return { w1: gw1 / n, w2: gw2 / n, b: gb / n };
}

export function clampParam(v: number): number {
	return Math.min(PARAM_MAX, Math.max(PARAM_MIN, v));
}

/** One gradient descent step; weights stay inside the slider range. */
export function gdStep(
	points: readonly Point[],
	params: LogisticParams,
	lr: number,
): LogisticParams {
	const g = gradient(points, params);
	return {
		w1: clampParam(params.w1 - lr * g.w1),
		w2: clampParam(params.w2 - lr * g.w2),
		b: clampParam(params.b - lr * g.b),
	};
}

/** `k` gradient descent steps from `params`. */
export function gdSteps(
	points: readonly Point[],
	params: LogisticParams,
	lr: number,
	k: number,
): LogisticParams {
	let current = { ...params };
	for (let i = 0; i < k; i++) current = gdStep(points, current, lr);
	return current;
}

/** Class predicted at threshold: 1 when p >= threshold. */
export function classify(p: number, threshold: number): Label {
	return p >= threshold ? 1 : 0;
}

export function confusion(
	points: readonly Point[],
	params: LogisticParams,
	threshold: number,
): Confusion {
	const c: Confusion = { tp: 0, fp: 0, tn: 0, fn: 0 };
	for (const p of points) {
		const pred = classify(predictProba(params, p.x, p.y), threshold);
		if (pred === 1) {
			if (p.label === 1) c.tp++;
			else c.fp++;
		} else if (p.label === 1) {
			c.fn++;
		} else {
			c.tn++;
		}
	}
	return c;
}

export function accuracy(c: Confusion): number {
	const n = c.tp + c.fp + c.tn + c.fn;
	return n === 0 ? 0 : (c.tp + c.tn) / n;
}

/**
 * Probability of class 1 at the centres of a `n`×`n` grid over the visible square.
 * Row 0 is the top row (largest x2), so the rows can be drawn top to bottom.
 */
export function probabilityGrid(params: LogisticParams, n: number = GRID_N): number[][] {
	const step = (DOMAIN_MAX - DOMAIN_MIN) / n;
	const rows: number[][] = [];
	for (let r = 0; r < n; r++) {
		const y = DOMAIN_MAX - (r + 0.5) * step;
		const row: number[] = [];
		for (let c = 0; c < n; c++) {
			row.push(predictProba(params, DOMAIN_MIN + (c + 0.5) * step, y));
		}
		rows.push(row);
	}
	return rows;
}

export type Segment = [number, number, number, number];

/**
 * Decision line at the threshold: points with w1·x1 + w2·x2 + b = logit(threshold),
 * clipped to the visible square. Returns [x1, y1, x2, y2] or null when there is no line.
 */
export function boundarySegment(params: LogisticParams, threshold: number): Segment | null {
	const { w1, w2 } = params;
	if (Math.abs(w1) < EPS && Math.abs(w2) < EPS) return null;
	const c = logit(threshold) - params.b;
	const tol = 1e-9;
	const inside = (v: number): boolean => v >= DOMAIN_MIN - tol && v <= DOMAIN_MAX + tol;
	const found: Array<[number, number]> = [];
	if (Math.abs(w2) > EPS) {
		for (const x of [DOMAIN_MIN, DOMAIN_MAX]) {
			const y = (c - w1 * x) / w2;
			if (inside(y)) found.push([x, y]);
		}
	}
	if (Math.abs(w1) > EPS) {
		for (const y of [DOMAIN_MIN, DOMAIN_MAX]) {
			const x = (c - w2 * y) / w1;
			if (inside(x)) found.push([x, y]);
		}
	}
	// A line through a corner is found twice: keep distinct points only.
	const unique = found.filter(
		(p, i) =>
			found.findIndex((q) => Math.abs(q[0] - p[0]) < tol && Math.abs(q[1] - p[1]) < tol) === i,
	);
	const a = unique[0];
	const b = unique[1];
	if (!a || !b) return null;
	return [a[0], a[1], b[0], b[1]];
}

function snap(v: number, step: number, min: number, max: number): number {
	const snapped = Math.round(v / step) * step;
	return Number(Math.min(max, Math.max(min, snapped)).toFixed(2));
}

/**
 * Applies a partial patch to the state: non-finite values are ignored, the rest is clamped
 * to the slider ranges and snapped to their steps. Used by the slider handlers and `DemoLink`.
 */
export function mergeState(
	current: LogisticDemoState,
	patch: Partial<LogisticDemoState>,
): LogisticDemoState {
	const num = (v: unknown): number | undefined =>
		typeof v === 'number' && Number.isFinite(v) ? v : undefined;
	const w1 = num(patch.w1);
	const w2 = num(patch.w2);
	const b = num(patch.b);
	const t = num(patch.threshold);
	const lr = num(patch.lr);
	return {
		w1: w1 === undefined ? current.w1 : snap(w1, PARAM_STEP, PARAM_MIN, PARAM_MAX),
		w2: w2 === undefined ? current.w2 : snap(w2, PARAM_STEP, PARAM_MIN, PARAM_MAX),
		b: b === undefined ? current.b : snap(b, PARAM_STEP, PARAM_MIN, PARAM_MAX),
		threshold:
			t === undefined ? current.threshold : snap(t, THRESHOLD_STEP, THRESHOLD_MIN, THRESHOLD_MAX),
		lr: lr === undefined ? current.lr : snap(lr, LR_STEP, LR_MIN, LR_MAX),
	};
}
