/**
 * Math of the linear regression demo: least squares, ridge (L2) and gradient descent on MSE.
 * Points live in the unit square [0, 1] x [0, 1]; the component maps them to pixels.
 * Pure functions only: no DOM, no Svelte.
 */
import { mulberry32 } from './attention';

export interface Point {
	x: number;
	y: number;
}

/** Line y = a * x + b. */
export interface Line {
	a: number;
	b: number;
}

/** State the demo exposes to text links (`DemoLink`). */
export interface LinearRegressionDemoState {
	/** Ridge penalty λ >= 0 on the slope (sum-of-squares scale, not the mean). */
	lambda: number;
	/** Gradient descent step size. */
	lr: number;
}

export const LAMBDA_MIN = 0;
export const LAMBDA_MAX = 2;
export const LAMBDA_STEP = 0.05;
export const LAMBDA_DEFAULT = 0;

export const LR_MIN = 0.01;
/** Above ~0.5 the descent diverges for points in [0, 1]^2 (the Hessian norm is at most 4). */
export const LR_MAX = 0.5;
export const LR_STEP = 0.01;
export const LR_DEFAULT = 0.1;

/** Gradient descent steps shown in the loss curve. */
export const GD_STEPS = 60;
/** The demo keeps at least this many points so a line is always defined. */
export const MIN_POINTS = 2;
export const SEED = 20240615;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Clamps a coordinate into [0, 1] and rounds it to 3 decimals. */
export function clampUnit(v: number): number {
	return round3(clamp(Number.isFinite(v) ? v : 0, 0, 1));
}

/** Snaps `v` to the grid `min + k * step` inside [min, max]. */
export function snapTo(v: number, min: number, max: number, step: number): number {
	const k = Math.round((clamp(v, min, max) - min) / step);
	return round3(clamp(min + k * step, min, max));
}

/** Default cloud: a noisy line y ≈ 0.15 + 0.7 x. Same points on every page load. */
export function makePoints(n = 14, seed: number = SEED): Point[] {
	const rand = mulberry32(seed);
	const points: Point[] = [];
	for (let i = 0; i < n; i++) {
		const x = 0.05 + 0.9 * rand();
		// Sum of three uniforms minus 1.5 has sd 0.5: scaled, the noise has sd ≈ 0.06.
		const noise = (rand() + rand() + rand() - 1.5) * 0.12;
		points.push({ x: clampUnit(x), y: clampUnit(0.15 + 0.7 * x + noise) });
	}
	return points;
}

/**
 * Ridge fit with the intercept left unpenalized: minimises Σ(y - a x - b)² + λ a².
 * Works on centred data: a = Sxy / (Sxx + λ), b = ȳ - a x̄. λ = 0 gives ordinary least squares.
 * Returns null when the line is undefined (fewer than 2 points, or all x equal and λ = 0).
 */
export function fitRidge(points: readonly Point[], lambda: number): Line | null {
	const n = points.length;
	if (n < 2) return null;
	let mx = 0;
	let my = 0;
	for (const p of points) {
		mx += p.x;
		my += p.y;
	}
	mx /= n;
	my /= n;
	let sxx = 0;
	let sxy = 0;
	for (const p of points) {
		const dx = p.x - mx;
		sxx += dx * dx;
		sxy += dx * (p.y - my);
	}
	const denom = sxx + Math.max(0, lambda);
	if (denom === 0) return null;
	const a = sxy / denom;
	return { a, b: my - a * mx };
}

/** Ordinary least squares: `fitRidge` with λ = 0. */
export function fitOls(points: readonly Point[]): Line | null {
	return fitRidge(points, 0);
}

export function predict(line: Line, x: number): number {
	return line.a * x + line.b;
}

/** Residuals y - ŷ, in the order of `points`. */
export function residuals(points: readonly Point[], line: Line): number[] {
	return points.map((p) => p.y - predict(line, p.x));
}

/** Mean squared error. Returns NaN for an empty set. */
export function mse(points: readonly Point[], line: Line): number {
	if (points.length === 0) return Number.NaN;
	let sum = 0;
	for (const r of residuals(points, line)) sum += r * r;
	return sum / points.length;
}

/** Coefficient of determination R² = 1 - SSE / SST. Null when all y are equal. */
export function r2(points: readonly Point[], line: Line): number | null {
	const n = points.length;
	if (n === 0) return null;
	const my = points.reduce((s, p) => s + p.y, 0) / n;
	let sst = 0;
	for (const p of points) sst += (p.y - my) ** 2;
	if (sst === 0) return null;
	let sse = 0;
	for (const r of residuals(points, line)) sse += r * r;
	return 1 - sse / sst;
}

export interface DescentResult {
	/** Line after the last step. */
	line: Line;
	/** MSE before each step, plus the MSE after the last one (length = steps + 1). */
	losses: number[];
}

/**
 * Batch gradient descent on MSE from `start` (default a = 0, b = 0).
 * Gradient: dL/da = -2/n Σ x r, dL/db = -2/n Σ r, with r = y - ŷ.
 * Stops early if the values stop being finite, so the curve shows the divergence.
 */
export function gradientDescent(
	points: readonly Point[],
	lr: number,
	steps: number = GD_STEPS,
	start: Line = { a: 0, b: 0 },
): DescentResult {
	const n = points.length;
	let line: Line = { ...start };
	const losses: number[] = [];
	if (n === 0) return { line, losses: [Number.NaN] };
	for (let step = 0; step < steps; step++) {
		const loss = mse(points, line);
		losses.push(loss);
		if (!Number.isFinite(loss)) break;
		let ga = 0;
		let gb = 0;
		for (const p of points) {
			const r = p.y - predict(line, p.x);
			ga += p.x * r;
			gb += r;
		}
		line = { a: line.a - lr * (-2 / n) * ga, b: line.b - lr * (-2 / n) * gb };
	}
	losses.push(mse(points, line));
	return { line, losses };
}

/** Returns a copy with point `index` moved to (x, y), clamped to the unit square. */
export function movePoint(points: readonly Point[], index: number, x: number, y: number): Point[] {
	return points.map((p, i) => (i === index ? { x: clampUnit(x), y: clampUnit(y) } : p));
}

/** Returns a copy with a new point appended (clamped to the unit square). */
export function addPoint(points: readonly Point[], x: number, y: number): Point[] {
	return [...points, { x: clampUnit(x), y: clampUnit(y) }];
}

/** Returns a copy without point `index`; unchanged when only MIN_POINTS remain. */
export function removePoint(points: readonly Point[], index: number): Point[] {
	if (points.length <= MIN_POINTS) return [...points];
	return points.filter((_, i) => i !== index);
}

/** Formats a number for the readouts; null (undefined value) shows a dash. */
export function fmt(v: number | null | undefined, digits = 2): string {
	if (v === null || v === undefined || !Number.isFinite(v)) return '—';
	return v.toFixed(digits);
}
