/**
 * Pure logic for the floating-point demo: binary formats, rounding to a format,
 * bit patterns, naive / compensated / exact summation, and softmax.
 * No DOM and no Svelte imports, so the same functions are covered by Vitest.
 */

export interface FloatFormat {
	/** Human-readable name shown in the UI. */
	readonly name: string;
	/** Bits of the exponent field. */
	readonly expBits: number;
	/** Bits of the mantissa (fraction) field, without the hidden leading one. */
	readonly mantBits: number;
}

const FLOAT64: FloatFormat = { name: 'float64', expBits: 11, mantBits: 52 };

/** Formats offered by the demo, ordered from the narrowest to the widest. */
export const FORMATS: readonly FloatFormat[] = [
	{ name: 'float16', expBits: 5, mantBits: 10 },
	{ name: 'bfloat16', expBits: 8, mantBits: 7 },
	{ name: 'float32', expBits: 8, mantBits: 23 },
	FLOAT64,
];

/** Format by index; out-of-range indices fall back to float64. */
export function formatAt(i: number): FloatFormat {
	return FORMATS[i] ?? FLOAT64;
}

/** Exponent bias: 2^(expBits - 1) - 1. */
export function bias(fmt: FloatFormat): number {
	return 2 ** (fmt.expBits - 1) - 1;
}

/** Machine epsilon of the format: 2^-mantBits (distance from 1 to the next number). */
export function machineEpsilon(fmt: FloatFormat): number {
	return 2 ** -fmt.mantBits;
}

/** Largest finite value of the format. */
export function maxFinite(fmt: FloatFormat): number {
	return (2 - 2 ** -fmt.mantBits) * 2 ** bias(fmt);
}

/** Round half to even, exact for the magnitudes used here. */
function roundHalfEven(v: number): number {
	const f = Math.floor(v);
	const d = v - f;
	if (d > 0.5) return f + 1;
	if (d < 0.5) return f;
	return f % 2 === 0 ? f : f + 1;
}

/** Binary exponent of a positive finite number: floor(log2 x), corrected for rounding of log2. */
function binaryExponent(a: number): number {
	let e = Math.floor(Math.log2(a));
	if (2 ** e > a) e -= 1;
	if (2 ** (e + 1) <= a) e += 1;
	return e;
}

/**
 * Rounds a JavaScript number to the nearest value of the format (ties to even).
 * Values above the format range become ±Infinity. float64 is the native type, so it is returned as is.
 */
export function roundTo(x: number, fmt: FloatFormat): number {
	if (fmt.mantBits >= 52 && fmt.expBits >= 11) return x;
	if (!Number.isFinite(x) || x === 0) return x;
	const sign = x < 0 ? -1 : 1;
	const a = Math.abs(x);
	const minE = 1 - bias(fmt);
	const e = Math.max(binaryExponent(a), minE);
	// Scale so that the result has `mantBits` fraction bits at exponent e.
	const scale = 2 ** (fmt.mantBits - e);
	const m = roundHalfEven(a * scale);
	const r = m / scale;
	if (r >= 2 ** (bias(fmt) + 1)) return sign * Infinity;
	return sign * r;
}

/**
 * Bit pattern of a number in the format, most significant bit first:
 * [sign, exponent bits..., mantissa bits...]. The length is 1 + expBits + mantBits.
 */
export function bitsOf(x: number, fmt: FloatFormat): number[] {
	const bits: number[] = [];
	const pushField = (value: number, width: number) => {
		for (let i = width - 1; i >= 0; i--) {
			bits.push(Math.floor(value / 2 ** i) % 2);
		}
	};
	const expAllOnes = 2 ** fmt.expBits - 1;
	if (Number.isNaN(x)) {
		// Canonical quiet NaN: exponent all ones, top mantissa bit set.
		pushField(0, 1);
		pushField(expAllOnes, fmt.expBits);
		pushField(2 ** (fmt.mantBits - 1), fmt.mantBits);
		return bits;
	}
	const sign = x < 0 || Object.is(x, -0) ? 1 : 0;
	pushField(sign, 1);
	if (!Number.isFinite(x)) {
		pushField(expAllOnes, fmt.expBits);
		pushField(0, fmt.mantBits);
		return bits;
	}
	const r = Math.abs(roundTo(x, fmt));
	if (r === 0) {
		pushField(0, fmt.expBits);
		pushField(0, fmt.mantBits);
		return bits;
	}
	if (!Number.isFinite(r)) {
		pushField(expAllOnes, fmt.expBits);
		pushField(0, fmt.mantBits);
		return bits;
	}
	const minE = 1 - bias(fmt);
	const e = binaryExponent(r);
	if (e < minE) {
		// Subnormal: exponent field 0, mantissa counts units of 2^(minE - mantBits).
		pushField(0, fmt.expBits);
		pushField(r / 2 ** (minE - fmt.mantBits), fmt.mantBits);
	} else {
		pushField(e + bias(fmt), fmt.expBits);
		const frac = r / 2 ** e - 1;
		pushField(roundHalfEven(frac * 2 ** fmt.mantBits), fmt.mantBits);
	}
	return bits;
}

