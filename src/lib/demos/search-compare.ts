/**
 * Grid search against random search on a made-up score surface with two hyperparameters.
 * Only the first one matters (a narrow peak); the second changes the score a little.
 * Pure functions only. Parameters are scaled to [0, 1].
 */

import { mulberry32 } from './attention';

export const GRID_MIN = 2;
export const GRID_MAX = 5;
export const DEFAULT_GRID = 3;
export const PEAK_X = 0.56;
export const PEAK_WIDTH = 0.07;
export const REPEATS = 200;

export interface SearchState {
	/** Grid side k: the grid has k x k trials, random search gets the same budget. */
	side: number;
	/** Seed of the random draw shown on the plot. */
	draw: number;
}

export const DEFAULT_SEARCH_STATE: SearchState = { side: DEFAULT_GRID, draw: 1 };

export interface Point {
	x: number;
	y: number;
	score: number;
}

/** Score in [0, 1]: a sharp peak along x, a weak slow dependence on y. */
export function score(x: number, y: number): number {
	const px = Math.exp(-(((x - PEAK_X) / PEAK_WIDTH) ** 2));
	const py = Math.exp(-(((y - 0.5) / 0.5) ** 2));
	return 0.1 + 0.8 * px * (0.85 + 0.15 * py);
}

export function snapSide(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_GRID;
	return Math.min(GRID_MAX, Math.max(GRID_MIN, Math.round(v)));
}

export function snapDraw(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return 1;
	return Math.max(1, Math.round(v));
}

export function sanitizeSearchState(patch: Partial<SearchState> | undefined): SearchState {
	return {
		side: patch?.side === undefined ? DEFAULT_GRID : snapSide(patch.side),
		draw: patch?.draw === undefined ? 1 : snapDraw(patch.draw),
	};
}

/** k x k grid with cell centres (i + 0.5) / k. */
export function gridPoints(side: number): Point[] {
	const pts: Point[] = [];
	for (let i = 0; i < side; i++) {
		for (let j = 0; j < side; j++) {
			const x = (i + 0.5) / side;
			const y = (j + 0.5) / side;
			pts.push({ x, y, score: score(x, y) });
		}
	}
	return pts;
}

/** side * side uniform points; deterministic for a given draw. */
export function randomPoints(side: number, draw: number): Point[] {
	const rand = mulberry32(draw * 7919 + 13);
	const pts: Point[] = [];
	for (let i = 0; i < side * side; i++) {
		const x = rand();
		const y = rand();
		pts.push({ x, y, score: score(x, y) });
	}
	return pts;
}

export function bestScore(pts: readonly Point[]): number {
	return pts.reduce((m, p) => Math.max(m, p.score), -Infinity);
}

/** Number of distinct values of x among the points (rounded to 6 decimals). */
export function distinctX(pts: readonly Point[]): number {
	return new Set(pts.map((p) => p.x.toFixed(6))).size;
}

/** Mean best score of random search over many draws with the same budget. */
export function meanRandomBest(side: number, repeats = REPEATS): number {
	let sum = 0;
	for (let d = 1; d <= repeats; d++) sum += bestScore(randomPoints(side, d));
	return sum / repeats;
}

export interface SearchSummary {
	grid: Point[];
	random: Point[];
	gridBest: number;
	randomBest: number;
	gridDistinctX: number;
	randomDistinctX: number;
	randomMean: number;
	budget: number;
}

export function summarizeSearch(state: SearchState): SearchSummary {
	const grid = gridPoints(state.side);
	const random = randomPoints(state.side, state.draw);
	return {
		grid,
		random,
		gridBest: bestScore(grid),
		randomBest: bestScore(random),
		gridDistinctX: distinctX(grid),
		randomDistinctX: distinctX(random),
		randomMean: meanRandomBest(state.side),
		budget: state.side * state.side,
	};
}

export function describeSearch(s: SearchSummary): string {
	const f = (v: number): string => v.toFixed(3);
	return `Бюджет ${s.budget} запусков. Сетка пробует ${s.gridDistinctX} значений важного параметра, лучший результат ${f(s.gridBest)}. Случайный поиск пробует ${s.randomDistinctX}, лучший результат ${f(s.randomBest)}. В среднем по ${REPEATS} розыгрышам случайный поиск даёт ${f(s.randomMean)}.`;
}
