/**
 * Math of the hashing-sketches demo: a Bloom filter (false-positive rate against theory),
 * MinHash (Jaccard estimate with t hash functions) and Count-Min parameters.
 * Pure functions only: no DOM, no Svelte.
 *
 * Everything is deterministic: keys and hash salts come from fixed seeds, so every page load
 * shows the same numbers.
 * Bloom theory: f = (1 - e^{-kn/m})^k (Broder, Mitzenmacher 2004).
 * MinHash theory: Pr[min pi(A) = min pi(B)] = J(A, B); spread of the estimate sqrt(J(1-J)/t).
 * Count-Min (Cormode, Muthukrishnan 2005): w = ceil(e/eps), d = ceil(ln(1/delta)).
 */

/** Default number of inserted elements in the Bloom demo (the chapter uses m/n = 10 with n = 300). */
export const N_ITEMS = 300;
export const N_MIN = 50;
export const N_MAX = 1000;
export const N_STEP = 50;
export const DEFAULT_N = N_ITEMS;
/** Elements added by one press of the "add" button. */
export const N_ADD = 50;
export const M_MIN = 300;
export const M_MAX = 3000;
export const M_STEP = 60;
export const DEFAULT_M = 3000;
export const K_MIN = 1;
export const K_MAX = 12;
export const DEFAULT_K = 7;
/** Absent elements used to measure the false-positive rate. */
export const QUERIES = 4000;
export const T_MIN = 1;
export const T_MAX = 200;
export const T_STEP = 1;
export const DEFAULT_T = 100;
/** Independent MinHash runs used to measure the spread of the estimate. */
export const SPREAD_TRIALS = 200;

const SEED_ITEMS = 0x1234567;
const SEED_ABSENT = 0x7654321;
const LN2_SQ = Math.LN2 * Math.LN2;

export interface BloomDemoState {
	m: number;
	k: number;
	n: number;
	t: number;
}

function clampInt(v: number, lo: number, hi: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	return Math.min(hi, Math.max(lo, Math.round(v)));
}

export function snapM(v: number): number {
	const steps = Math.round((clampInt(v, M_MIN, M_MAX, DEFAULT_M) - M_MIN) / M_STEP);
	return Math.min(M_MAX, M_MIN + steps * M_STEP);
}

export function snapN(v: number): number {
	const steps = Math.round((clampInt(v, N_MIN, N_MAX, DEFAULT_N) - N_MIN) / N_STEP);
	return Math.min(N_MAX, N_MIN + steps * N_STEP);
}

export function snapK(v: number): number {
	return clampInt(v, K_MIN, K_MAX, DEFAULT_K);
}

export function snapT(v: number): number {
	return clampInt(v, T_MIN, T_MAX, DEFAULT_T);
}

/** 32-bit integer mixer (murmur3 finaliser). A bijection on uint32, so distinct inputs give distinct outputs. */
export function mix32(x: number): number {
	let h = x >>> 0;
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	h ^= h >>> 16;
	return h >>> 0;
}

/** Inserted elements: the first `n` values of a fixed sequence. */
export function insertedKeys(n: number = N_ITEMS): number[] {
	const keys: number[] = [];
	for (let i = 0; i < n; i++) keys.push(mix32(SEED_ITEMS + i));
	return keys;
}

/** Elements that are guaranteed not to be inserted (the first `count` such values). */
export function absentKeys(count: number = QUERIES, n: number = N_ITEMS): number[] {
	const inserted = new Set(insertedKeys(n));
	const keys: number[] = [];
	for (let i = 0; keys.length < count; i++) {
		const key = mix32(SEED_ABSENT + i);
		if (!inserted.has(key)) keys.push(key);
	}
	return keys;
}

/**
 * Bit positions of one element for k hash functions over m bits.
 * Double hashing: p_j = (h1 + j·h2) mod m, with an odd step h2 so that the positions differ.
 */
export function bloomPositions(key: number, m: number, k: number): number[] {
	const h1 = mix32(key);
	const h2 = (mix32(key ^ 0x5bd1e995) | 1) >>> 0;
	const out: number[] = [];
	for (let j = 0; j < k; j++) out.push((h1 + j * h2) % m);
	return out;
}

/** Theory: f = (1 - e^{-kn/m})^k, the expected false-positive rate. */
export function bloomTheory(m: number, n: number, k: number): number {
	return Math.pow(1 - Math.exp((-k * n) / m), k);
}

/** Expected share of bits set to 1 after n insertions. */
export function bloomFillTheory(m: number, n: number, k: number): number {
	return 1 - Math.exp((-k * n) / m);
}

/** Optimal number of hash functions k = ln2 · m / n, rounded to the nearest integer (at least 1). */
export function optimalK(m: number, n: number): number {
	return Math.max(1, Math.round((Math.LN2 * m) / n));
}

/** Bits per element needed for a false-positive rate f at the optimal k: m/n = -ln f / (ln2)². */
export function bitsPerElement(f: number): number {
	return -Math.log(f) / LN2_SQ;
}

