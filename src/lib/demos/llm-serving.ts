/**
 * Math of the LLM serving demo: cost per million output tokens and latency as functions of
 * GPU load and batch size. All prices are illustrative units (у. е.), not real offers.
 * Pure functions only: no DOM, no Svelte.
 */

/** Batch sizes the slider can take. */
export const BATCH_OPTIONS = [1, 2, 4, 8, 16, 32, 64] as const;

/** Time of one generation step at batch 1, ms (TPOT for a single user). */
export const T1_MS = 25;
/** Extra step time per additional request in the batch, ms. Gives 30 ms at batch 16. */
export const STEP_SLOPE_MS = 1 / 3;

/** Time to first token without queueing, s. */
export const TTFT_BASE_S = 0.4;
/** Queueing scale, s: waiting grows as load / (1 - load). */
export const QUEUE_S = 0.2;
/** Load is capped below 1 in the queueing term so the latency stays finite. */
export const MAX_QUEUE_LOAD = 0.95;

/** Output length of the example response, tokens. */
export const OUT_TOKENS = 300;

export const LOAD_MIN = 5;
export const LOAD_MAX = 100;
export const LOAD_STEP = 5;
export const GPU_MIN = 0.5;
export const GPU_MAX = 10;
export const GPU_STEP = 0.5;
export const API_MIN = 1;
export const API_MAX = 60;
export const API_STEP = 1;

/** Loads used for the cost curve: 5%, 10%, ..., 100%. */
export const LOAD_CURVE: readonly number[] = Array.from(
	{ length: (LOAD_MAX - LOAD_MIN) / LOAD_STEP + 1 },
	(_, i) => LOAD_MIN + i * LOAD_STEP,
);

export interface LlmServingDemoState {
	/** Requests served in one batch. */
	batch: number;
	/** GPU load in percent: share of time the GPU does useful work. */
	load: number;
	/** Illustrative GPU price, у. е. per hour. */
	gpuPrice: number;
	/** Illustrative API price, у. е. per million output tokens. */
	apiPrice: number;
}

export const DEFAULTS: LlmServingDemoState = {
	batch: 16,
	load: 60,
	gpuPrice: 2.5,
	apiPrice: 15,
};

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Nearest allowed batch size. Non-finite input gives the default. */
export function snapBatch(b: number): number {
	if (!Number.isFinite(b)) return DEFAULTS.batch;
	let best: number = BATCH_OPTIONS[0];
	for (const option of BATCH_OPTIONS) {
		if (Math.abs(option - b) < Math.abs(best - b)) best = option;
	}
	return best;
}

/** Rounds to the load step and clamps to the slider range. Non-finite input gives the default. */
export function snapLoad(v: number): number {
	if (!Number.isFinite(v)) return DEFAULTS.load;
	const stepped = Math.round(v / LOAD_STEP) * LOAD_STEP;
	return clamp(stepped, LOAD_MIN, LOAD_MAX);
}

/** Rounds to the GPU price step and clamps to the slider range. */
export function snapGpu(v: number): number {
	if (!Number.isFinite(v)) return DEFAULTS.gpuPrice;
	const stepped = Math.round(v / GPU_STEP) * GPU_STEP;
	return Math.round(clamp(stepped, GPU_MIN, GPU_MAX) * 10) / 10;
}

/** Rounds to the API price step and clamps to the slider range. */
export function snapApi(v: number): number {
	if (!Number.isFinite(v)) return DEFAULTS.apiPrice;
	return clamp(Math.round(v / API_STEP) * API_STEP, API_MIN, API_MAX);
}

/** Time of one generation step for a batch, ms. This is also TPOT of every user in the batch. */
export function stepTimeMs(batch: number): number {
	return T1_MS + STEP_SLOPE_MS * (batch - 1);
}

/** Output tokens per second of the GPU at full load (every step is busy): B / t(B). */
export function tokensPerSecondFull(batch: number): number {
	return batch / (stepTimeMs(batch) / 1000);
}

/** Output tokens per second actually delivered at a given load (percent). */
export function tokensPerSecond(batch: number, load: number): number {
	return (load / 100) * tokensPerSecondFull(batch);
}

/**
 * Cost of one million output tokens on your own GPU, у. е.:
 * c_g / (delivered tokens per second · 3600) · 10^6. Infinite when nothing is delivered.
 */
