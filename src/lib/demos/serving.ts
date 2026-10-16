/**
 * Math of the serving demo: batch vs online inference, and a canary rollout with rollback.
 * This is a teaching model with made-up constants, not a benchmark: the numbers show the trade-offs.
 * Pure functions only: no DOM, no Svelte. No randomness: every page load shows the same numbers.
 *
 * Inference model: one call costs T_OVERHEAD_MS + T_PER_ITEM_MS * batch milliseconds.
 * The traffic is split between WORKERS identical workers; each worker is an M/D/1-like queue
 * (Poisson arrivals, deterministic service). Batch waiting is the mean time to collect a batch.
 *
 * Canary model: a share of REQ_PER_HOUR requests goes to the new version. The rollback rule
 * compares the canary error rate with the baseline once the canary has enough requests.
 */

export const WORKERS = 4;
export const T_OVERHEAD_MS = 20;
export const T_PER_ITEM_MS = 2;

export const BATCH_MIN = 1;
export const BATCH_MAX = 64;
export const BATCH_DEFAULT = 8;

export const RATE_MIN = 10;
export const RATE_MAX = 400;
export const RATE_STEP = 10;
export const RATE_DEFAULT = 120;

export const SHARE_MIN = 0;
export const SHARE_MAX = 100;
export const SHARE_STEP = 5;
export const SHARE_DEFAULT = 10;

export const REQ_PER_HOUR = 10000;
/** Error rate of the current version (fraction of requests). */
export const ERR_BASE = 0.005;
/** Error rate of the new version when it is healthy. */
export const ERR_NEW_OK = 0.006;
/** Error rate of the new version when it is broken. */
export const ERR_NEW_BAD = 0.04;
/** Canary needs at least this many requests per hour before a verdict is reached. */
export const MIN_CANARY_SAMPLE = 1000;
/** Rollback when the canary error rate exceeds this multiple of the baseline. */
export const ERR_RATIO_LIMIT = 2;

export interface ServingDemoState {
	/** Requests per batch (1 = online, one request per call). */
	batch: number;
	/** Arrival rate of requests per second. */
	rate: number;
	/** Share of traffic on the new version, in percent. */
	share: number;
	/** Whether the new version has a defect. */
	broken: boolean;
}

export const DEFAULT_STATE: ServingDemoState = {
	batch: BATCH_DEFAULT,
	rate: RATE_DEFAULT,
	share: SHARE_DEFAULT,
	broken: false,
};

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

function snapTo(v: unknown, lo: number, hi: number, step: number, fallback: number): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
	return clamp(Math.round(clamp(v, lo, hi) / step) * step, lo, hi);
}

/** Integer batch size in [BATCH_MIN, BATCH_MAX]. Non-numbers give the default. */
export function snapBatch(v: unknown): number {
	return snapTo(v, BATCH_MIN, BATCH_MAX, 1, BATCH_DEFAULT);
}

/** Arrival rate snapped to RATE_STEP within [RATE_MIN, RATE_MAX]. */
export function snapRate(v: unknown): number {
	return snapTo(v, RATE_MIN, RATE_MAX, RATE_STEP, RATE_DEFAULT);
}

/** Traffic share snapped to SHARE_STEP within [SHARE_MIN, SHARE_MAX]. */
export function snapShare(v: unknown): number {
	return snapTo(v, SHARE_MIN, SHARE_MAX, SHARE_STEP, SHARE_DEFAULT);
}

/** Merges a patch into the state, snapping every field. Unknown or invalid fields are ignored. */
export function applyPatch(
	state: ServingDemoState,
	patch: Partial<Record<keyof ServingDemoState, unknown>>,
): ServingDemoState {
	return {
		batch: 'batch' in patch ? snapBatch(patch.batch) : state.batch,
		rate: 'rate' in patch ? snapRate(patch.rate) : state.rate,
		share: 'share' in patch ? snapShare(patch.share) : state.share,
		broken: typeof patch.broken === 'boolean' ? patch.broken : state.broken,
	};
}

/** Time of one call of the model on `batch` requests, in milliseconds. */
export function serviceMs(batch: number): number {
	return T_OVERHEAD_MS + T_PER_ITEM_MS * batch;
}

export interface PathMetrics {
	batch: number;
	/** Time of one call, ms. */
	serviceMs: number;
	/** Mean wait for a batch to fill, ms. Zero for online. */
	fillMs: number;
	/** Mean queue wait, ms. Infinity when the queue is unstable. */
	queueMs: number;
	/** Mean end-to-end latency per request, ms. Infinity when the queue is unstable. */
	latencyMs: number;
	/** Worker utilisation in [0, 1+). */
	utilisation: number;
	/** Maximum sustained throughput of all workers, requests per second. */
	capacity: number;
	/** True when utilisation is below 1. */
	stable: boolean;
}

/**
 * Latency and load of one serving path. `batch` = 1 is the online path.
 * Per worker: arrivals rate/WORKERS, one call per `batch` requests.
 */
export function pathMetrics(batch: number, rate: number): PathMetrics {
	const b = snapBatch(batch);
	const r = snapRate(rate);
	const s = serviceMs(b);
	const sSec = s / 1000;
	const lambdaW = r / WORKERS;
	const fillMs = b > 1 ? ((b - 1) / (2 * lambdaW)) * 1000 : 0;
	const utilisation = (lambdaW / b) * sSec;
	const capacity = (WORKERS * b) / sSec;
	const stable = utilisation < 1;
	const queueMs = stable ? (utilisation * s) / (2 * (1 - utilisation)) : Infinity;
	const latencyMs = stable ? fillMs + queueMs + s : Infinity;
	return { batch: b, serviceMs: s, fillMs, queueMs, latencyMs, utilisation, capacity, stable };
}

export type Verdict = 'off' | 'wait' | 'ok' | 'rollback';

export interface CanaryMetrics {
	/** Requests per hour on the new version. */
	canaryRequests: number;
	/** Error rate of the new version. */
	newErrRate: number;
	/** Expected user-visible errors per hour at the current share. */
	errorsPerHour: number;
	/** Expected errors per hour after a rollback to the baseline. */
	errorsAfterRollback: number;
	verdict: Verdict;
}

/**
 * Canary verdict for the current share. `off` at share 0, `wait` while the canary sample
 * is too small, `rollback` when its error rate exceeds the baseline by ERR_RATIO_LIMIT, else `ok`.
 */
export function canaryMetrics(share: number, broken: boolean): CanaryMetrics {
	const p = snapShare(share) / 100;
	const newErrRate = broken ? ERR_NEW_BAD : ERR_NEW_OK;
	const canaryRequests = p * REQ_PER_HOUR;
	const errorsPerHour = (1 - p) * REQ_PER_HOUR * ERR_BASE + canaryRequests * newErrRate;
	const errorsAfterRollback = REQ_PER_HOUR * ERR_BASE;
	let verdict: Verdict;
	if (p === 0) verdict = 'off';
	else if (canaryRequests < MIN_CANARY_SAMPLE) verdict = 'wait';
	else if (newErrRate > ERR_BASE * ERR_RATIO_LIMIT) verdict = 'rollback';
	else verdict = 'ok';
	return { canaryRequests, newErrRate, errorsPerHour, errorsAfterRollback, verdict };
}

/** Formats milliseconds for the UI: integer ms, or a text for an unstable queue. */
export function formatMs(ms: number): string {
	return Number.isFinite(ms) ? `${Math.round(ms)} мс` : 'очередь растёт';
}
