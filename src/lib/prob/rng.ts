/**
 * Seeded pseudo-random numbers. Same seed → same sequence, so simulations are reproducible.
 */

/** mulberry32: small, fast 32-bit PRNG. Returns floats in [0, 1). */
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

/** In-place Fisher–Yates shuffle. Returns the same array. */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = arr[i] as T;
		arr[i] = arr[j] as T;
		arr[j] = tmp;
	}
	return arr;
}

/**
 * Ordered sample of k distinct indices from 0..n-1 (partial Fisher–Yates).
 * Each ordered k-tuple of distinct indices is equally likely.
 */
export function sampleWithoutReplacement(n: number, k: number, rng: () => number): number[] {
	if (!Number.isSafeInteger(n) || !Number.isSafeInteger(k) || k < 0 || k > n) {
		throw new RangeError(`cannot sample ${k} of ${n} without replacement`);
	}
	const pool = Array.from({ length: n }, (_, i) => i);
	for (let i = 0; i < k; i++) {
		const j = i + Math.floor(rng() * (n - i));
		const tmp = pool[i] as number;
		pool[i] = pool[j] as number;
		pool[j] = tmp;
	}
	return pool.slice(0, k);
}
