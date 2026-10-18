/**
 * Math of the LoRA demo: how many values a low-rank update `B·A` trains compared with full
 * fine-tuning of the same weight matrices. Pure functions only: no DOM, no Svelte.
 */

/** Input size k and output size d of the demo matrix W0 (d × k). */
export const D_IN = 4096;
export const D_OUT = 4096;

export const RANK_MIN = 1;
export const RANK_MAX = 64;
export const RANK_STEP = 1;
export const RANK_DEFAULT = 8;

/** Transformer depth and adapted matrices per layer (query and value), as in the chapter text. */
export const LAYERS = 32;
export const ADAPTED_PER_LAYER = 2;

export type Scope = 'matrix' | 'model';

export interface LoraDemoState {
	/** One matrix, or all adapted matrices of the model (LAYERS × ADAPTED_PER_LAYER). */
	scope: Scope;
	/** Rank r of the update, an integer. */
	rank: number;
}

export function isScope(v: unknown): v is Scope {
	return v === 'matrix' || v === 'model';
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an integer and clamps to the rank slider range. Non-finite input gives the default. */
export function snapRank(r: number): number {
	if (!Number.isFinite(r)) return RANK_DEFAULT;
	return Math.round(clamp(r, RANK_MIN, RANK_MAX));
}

/** Number of weight matrices covered by the scope. */
export function matrixCount(scope: Scope): number {
	return scope === 'matrix' ? 1 : LAYERS * ADAPTED_PER_LAYER;
}

/** Trainable values of one LoRA update: B (d × r) and A (r × k) give r·(d + k). */
export function loraParams(d: number, k: number, r: number): number {
	return r * (d + k);
}

/** Trainable values of full fine-tuning of one matrix: d·k. */
export function fullParams(d: number, k: number): number {
	return d * k;
}

export interface ParamCounts {
	/** Number of matrices in the scope. */
	matrices: number;
	/** Trainable values with LoRA. */
	lora: number;
	/** Trainable values with full fine-tuning of the same matrices. */
	full: number;
	/** lora / full, between 0 and 1. */
	fraction: number;
}

export function paramCounts(
	scope: Scope,
	rank: number,
	d: number = D_OUT,
	k: number = D_IN,
): ParamCounts {
	const matrices = matrixCount(scope);
	const lora = matrices * loraParams(d, k, rank);
	const full = matrices * fullParams(d, k);
	return { matrices, lora, full, fraction: full > 0 ? lora / full : 0 };
}

/** Integer with a thin no-break space between groups of three digits: 16 777 216. */
export function formatCount(n: number): string {
	const s = Math.round(n).toString();
	return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Share in percent with two decimals and a decimal comma: 0,39. */
export function formatPercent(fraction: number): string {
	return (fraction * 100).toFixed(2).replace('.', ',');
}

/** Text for aria-live and the figure description. Numbers are computed, not typed. */
export function describeLora(
	scope: Scope,
	rank: number,
	c: ParamCounts = paramCounts(scope, rank),
): string {
	const where =
		scope === 'matrix'
			? 'одной матрицы 4096 × 4096'
			: `${c.matrices} матриц (32 слоя, запрос и значение)`;
	return (
		`Ранг r = ${rank}, для ${where} LoRA обучает ${formatCount(c.lora)} значений вместо ${formatCount(c.full)}. ` +
		`Доля обучаемых значений: ${formatPercent(c.fraction)}%.`
	);
}
