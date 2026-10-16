/**
 * Combinatorics on BigInt. Out-of-range arguments give 0n (not an error), so that
 * probability formulas with impossible events simply evaluate to zero.
 */

function assertNonNegInt(n: number, name: string): void {
	if (!Number.isSafeInteger(n) || n < 0)
		throw new RangeError(`${name} must be a non-negative integer`);
}

export function factorial(n: number): bigint {
	assertNonNegInt(n, 'n');
	let r = 1n;
	for (let i = 2; i <= n; i++) r *= BigInt(i);
	return r;
}

/** Binomial coefficient C(n, k). 0n when k < 0, k > n or n < 0. */
export function nCr(n: number, k: number): bigint {
	if (!Number.isSafeInteger(n) || !Number.isSafeInteger(k)) {
		throw new RangeError('nCr arguments must be safe integers');
	}
	if (n < 0 || k < 0 || k > n) return 0n;
	const m = Math.min(k, n - k);
	let r = 1n;
	// r stays an integer at every step: after i steps it equals C(n - m + i, i).
	for (let i = 1; i <= m; i++) {
		r = (r * BigInt(n - m + i)) / BigInt(i);
	}
	return r;
}

/** Number of arrangements A(n, k) = n·(n−1)·…·(n−k+1). 0n when k < 0 or k > n. */
export function nPr(n: number, k: number): bigint {
	if (!Number.isSafeInteger(n) || !Number.isSafeInteger(k)) {
		throw new RangeError('nPr arguments must be safe integers');
	}
	if (n < 0 || k < 0 || k > n) return 0n;
	let r = 1n;
	for (let i = 0; i < k; i++) r *= BigInt(n - i);
	return r;
}

/**
 * Multinomial coefficient n! / (c1! · c2! · …), n = Σ ci.
 * Computed as a product of binomials, so no huge factorials are built.
 */
export function multinomial(counts: number[]): bigint {
	let total = 0;
	let r = 1n;
	for (const c of counts) {
		assertNonNegInt(c, 'count');
		total += c;
		r *= nCr(total, c);
	}
	return r;
}

/** ln(n!). Exact sum of logs for n ≤ 1e5, Stirling series beyond. */
export function logFactorial(n: number): number {
	assertNonNegInt(n, 'n');
	if (n <= 1) return 0;
	if (n <= 100_000) {
		let s = 0;
		for (let i = 2; i <= n; i++) s += Math.log(i);
		return s;
	}
	return (n + 0.5) * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI) + 1 / (12 * n);
}
