/**
 * Exact rational arithmetic on BigInt. Every result is reduced by gcd and has `den > 0n`.
 */
import type { Rational } from './types';

export type Integer = bigint | number;

function toBig(x: Integer): bigint {
	if (typeof x === 'bigint') return x;
	if (!Number.isSafeInteger(x)) throw new RangeError(`not a safe integer: ${x}`);
	return BigInt(x);
}

function abs(x: bigint): bigint {
	return x < 0n ? -x : x;
}

/** Greatest common divisor of two integers (always non-negative). */
export function gcd(a: bigint, b: bigint): bigint {
	let x = abs(a);
	let y = abs(b);
	while (y !== 0n) {
		[x, y] = [y, x % y];
	}
	return x;
}

/** Builds a reduced rational `num / den`. Throws on zero denominator. */
export function rat(num: Integer, den: Integer = 1): Rational {
	let n = toBig(num);
	let d = toBig(den);
	if (d === 0n) throw new RangeError('denominator is zero');
	if (d < 0n) {
		n = -n;
		d = -d;
	}
	const g = gcd(n, d);
	if (g > 1n) {
		n /= g;
		d /= g;
	}
	return { num: n, den: d };
}

export function add(a: Rational, b: Rational): Rational {
	return rat(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function sub(a: Rational, b: Rational): Rational {
	return rat(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function mul(a: Rational, b: Rational): Rational {
	return rat(a.num * b.num, a.den * b.den);
}

export function div(a: Rational, b: Rational): Rational {
	if (b.num === 0n) throw new RangeError('division by zero rational');
	return rat(a.num * b.den, a.den * b.num);
}

function bitLength(x: bigint): number {
	const v = abs(x);
	return v === 0n ? 0 : v.toString(2).length;
}

/**
 * Nearest double. Works for huge and tiny values: the quotient is computed with
 * about 64 significant bits before the final power-of-two scaling.
 */
export function toNumber(r: Rational): number {
	if (r.num === 0n) return 0;
	const neg = r.num < 0n;
	const n = abs(r.num);
	const shift = Math.max(0, 64 - (bitLength(n) - bitLength(r.den)));
	let value = Number((n << BigInt(shift)) / r.den);
	for (let s = shift; s > 0;) {
		const step = Math.min(s, 1000);
		value /= 2 ** step;
		s -= step;
	}
	return neg ? -value : value;
}

/** «a/b», or just «a» when the value is an integer. */
export function formatRational(r: Rational): string {
	return r.den === 1n ? r.num.toString() : `${r.num}/${r.den}`;
}

/**
 * Exact fraction for a decimal number rounded to `places` digits: `0.3` → `3/10`.
 * Uses the decimal string of the number, not binary arithmetic.
 */
export function fromDecimal(x: number, places = 6): Rational {
	if (!Number.isFinite(x)) throw new RangeError(`not a finite number: ${x}`);
	if (Math.abs(x) >= 1e15) throw new RangeError(`number too large for decimal form: ${x}`);
	if (!Number.isInteger(places) || places < 0 || places > 18) {
		throw new RangeError(`places out of range: ${places}`);
	}
	const digits = BigInt(Math.abs(x).toFixed(places).replace('.', ''));
	const r = rat(digits, 10n ** BigInt(places));
	return x < 0 ? rat(-r.num, r.den) : r;
}
