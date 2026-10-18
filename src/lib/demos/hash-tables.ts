/**
 * Math of the hash table demo: insertion into a chained or open-addressed (linear probing) table.
 * Pure functions only: no DOM, no Svelte.
 *
 * Keys: a fixed sequence of distinct integers drawn by a seed, so every page load shows the same table.
 * Growth: when the load factor n / m exceeds MAX_LOAD after an insertion, the table is rebuilt
 * (rehashing) with the smallest prime size >= 2m.
 * Hash functions: division h(k) = k mod m; multiplicative h(k) = floor(m * frac(k * A)), A = (sqrt5 - 1) / 2;
 * universal (Carter-Wegman) h(k) = ((a * k + b) mod P) mod m with a prime P > KEY_MAX and a pair (a, b)
 * drawn from the seed by the `pick` index.
 * Theory (Knuth, TAOCP vol. 3, 6.4), successful search, load factor a:
 *   chaining: 1 + a / 2 comparisons; linear probing: (1 + 1 / (1 - a)) / 2 probes.
 */

import { mulberry32 } from './attention';

export const KEYS_SEED = 4242;
/** Number of keys in the fixed sequence (the slider maximum). */
export const N_MAX = 40;
/** Keys are integers in [1, KEY_MAX]. */
export const KEY_MAX = 999;
export const INITIAL_SIZE = 7;
/** Rehash when n / m exceeds this value. */
export const MAX_LOAD = 0.75;
export const DEFAULT_COUNT = 12;
const KNUTH_A = (Math.sqrt(5) - 1) / 2;

export type Strategy = 'chain' | 'probe';
export type HashKind = 'division' | 'multiplicative' | 'universal';
/** Prime larger than every key: the modulus of the universal family. */
export const UNIVERSAL_P = 1009;
export const DEFAULT_PICK = 0;
export const DEFAULT_STRATEGY: Strategy = 'chain';
export const DEFAULT_HASH: HashKind = 'division';

export function isStrategy(v: unknown): v is Strategy {
	return v === 'chain' || v === 'probe';
}

export function isHashKind(v: unknown): v is HashKind {
	return v === 'division' || v === 'multiplicative' || v === 'universal';
}

export interface HashTableDemoState {
	/** Collision resolution: chains per bucket, or linear probing in one array. */
	strategy: Strategy;
	/** Hash function. */
	hash: HashKind;
	/** Index of the (a, b) pair of the universal family; used only when hash is 'universal'. */
	pick?: number;
	/** How many keys of the fixed sequence are inserted, integer in [0, N_MAX]. */
	count: number;
}

