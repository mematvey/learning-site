/**
 * Math of the memory-cache demo: a square n x n matrix of doubles stored row by row, two traversal
 * orders (by rows, by columns) and a fully associative LRU cache that counts misses.
 * The cache is a teaching simplification: real CPUs use set-associative caches with several levels.
 * The time estimate uses two assumed constants (HIT_NS, MISS_NS), not measurements.
 * Pure functions only: no DOM, no Svelte.
 */

/** Size of one matrix element: double precision, 8 bytes. */
export const ELEM_BYTES = 8;

export const N_OPTIONS = [16, 32, 48, 64] as const;
export const CACHE_BYTES_OPTIONS = [512, 1024, 2048, 4096, 8192, 16384] as const;
export const LINE_BYTES_OPTIONS = [16, 32, 64, 128] as const;

/** Assumed cost of a cache hit (ns). Order of magnitude only. */
export const HIT_NS = 1;
/** Assumed cost of a cache miss that goes to main memory (ns). Order of magnitude only. */
export const MISS_NS = 80;

export type Order = 'row' | 'col';

export interface CacheDemoState {
	/** Matrix side: the matrix is n x n. */
	n: number;
	/** Cache capacity in bytes. */
	cacheBytes: number;
	/** Cache line size in bytes. */
	lineBytes: number;
	/** Traversal order shown in the grid. */
	order: Order;
	/** Number of accesses shown in the grid (0 .. n*n). */
	step: number;
}

export const DEFAULTS: CacheDemoState = {
	n: 64,
	cacheBytes: 2048,
	lineBytes: 64,
	order: 'col',
	step: 64 * 64,
};

export interface TraversalStats {
	/** Number of accesses (n*n). */
	accesses: number;
	/** Number of misses. */
	misses: number;
	/** Misses divided by accesses, 0..1. */
	missRate: number;
	/** Estimated time in ns. */
	timeNs: number;
	/** hits[t] is true when access t hit the cache. */
	hits: boolean[];
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Nearest allowed option; non-numbers give the fallback. */
function snapTo<T extends number>(options: readonly T[], v: unknown, fallback: T): T {
	if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
	let best = options[0] ?? fallback;
	for (const o of options) {
		if (Math.abs(o - v) < Math.abs(best - v)) best = o;
	}
	return best;
}

/** Element indices in the order they are visited. Element (i, j) has index i*n + j. */
export function traversal(n: number, order: Order): number[] {
	const out: number[] = [];
	if (order === 'row') {
		for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push(i * n + j);
	} else {
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out.push(i * n + j);
	}
	return out;
}

/** Position in the visiting order for every element index: positions[e] = t when element e is visited at access t. */
export function visitPositions(n: number, order: Order): number[] {
	const seq = traversal(n, order);
	const pos = new Array<number>(n * n).fill(0);
	seq.forEach((e, t) => {
		pos[e] = t;
	});
	return pos;
}

/** Cache line number of an element index. */
export function lineOf(elem: number, lineBytes: number): number {
	return Math.floor((elem * ELEM_BYTES) / lineBytes);
}

/**
 * Simulates a fully associative LRU cache on a sequence of element accesses.
 * Returns hits[t] = true when access t was found in the cache. Eviction removes the least recently used line.
 */
export function simulate(
	elems: readonly number[],
	cacheBytes: number,
	lineBytes: number,
): boolean[] {
	const capacity = Math.max(1, Math.floor(cacheBytes / lineBytes));
	const lru = new Map<number, true>();
	const hits: boolean[] = [];
	for (const e of elems) {
		const line = lineOf(e, lineBytes);
		if (lru.has(line)) {
			lru.delete(line);
			lru.set(line, true);
			hits.push(true);
			continue;
		}
		if (lru.size >= capacity) {
			const oldest = lru.keys().next().value;
			if (oldest !== undefined) lru.delete(oldest);
		}
		lru.set(line, true);
		hits.push(false);
	}
	return hits;
}

/** Estimated time: each hit costs HIT_NS, each miss costs MISS_NS. */
export function estimateTimeNs(accesses: number, misses: number): number {
	return (accesses - misses) * HIT_NS + misses * MISS_NS;
}

/** Full pass over the n x n matrix in the given order: counts, miss rate and estimated time. */
export function traversalStats(
	n: number,
	order: Order,
	cacheBytes: number,
	lineBytes: number,
): TraversalStats {
	const hits = simulate(traversal(n, order), cacheBytes, lineBytes);
	const accesses = hits.length;
	const misses = hits.reduce((s, h) => s + (h ? 0 : 1), 0);
	return {
		accesses,
		misses,
		missRate: accesses === 0 ? 0 : misses / accesses,
		timeNs: estimateTimeNs(accesses, misses),
		hits,
	};
}

/** Number of cache lines in the cache (at least one). */
export function cacheLines(cacheBytes: number, lineBytes: number): number {
	return Math.max(1, Math.floor(cacheBytes / lineBytes));
}

/** Matrix size in bytes. */
export function matrixBytes(n: number): number {
	return n * n * ELEM_BYTES;
}

/** Human-readable size in bytes: "512 Б", "2 КБ". */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} Б`;
	return `${Math.round(bytes / 1024)} КБ`;
}

/** Human-readable time in ns, mcs or ms. */
export function formatTime(ns: number): string {
	if (ns < 1000) return `${Math.round(ns)} нс`;
	if (ns < 1e6) return `${(ns / 1e3).toPrecision(3)} мкс`;
	return `${(ns / 1e6).toPrecision(3)} мс`;
}

/** Share of misses in percent, one decimal place. */
export function formatPercent(rate: number): string {
	return `${(rate * 100).toFixed(1)}%`;
}

/** Clamps the step to [0, n*n] and rounds it. */
export function clampStep(step: unknown, n: number): number {
	const total = n * n;
	if (typeof step !== 'number' || !Number.isFinite(step)) return total;
	return clamp(Math.round(step), 0, total);
}

/** Validates a state patch: unknown values are replaced by the current ones, options are snapped. */
export function applyPatch(st: CacheDemoState, patch: Partial<CacheDemoState>): CacheDemoState {
	const n = snapTo(N_OPTIONS, patch.n ?? st.n, st.n);
	const cacheBytes = snapTo(CACHE_BYTES_OPTIONS, patch.cacheBytes ?? st.cacheBytes, st.cacheBytes);
	const lineBytes = snapTo(LINE_BYTES_OPTIONS, patch.lineBytes ?? st.lineBytes, st.lineBytes);
	const order: Order = patch.order === 'row' || patch.order === 'col' ? patch.order : st.order;
	const step = clampStep(patch.step ?? st.step, n);
	return { n, cacheBytes, lineBytes, order, step };
}

/** Text under the grid. Numbers come from the simulation. */
export function describeState(
	st: CacheDemoState,
	row: TraversalStats,
	col: TraversalStats,
): string {
	const current = st.order === 'row' ? row : col;
	const name = st.order === 'row' ? 'по строкам' : 'по столбцам';
	const lines = cacheLines(st.cacheBytes, st.lineBytes);
	return (
		`Обход ${name}: промахов ${current.misses} из ${current.accesses} ` +
		`(${formatPercent(current.missRate)}), оценка времени ${formatTime(current.timeNs)}. ` +
		`Кэш держит ${lines} ${lines === 1 ? 'линию' : 'линий'}; ` +
		`по строкам промахов ${row.misses}, по столбцам ${col.misses}.`
	);
}