export function costPerMillion(gpuPrice: number, tokensPerSec: number): number {
	if (tokensPerSec <= 0) return Number.POSITIVE_INFINITY;
	return (gpuPrice / (tokensPerSec * 3600)) * 1_000_000;
}

/**
 * Load share at which your own GPU costs the same as the API per output token.
 * Equals cost at full load divided by the API price. Above 1 means the API is always cheaper.
 * GPU cost only: people, spare capacity and downtime are not included.
 */
export function breakEvenShare(
	gpuPrice: number,
	fullTokensPerSec: number,
	apiPrice: number,
): number {
	return costPerMillion(gpuPrice, fullTokensPerSec) / apiPrice;
}

/** Time to first token at a load, s: base time plus queueing that grows near full load. */
export function ttftSeconds(load: number): number {
	const u = clamp(load / 100, 0, MAX_QUEUE_LOAD);
	return TTFT_BASE_S + (QUEUE_S * u) / (1 - u);
}

/** Total latency of a response: T = TTFT + (N - 1) · TPOT, all in seconds. */
export function latencySeconds(ttftS: number, tpotMs: number, nOut: number): number {
	return ttftS + (nOut - 1) * (tpotMs / 1000);
}

/** Cost of one API request, у. е.; prices per million tokens. */
export function apiCost(nIn: number, nOut: number, priceIn: number, priceOut: number): number {
	return (nIn * priceIn + nOut * priceOut) / 1_000_000;
}

/** Cost of one million output tokens on the GPU for each load in the curve. */
export function costCurve(
	gpuPrice: number,
	batch: number,
	loads: readonly number[] = LOAD_CURVE,
): { load: number; cost: number }[] {
	return loads.map((load) => ({
		load,
		cost: costPerMillion(gpuPrice, tokensPerSecond(batch, load)),
	}));
}

/** Whole powers of ten covering the values (for a log axis). Always spans at least one decade. */
export function logDomain(values: readonly number[]): { lo: number; hi: number } {
	const logs = values.filter((v) => Number.isFinite(v) && v > 0).map((v) => Math.log10(v));
	if (logs.length === 0) return { lo: -1, hi: 2 };
	const lo = Math.floor(Math.min(...logs));
	let hi = Math.ceil(Math.max(...logs));
	if (hi === lo) hi = lo + 1;
	return { lo, hi };
}

/** Formats a price in у. е. for labels: one decimal below 10, integers above. */
export function formatPrice(v: number): string {
	if (!Number.isFinite(v)) return '—';
	if (v < 10) return v.toFixed(2);
	return Math.round(v).toLocaleString('ru-RU');
}

/** Percent with one decimal, e.g. 8.7%. */
export function formatPercent(share: number): string {
	return `${(share * 100).toFixed(1)}%`;
}

/** Verdict under the charts: which side is cheaper at the chosen load. */
export function verdict(state: LlmServingDemoState): string {
	const full = tokensPerSecondFull(state.batch);
	const share = breakEvenShare(state.gpuPrice, full, state.apiPrice);
	if (share > 1) {
		return 'Даже при 100% загрузке свой GPU дороже API при этих ценах.';
	}
	const load = state.load / 100;
	if (load >= share) {
		return `При загрузке ${state.load}% свой GPU дешевле API. Безубыточность: ${formatPercent(share)}.`;
	}
	return `При загрузке ${state.load}% API дешевле. Безубыточность: ${formatPercent(share)}.`;
}

/** Text of the live description (aria-live). Numbers are computed, not typed. */
export function describeState(state: LlmServingDemoState): string {
	const step = stepTimeMs(state.batch);
	const cost = costPerMillion(state.gpuPrice, tokensPerSecond(state.batch, state.load));
	const latency = latencySeconds(ttftSeconds(state.load), step, OUT_TOKENS);
	return (
		`Батч ${state.batch}, загрузка ${state.load}%. TPOT ${step.toFixed(1)} мс. ` +
		`Свой GPU: ${formatPrice(cost)} у. е. за миллион токенов; API: ${formatPrice(state.apiPrice)} у. е. ` +
		`Ответ из ${OUT_TOKENS} токенов займёт около ${latency.toFixed(1)} с. ${verdict(state)}`
	);
}
