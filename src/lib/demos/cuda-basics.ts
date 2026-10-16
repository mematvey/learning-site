/**
 * Math of the CUDA grid demo: how many blocks a launch needs, which global index each thread gets,
 * which threads are idle, and where every thread is drawn. Pure functions only: no DOM, no Svelte.
 *
 * Launch: G = ceil(N / B) blocks of B threads. Thread t of block b has global index i = b * B + t.
 * Threads with i >= N are idle (they pass the bounds check). Rounding down, floor(N / B),
 * leaves the tail of the array without any thread.
 */

export const N_MIN = 1;
export const N_MAX = 1024;
export const N_DEFAULT = 1000;

export const BLOCK_SIZES = [32, 64, 128, 256, 512, 1024] as const;
export type BlockDim = (typeof BLOCK_SIZES)[number];
export const BLOCK_DEFAULT: BlockDim = 256;

/** A block is drawn as rows of at most this many threads (one warp per row). */
export const WARP = 32;

/** 'up' = ceil(N / B), the correct launch. 'down' = floor(N / B), the common mistake. */
export type Rounding = 'up' | 'down';

export interface CudaGridDemoState {
	/** Number of elements N. */
	n: number;
	/** Threads per block, blockDim.x (B). */
	blockDim: BlockDim;
	/** Rounding of the block count. */
	rounding: Rounding;
	/** Selected global thread index in [0, launched threads). */
	sel: number;
}

export const DEFAULT_STATE: CudaGridDemoState = {
	n: N_DEFAULT,
	blockDim: BLOCK_DEFAULT,
	rounding: 'up',
	sel: 0,
};

/** Geometry of the SVG in viewBox units. */
export const LAYOUT = {
	/** viewBox width. */
	width: 640,
	/** Distance between neighbouring threads. */
	pitch: 8,
	/** Side of one thread square. */
	cell: 6.5,
	/** Gap between blocks and between the missed strip and the grid. */
	gap: 14,
	/** Height of the caption above a block. */
	label: 16,
} as const;

export function isRounding(v: unknown): v is Rounding {
	return v === 'up' || v === 'down';
}

/** Clamps N to [N_MIN, N_MAX] and rounds it to an integer. */
export function snapN(v: number): number {
	if (!Number.isFinite(v)) return N_DEFAULT;
	return Math.min(N_MAX, Math.max(N_MIN, Math.round(v)));
}

/** Nearest supported block size; ties go to the smaller one. */
export function snapBlockDim(v: number): BlockDim {
	if (!Number.isFinite(v)) return BLOCK_DEFAULT;
	let best: BlockDim = BLOCK_SIZES[0];
	for (const s of BLOCK_SIZES) {
		if (Math.abs(s - v) < Math.abs(best - v)) best = s;
	}
	return best;
}

function assertPositiveInt(v: number, name: string): void {
	if (!Number.isInteger(v) || v < 1) {
		throw new RangeError(`${name} must be a positive integer, got ${v}`);
	}
}

/** Number of blocks: ceil(N / B) for 'up', floor(N / B) for 'down'. Integer arithmetic. */
export function gridDim(n: number, blockDim: number, rounding: Rounding): number {
	assertPositiveInt(n, 'n');
	assertPositiveInt(blockDim, 'blockDim');
	return rounding === 'up' ? Math.floor((n + blockDim - 1) / blockDim) : Math.floor(n / blockDim);
}

/** Global index of a thread: blockIdx * blockDim + threadIdx. */
export function globalIndex(blockIdx: number, blockDim: number, threadIdx: number): number {
	return blockIdx * blockDim + threadIdx;
}

/** Inverse of globalIndex: block and thread numbers of the thread with global index i. */
export function threadOf(index: number, blockDim: number): { block: number; thread: number } {
	return { block: Math.floor(index / blockDim), thread: index % blockDim };
}

/** Threads that are launched in total: G * B. */
export function launchedThreads(blocks: number, blockDim: number): number {
	return blocks * blockDim;
}

/** Launched threads with global index >= N: they do nothing. */
export function idleThreads(n: number, blocks: number, blockDim: number): number {
	return Math.max(0, launchedThreads(blocks, blockDim) - n);
}

/** Elements that no launched thread reaches. Non-zero only with rounding down. */
export function missedElements(n: number, blocks: number, blockDim: number): number {
	return Math.max(0, n - launchedThreads(blocks, blockDim));
}

export function clampSel(sel: number, count: number): number {
	if (count <= 0 || !Number.isFinite(sel)) return 0;
	return Math.min(count - 1, Math.max(0, Math.round(sel)));
}

export interface GridSummary {
	n: number;
	blockDim: number;
	rounding: Rounding;
	blocks: number;
	launched: number;
	idle: number;
	missed: number;
}

