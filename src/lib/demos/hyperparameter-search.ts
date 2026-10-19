/**
 * Math of the hyperparameter-search demo: a synthetic quality surface over two hyperparameters
 * and three search methods (grid, random, successive halving) on the same surface.
 * Coordinates lie in [0, 1]. x is the important hyperparameter, y is the second one; `w` sets how
 * much y matters (0 means it does not matter at all).
 * Measurements are deterministic (seeded), so every page load shows the same picture.
 * Pure functions only: no DOM, no Svelte.
 */

export interface Point {
	x: number;
	y: number;
}

export interface SearchState {
	/** Optimum of the important hyperparameter, in [0, 1]. */
	x0: number;
	/** Optimum of the second hyperparameter, in [0, 1]. */
	y0: number;
	/** Influence of the second hyperparameter, from 0 (none) to 1. */
	w: number;
	/** Number of full trainings that grid and random search may use (random: exactly this many). */
	budget: number;
	/** Seed of the random points and of the measurement noise. */
	seed: number;
}

export type SurfaceParams = Pick<SearchState, 'x0' | 'y0' | 'w'>;

export const DEFAULT_STATE: SearchState = { x0: 0.62, y0: 0.35, w: 0.2, budget: 9, seed: 1 };

export const BUDGET_MIN = 4;
export const BUDGET_MAX = 49;
export const W_MIN = 0;
export const W_MAX = 1;
export const W_STEP = 0.1;

/** Quality = BASE + WEIGHT_X * peak_x + WEIGHT_Y * w * peak_y, so the optimum is BASE + WEIGHT_X + WEIGHT_Y * w. */
const BASE_QUALITY = 0.1;
const WEIGHT_X = 0.7;
const WEIGHT_Y = 0.2;
const PEAK_WIDTH_X = 0.14;
const PEAK_WIDTH_Y = 0.3;

/** Resource units of one full training. Successive halving and full search use the same unit. */
export const FULL_UNITS = 81;
/** Successive halving: number of candidates, keep one third per round, noise at budget 1. */
export const SH_CANDIDATES = 81;
export const SH_ETA = 3;
const NOISE = 0.15;

/** Grid cells per axis of the heatmap. */
export const HEAT_N = 20;

export type MethodId = 'grid' | 'random' | 'halving' | 'full';

export interface MethodResult {
	id: MethodId;
	/** Configurations that are trained. */
	configs: number;
	/** Resource units spent in total. */
	units: number;
	/** Configuration returned by the method. */
	best: Point;
	/** True (noise-free) quality of `best`. */
	value: number;
	/** Distance from `value` to the optimum of the surface. */
	gap: number;
}

export interface HalvingPlan {
	/** survivors[r]: configurations alive after r completed rounds. survivors[0] is all candidates. */
	survivors: Point[][];
	/** Budget per configuration in round r + 1: 1, 3, 9, 27, 81 units. */
	budgets: number[];
	/** Units spent after r completed rounds (cumulative). spent[0] = 0. */
	spent: number[];
	/** Best of all candidates trained once at the full budget (the full search). */
	fullBest: Point;
}

export function clamp01(v: number): number {
	if (!Number.isFinite(v)) return 0;
	return Math.min(1, Math.max(0, v));
}

export function snapBudget(b: number): number {
	if (!Number.isFinite(b)) return DEFAULT_STATE.budget;
	return Math.round(Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, b)));
}

export function snapW(w: number): number {
	if (!Number.isFinite(w)) return DEFAULT_STATE.w;
	return Math.round(Math.min(W_MAX, Math.max(W_MIN, w)) * 10) / 10;
}

/** Seeded generator (mulberry32): the same seed gives the same sequence in [0, 1). */
export function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function gauss(d: number, width: number): number {
	return Math.exp(-(d * d) / (2 * width * width));
}

/** Noise-free quality of a configuration. Peaks at (x0, y0). */
export function quality(p: Point, s: SurfaceParams): number {
	return (
		BASE_QUALITY +
		WEIGHT_X * gauss(p.x - s.x0, PEAK_WIDTH_X) +
		WEIGHT_Y * s.w * gauss(p.y - s.y0, PEAK_WIDTH_Y)
	);
}

/** Quality at the optimum. Used as the maximum for gaps and shading. */
export function qualityMax(s: Pick<SearchState, 'w'>): number {
	return BASE_QUALITY + WEIGHT_X + WEIGHT_Y * s.w;
}

/** Deterministic value in [-1, 1] that depends only on the point: a configuration always gets the same error. */
export function pointNoise(p: Point): number {
	const v = Math.sin(p.x * 127.1 + p.y * 311.7) * 43758.5453;
	return 2 * (v - Math.floor(v)) - 1;
}

