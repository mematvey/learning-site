/**
 * Math of the bootstrap and permutation demo: resampling a sample with replacement,
 * the bootstrap SE and percentile interval of a mean, and the exact permutation test
 * for a difference of means. Deterministic (seeded). Pure functions only: no DOM, no Svelte.
 */

/** Group A of the chapter example: mean 14,75, sample SD about 2,82. */
export const SAMPLE_A: readonly number[] = [13, 12, 18, 11, 16, 15, 14, 19];
/** Group B of the chapter example: mean 20,875; the difference of means is 6,125. */
export const SAMPLE_B: readonly number[] = [17, 26, 22, 24, 18, 21, 20, 19];

/** Number of bootstrap resamples used by the chapter numbers. */
export const BOOT_B = 20000;
/** Seed used by the chapter numbers. */
export const SEED = 0;

/** Number of bins of the bootstrap histogram is derived from this width. */
export const BIN_WIDTH = 0.1;

/** Small seeded PRNG (mulberry32): same seed gives the same stream on every platform. */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function mean(xs: readonly number[]): number {
	if (xs.length === 0) return 0;
	let s = 0;
	for (const v of xs) s += v;
	return s / xs.length;
}

/** Sample standard deviation with the n-1 divisor. */
export function sampleSd(xs: readonly number[]): number {
	if (xs.length < 2) return 0;
	const mu = mean(xs);
	let s = 0;
	for (const v of xs) s += (v - mu) * (v - mu);
	return Math.sqrt(s / (xs.length - 1));
}

/** Indices of one bootstrap resample: n draws with replacement from 0..n-1. */
export function resampleIndices(rng: () => number, n: number): number[] {
	const idx: number[] = new Array(n);
	for (let i = 0; i < n; i++) idx[i] = Math.floor(rng() * n);
	return idx;
}

/** Mean of the resample given by indices into data. */
export function resampleMean(data: readonly number[], idx: readonly number[]): number {
	let s = 0;
	for (const i of idx) s += data[i] ?? 0;
	return s / idx.length;
}

/**
 * Bootstrap distribution of the mean: means of `count` resamples, drawn in order from one stream.
 * Calling it with count = 100 and then with 20000 gives the same first 100 values.
 */
export function bootstrapMeans(
	data: readonly number[],
	count: number,
	seed: number = SEED,
): Float64Array {
	const rng = mulberry32(seed);
	const out = new Float64Array(count);
	for (let b = 0; b < count; b++) {
		out[b] = resampleMean(data, resampleIndices(rng, data.length));
	}
	return out;
}

/** Bootstrap SE: sample SD of the bootstrap distribution (n-1 divisor). */
export function bootstrapSe(means: ArrayLike<number>): number {
	const n = means.length;
	if (n < 2) return 0;
	let mu = 0;
	for (let i = 0; i < n; i++) mu += means[i] ?? 0;
	mu /= n;
	let s = 0;
	for (let i = 0; i < n; i++) {
		const dv = (means[i] ?? 0) - mu;
		s += dv * dv;
	}
	return Math.sqrt(s / (n - 1));
}

/**
 * Percentile interval [q(alpha/2), q(1 - alpha/2)] by the nearest-rank rule on the sorted means.
 * Returns null for an empty input.
 */
export function percentileInterval(
	means: ArrayLike<number>,
	alpha = 0.05,
): [number, number] | null {
	const n = means.length;
	if (n === 0) return null;
	const sorted = Float64Array.from(means).sort();
	const lo = Math.min(n - 1, Math.max(0, Math.floor((alpha / 2) * n)));
	const hi = Math.min(n - 1, Math.max(0, Math.ceil((1 - alpha / 2) * n) - 1));
	return [sorted[lo] ?? NaN, sorted[hi] ?? NaN];
}

