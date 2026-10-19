/**
 * Memory budget of one training step on one card: weights, gradients, optimizer state, activations.
 * Formulas from content/compute/training-memory:
 *   states per card: 16·P / N with full sharding (ZeRO-3); without sharding 16·P;
 *   activations: L·k·b·s·h bytes, with checkpointing about 2·√L stored layers instead of L.
 * Pure functions only: no DOM, no Svelte.
 */

/** Decimal gigabyte, as in the chapter: 1 GB = 10^9 bytes. */
export const GB = 1e9;
/** Activation coefficient k, bytes per (layer, token, width). An assumption of the demo, not a measurement. */
export const ACT_K = 20;

export const PARAMS_MIN = 1;
export const PARAMS_MAX = 70;
export const LAYERS_MIN = 1;
export const LAYERS_MAX = 96;
export const WIDTH_MIN = 512;
export const WIDTH_MAX = 16384;
export const WIDTH_STEP = 512;
export const SEQ_OPTIONS: readonly number[] = [128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
export const BATCH_MIN = 1;
export const BATCH_MAX = 64;
export const CARD_COUNTS: readonly number[] = [1, 2, 4, 8, 16, 32, 64];
export const CARD_GB_OPTIONS: readonly number[] = [24, 40, 80];
/** Labels of the sharding switch: 0 means no sharding. */
export const SHARD_LABELS: readonly string[] = ['Нет', 'ZeRO-1', 'ZeRO-2', 'ZeRO-3'];

/** 0: no sharding, 1: ZeRO-1 (optimizer), 2: ZeRO-2 (+ gradients), 3: ZeRO-3 (+ weights). */
export type ShardStage = 0 | 1 | 2 | 3;

export interface TrainingMemoryDemoState {
	/** Parameter count P, in billions. */
	params: number;
	/** Number of layers L. */
	layers: number;
	/** Model width h. */
	width: number;
	/** Sequence length s, in tokens. One of SEQ_OPTIONS. */
	seqLen: number;
	/** Batch size b per card. */
	batch: number;
	/** Activation checkpointing on or off. */
	checkpoint: boolean;
	/** Number of cards N that share the sharded states. One of CARD_COUNTS. */
	cards: number;
	shard: ShardStage;
	/** Memory of one card, GB. One of CARD_GB_OPTIONS. */
	cardGb: number;
}

export const DEFAULT_STATE: TrainingMemoryDemoState = {
	params: 7,
	layers: 32,
	width: 4096,
	seqLen: 2048,
	batch: 1,
	checkpoint: false,
	cards: 1,
	shard: 0,
	cardGb: 80,
};

export function isShard(v: unknown): v is ShardStage {
	return v === 0 || v === 1 || v === 2 || v === 3;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

function num(v: unknown, fallback: number): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Integer in [min, max]. */
export function snapInt(v: number, min: number, max: number): number {
	return clamp(Math.round(v), min, max);
}

/** Multiple of `step` in [min, max]. */
export function snapStep(v: number, min: number, max: number, step: number): number {
	return clamp(Math.round(v / step) * step, min, max);
}

/** The option closest to `v`; ties go to the smaller option. */
export function nearest(v: number, options: readonly number[]): number {
	let best: number = options[0] ?? 0;
	for (const o of options) {
		if (Math.abs(o - v) < Math.abs(best - v)) best = o;
	}
	return best;
}

/** Brings any input (URL, text patch, slider value) to a valid state. Missing fields get defaults. */
export function sanitize(p: Partial<TrainingMemoryDemoState> = {}): TrainingMemoryDemoState {
	const d = DEFAULT_STATE;
	return {
		params: snapInt(num(p.params, d.params), PARAMS_MIN, PARAMS_MAX),
		layers: snapInt(num(p.layers, d.layers), LAYERS_MIN, LAYERS_MAX),
		width: snapStep(num(p.width, d.width), WIDTH_MIN, WIDTH_MAX, WIDTH_STEP),
		seqLen: nearest(num(p.seqLen, d.seqLen), SEQ_OPTIONS),
		batch: snapInt(num(p.batch, d.batch), BATCH_MIN, BATCH_MAX),
		checkpoint: typeof p.checkpoint === 'boolean' ? p.checkpoint : d.checkpoint,
		cards: nearest(num(p.cards, d.cards), CARD_COUNTS),
		shard: isShard(p.shard) ? p.shard : d.shard,
		cardGb: nearest(num(p.cardGb, d.cardGb), CARD_GB_OPTIONS),
	};
}

/** GB per card of the three state parts. Weights and gradients are fp16, master weights and Adam moments fp32. */
export interface StateParts {
	/** 2 bytes per parameter. */
	weights: number;
	/** 2 bytes per parameter. */
	grads: number;
	/** 12 bytes per parameter: fp32 master weights (4) and Adam moments (4 + 4). */
	optimizer: number;
}

/**
 * Per-card states for the sharding stage.
 * Stage 0: 2P + 2P + 12P. Stage 1 shards the optimizer, stage 2 also the gradients,
 * stage 3 also the weights. With N cards this gives 16P/N for stage 3, as in the chapter.
 */
export function statesParts(paramsB: number, shard: ShardStage, cards: number): StateParts {
	const p = paramsB * GB;
	const n = Math.max(1, cards);
	const wDiv = shard >= 3 ? n : 1;
	const gDiv = shard >= 2 ? n : 1;
	const oDiv = shard >= 1 ? n : 1;
	return {
		weights: (2 * p) / wDiv / GB,
		grads: (2 * p) / gDiv / GB,
		optimizer: (12 * p) / oDiv / GB,
	};
}

/** Number of layers whose activations are stored: all of them, or about 2·√L with checkpointing. */
export function storedLayers(layers: number, checkpoint: boolean): number {
	if (!checkpoint) return layers;
	return Math.min(layers, 2 * Math.sqrt(layers));
}

/** Activations in GB: stored layers × k × b × s × h bytes. */
export function activationsGb(
	layers: number,
	batch: number,
	seqLen: number,
	width: number,
	checkpoint: boolean,
): number {
	return (storedLayers(layers, checkpoint) * ACT_K * batch * seqLen * width) / GB;
}

export interface Budget extends StateParts {
	/** Sum of the three state parts, GB per card. */
	states: number;
	activations: number;
	/** States plus activations, GB per card. */
	total: number;
	cardGb: number;
	/** cardGb - total. Negative means OOM. */
	headroom: number;
	fits: boolean;
	/** Upper bound of the stacked chart: the larger of the total and the card limit. */
	scaleMax: number;
	/** Stored layers (fractional with checkpointing). */
	storedLayers: number;
}

export function budget(s: TrainingMemoryDemoState): Budget {
	const parts = statesParts(s.params, s.shard, s.cards);
	const states = parts.weights + parts.grads + parts.optimizer;
	const activations = activationsGb(s.layers, s.batch, s.seqLen, s.width, s.checkpoint);
	const total = states + activations;
	return {
		...parts,
		states,
		activations,
		total,
		cardGb: s.cardGb,
		headroom: s.cardGb - total,
		fits: total <= s.cardGb,
		scaleMax: Math.max(total, s.cardGb),
		storedLayers: storedLayers(s.layers, s.checkpoint),
	};
}

/** One decimal with a decimal comma, as in Russian text: 112.0 -> "112,0". */
export function formatGb(v: number): string {
	return v.toFixed(1).replace('.', ',');
}

/**
 * Two cause-and-effect sentences for the current state: what sets the state size and what sets the activation size.
 */
export function explain(s: TrainingMemoryDemoState, b: Budget): string[] {
	const what = ['', 'оптимизатор', 'оптимизатор и градиенты', 'оптимизатор, градиенты и веса'][
		s.shard
	];
	const statesLine =
		s.shard === 0
			? `Без шардирования состояния ${formatGb(b.states)} ГБ на каждой карте, число карт на них не влияет.`
			: `ZeRO-${s.shard} делит ${what} между ${s.cards} картами: ${formatGb(b.states)} ГБ на карту.`;
	const actLine = s.checkpoint
		? `Пересчёт активаций: хранится около ${Math.round(b.storedLayers)} слоёв из ${s.layers}, активации ${formatGb(b.activations)} ГБ.`
		: `Активации ${formatGb(b.activations)} ГБ при батче ${s.batch} и длине ${s.seqLen}: растут с ними, от числа карт не зависят.`;
	return [statesLine, actLine];
}

/** Verdict for the card limit: fits with headroom, or OOM with the shortfall. */
export function verdict(b: Budget): string {
	if (b.fits) {
		return `Всего ${formatGb(b.total)} ГБ из ${b.cardGb} ГБ: помещается, запас ${formatGb(b.headroom)} ГБ.`;
	}
	return `Всего ${formatGb(b.total)} ГБ больше ${b.cardGb} ГБ: OOM, не хватает ${formatGb(-b.headroom)} ГБ.`;
}
