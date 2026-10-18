/**
 * Math of the distributed-training demo: memory of model states per GPU for several
 * parallelism strategies, and the pipeline bubble. Activations and temporary buffers are not
 * counted, as in the chapter. Splits are ideal (even shards, no replicated tensors).
 * Pure functions only: no DOM, no Svelte.
 */

/** Bytes per parameter for weights in 16 bits (chapter, mixed precision). */
export const BYTES_WEIGHTS = 2;
/** Bytes per parameter for gradients in 16 bits. */
export const BYTES_GRADS = 2;
/** Bytes per parameter for optimizer states: fp32 master copy 4, Adam momentum 4, Adam variance 4. */
export const BYTES_OPTIMIZER = 12;
/** Model states per parameter: 2 + 2 + 12 = 16 bytes. */
export const BYTES_PER_PARAM = BYTES_WEIGHTS + BYTES_GRADS + BYTES_OPTIMIZER;

/** Memory of one GPU in the chapter's example (A100 80 GB), in GB. */
export const GPU_MEMORY_GB = 80;

export const PARAMS_MIN = 1;
export const PARAMS_MAX = 70;
export const PARAMS_STEP = 1;
export const PARAMS_DEFAULT = 7;

/** Allowed GPU counts for the memory charts (powers of two). */
export const CARD_COUNTS: readonly number[] = [1, 2, 4, 8, 16, 32, 64];
export const CARDS_DEFAULT = 8;

export const STAGES_MIN = 2;
export const STAGES_MAX = 16;
export const STAGES_DEFAULT = 4;
export const MICRO_MIN = 1;
export const MICRO_MAX = 32;
export const MICRO_DEFAULT = 4;

export type Strategy = 'dp' | 'zero1' | 'zero2' | 'zero3' | 'tensor' | 'pipeline';

export interface StrategyInfo {
	id: Strategy;
	label: string;
}

/** Rows of the memory chart, in the order of the chapter (no sharding first, then ZeRO, then splits). */
export const STRATEGIES: readonly StrategyInfo[] = [
	{ id: 'dp', label: 'Параллелизм данных' },
	{ id: 'zero1', label: 'ZeRO-1: шардирует оптимизатор' },
	{ id: 'zero2', label: 'ZeRO-2: + градиенты' },
	{ id: 'zero3', label: 'ZeRO-3 / FSDP: + параметры' },
	{ id: 'tensor', label: 'Тензорный параллелизм' },
	{ id: 'pipeline', label: 'Конвейерный параллелизм' },
];

export interface DistributedDemoState {
	/** Model size in billions of parameters. */
	paramsB: number;
	/** Number of GPUs for the memory chart. */
	cards: number;
	/** Pipeline stages p for the bubble chart. */
	stages: number;
	/** Microbatches m for the bubble chart. */
	micro: number;
}

export const DEFAULT_STATE: DistributedDemoState = {
	paramsB: PARAMS_DEFAULT,
	cards: CARDS_DEFAULT,
	stages: STAGES_DEFAULT,
	micro: MICRO_DEFAULT,
};

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to the slider step and clamps to the range. Non-finite input gives the default. */
export function snapParams(v: number): number {
	if (!Number.isFinite(v)) return PARAMS_DEFAULT;
	return clamp(Math.round(v / PARAMS_STEP) * PARAMS_STEP, PARAMS_MIN, PARAMS_MAX);
}

/** Nearest allowed GPU count. Non-finite input gives the default. */
export function snapCards(v: number): number {
	if (!Number.isFinite(v)) return CARDS_DEFAULT;
	let best = CARD_COUNTS[0] ?? CARDS_DEFAULT;
	for (const c of CARD_COUNTS) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
	return best;
}

export function snapStages(v: number): number {
	if (!Number.isFinite(v)) return STAGES_DEFAULT;
	return clamp(Math.round(v), STAGES_MIN, STAGES_MAX);
}

export function snapMicro(v: number): number {
	if (!Number.isFinite(v)) return MICRO_DEFAULT;
	return clamp(Math.round(v), MICRO_MIN, MICRO_MAX);
}

