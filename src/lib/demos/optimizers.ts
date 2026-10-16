/**
 * Math of the optimizer demo: SGD, momentum and Adam on a 2-D quadratic loss
 * f(w) = ½ (w₁² + κ·w₂²). The surface is ill-conditioned when κ is large: the valley is steep
 * along w₂ and flat along w₁. All trajectories start from the same point with the same step count.
 * The loss is exact, so its level sets are ellipses and are drawn analytically.
 * Pure functions only: no DOM, no Svelte.
 */

export type Point = readonly [number, number];

export const START: Point = [-4, 3];
/** Half-width of the square plot window in data units: w in [-AXIS, AXIS]². */
export const AXIS = 5;

export const KAPPA_MIN = 1;
export const KAPPA_MAX = 20;
export const KAPPA_STEP = 1;
export const KAPPA_DEFAULT = 20;

export const LR_MIN = 0.01;
export const LR_MAX = 0.5;
export const LR_STEP = 0.01;
export const LR_DEFAULT = 0.07;

export const MOMENTUM_MIN = 0;
export const MOMENTUM_MAX = 0.99;
export const MOMENTUM_STEP = 0.01;
export const MOMENTUM_DEFAULT = 0.9;

/** Number of iterations computed for each optimizer; the step slider scrubs through them. */
export const TOTAL_STEPS = 60;
export const STEP_DEFAULT = 30;

/** Adam defaults from the original paper (Kingma & Ba, 2014). */
export const ADAM_BETA1 = 0.9;
export const ADAM_BETA2 = 0.999;
export const ADAM_EPS = 1e-8;

/** A trajectory is cut when any coordinate leaves this box or becomes non-finite. */
export const DIVERGE_LIMIT = 1e3;

export type OptimizerKind = 'sgd' | 'momentum' | 'adam';
export const OPTIMIZER_KINDS: readonly OptimizerKind[] = ['sgd', 'momentum', 'adam'];

export const OPTIMIZER_NAME: Record<OptimizerKind, string> = {
	sgd: 'SGD',
	momentum: 'momentum',
	adam: 'Adam',
};

export interface OptimizerDemoState {
	/** Learning rate η, shared by all optimizers. */
	lr: number;
	/** Curvature ratio κ of the second coordinate. */
	kappa: number;
	/** Momentum coefficient β of the momentum optimizer (SGD and Adam do not use it). */
	momentum: number;
	/** Iteration shown on the plot and in the legend. */
	step: number;
}

export interface OptimizerConfig {
	lr: number;
	kappa: number;
	momentum: number;
}

export interface Trajectory {
	/** Points w_0 ... w_T. Shorter than TOTAL_STEPS + 1 when diverged. */
	points: Point[];
	diverged: boolean;
}