/** Equal-width histogram over [lo, hi): counts per bin. Values outside the range are dropped. */
export function histogram(
	values: ArrayLike<number>,
	lo: number,
	hi: number,
	width: number,
): number[] {
	const bins = Math.max(1, Math.round((hi - lo) / width));
	const counts = new Array<number>(bins).fill(0);
	for (let i = 0; i < values.length; i++) {
		const v = values[i];
		if (v === undefined || v < lo || v >= hi) continue;
		const k = Math.min(bins - 1, Math.floor((v - lo) / width));
		counts[k] = (counts[k] ?? 0) + 1;
	}
	return counts;
}

/** Pooled values of both groups (A first). */
export function pooled(a: readonly number[], b: readonly number[]): number[] {
	return [...a, ...b];
}

/** Difference of means (B minus A) of the observed split. */
export function observedDiff(a: readonly number[], b: readonly number[]): number {
	return mean(b) - mean(a);
}

/**
 * Difference of means B minus A for a relabelling: `inA` is the list of pooled positions
 * that receive label A; the rest get label B.
 */
export function diffForLabels(pool: readonly number[], inA: readonly number[]): number {
	const isA = new Uint8Array(pool.length);
	for (const i of inA) isA[i] = 1;
	let sa = 0;
	let sb = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < pool.length; i++) {
		if (isA[i]) {
			sa += pool[i] ?? 0;
			na++;
		} else {
			sb += pool[i] ?? 0;
			nb++;
		}
	}
	return sb / nb - sa / na;
}

/**
 * Exact permutation distribution of the difference of means: one value per way to choose the
 * nA pooled positions that get label A (C(N, nA) values, 12870 for 8 + 8).
 * Returns the differences (B minus A) and the positions of each subset in the same order.
 */
export function exactPermutationDiffs(pool: readonly number[], nA: number): Float64Array {
	const N = pool.length;
	const total = binomial(N, nA);
	const out = new Float64Array(total);
	const sum = pool.reduce((s, v) => s + v, 0);
	const nB = N - nA;
	let k = 0;
	const rec = (start: number, depth: number, sa: number): void => {
		if (depth === nA) {
			out[k++] = (sum - sa) / nB - sa / nA;
			return;
		}
		for (let i = start; i <= N - (nA - depth); i++) rec(i + 1, depth + 1, sa + (pool[i] ?? 0));
	};
	rec(0, 0, 0);
	return out;
}

/** Binomial coefficient C(n, k) as a number (exact for the sizes used here). */
export function binomial(n: number, k: number): number {
	let r = 1;
	for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
	return Math.round(r);
}

/**
 * Two-sided exact p-value: share of permutations with |d| >= |observed|.
 * A small tolerance keeps the observed split itself inside the count.
 */
export function twoSidedP(
	diffs: ArrayLike<number>,
	observed: number,
): { count: number; p: number } {
	const target = Math.abs(observed) - 1e-9;
	let count = 0;
	for (let i = 0; i < diffs.length; i++) {
		if (Math.abs(diffs[i] ?? 0) >= target) count++;
	}
	return { count, p: count / diffs.length };
}

/** Seeded random relabelling: a list of pooled positions for label A, nA of them, chosen at random. */
export function randomLabelsA(rng: () => number, N: number, nA: number): number[] {
	const perm = Array.from({ length: N }, (_, i) => i);
	for (let i = N - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = perm[i] ?? 0;
		perm[i] = perm[j] ?? 0;
		perm[j] = tmp;
	}
	return perm.slice(0, nA).sort((x, y) => x - y);
}

/**
 * All resamples at once: indices (count × n, row-major) and their means, from one seeded stream.
 * The demo shows the first k rows; the values match bootstrapMeans for the same seed.
 */
export function bootstrapRun(
	data: readonly number[],
	count: number,
	seed: number = SEED,
): { idx: Uint8Array; means: Float64Array } {
	const n = data.length;
	const rng = mulberry32(seed);
	const idx = new Uint8Array(count * n);
	const means = new Float64Array(count);
	for (let b = 0; b < count; b++) {
		let s = 0;
		for (let i = 0; i < n; i++) {
			const j = Math.floor(rng() * n);
			idx[b * n + i] = j;
			s += data[j] ?? 0;
		}
		means[b] = s / n;
	}
	return { idx, means };
}