export interface BloomMeasure {
	bits: Uint8Array;
	/** Share of absent elements reported as present. */
	fpMeasured: number;
	fpTheory: number;
	/** Inserted elements reported as absent; must be 0. */
	falseNegatives: number;
	fillMeasured: number;
	fillTheory: number;
}

export function measureBloom(m: number, k: number, n: number = N_ITEMS): BloomMeasure {
	const bits = new Uint8Array(m);
	const inserted = insertedKeys(n);
	for (const key of inserted) {
		for (const p of bloomPositions(key, m, k)) bits[p] = 1;
	}
	let falseNegatives = 0;
	for (const key of inserted) {
		if (!probe(bits, m, k, key).present) falseNegatives++;
	}
	const absent = absentKeys(QUERIES, n);
	let hits = 0;
	for (const key of absent) {
		if (probe(bits, m, k, key).present) hits++;
	}
	let ones = 0;
	for (let i = 0; i < m; i++) ones += bits[i] ?? 0;
	return {
		bits,
		fpMeasured: hits / absent.length,
		fpTheory: bloomTheory(m, n, k),
		falseNegatives,
		fillMeasured: ones / m,
		fillTheory: bloomFillTheory(m, n, k),
	};
}

export interface ProbeResult {
	positions: number[];
	/** True when every position is set: the filter answers "possibly present". */
	present: boolean;
}

export function probe(bits: Uint8Array, m: number, k: number, key: number): ProbeResult {
	const positions = bloomPositions(key, m, k);
	const present = positions.every((p) => bits[p] === 1);
	return { positions, present };
}

/** Share of set bits in each of `cells` equal ranges of the array, for drawing a strip. */
export function binDensity(bits: Uint8Array, cells: number): number[] {
	const m = bits.length;
	const out: number[] = [];
	for (let c = 0; c < cells; c++) {
		const lo = Math.floor((c * m) / cells);
		const hi = Math.floor(((c + 1) * m) / cells);
		let ones = 0;
		for (let i = lo; i < hi; i++) ones += bits[i] ?? 0;
		out.push(hi > lo ? ones / (hi - lo) : 0);
	}
	return out;
}

/* MinHash */

/** Set A = {a, b, c, d}, set B = {c, d, e, f}: shingles encoded as 1..6. */
export const SET_A: readonly number[] = [1, 2, 3, 4];
export const SET_B: readonly number[] = [3, 4, 5, 6];
export const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

/** Jaccard index |A ∩ B| / |A ∪ B| for two lists without duplicates. */
export function jaccard(a: readonly number[], b: readonly number[]): number {
	const sb = new Set(b);
	const inter = a.filter((x) => sb.has(x)).length;
	const union = new Set([...a, ...b]).size;
	return union === 0 ? 0 : inter / union;
}

/**
 * MinHash signature of a set with t hash functions. Hash i is mix32(x ^ salt_i), where the salts
 * come from `seed`, so each seed gives an independent family.
 */
export function minhashSignature(set: readonly number[], t: number, seed = 0): Uint32Array {
	const sig = new Uint32Array(t);
	for (let i = 0; i < t; i++) {
		const salt = mix32(seed * 1000003 + i + 1);
		let min = 0xffffffff;
		for (const x of set) {
			const h = mix32(x ^ salt);
			if (h < min) min = h;
		}
		sig[i] = min;
	}
	return sig;
}

/** Estimate of J: share of positions where the two signatures agree. */
export function minhashEstimate(sa: Uint32Array, sb: Uint32Array): number {
	let eq = 0;
	for (let i = 0; i < sa.length; i++) if (sa[i] === sb[i]) eq++;
	return sa.length === 0 ? 0 : eq / sa.length;
}

/** Theory: standard deviation of the estimate, sqrt(J(1-J)/t). */
export function minhashSpreadTheory(j: number, t: number): number {
	return Math.sqrt((j * (1 - j)) / t);
}

/** Sample standard deviation of the MinHash estimate over `trials` independent seeds. */
export function minhashSpreadMeasured(t: number, trials: number = SPREAD_TRIALS): number {
	const values: number[] = [];
	for (let s = 0; s < trials; s++) {
		values.push(minhashEstimate(minhashSignature(SET_A, t, s), minhashSignature(SET_B, t, s)));
	}
	const mean = values.reduce((a, v) => a + v, 0) / trials;
	const variance = values.reduce((a, v) => a + (v - mean) * (v - mean), 0) / (trials - 1);
	return Math.sqrt(variance);
}

/* Count-Min */

export interface CountMinParams {
	/** Width: counters per row. */
	w: number;
	/** Depth: number of rows (hash functions). */
	d: number;
	/** Total counters, w · d. */
	counters: number;
}

/** Parameters for additive error eps·‖a‖₁ with probability at least 1 - delta. */
export function countMinParams(eps: number, delta: number): CountMinParams {
	const w = Math.ceil(Math.E / eps);
	const d = Math.ceil(Math.log(1 / delta));
	return { w, d, counters: w * d };
}
