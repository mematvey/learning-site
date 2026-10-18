/**
 * Math of the gradient descent demo: the loss of one weight (1D) or of two weights (2D),
 * the update w <- w - eta * grad, and the stability thresholds 1/curvature and 2/curvature.
 * The start point is fixed, so every page load shows the same trajectory.
 * Pure functions only: no DOM, no Svelte.
 */

export type Dim = 1 | 2;

export interface GradientDescentDemoState {
	/** 1D: L(w) = (w - 3)^2. 2D: L(w1, w2) = (w1 - 3)^2 + 4 (w2 - 3)^2. */
	dim: Dim;
	/** Step size eta (learning rate). */
	eta: number;
	/** Number of update steps drawn. */
	steps: number;
}

export const ETA_MIN = 0.01;
export const ETA_MAX = 1.2;
export const ETA_STEP = 0.01;
export const ETA_DEFAULT = 0.1;
export const STEPS_MIN = 1;
export const STEPS_MAX = 100;
export const STEPS_DEFAULT = 20;

/** Position of the minimum along every weight: w* = 3. */
export const W_STAR = 3;
/** Second derivative along each weight: 2 for the 1D loss; 2 and 8 for the 2D loss. */
export const CURVATURE_1D = 2;
export const CURVATURE_2D: readonly [number, number] = [2, 8];
export const START_1D = 0;
export const START_2D: readonly [number, number] = [0, 0];

/** Domain of both charts, the same on each axis. */
export const DOM_LO = -1;
export const DOM_HI = 7;
/** Top of the loss axis in the 1D chart. Points above it are drawn at the top edge. */
export const LOSS_MAX = 18;

export type Regime = 'smooth' | 'oscillate' | 'bounce' | 'diverge';

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Element by index; negative indices count from the end. Throws when the index is out of range. */
export function itemAt<T>(xs: readonly T[], i: number): T {
	const v = xs[i < 0 ? xs.length + i : i];
	if (v === undefined) throw new RangeError(`index ${i} is out of range`);
	return v;
}

/** Any value other than 2 means the 1D demo. */
export function snapDim(v: unknown): Dim {
	return v === 2 ? 2 : 1;
}

/** Rounds to two decimals and clamps to the eta slider range. Non-finite input gives the default. */
export function snapEta(v: number): number {
	if (!Number.isFinite(v)) return ETA_DEFAULT;
	return Math.round(clamp(v, ETA_MIN, ETA_MAX) * 100) / 100;
}

/** Rounds to an integer and clamps to the steps slider range. Non-finite input gives the default. */
export function snapSteps(v: number): number {
	if (!Number.isFinite(v)) return STEPS_DEFAULT;
	return Math.round(clamp(v, STEPS_MIN, STEPS_MAX));
}

export function loss1d(w: number): number {
	return (CURVATURE_1D / 2) * (w - W_STAR) ** 2;
}

/** Gradient of the 1D loss: 2 (w - 3). */
export function grad1d(w: number): number {
	return CURVATURE_1D * (w - W_STAR);
}

export function loss2d(w1: number, w2: number): number {
	return (CURVATURE_2D[0] / 2) * (w1 - W_STAR) ** 2 + (CURVATURE_2D[1] / 2) * (w2 - W_STAR) ** 2;
}

/** Gradient of the 2D loss: (2 (w1 - 3), 8 (w2 - 3)). */
export function grad2d(w1: number, w2: number): [number, number] {
	return [CURVATURE_2D[0] * (w1 - W_STAR), CURVATURE_2D[1] * (w2 - W_STAR)];
}

/** Points w_0 .. w_steps of plain gradient descent in 1D (steps + 1 values, the first is the start). */
export function trajectory1d(eta: number, steps: number, start = START_1D): number[] {
	const w = [start];
	for (let k = 0; k < steps; k++) {
		const cur = itemAt(w, k);
		w.push(cur - eta * grad1d(cur));
	}
	return w;
}

/** Points of gradient descent in 2D (steps + 1 pairs, the first is the start). */
export function trajectory2d(
	eta: number,
	steps: number,
	start: readonly [number, number] = START_2D,
): Array<[number, number]> {
	const path: Array<[number, number]> = [[start[0], start[1]]];
	for (let k = 0; k < steps; k++) {
		const [a, b] = itemAt(path, k);
		const [ga, gb] = grad2d(a, b);
		path.push([a - eta * ga, b - eta * gb]);
	}
	return path;
}

/** Steepest curvature of the loss: sets the stability threshold. */
export function maxCurvature(dim: Dim): number {
	return dim === 1 ? CURVATURE_1D : Math.max(...CURVATURE_2D);
}

/** Smooth and convergent limit 1 / curvature and the divergence limit 2 / curvature. */
export function stabilityLimits(dim: Dim): { smooth: number; limit: number } {
	const lambda = maxCurvature(dim);
	return { smooth: 1 / lambda, limit: 2 / lambda };
}

/**
 * Behaviour along the steepest direction. The factor per step is |1 - eta * curvature|:
 * below 1/curvature the error shrinks without sign change, up to 2/curvature it shrinks
 * with sign change, exactly at 2/curvature it bounces, above it grows.
 */
export function regimeOf(dim: Dim, eta: number): Regime {
	const { smooth, limit } = stabilityLimits(dim);
	if (eta <= smooth) return 'smooth';
	if (eta < limit) return 'oscillate';
	if (eta === limit) return 'bounce';
	return 'diverge';
}

