/**
 * Hypergeometric distribution: draw n items without replacement from N items,
 * K of which are "marked". Exact values as rationals.
 */
import { nCr } from './comb';
import { rat } from './rational';
import type { Rational } from './types';

/** Numerator of P(X = j) over the common denominator C(N, n). */
function numerator(N: number, K: number, n: number, j: number): bigint {
	return nCr(K, j) * nCr(N - K, n - j);
}

/** P(X = k): exactly k marked items among n drawn. Zero for impossible arguments. */
export function hypergeomPmf(N: number, K: number, n: number, k: number): Rational {
	if (n < 0 || n > N || K < 0 || K > N) return rat(0);
	const den = nCr(N, n);
	return rat(numerator(N, K, n, k), den);
}

/** P(X ≥ k): at least k marked items among n drawn. */
export function hypergeomAtLeast(N: number, K: number, n: number, k: number): Rational {
	if (n < 0 || n > N || K < 0 || K > N) return rat(0);
	const den = nCr(N, n);
	let num = 0n;
	for (let j = Math.max(k, 0); j <= Math.min(n, K); j++) {
		num += numerator(N, K, n, j);
	}
	return rat(num, den);
}
