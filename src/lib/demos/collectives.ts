/**
 * Model of the collectives demo (chapter compute/collectives): ring all-reduce time
 * T = 2(N-1)·α + 2(N-1)/N · S/B, and the ring schedule of reduce-scatter and all-gather.
 * The bandwidth and latency defaults are teaching values, not a spec of any network.
 * Units inside the functions: bytes, bytes per second, seconds. Pure functions only: no DOM, no Svelte.
 */

export const KB = 1e3;
export const MB = 1e6;
export const GB = 1e9;

export const N_MIN = 2;
export const N_MAX = 64;
export const DEFAULT_N = 8;
export const DEFAULT_S_BYTES = GB;
export const DEFAULT_B_GBS = 100;
export const DEFAULT_ALPHA_US = 10;
/** Reference message of the chart and the table: 1 MB. */
export const REF_BYTES = MB;

/** Message size slider works on log10(bytes): 10^3 B (1 KB) … 10^10 B (10 GB). */
export const S_EXP_MIN = 3;
export const S_EXP_MAX = 10;
export const S_EXP_STEP = 0.1;
/** Bandwidth slider, GB/s. */
export const B_MIN = 10;
export const B_MAX = 400;
export const B_STEP = 10;
/** Per-step latency slider, µs. */
export const ALPHA_MIN = 1;
export const ALPHA_MAX = 100;
export const ALPHA_STEP = 1;

/** Chart y domain in seconds: 10^-6 s … 10^1 s, one decade per tick. */
export const LOG_MIN = -6;
export const LOG_MAX = 1;

