/**
 * Math of the LLM inference demo (chapter compute/llm-inference).
 *   KV-cache memory:      M_KV = 2 · L · n_kv · d_h · b · T · B
 *   Decode step bound:    t_step >= (P · b + M_KV) / β,   tokens/s <= B / t_step
 * These are upper estimates: compute time, synchronisation and framework overhead are not
 * included, so the speed is a bandwidth limit, never a measurement.
 * Pure functions only: no DOM, no Svelte.
 */

/** Memory bandwidth of NVIDIA H100 SXM, 3.35 TB/s, as stated in the chapter source. */
export const H100_BANDWIDTH = 3.35e12;
/** Memory capacity of NVIDIA H100 SXM, 80 GB (decimal), as stated in the chapter source. */
export const H100_MEMORY = 80e9;

export interface ModelConfig {
	id: string;
	title: string;
	/** Number of transformer layers L. */
	layers: number;
	/** Number of KV heads n_kv. Equals the number of attention heads in MHA. */
	kvHeads: number;
	/** Head size d_h. */
	headDim: number;
	/** Parameter count P (8 billion, the rounded value used in the chapter). */
	params: number;
}

/** Llama 3 8B: 32 layers, 32 query heads, 8 KV heads, head size 4096 / 32 = 128 (Llama 3 paper). */
export const MODELS: readonly [ModelConfig, ...ModelConfig[]] = [
	{
		id: 'llama3-8b-gqa',
		title: 'Llama 3 8B, GQA: 8 KV-голов',
		layers: 32,
		kvHeads: 8,
		headDim: 128,
		params: 8e9,
	},
	{
		id: 'llama3-8b-mha',
		title: 'Та же модель с 32 KV-головами (MHA)',
		layers: 32,
		kvHeads: 32,
		headDim: 128,
		params: 8e9,
	},
];

export interface DtypeOption {
	id: string;
	title: string;
	/** Bytes per element, b. */
	bytes: number;
}

/** One value of b is used for weights and cache, as in the chapter formulas. */
export const DTYPES: readonly [DtypeOption, ...DtypeOption[]] = [
	{ id: 'fp32', title: 'FP32 (4 байта)', bytes: 4 },
	{ id: 'fp16', title: 'FP16 / BF16 (2 байта)', bytes: 2 },
	{ id: 'int8', title: 'INT8 / FP8 (1 байт)', bytes: 1 },
];

/** Context lengths in tokens, powers of two from 512 to 131072. */
export const CONTEXTS: readonly [number, ...number[]] = [
	512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072,
];
/** Batch sizes (requests decoded together). */
export const BATCHES: readonly [number, ...number[]] = [1, 2, 4, 8, 16, 32, 64];

export interface LlmInferenceDemoState {
	/** Id from `MODELS`. */
	model: string;
	/** Id from `DTYPES`. */
	dtype: string;
	/** Context length T, one of `CONTEXTS`. */
	context: number;
	/** Batch size B, one of `BATCHES`. */
	batch: number;
}

export const DEFAULT_STATE: LlmInferenceDemoState = {
	model: 'llama3-8b-gqa',
	dtype: 'fp16',
	context: 8192,
	batch: 1,
};