/** Value of a bit pattern in the format (inverse of bitsOf for representable numbers). */
export function valueOf(bits: readonly number[], fmt: FloatFormat): number {
	const sign = (bits[0] ?? 0) === 1 ? -1 : 1;
	let expField = 0;
	for (let i = 1; i <= fmt.expBits; i++) expField = expField * 2 + (bits[i] ?? 0);
	let mantField = 0;
	for (let i = fmt.expBits + 1; i < bits.length; i++) mantField = mantField * 2 + (bits[i] ?? 0);
	if (expField === 2 ** fmt.expBits - 1) {
		return mantField === 0 ? sign * Infinity : NaN;
	}
	const minE = 1 - bias(fmt);
	if (expField === 0) {
		return sign * mantField * 2 ** (minE - fmt.mantBits);
	}
	const e = expField - bias(fmt);
	return sign * (2 ** fmt.mantBits + mantField) * 2 ** (e - fmt.mantBits);
}

/** Decomposition for the explanation: sign, exponent (unbiased), significand 1.f in [1, 2). */
export interface Decomposition {
	kind: 'normal' | 'subnormal' | 'zero' | 'inf' | 'nan';
	sign: number;
	exponent: number;
	significand: number;
}

export function decompose(bits: readonly number[], fmt: FloatFormat): Decomposition {
	const sign = bits[0] ?? 0;
	let expField = 0;
	for (let i = 1; i <= fmt.expBits; i++) expField = expField * 2 + (bits[i] ?? 0);
	let mantField = 0;
	for (let i = fmt.expBits + 1; i < bits.length; i++) mantField = mantField * 2 + (bits[i] ?? 0);
	const expAllOnes = 2 ** fmt.expBits - 1;
	if (expField === expAllOnes) {
		return {
			kind: mantField === 0 ? 'inf' : 'nan',
			sign,
			exponent: 0,
			significand: 0,
		};
	}
	if (expField === 0) {
		if (mantField === 0) return { kind: 'zero', sign, exponent: 0, significand: 0 };
		return {
			kind: 'subnormal',
			sign,
			exponent: 1 - bias(fmt),
			significand: mantField / 2 ** fmt.mantBits,
		};
	}
	return {
		kind: 'normal',
		sign,
		exponent: expField - bias(fmt),
		significand: 1 + mantField / 2 ** fmt.mantBits,
	};
}

/** Naive left-to-right sum; every partial sum is rounded to the format. */
export function naiveSum(xs: readonly number[], fmt: FloatFormat): number {
	let s = 0;
	for (const x of xs) {
		s = roundTo(s + roundTo(x, fmt), fmt);
	}
	return s;
}

/** Kahan compensated sum in float64. */
export function kahanSum(xs: readonly number[]): number {
	let sum = 0;
	let c = 0;
	for (const x of xs) {
		const y = x - c;
		const t = sum + y;
		c = t - sum - y;
		sum = t;
	}
	return sum;
}

/**
 * Exact-rounding sum in the style of Python's math.fsum (Shewchuk's partials).
 * Keeps non-overlapping partial sums, so no information is lost until the final addition.
 */
export function fsum(xs: readonly number[]): number {
	const partials: number[] = [];
	for (let x of xs) {
		let i = 0;
		for (let j = 0; j < partials.length; j++) {
			let y = partials[j] ?? 0;
			if (Math.abs(x) < Math.abs(y)) {
				const tmp = x;
				x = y;
				y = tmp;
			}
			const hi = x + y;
			const lo = y - (hi - x);
			if (lo !== 0) partials[i++] = lo;
			x = hi;
		}
		partials.length = i;
		partials.push(x);
	}
	// Add from the largest partial down; the partials are non-overlapping, so this is accurate.
	let total = 0;
	for (let k = partials.length - 1; k >= 0; k--) total += partials[k] ?? 0;
	return total;
}

/** Softmax with the maximum subtracted first (stable form). */
export function softmaxStable(z: readonly number[]): number[] {
	const m = Math.max(...z);
	const e = z.map((v) => Math.exp(v - m));
	const s = e.reduce((a, b) => a + b, 0);
	return e.map((v) => v / s);
}

/** Naive softmax: exp(z) is taken without any shift. Overflow gives Infinity and NaN, as in the chapter. */
export function softmaxNaive(z: readonly number[]): number[] {
	const e = z.map((v) => Math.exp(v));
	const s = e.reduce((a, b) => a + b, 0);
	return e.map((v) => v / s);
}

/** Relative error of storing x in the format: (fl(x) - x) / x. */
export function relativeRoundingError(x: number, fmt: FloatFormat): number {
	return (roundTo(x, fmt) - x) / x;
}