export interface CollectivesDemoState {
	/** Number of GPUs in the group. */
	n: number;
	/** Message size per GPU in bytes. */
	sBytes: number;
	/** Link bandwidth in GB/s. */
	bGbs: number;
	/** Latency of one step in µs. */
	alphaUs: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

function roundTo(v: number, step: number): number {
	return Math.round(v / step) * step;
}

/** Integer GPU count in [N_MIN, N_MAX]. Non-finite input gives DEFAULT_N. */
export function snapN(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_N;
	return Math.round(clamp(n, N_MIN, N_MAX));
}

/** Snaps log10(bytes) to the slider step and clamps it to the range. */
export function snapSExp(e: number): number {
	if (!Number.isFinite(e)) return Math.log10(DEFAULT_S_BYTES);
	return Math.round(clamp(roundTo(e, S_EXP_STEP), S_EXP_MIN, S_EXP_MAX) * 10) / 10;
}

/** Message size in bytes for a slider value. */
export function sBytesFromExp(e: number): number {
	return Math.pow(10, snapSExp(e));
}

/** Snaps bandwidth (GB/s) to the slider. Non-finite input gives the default. */
export function snapB(b: number): number {
	if (!Number.isFinite(b)) return DEFAULT_B_GBS;
	return clamp(roundTo(b, B_STEP), B_MIN, B_MAX);
}

/** Snaps latency (µs) to the slider. Non-finite input gives the default. */
export function snapAlpha(a: number): number {
	if (!Number.isFinite(a)) return DEFAULT_ALPHA_US;
	return clamp(Math.round(a / ALPHA_STEP) * ALPHA_STEP, ALPHA_MIN, ALPHA_MAX);
}

/** Number of steps of the ring all-reduce: reduce-scatter and all-gather, N-1 each. */
export function ringSteps(n: number): number {
	return 2 * (n - 1);
}

/** Bytes one GPU sends: V = 2(N-1)/N · S. */
export function ringVolume(n: number, s: number): number {
	return ((2 * (n - 1)) / n) * s;
}

export interface RingTime {
	/** Number of steps 2(N-1). */
	steps: number;
	/** Time of one step, α + S/(N·B). */
	stepTime: number;
	/** Latency part 2(N-1)·α, seconds. */
	latency: number;
	/** Data part 2(N-1)/N · S/B, seconds. */
	transfer: number;
	/** Total time, seconds. */
	total: number;
	/** Bytes sent by one GPU. */
	volume: number;
}

/**
 * Time of the ring all-reduce in the teaching model.
 * @param n GPU count, s message bytes, b bandwidth bytes/s, alpha step latency in seconds.
 */
export function ringTime(n: number, s: number, b: number, alpha: number): RingTime {
	const steps = ringSteps(n);
	const latency = steps * alpha;
	const transfer = (steps / n) * (s / b);
	return {
		steps,
		stepTime: alpha + s / (n * b),
		latency,
		transfer,
		total: latency + transfer,
		volume: ringVolume(n, s),
	};
}

/** Message size (bytes) at which latency and data parts are equal: S = N·α·B. */
export function crossoverBytes(n: number, b: number, alpha: number): number {
	return n * alpha * b;
}

/** Total time for each N in ns, seconds. */
export function timeCurve(ns: readonly number[], s: number, b: number, alpha: number): number[] {
	return ns.map((n) => ringTime(n, s, b, alpha).total);
}

/** Latency-only part 2(N-1)·α for each N in ns, seconds. */
export function latencyCurve(ns: readonly number[], alpha: number): number[] {
	return ns.map((n) => ringSteps(n) * alpha);
}

/** Drops trailing zeros after the decimal point: "1.10" gives "1.1", "2.0" gives "2". */
function trimZeros(text: string): string {
	return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

/** Bytes with a unit, Russian: "1 ГБ", "1 МБ", "3,2 ГБ". */
export function formatBytes(bytes: number): string {
	let value = bytes;
	let unit = 'Б';
	if (bytes >= GB) {
		value = bytes / GB;
		unit = 'ГБ';
	} else if (bytes >= MB) {
		value = bytes / MB;
		unit = 'МБ';
	} else if (bytes >= KB) {
		value = bytes / KB;
		unit = 'КБ';
	}
	const digits = value >= 10 ? 0 : 1;
	return `${trimZeros(value.toFixed(digits)).replace('.', ',')} ${unit}`;
}

/** Duration in seconds as µs, ms or s, Russian decimal comma: "0,16 мс", "17,6 мс", "1 мс", "1,28 с". */
export function formatDuration(seconds: number): string {
	if (seconds < 1e-3) {
		const us = seconds * 1e6;
		return `${trimZeros(us.toFixed(us < 10 ? 1 : 0)).replace('.', ',')} мкс`;
	}
	if (seconds < 1) {
		const ms = seconds * 1e3;
		return `${trimZeros(ms.toFixed(ms >= 10 ? 1 : 2)).replace('.', ',')} мс`;
	}
	return `${trimZeros(seconds.toFixed(2)).replace('.', ',')} с`;
}

/** Log10 of a time in seconds for the chart; values are clamped to the domain. */
export function logY(seconds: number): number {
	const v = Math.log10(Math.max(seconds, Math.pow(10, LOG_MIN)));
	return clamp(v, LOG_MIN, LOG_MAX);
}

/* ---------- Ring schedule ---------- */

export type RingPhase = 'reduce-scatter' | 'all-gather';

/** One transfer: GPU `from` sends piece `chunk` to its neighbour `to`. */
export interface RingSend {
	from: number;
	to: number;
	chunk: number;
}

export interface RingStep {
	/** Overall step index, 0 … 2(N-1)-1. */
	index: number;
	phase: RingPhase;
	/** Step index inside its phase, 0 … N-2. */
	sub: number;
	/** One send per GPU: GPU i sends to (i+1) mod N. */
	sends: RingSend[];
}

function mod(a: number, n: number): number {
	return ((a % n) + n) % n;
}

/**
 * Ring schedule. Reduce-scatter, step s: GPU i sends piece (i-s) mod N to i+1.
 * All-gather, step t: GPU i sends piece (i+1-t) mod N to i+1.
 * Returns [] for n < 2.
 */
export function ringSchedule(n: number): RingStep[] {
	if (n < 2) return [];
	const steps: RingStep[] = [];
	for (let sub = 0; sub < n - 1; sub++) {
		const sends: RingSend[] = [];
		for (let i = 0; i < n; i++) {
			sends.push({ from: i, to: (i + 1) % n, chunk: mod(i - sub, n) });
		}
		steps.push({ index: sub, phase: 'reduce-scatter', sub, sends });
	}
	for (let sub = 0; sub < n - 1; sub++) {
		const sends: RingSend[] = [];
		for (let i = 0; i < n; i++) {
			sends.push({ from: i, to: (i + 1) % n, chunk: mod(i + 1 - sub, n) });
		}
		steps.push({ index: n - 1 + sub, phase: 'all-gather', sub, sends });
	}
	return steps;
}

/**
 * Contributions: contrib[gpu][chunk] is the set of GPUs whose piece of this chunk
 * the GPU already holds summed in. A chunk is complete when its set has N members.
 */
export type Contrib = Set<number>[][];

export function initialContrib(n: number): Contrib {
	const contrib: Contrib = [];
	for (let i = 0; i < n; i++) {
		const row: Set<number>[] = [];
		for (let k = 0; k < n; k++) row.push(new Set([i]));
		contrib.push(row);
	}
	return contrib;
}

/** Returns the state after one schedule step; the input is not changed. */
export function applyRingStep(contrib: Contrib, step: RingStep): Contrib {
	const next: Contrib = contrib.map((row) => row.map((s) => new Set(s)));
	for (const { from, to, chunk } of step.sends) {
		const incoming = contrib[from]?.[chunk];
		const row = next[to];
		if (!incoming || !row) continue;
		if (step.phase === 'reduce-scatter') {
			for (const g of incoming) row[chunk]?.add(g);
		} else {
			row[chunk] = new Set(incoming);
		}
	}
	return next;
}

/** State after the first `k` steps of the schedule (k clamped to the schedule length). */
export function contribAfter(n: number, k: number): Contrib {
	let contrib = initialContrib(n);
	const steps = ringSchedule(n);
	const count = Math.max(0, Math.min(k, steps.length));
	for (let i = 0; i < count; i++) {
		const step = steps[i];
		if (step) contrib = applyRingStep(contrib, step);
	}
	return contrib;
}

/** Number of (GPU, chunk) pairs that hold the full sum, 0 … N². */
export function completeChunks(contrib: Contrib, n: number): number {
	let count = 0;
	for (const row of contrib) {
		for (const s of row) {
			if (s.size === n) count++;
		}
	}
	return count;
}