/** Measured score of a configuration trained with `budget` units: quality plus noise that shrinks with budget. */
export function score(p: Point, s: SurfaceParams, budget: number): number {
	return quality(p, s) + (NOISE * pointNoise(p)) / Math.sqrt(budget);
}

/** Points per side of the grid: floor(sqrt(budget)), at least 2, so the grid uses at most `budget` trainings. */
export function gridSide(budget: number): number {
	return Math.max(2, Math.floor(Math.sqrt(snapBudget(budget))));
}

/** Grid points: all combinations of `gridSide` equally spaced values on each axis. */
export function gridPoints(budget: number): Point[] {
	const k = gridSide(budget);
	const levels = Array.from({ length: k }, (_, i) => i / (k - 1));
	const out: Point[] = [];
	for (const y of levels) {
		for (const x of levels) out.push({ x, y });
	}
	return out;
}

/** Uniform random points in [0, 1]^2. */
export function randomPoints(n: number, seed: number): Point[] {
	const rand = rng(seed * 101 + 7);
	return Array.from({ length: n }, () => ({ x: rand(), y: rand() }));
}

/**
 * Successive halving on SH_CANDIDATES random points. Round r + 1 trains the survivors with
 * budget eta^r and keeps the best third. Five rounds: 81, 27, 9, 3, 1 configurations at budgets
 * 1, 3, 9, 27, 81, so each round spends 81 units and the total is 405.
 */
export function halvingPlan(s: SearchState): HalvingPlan {
	const candidates = randomPoints(SH_CANDIDATES, s.seed + 1000);
	const rounds = Math.round(Math.log(SH_CANDIDATES) / Math.log(SH_ETA)) + 1;
	const survivors: Point[][] = [candidates];
	const budgets: number[] = [];
	const spent: number[] = [0];
	let alive = candidates;
	for (let r = 0; r < rounds; r++) {
		const b = SH_ETA ** r;
		budgets.push(b);
		spent.push((spent[r] ?? 0) + alive.length * b);
		const ranked = [...alive].sort((p, q) => score(q, s, b) - score(p, s, b));
		alive = ranked.slice(0, Math.max(1, Math.floor(alive.length / SH_ETA)));
		survivors.push(alive);
	}
	const fullBest = argmax(candidates, s, FULL_UNITS);
	return { survivors, budgets, spent, fullBest };
}

/** First point of a list; the lists used here are never empty. */
function first(points: Point[]): Point {
	return points[0] ?? { x: 0, y: 0 };
}

/** Point with the highest measured score at `budget`. Ties keep the earlier point. */
export function argmax(points: Point[], s: SurfaceParams, budget: number): Point {
	let best = first(points);
	let bestScore = -Infinity;
	for (const p of points) {
		const v = score(p, s, budget);
		if (v > bestScore) {
			bestScore = v;
			best = p;
		}
	}
	return best;
}

/** Results of the four methods at the state's budget (grid, random) and the fixed halving plan. */
export function compareMethods(s: SearchState, plan: HalvingPlan): MethodResult[] {
	const top = qualityMax(s);
	const grid = gridPoints(s.budget);
	const random = randomPoints(s.budget, s.seed);
	const rows: { id: MethodId; configs: number; units: number; best: Point }[] = [
		{
			id: 'grid',
			configs: grid.length,
			units: grid.length * FULL_UNITS,
			best: argmax(grid, s, FULL_UNITS),
		},
		{
			id: 'random',
			configs: random.length,
			units: random.length * FULL_UNITS,
			best: argmax(random, s, FULL_UNITS),
		},
		{
			id: 'halving',
			configs: SH_CANDIDATES,
			units: plan.spent.at(-1) ?? 0,
			best: first(plan.survivors.at(-1) ?? []),
		},
		{
			id: 'full',
			configs: SH_CANDIDATES,
			units: SH_CANDIDATES * FULL_UNITS,
			best: plan.fullBest,
		},
	];
	return rows.map((r) => {
		const value = quality(r.best, s);
		return { ...r, value, gap: top - value };
	});
}

/** Heatmap cells with quality relative to the optimum (0..1). ix, iy index the cell; iy grows upwards. */
export interface Cell {
	ix: number;
	iy: number;
	q: number;
}

export function heatmap(s: SurfaceParams): Cell[] {
	const top = qualityMax(s);
	const out: Cell[] = [];
	for (let iy = 0; iy < HEAT_N; iy++) {
		for (let ix = 0; ix < HEAT_N; ix++) {
			const p = { x: (ix + 0.5) / HEAT_N, y: (iy + 0.5) / HEAT_N };
			out.push({ ix, iy, q: quality(p, s) / top });
		}
	}
	return out;
}
