/**
 * Math of the Triton intro demo: a vector of n elements is split into blocks of B lanes,
 * one Triton program per block. The number of programs is ceil(n / B), the last block is
 * masked where its lanes fall past the end of the vector. Pure functions only: no DOM, no Svelte.
 */

export const N_MIN = 1;
export const N_MAX = 128;
export const N_DEFAULT = 100;
export const BLOCK_SIZES = [4, 8, 16, 32, 64] as const;
export type BlockSize = (typeof BLOCK_SIZES)[number];
export const BLOCK_DEFAULT: BlockSize = 32;

export interface TritonDemoState {
	/** Vector length n. */
	n: number;
	/** Block size B (lanes per program). Must be a power of two from BLOCK_SIZES. */
	block: BlockSize;
}

export const DEFAULT_STATE: TritonDemoState = { n: N_DEFAULT, block: BLOCK_DEFAULT };

/** One lane of a program: its position in the vector and whether the mask lets it through. */
export interface Lane {
	t: number;
	offset: number;
	active: boolean;
}

export function isBlockSize(v: unknown): v is BlockSize {
	return typeof v === 'number' && (BLOCK_SIZES as readonly number[]).includes(v);
}

/** Rounds to an integer inside the n slider range. Non-finite input gives N_DEFAULT. */
export function snapN(n: number): number {
	if (!Number.isFinite(n)) return N_DEFAULT;
	return Math.min(N_MAX, Math.max(N_MIN, Math.round(n)));
}

/** Nearest allowed block size. Non-finite input gives BLOCK_DEFAULT. */
export function snapBlock(b: number): BlockSize {
	if (!Number.isFinite(b)) return BLOCK_DEFAULT;
	let best: BlockSize = BLOCK_SIZES[0];
	for (const v of BLOCK_SIZES) {
		if (Math.abs(v - b) < Math.abs(best - b)) best = v;
	}
	return best;
}

export function applyPatch(
	state: TritonDemoState,
	patch: Partial<TritonDemoState>,
): TritonDemoState {
	return {
		n: typeof patch.n === 'number' ? snapN(patch.n) : state.n,
		block: patch.block !== undefined ? snapBlock(patch.block) : state.block,
	};
}

/** Number of programs in the grid: ceil(n / B) in integer arithmetic, the same as triton.cdiv. */
export function programCount(n: number, B: number): number {
	return Math.floor((n + B - 1) / B);
}

/** Positions of program `pid` inside the vector: pid·B + t. Lanes past the end are included. */
export function laneOffsets(n: number, B: number, pid: number): number[] {
	const offsets: number[] = [];
	for (let t = 0; t < B; t++) offsets.push(pid * B + t);
	return offsets;
}

/** Mask of program `pid`: true where the position lies inside the vector. */
export function laneMask(n: number, B: number, pid: number): boolean[] {
	return laneOffsets(n, B, pid).map((o) => o < n);
}

/** Number of useful (unmasked) lanes of program `pid`. */
export function usefulLanes(n: number, B: number, pid: number): number {
	return Math.max(0, Math.min(B, n - pid * B));
}

/** All lanes of program `pid` with their masks, in order. */
export function programLanes(n: number, B: number, pid: number): Lane[] {
	return laneOffsets(n, B, pid).map((offset, t) => ({ t, offset, active: offset < n }));
}

/** Lanes that the mask has to switch off in the whole grid: programs·B − n. */
export function maskedLanes(n: number, B: number): number {
	return programCount(n, B) * B - n;
}

/** Positions left out if the grid were computed with floor division n // B instead of ceil. */
export function uncoveredByFloor(n: number, B: number): number {
	return n % B;
}

/** Useful lanes of the last program. */
export function lastBlockUseful(n: number, B: number): number {
	return usefulLanes(n, B, programCount(n, B) - 1);
}

/** True when the last block is incomplete, so the mask does real work. */
export function hasTail(n: number, B: number): boolean {
	return n % B !== 0;
}

/**
 * Simulates the kernel `out = x + y` over blocks: each program loads and stores only the
 * lanes its mask allows. The result must match the elementwise sum.
 */
export function addWithMask(x: number[], y: number[], B: number): number[] {
	if (x.length !== y.length) throw new Error('x and y must have the same length');
	const n = x.length;
	const out: number[] = new Array<number>(n).fill(0);
	for (let pid = 0; pid < programCount(n, B); pid++) {
		for (const lane of programLanes(n, B, pid)) {
			if (!lane.active) continue;
			out[lane.offset] = (x[lane.offset] ?? 0) + (y[lane.offset] ?? 0);
		}
	}
	return out;
}

/** Text for aria-live: the grid, the last block and the masked positions. */
export function describeGrid(n: number, B: number): string {
	const P = programCount(n, B);
	const useful = lastBlockUseful(n, B);
	const masked = maskedLanes(n, B);
	if (!hasTail(n, B)) {
		return `n = ${n}, B = ${B}: программ ${P}, хвоста нет, маска ничего не отбрасывает.`;
	}
	return `n = ${n}, B = ${B}: программ ${P}. В последней программе полезных позиций ${useful} из ${B}, замаскировано ${masked}.`;
}
