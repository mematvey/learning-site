/**
 * Math of the matmul tiling demo: how many times global memory is read when C = A * B
 * is computed for square n x n matrices, naively and with square tiles of side T.
 * Pure functions only: no DOM, no Svelte. No hardware numbers: only counts of element reads.
 *
 * Counting model: every read of one element of A or B from global memory counts once.
 * Caches, registers and the n^2 writes of C are not counted, so the numbers show the scaling,
 * not a profile of a real GPU.
 * Naive: C[i][j] reads row i of A and column j of B, so each element of A and of B is read n times.
 * Tiled: a block computes a T x T tile of C and loads the A-tile and the B-tile of every K-step
 * into shared memory. An element of A is then read once for each column-tile of C: ceil(n / T) times.
 * Tile T = 1 is the naive algorithm again.
 */

export const N_MIN = 8;
export const N_MAX = 128;
export const N_STEP = 8;
export const N_DEFAULT = 64;

export const TILE_OPTIONS = [1, 2, 4, 8, 16, 32] as const;
export type Tile = (typeof TILE_OPTIONS)[number];
export const TILE_DEFAULT: Tile = 8;

export interface MatmulTilingDemoState {
	/** Side of the square matrices. */
	n: number;
	/** Side of the square tile, one of TILE_OPTIONS. */
	tile: number;
}

export const DEFAULT_STATE: MatmulTilingDemoState = { n: N_DEFAULT, tile: TILE_DEFAULT };

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Clamps the matrix side to its range and snaps it to the slider step. Non-numbers give the default. */
export function snapN(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_STATE.n;
	const c = clamp(v, N_MIN, N_MAX);
	return Math.round(c / N_STEP) * N_STEP;
}

/** Nearest allowed tile size. Non-numbers give the default. */
export function snapTile(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_STATE.tile;
	let best: Tile = TILE_OPTIONS[0];
	for (const t of TILE_OPTIONS) {
		if (Math.abs(t - v) < Math.abs(best - v)) best = t;
	}
	return best;
}

/** Applies a patch to the state: only known fields, each one snapped. Unknown or bad values are ignored. */
export function applyPatch(
	state: MatmulTilingDemoState,
	patch: Partial<Record<keyof MatmulTilingDemoState, unknown>>,
): MatmulTilingDemoState {
	const next = { ...state };
	if (patch.n !== undefined) next.n = snapN(patch.n);
	if (patch.tile !== undefined) next.tile = snapTile(patch.tile);
	return next;
}

/** Reads of one element of A (or B) from global memory in the naive algorithm: n. */
export function readsPerElementNaive(n: number): number {
	return n;
}

/** Reads of one element of A (or B) from global memory with tiles of side `tile`: ceil(n / tile). */
export function readsPerElementTiled(n: number, tile: number): number {
	return Math.ceil(n / tile);
}

/** Total element reads of the naive algorithm: each of n^2 outputs reads n pairs, so 2 n^3. */
export function totalReadsNaive(n: number): number {
	return 2 * n ** 3;
}

/** Total element reads with tiles: 2 n^2 ceil(n / tile). */
export function totalReadsTiled(n: number, tile: number): number {
	return 2 * n * n * readsPerElementTiled(n, tile);
}

/** How many times fewer reads the tiled algorithm makes. Never above `tile`; equals `tile` when tile divides n. */
export function reduction(n: number, tile: number): number {
	return totalReadsNaive(n) / totalReadsTiled(n, tile);
}

/** Groups thousands with spaces, without locale data, so the text is the same on every machine. */
export function formatCount(x: number): string {
	return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** One-sentence description of the current state for the live region. */
export function describeState(state: MatmulTilingDemoState): string {
	const { n, tile } = state;
	const per = readsPerElementTiled(n, tile);
	const naive = readsPerElementNaive(n);
	const red = reduction(n, tile);
	return (
		`Матрицы ${n} × ${n}, тайл ${tile} × ${tile}: каждый элемент A и B читается из глобальной памяти ` +
		`${per} раз вместо ${naive}. Всего обращений ${formatCount(totalReadsTiled(n, tile))} ` +
		`вместо ${formatCount(totalReadsNaive(n))}, выигрыш в ${red.toFixed(1)} раза.`
	);
}