/** Result of the table built from the first `count` keys. */
export interface TableSnapshot {
	/** Table size m (number of buckets or slots). */
	readonly size: number;
	/** Number of stored keys n. */
	readonly count: number;
	/** Load factor a = n / m. */
	readonly load: number;
	/** Cells: chain keys in insertion order (chaining), or 0 or 1 key per slot (probing). */
	readonly cells: readonly (readonly number[])[];
	/** Occupied places passed over by the user's insertions (moves during rehashing are not counted). */
	readonly collisions: number;
	/** Number of times the table was rebuilt with a larger size. */
	readonly rehashes: number;
	/** Longest chain (chaining) or longest run of occupied slots (probing). */
	readonly longest: number;
	/** Observed average comparisons (or probes) of a successful search over all stored keys. */
	readonly avgProbes: number;
	/** Theoretical average for the current load factor. */
	readonly theoryProbes: number;
	/** The most recently inserted key, or null for an empty table. */
	readonly lastKey: number | null;
	/** Cell index of the most recently inserted key, or -1. */
	readonly lastIndex: number;
	/** Comparisons (or probes) needed to find the most recently inserted key. */
	readonly lastCost: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds and clamps the key count to [0, N_MAX]. Non-finite input gives the default. */
export function snapCount(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_COUNT;
	return clamp(Math.round(v), 0, N_MAX);
}

/** The fixed sequence of distinct keys, computed once from the seed. */
export function makeKeys(): number[] {
	const rnd = mulberry32(KEYS_SEED);
	const seen = new Set<number>();
	const out: number[] = [];
	while (out.length < N_MAX) {
		const k = 1 + Math.floor(rnd() * KEY_MAX);
		if (!seen.has(k)) {
			seen.add(k);
			out.push(k);
		}
	}
	return out;
}

export const KEYS: readonly number[] = makeKeys();

function isPrime(n: number): boolean {
	if (n < 2) return false;
	for (let d = 2; d * d <= n; d++) {
		if (n % d === 0) return false;
	}
	return true;
}

/** Smallest prime >= x. */
export function nextPrime(x: number): number {
	let p = Math.max(2, Math.ceil(x));
	while (!isPrime(p)) p++;
	return p;
}

/** Pair (a, b) of the universal family for a pick index: a in [1, P - 1], b in [0, P - 1]. Deterministic. */
export function universalPair(pick: number): { a: number; b: number } {
	const rnd = mulberry32(KEYS_SEED + 1 + Math.max(0, Math.floor(pick)));
	return {
		a: 1 + Math.floor(rnd() * (UNIVERSAL_P - 1)),
		b: Math.floor(rnd() * UNIVERSAL_P),
	};
}

/** Rounds and clamps the pick index to a non-negative integer. */
export function snapPick(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_PICK;
	return Math.max(0, Math.floor(v));
}

/** Bucket (or home slot) of a key in a table of size m. Result is in [0, m). */
export function bucketOf(key: number, m: number, hash: HashKind, pick = DEFAULT_PICK): number {
	if (hash === 'division') return key % m;
	if (hash === 'universal') {
		const { a, b } = universalPair(pick);
		return ((a * key + b) % UNIVERSAL_P) % m;
	}
	const frac = (key * KNUTH_A) % 1;
	return Math.min(m - 1, Math.floor(m * frac));
}

function emptyCells(m: number): number[][] {
	return Array.from({ length: m }, () => []);
}

/** Places a key; returns the cell index, the occupied places passed, and the position of the key in its cell. */
function place(
	cells: number[][],
	key: number,
	hash: HashKind,
	strategy: Strategy,
	pick: number,
): { index: number; collisions: number; cost: number } {
	const m = cells.length;
	const home = bucketOf(key, m, hash, pick);
	if (strategy === 'chain') {
		const bucket = cells[home] ?? [];
		const collisions = bucket.length;
		bucket.push(key);
		return { index: home, collisions, cost: bucket.length };
	}
	let i = home;
	let collisions = 0;
	for (let step = 0; step < m; step++) {
		const cell = cells[i] ?? [];
		if (cell.length === 0) {
			cell.push(key);
			return { index: i, collisions, cost: step + 1 };
		}
		collisions++;
		i = (i + 1) % m;
	}
	throw new Error('hash table is full');
}

/** Finds a key: its cell index and the number of comparisons (probes), or null if absent. */
export function lookup(
	cells: readonly (readonly number[])[],
	key: number,
	hash: HashKind,
	strategy: Strategy,
	pick: number = DEFAULT_PICK,
): { index: number; cost: number } | null {
	const m = cells.length;
	const home = bucketOf(key, m, hash, pick);
	if (strategy === 'chain') {
		const pos = (cells[home] ?? []).indexOf(key);
		return pos < 0 ? null : { index: home, cost: pos + 1 };
	}
	let i = home;
	for (let step = 0; step < m; step++) {
		const cell = cells[i] ?? [];
		if (cell.length === 0) return null;
		if (cell[0] === key) return { index: i, cost: step + 1 };
		i = (i + 1) % m;
	}
	return null;
}

/** Longest chain (chaining) or longest run of consecutive occupied slots (probing). */
function longestRun(cells: readonly (readonly number[])[], strategy: Strategy): number {
	if (strategy === 'chain') {
		return cells.reduce((best, c) => Math.max(best, c.length), 0);
	}
	let best = 0;
	let run = 0;
	for (const c of cells) {
		run = c.length > 0 ? run + 1 : 0;
		best = Math.max(best, run);
	}
	return best;
}

/** Theoretical average comparisons (chaining) or probes (linear probing) of a successful search. */
export function theoryProbes(strategy: Strategy, load: number): number {
	if (strategy === 'chain') return 1 + load / 2;
	if (load >= 1) return Infinity;
	return 0.5 * (1 + 1 / (1 - load));
}

/**
 * Builds the table from the first `state.count` keys of the fixed sequence.
 * Deterministic: the same state always gives the same table.
 */
export function buildTable(state: HashTableDemoState): TableSnapshot {
	const keys = KEYS.slice(0, snapCount(state.count));
	const { hash, strategy } = state;
	const pick = snapPick(state.pick);
	let m = INITIAL_SIZE;
	let cells = emptyCells(m);
	let collisions = 0;
	let rehashes = 0;
	let n = 0;
	for (const key of keys) {
		const r = place(cells, key, hash, strategy, pick);
		collisions += r.collisions;
		n++;
		if (n / m > MAX_LOAD) {
			m = nextPrime(2 * m);
			cells = emptyCells(m);
			for (const k of keys.slice(0, n)) place(cells, k, hash, strategy, pick);
			rehashes++;
		}
	}

	const load = n / m;
	let totalCost = 0;
	for (const k of keys) {
		totalCost += lookup(cells, k, hash, strategy, pick)?.cost ?? 0;
	}
	const lastKey = n > 0 ? (keys[n - 1] ?? null) : null;
	const last = lastKey === null ? null : lookup(cells, lastKey, hash, strategy, pick);
	return {
		size: m,
		count: n,
		load,
		cells,
		collisions,
		rehashes,
		longest: longestRun(cells, strategy),
		avgProbes: n > 0 ? totalCost / n : 0,
		theoryProbes: n > 0 ? theoryProbes(strategy, load) : 0,
		lastKey,
		lastIndex: last?.index ?? -1,
		lastCost: last?.cost ?? 0,
	};
}

/** One-sentence description of the table for the live region. */
export function describeTable(state: HashTableDemoState, t: TableSnapshot): string {
	if (t.count === 0) return 'Таблица пуста. Сдвиньте ползунок или добавьте ключ.';
	const where =
		state.strategy === 'chain'
			? `цепочки в ${t.size} корзинах, самая длинная цепочка: ${t.longest}`
			: `открытая адресация в ${t.size} ячейках, самый длинный занятый участок: ${t.longest}`;
	const grow =
		t.rehashes > 0
			? ` Таблица перестраивалась ${t.rehashes} раз: при α > ${MAX_LOAD} размер растёт до простого числа.`
			: '';
	return `Ключей ${t.count}, α = ${t.load.toFixed(2)}; ${where}. Коллизий при вставке: ${t.collisions}.${grow}`;
}

/** Load factor with two decimals, for display. */
export function formatLoad(load: number): string {
	return load.toFixed(2);
}
