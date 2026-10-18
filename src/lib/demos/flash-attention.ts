/**
 * Math of the FlashAttention demo: one row of attention scores walked tile by tile with the
 * online softmax. Keeps the running maximum m, the running sum of exponents l and the running
 * weighted output a; each tile is merged into them with one rescaling factor per side.
 * The demo data is the worked example of the chapter: scores [2, 5, 1, 4], values [10, 20, 30, 40].
 * Pure functions only: no DOM, no Svelte.
 */

export const DEMO_SCORES: readonly number[] = [2, 5, 1, 4];
export const DEMO_VALUES: readonly number[] = [10, 20, 30, 40];

export const TILE_SIZES = [1, 2, 4] as const;
export type TileSize = (typeof TILE_SIZES)[number];

export interface FlashAttentionDemoState {
	/** Number of score elements in one tile. */
	tileSize: TileSize;
	/** Number of tiles already merged (0 = nothing yet). */
	step: number;
}

export function isTileSize(v: unknown): v is TileSize {
	return v === 1 || v === 2 || v === 4;
}

/** Clamps the step to `[0, tileCount]`. Non-finite input gives 0. */
export function clampStep(step: number, tileCount: number): number {
	if (!Number.isFinite(step)) return 0;
	return Math.min(tileCount, Math.max(0, Math.trunc(step)));
}

/** Local statistics of one tile (or of the merged state): max m, sum l, weighted output a. */
export interface RowState {
	m: number;
	l: number;
	a: number;
}

/** State before the first tile: nothing is accumulated yet. */
export const EMPTY_STATE: RowState = { m: -Infinity, l: 0, a: 0 };

/** Splits indices 0..n-1 into consecutive tiles of `size` (the last tile may be shorter). */
export function tileIndices(n: number, size: number): number[][] {
	const tiles: number[][] = [];
	const step = Math.max(1, Math.floor(size));
	for (let start = 0; start < n; start += step) {
		const tile: number[] = [];
		for (let i = start; i < Math.min(n, start + step); i++) tile.push(i);
		tiles.push(tile);
	}
	return tiles;
}

/**
 * Statistics of one tile: m = max of its scores, l = sum of exp(x - m),
 * a = sum of exp(x - m) * v. Everything is relative to the tile's own maximum.
 */
export function tileState(
	scores: readonly number[],
	values: readonly number[],
	idx: readonly number[],
): RowState {
	let m = -Infinity;
	for (const i of idx) m = Math.max(m, scores[i] ?? -Infinity);
	let l = 0;
	let a = 0;
	for (const i of idx) {
		const w = Math.exp((scores[i] ?? 0) - m);
		l += w;
		a += w * (values[i] ?? 0);
	}
	return { m, l, a };
}

/**
 * Merges two states with the rescaling rule: the new maximum is max(mA, mB), and each side is
 * multiplied by exp(its maximum - new maximum). Exact, so the merge order does not matter.
 * An empty side (m = -Infinity, l = 0, a = 0) contributes nothing.
 */
export function mergeState(prev: RowState, next: RowState): RowState {
	const m = Math.max(prev.m, next.m);
	const kPrev = Math.exp(prev.m - m);
	const kNext = Math.exp(next.m - m);
	return {
		m,
		l: prev.l * kPrev + next.l * kNext,
		a: prev.a * kPrev + next.a * kNext,
	};
}

/** Output of a state: o = a / l. Zero while nothing is accumulated. */
export function outputOf(s: RowState): number {
	return s.l === 0 ? 0 : s.a / s.l;
}

/** Rescaling factor of the old sum when the maximum changes: exp(mPrev - mNew). 1 if unchanged. */
export function rescaleFactor(prevM: number, newM: number): number {
	return Math.exp(prevM - newM);
}

export interface TileStep {
	/** Zero-based tile number. */
	tile: number;
	/** Indices of the score elements in this tile. */
	indices: number[];
	/** Local statistics of this tile alone. */
	local: RowState;
	/** Accumulated state before this tile. */
	before: RowState;
	/** Accumulated state after this tile. */
	after: RowState;
	/** Factor applied to the old sum (exp(mBefore - mAfter)); 1 when the maximum did not change. */
	rescale: number;
}

/** Walks the row tile by tile and records every step. */
export function walkRow(
	scores: readonly number[],
	values: readonly number[],
	tileSize: number,
): TileStep[] {
	const steps: TileStep[] = [];
	let state = EMPTY_STATE;
	tileIndices(scores.length, tileSize).forEach((indices, tile) => {
		const local = tileState(scores, values, indices);
		const after = mergeState(state, local);
		steps.push({
			tile,
			indices,
			local,
			before: state,
			after,
			rescale: rescaleFactor(state.m, after.m),
		});
		state = after;
	});
	return steps;
}

/** Output after the first `step` tiles (the accumulated state, not the full row). */
export function outputAfter(
	scores: readonly number[],
	values: readonly number[],
	tileSize: number,
	step: number,
): RowState {
	const steps = walkRow(scores, values, tileSize);
	if (step <= 0 || steps.length === 0) return EMPTY_STATE;
	return steps[Math.min(step, steps.length) - 1]?.after ?? EMPTY_STATE;
}

/** Reference: softmax over the whole row, then the weighted sum of the values. */
export function naiveAttention(scores: readonly number[], values: readonly number[]): number {
	const m = Math.max(...scores);
	const exps = scores.map((x) => Math.exp(x - m));
	const total = exps.reduce((s, v) => s + v, 0);
	let out = 0;
	for (let i = 0; i < scores.length; i++) out += ((exps[i] ?? 0) / total) * (values[i] ?? 0);
	return out;
}

/** Online softmax with tiles: the result of the walk, for comparison with `naiveAttention`. */
export function onlineAttention(
	scores: readonly number[],
	values: readonly number[],
	tileSize: number,
): number {
	let state = EMPTY_STATE;
	for (const s of walkRow(scores, values, tileSize)) state = s.after;
	return outputOf(state);
}

/** Formats a number with a fixed number of decimals; non-finite values print as an en dash. */
export function fmt(x: number, digits = 2): string {
	if (!Number.isFinite(x)) return '—';
	return x.toFixed(digits);
}

/**
 * Text of the live region: where the walk is and what changed in the last step.
 * Numbers are computed, not typed.
 */
export function describeStep(
	steps: readonly TileStep[],
	step: number,
	tileSize: number,
	reference: number,
): string {
	const total = steps.length;
	if (step === 0 || total === 0) {
		return `Ещё ничего не учтено. Тайлов по ${tileSize}: ${total}. Наивный ответ: ${fmt(reference)}.`;
	}
	const cur = steps[step - 1];
	if (!cur) return '';
	const idxText = cur.indices.map((i) => i + 1).join(', ');
	let maxText: string;
	if (cur.before.l === 0) {
		maxText = `первый тайл, максимум ${fmt(cur.after.m, 0)}`;
	} else if (cur.after.m === cur.before.m) {
		maxText = `максимум ${fmt(cur.after.m, 0)} не изменился`;
	} else {
		maxText = `максимум вырос с ${fmt(cur.before.m, 0)} до ${fmt(cur.after.m, 0)}, старая сумма умножена на ${fmt(cur.rescale, 4)}`;
	}
	const tail =
		step === total ? `Итог o = ${fmt(outputOf(cur.after))}, наивный ответ ${fmt(reference)}.` : '';
	return `Тайл ${cur.tile + 1} из ${total}, оценки ${idxText}: ${maxText}. Сумма l = ${fmt(cur.after.l, 4)}. ${tail}`.trim();
}