export function summarize(state: CudaGridDemoState): GridSummary {
	const blocks = gridDim(state.n, state.blockDim, state.rounding);
	return {
		n: state.n,
		blockDim: state.blockDim,
		rounding: state.rounding,
		blocks,
		launched: launchedThreads(blocks, state.blockDim),
		idle: idleThreads(state.n, blocks, state.blockDim),
		missed: missedElements(state.n, blocks, state.blockDim),
	};
}

/** Applies a partial patch and keeps `sel` inside the launched threads. */
export function applyPatch(
	state: CudaGridDemoState,
	patch: Partial<CudaGridDemoState>,
): CudaGridDemoState {
	const next: CudaGridDemoState = { ...state };
	if (typeof patch.n === 'number') next.n = snapN(patch.n);
	if (typeof patch.blockDim === 'number') next.blockDim = snapBlockDim(patch.blockDim);
	if (isRounding(patch.rounding)) next.rounding = patch.rounding;
	const sel = typeof patch.sel === 'number' ? patch.sel : state.sel;
	const { launched } = summarize(next);
	next.sel = clampSel(sel, launched);
	return next;
}

/** Plain-language description of the launch, used for aria-live. */
export function describeGrid(s: GridSummary): string {
	if (s.rounding === 'down') {
		if (s.blocks === 0) {
			return `Округление вниз: блок из ${s.blockDim} потоков больше N = ${s.n}, ни один блок не запущен, все ${s.n} элементов не обработаны.`;
		}
		return `Округление вниз: блоков ${s.blocks}, запущено ${s.launched} потоков. Элементы с ${s.launched} по ${s.n - 1} не обработаны: ${s.missed} шт.`;
	}
	const tail =
		s.idle === 0 ? 'лишних потоков нет.' : `лишних потоков ${s.idle}, они не выполняют работу.`;
	return `N = ${s.n}, блок из ${s.blockDim} потоков: блоков ${s.blocks}, запущено ${s.launched} потоков, ${tail}`;
}

export interface ThreadCell {
	block: number;
	thread: number;
	/** Global index b * B + t. */
	index: number;
	x: number;
	y: number;
	/** True when index < N: the thread works on an element. */
	work: boolean;
}

export interface BlockTile {
	block: number;
	/** Caption position. */
	labelX: number;
	labelY: number;
	cells: ThreadCell[];
}

export interface MissedCell {
	/** Element index in [launched, N). */
	index: number;
	x: number;
	y: number;
}

export interface GridLayout {
	width: number;
	height: number;
	tiles: BlockTile[];
	missed: MissedCell[];
	/** Caption position of the missed strip, when there are missed elements. */
	missedLabel: { x: number; y: number } | null;
}

/**
 * Positions of all blocks and threads inside the viewBox. A block is drawn as rows of
 * min(B, WARP) threads; blocks wrap into rows of tiles. Elements without a thread form a strip below.
 */
export function layoutGrid(s: GridSummary): GridLayout {
	const { pitch, cell, gap, label, width } = LAYOUT;
	const cols = Math.min(s.blockDim, WARP);
	const rows = Math.ceil(s.blockDim / cols);
	const tileW = cols * pitch;
	const tileH = label + rows * pitch;
	const perRow = Math.max(1, Math.floor((width + gap) / (tileW + gap)));

	const tiles: BlockTile[] = [];
	let bottom = 0;
	for (let b = 0; b < s.blocks; b++) {
		const tx = (b % perRow) * (tileW + gap);
		const ty = Math.floor(b / perRow) * (tileH + gap);
		const cells: ThreadCell[] = [];
		for (let t = 0; t < s.blockDim; t++) {
			const index = globalIndex(b, s.blockDim, t);
			const x = tx + (t % cols) * pitch;
			const y = ty + label + Math.floor(t / cols) * pitch;
			cells.push({ block: b, thread: t, index, x, y, work: index < s.n });
			bottom = Math.max(bottom, y + cell);
		}
		tiles.push({ block: b, labelX: tx, labelY: ty + label - 4, cells });
	}

	const missed: MissedCell[] = [];
	let missedLabel: { x: number; y: number } | null = null;
	if (s.missed > 0) {
		const top = s.blocks > 0 ? bottom + gap : 0;
		missedLabel = { x: 0, y: top + label - 4 };
		for (let k = 0; k < s.missed; k++) {
			const x = (k % WARP) * pitch;
			const y = top + label + Math.floor(k / WARP) * pitch;
			missed.push({ index: s.launched + k, x, y });
			bottom = Math.max(bottom, y + cell);
		}
	}

	return { width, height: Math.max(bottom, label + pitch), tiles, missed, missedLabel };
}