export function findModel(id: string): ModelConfig {
	return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function findDtype(id: string): DtypeOption {
	return DTYPES.find((d) => d.id === id) ?? DTYPES[0];
}

/** Nearest allowed value; non-finite input gives `fallback`. */
function nearest(values: readonly [number, ...number[]], v: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	return values.reduce((best, x) => (Math.abs(x - v) < Math.abs(best - v) ? x : best));
}

export function snapContext(t: number): number {
	return nearest(CONTEXTS, t, DEFAULT_STATE.context);
}

export function snapBatch(b: number): number {
	return nearest(BATCHES, b, DEFAULT_STATE.batch);
}

/** KV-cache bytes for one token in all layers: 2 · L · n_kv · d_h · b (factor 2 is K and V). */
export function kvBytesPerToken(model: ModelConfig, bytesPerElem: number): number {
	return 2 * model.layers * model.kvHeads * model.headDim * bytesPerElem;
}

/** M_KV = 2 · L · n_kv · d_h · b · T · B. */
export function kvCacheBytes(
	model: ModelConfig,
	bytesPerElem: number,
	tokens: number,
	batch: number,
): number {
	return kvBytesPerToken(model, bytesPerElem) * tokens * batch;
}

/** Bytes of all weights: P · b. */
export function weightBytes(model: ModelConfig, bytesPerElem: number): number {
	return model.params * bytesPerElem;
}

export interface Estimate {
	kvPerToken: number;
	kvCache: number;
	weights: number;
	/** Bytes read per decode step: weights plus the whole KV cache of the batch. */
	perStep: number;
	/** Lower bound on the step time, in seconds. */
	stepSeconds: number;
	/** Upper bound on tokens per second for the whole batch. */
	tokensPerSecond: number;
	/** Upper bound on tokens per second for one request (tokensPerSecond / B). */
	tokensPerSecondPerRequest: number;
	/** Weights plus KV cache fit into the GPU memory. */
	fits: boolean;
}

/** Full estimate for a state. The bandwidth defaults to H100 SXM. */
export function estimate(
	state: LlmInferenceDemoState,
	bandwidth: number = H100_BANDWIDTH,
	memory: number = H100_MEMORY,
): Estimate {
	const model = findModel(state.model);
	const b = findDtype(state.dtype).bytes;
	const kvCache = kvCacheBytes(model, b, state.context, state.batch);
	const weights = weightBytes(model, b);
	const perStep = weights + kvCache;
	const stepSeconds = perStep / bandwidth;
	const tokensPerSecond = state.batch / stepSeconds;
	return {
		kvPerToken: kvBytesPerToken(model, b),
		kvCache,
		weights,
		perStep,
		stepSeconds,
		tokensPerSecond,
		tokensPerSecondPerRequest: tokensPerSecond / state.batch,
		fits: weights + kvCache <= memory,
	};
}

/** Binary units for the KV cache: KiB, MiB, GiB. */
export function formatBinary(bytes: number): string {
	const KI = 1024;
	if (bytes >= KI ** 3) return `${(bytes / KI ** 3).toFixed(2)} GiB`;
	if (bytes >= KI ** 2) return `${(bytes / KI ** 2).toFixed(1)} MiB`;
	return `${Math.round(bytes / KI)} KiB`;
}

/** Decimal GB (10^9 bytes), as the chapter writes weights and bytes per step. */
export function formatGB(bytes: number): string {
	return `${(bytes / 1e9).toFixed(1)} GB`;
}

/** Milliseconds with one decimal. */
export function formatMs(seconds: number): string {
	return `${(seconds * 1000).toFixed(1)} мс`;
}

/** Tokens per second, rounded to an integer. */
export function formatTps(v: number): string {
	return `${Math.round(v)}`;
}

/** Text for the aria-live line: all numbers are computed from the state. */
export function describeEstimate(
	state: LlmInferenceDemoState,
	e: Estimate = estimate(state),
): string {
	const model = findModel(state.model);
	const memNote = e.fits
		? 'Веса и KV-кэш помещаются в 80 GB памяти H100.'
		: 'Веса и KV-кэш не помещаются в 80 GB памяти H100.';
	return (
		`${model.title}, контекст ${state.context} токенов, батч ${state.batch}. ` +
		`KV-кэш: ${formatBinary(e.kvCache)}. За шаг читается ${formatGB(e.perStep)}. ` +
		`Расчётный предел: не быстрее ${formatTps(e.tokensPerSecond)} токенов в секунду на весь батч ` +
		`(${formatTps(e.tokensPerSecondPerRequest)} на запрос). Это оценка сверху, а не замер. ${memNote}`
	);
}