export function isOptimizerKind(v: unknown): v is OptimizerKind {
	return v === 'sgd' || v === 'momentum' || v === 'adam';
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to the slider step and clamps to the range. Non-finite input gives the default. */
function snapTo(v: number, lo: number, hi: number, step: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	const digits = Math.max(0, Math.round(-Math.log10(step)));
	const snapped = Math.round(clamp(v, lo, hi) / step) * step;
	return Number(snapped.toFixed(digits));
}

export function snapLr(v: number): number {
	return snapTo(v, LR_MIN, LR_MAX, LR_STEP, LR_DEFAULT);
}

export function snapKappa(v: number): number {
	return snapTo(v, KAPPA_MIN, KAPPA_MAX, KAPPA_STEP, KAPPA_DEFAULT);
}

export function snapMomentum(v: number): number {
	return snapTo(v, MOMENTUM_MIN, MOMENTUM_MAX, MOMENTUM_STEP, MOMENTUM_DEFAULT);
}

/** Integer iteration in [0, TOTAL_STEPS]. */
export function snapStep(v: number): number {
	if (!Number.isFinite(v)) return STEP_DEFAULT;
	return Math.round(clamp(v, 0, TOTAL_STEPS));
}

/** f(w) = ½ (w₁² + κ·w₂²). */
export function loss(w: Point, kappa: number): number {
	return 0.5 * (w[0] * w[0] + kappa * w[1] * w[1]);
}

/** ∇f(w) = (w₁, κ·w₂). */
export function grad(w: Point, kappa: number): Point {
	return [w[0], kappa * w[1]];
}

function isFinitePoint(w: Point): boolean {
	return (
		Number.isFinite(w[0]) &&
		Number.isFinite(w[1]) &&
		Math.abs(w[0]) <= DIVERGE_LIMIT &&
		Math.abs(w[1]) <= DIVERGE_LIMIT
	);
}

/**
 * Runs one optimizer for `steps` iterations from `start`.
 * SGD: w ← w − η g.
 * Momentum (heavy ball): v ← β v + g, w ← w − η v.
 * Adam: m, v are moving averages of g and g²; bias-corrected m̂, v̂; w ← w − η m̂ / (√v̂ + ε).
 */
export function trajectory(
	kind: OptimizerKind,
	cfg: OptimizerConfig,
	steps: number = TOTAL_STEPS,
	start: Point = START,
): Trajectory {
	let w: Point = [start[0], start[1]];
	const points: Point[] = [w];
	/** Momentum buffer (momentum) or first moment m (Adam). */
	let m: [number, number] = [0, 0];
	/** Second moment v (Adam). */
	let v: [number, number] = [0, 0];

	for (let t = 1; t <= steps; t++) {
		const g = grad(w, cfg.kappa);
		let next: [number, number];
		if (kind === 'sgd') {
			next = [w[0] - cfg.lr * g[0], w[1] - cfg.lr * g[1]];
		} else if (kind === 'momentum') {
			m = [cfg.momentum * m[0] + g[0], cfg.momentum * m[1] + g[1]];
			next = [w[0] - cfg.lr * m[0], w[1] - cfg.lr * m[1]];
		} else {
			m = [
				ADAM_BETA1 * m[0] + (1 - ADAM_BETA1) * g[0],
				ADAM_BETA1 * m[1] + (1 - ADAM_BETA1) * g[1],
			];
			v = [
				ADAM_BETA2 * v[0] + (1 - ADAM_BETA2) * g[0] * g[0],
				ADAM_BETA2 * v[1] + (1 - ADAM_BETA2) * g[1] * g[1],
			];
			const c1 = 1 - ADAM_BETA1 ** t;
			const c2 = 1 - ADAM_BETA2 ** t;
			next = [
				w[0] - (cfg.lr * (m[0] / c1)) / (Math.sqrt(v[0] / c2) + ADAM_EPS),
				w[1] - (cfg.lr * (m[1] / c1)) / (Math.sqrt(v[1] / c2) + ADAM_EPS),
			];
		}
		if (!isFinitePoint(next)) return { points, diverged: true };
		w = next;
		points.push(w);
	}
	return { points, diverged: false };
}

/** Point of a trajectory at iteration `step`, clamped to the computed part. */
export function pointAt(traj: Trajectory, step: number): Point {
	const i = clamp(Math.round(step), 0, traj.points.length - 1);
	return traj.points[i] ?? START;
}

/** True when the trajectory has stopped before `step` because it diverged. */
export function divergedBy(traj: Trajectory, step: number): boolean {
	return traj.diverged && step >= traj.points.length - 1;
}

/**
 * Semi-axes of the level set f = level in data units: w₁ = ±√(2·level), w₂ = ±√(2·level/κ).
 */
export function levelRadii(level: number, kappa: number): [number, number] {
	return [Math.sqrt(2 * level), Math.sqrt((2 * level) / kappa)];
}

/** Map a point of the square window [-AXIS, AXIS]² to pixels of a `size`×`size` box. */
export function toPixel(w: Point, size: number): [number, number] {
	const k = size / (2 * AXIS);
	return [(w[0] + AXIS) * k, (AXIS - w[1]) * k];
}

/** Short loss text: scientific notation for small values. */
export function formatLoss(v: number): string {
	if (!Number.isFinite(v)) return '∞';
	if (v < 0.01) return v.toExponential(1);
	return v.toFixed(2);
}

/** Text for aria-live: the state of all optimizers at the chosen step. Numbers are computed. */
export function describeOptimizers(
	cfg: OptimizerConfig,
	step: number,
	trajs: Readonly<Record<OptimizerKind, Trajectory>>,
): string {
	const parts = OPTIMIZER_KINDS.map((kind) => {
		const traj = trajs[kind];
		const name = OPTIMIZER_NAME[kind];
		if (divergedBy(traj, step)) return `${name} расходится`;
		const w = pointAt(traj, step);
		return `${name} ${formatLoss(loss(w, cfg.kappa))}`;
	});
	return `Шаг ${step} из ${TOTAL_STEPS}, η = ${cfg.lr.toFixed(2)}, κ = ${cfg.kappa}. Потери: ${parts.join(', ')}.`;
}