/** Formats a number with a decimal comma and a true minus sign. Very large values use exponent form. */
export function fmt(v: number, digits = 2): string {
	if (!Number.isFinite(v)) return String(v);
	if (Math.abs(v) >= 1e4) return v.toExponential(1).replace('.', ',').replace('-', '−');
	const threshold = 0.5 * 10 ** -digits;
	const x = Math.abs(v) < threshold ? 0 : v;
	return x.toFixed(digits).replace('.', ',').replace('-', '−');
}

const REGIME_TEXT: Record<Regime, string> = {
	smooth: 'ошибка уменьшается без колебаний, спуск сходится',
	oscillate: 'ошибка меняет знак, но по модулю уменьшается, спуск сходится колебаниями',
	bounce: 'ошибка не уменьшается, точка прыгает между двумя значениями',
	diverge: 'ошибка растёт по модулю, спуск расходится',
};

/** Text for aria-live: current step, loss and what the step size does. */
export function describeState(
	dim: Dim,
	eta: number,
	steps: number,
	traj: ReadonlyArray<number | readonly [number, number]>,
): string {
	const { limit } = stabilityLimits(dim);
	const regime = regimeOf(dim, eta);
	const threshold = `Порог сходимости: η < ${fmt(limit)}.`;
	const head = `При η = ${fmt(eta)} ${REGIME_TEXT[regime]}.`;
	if (dim === 1) {
		const w = traj[traj.length - 1] as number;
		return `Шаг ${steps}: w = ${fmt(w)}, потери L(w) = ${fmt(loss1d(w))}. ${head} ${threshold}`;
	}
	const [a, b] = traj[traj.length - 1] as [number, number];
	return (
		`Шаг ${steps}: w₁ = ${fmt(a)}, w₂ = ${fmt(b)}, потери L = ${fmt(loss2d(a, b))}. ` +
		`${head} Самое крутое направление w₂ задаёт порог. ${threshold}`
	);
}

/** The last update written out with numbers, for the formula line under the chart. */
export function lastStepText1d(traj: readonly number[], eta: number): string {
	const prev = itemAt(traj, -2);
	const next = itemAt(traj, -1);
	return `w = ${fmt(prev)} − ${fmt(eta)}·${CURVATURE_1D}·(${fmt(prev - W_STAR)}) = ${fmt(next)}`;
}

/** The last update of both weights written out with numbers. */
export function lastStepText2d(
	path: ReadonlyArray<readonly [number, number]>,
	eta: number,
): string {
	const [a0, b0] = itemAt(path, -2);
	const [a1, b1] = itemAt(path, -1);
	return (
		`w₁ = ${fmt(a0)} − ${fmt(eta)}·${CURVATURE_2D[0]}·(${fmt(a0 - W_STAR)}) = ${fmt(a1)}; ` +
		`w₂ = ${fmt(b0)} − ${fmt(eta)}·${CURVATURE_2D[1]}·(${fmt(b0 - W_STAR)}) = ${fmt(b1)}`
	);
}

/** Horizontal position of a weight value in a chart `width` px wide. */
export function scaleX(v: number, width: number, pad = 16): number {
	return pad + ((v - DOM_LO) / (DOM_HI - DOM_LO)) * (width - 2 * pad);
}

/** Vertical position of a w2 value in a square chart (w2 grows upwards). */
export function scaleYUp(v: number, size: number, pad = 16): number {
	return size - pad - ((v - DOM_LO) / (DOM_HI - DOM_LO)) * (size - 2 * pad);
}

/** Vertical position of a loss value in a 1D chart `height` px tall; bottom area is kept for ticks. */
export function lossY(loss: number, height: number, pad = 16, bottom = 28): number {
	const v = clamp(loss, 0, LOSS_MAX);
	return height - bottom - (v / LOSS_MAX) * (height - bottom - pad);
}

/** Curve of the 1D loss sampled over the chart domain, as pixel points. */
export function curvePoints1d(width: number, height: number, n = 120): Array<[number, number]> {
	const pts: Array<[number, number]> = [];
	for (let i = 0; i <= n; i++) {
		const w = DOM_LO + ((DOM_HI - DOM_LO) * i) / n;
		pts.push([scaleX(w, width), lossY(loss1d(w), height)]);
	}
	return pts;
}

/**
 * Radii in px of the level set loss2d = c (an ellipse centred at (3, 3)):
 * (w1 - 3)^2 = c along w1 and (w2 - 3)^2 = c / 4 along w2.
 */
export function contourRadii(level: number, size: number, pad = 16): { rx: number; ry: number } {
	const unit = (size - 2 * pad) / (DOM_HI - DOM_LO);
	return {
		rx: Math.sqrt(level / (CURVATURE_2D[0] / 2)) * unit,
		ry: Math.sqrt(level / (CURVATURE_2D[1] / 2)) * unit,
	};
}

/** True when a point lies outside the chart domain (or above the loss axis in 1D). */
export function isOutside1d(w: number, loss: number): boolean {
	return w < DOM_LO || w > DOM_HI || loss > LOSS_MAX;
}

export function isOutside2d(w1: number, w2: number): boolean {
	return w1 < DOM_LO || w1 > DOM_HI || w2 < DOM_LO || w2 > DOM_HI;
}