/**
 * Model-state bytes on one GPU for `psi` parameters split over `n` GPUs.
 * - dp: full copy on every GPU, 16 Ψ.
 * - zero1: weights and gradients full, optimizer states sharded: 4Ψ + 12Ψ/n.
 * - zero2: weights full, gradients and optimizer states sharded: 2Ψ + 14Ψ/n.
 * - zero3 (FSDP full shard): everything sharded: 16Ψ/n.
 * - tensor and pipeline: each GPU holds 1/n of the layers (ideal split): 16Ψ/n.
 */
export function stateBytesPerGpu(strategy: Strategy, psi: number, n: number): number {
	const k = Math.max(1, n);
	switch (strategy) {
		case 'dp':
			return BYTES_PER_PARAM * psi;
		case 'zero1':
			return (BYTES_WEIGHTS + BYTES_GRADS) * psi + (BYTES_OPTIMIZER * psi) / k;
		case 'zero2':
			return BYTES_WEIGHTS * psi + ((BYTES_GRADS + BYTES_OPTIMIZER) * psi) / k;
		case 'zero3':
		case 'tensor':
		case 'pipeline':
			return (BYTES_PER_PARAM * psi) / k;
	}
}

/** The same in GB (10^9 bytes), as in the chapter's code. */
export function stateGbPerGpu(strategy: Strategy, paramsB: number, n: number): number {
	return stateBytesPerGpu(strategy, paramsB * 1e9, n) / 1e9;
}

export interface MemoryRow {
	id: Strategy;
	label: string;
	gb: number;
	fits: boolean;
}

/** Memory of every strategy for the given model size and GPU count. */
export function memoryRows(paramsB: number, n: number): MemoryRow[] {
	return STRATEGIES.map((s) => {
		const gb = stateGbPerGpu(s.id, paramsB, n);
		return { id: s.id, label: s.label, gb, fits: gb <= GPU_MEMORY_GB };
	});
}

/**
 * Share of idle time in a pipeline with p stages and m microbatches: (p - 1) / (m + p - 1).
 * Matches the chapter's examples: p = 4, m = 4 gives about 43 %; m = 32 gives about 9 %.
 */
export function bubbleFraction(stages: number, micro: number): number {
	const p = Math.max(1, stages);
	const m = Math.max(1, micro);
	return (p - 1) / (m + p - 1);
}

/**
 * Time slots of a forward pass through the pipeline (GPipe-style schedule).
 * Stage s works on microbatch j in slot s + j. `grid[s][t]` is true when stage s is busy in slot t.
 * Share of idle cells equals `bubbleFraction`.
 */
export function pipelineGrid(stages: number, micro: number): boolean[][] {
	const p = Math.max(1, stages);
	const m = Math.max(1, micro);
	const slots = m + p - 1;
	const grid: boolean[][] = [];
	for (let s = 0; s < p; s++) {
		const row: boolean[] = [];
		for (let t = 0; t < slots; t++) row.push(t >= s && t - s < m);
		grid.push(row);
	}
	return grid;
}

/** Percent with no decimals, for the text: 43 for 0.4286. */
export function percent(fraction: number): number {
	return Math.round(fraction * 100);
}

/** Text of the description under the memory chart. Numbers are computed, not typed. */
export function describeMemory(paramsB: number, n: number): string {
	const dp = stateGbPerGpu('dp', paramsB, n);
	const z3 = stateGbPerGpu('zero3', paramsB, n);
	const fit = dp <= GPU_MEMORY_GB ? 'влезает' : 'не влезает';
	return (
		`Модель на ${paramsB} млрд параметров, ${n} GPU. Параллелизм данных: ${dp.toFixed(1)} ГБ на карту, ` +
		`${fit} в ${GPU_MEMORY_GB} ГБ. ZeRO-3 и шардирование: ${z3.toFixed(1)} ГБ на карту. ` +
		'Активации не учтены.'
	);
}

/** Text of the description under the pipeline chart. */
export function describeBubble(stages: number, micro: number): string {
	const idle = percent(bubbleFraction(stages, micro));
	return `Конвейер из ${stages} стадий, ${micro} микробатчей: простой около ${idle} % времени.`;
}
