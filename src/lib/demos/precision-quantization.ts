/**
 * Math of the precision demo: binary layout of floating-point formats, round-to-nearest-even
 * into a format, and symmetric integer quantization with one scale or group scales.
 * Rounding is done by hand for every format (no Math.fround), so fp16, bf16 and fp8 behave the same.
 * Pure functions only: no DOM, no Svelte.
 */

export type FormatId = 'fp32' | 'bf16' | 'fp16' | 'e4m3' | 'e5m2';

export interface FloatFormat {
	id: FormatId;
	label: string;
	/** Number of exponent bits. */
	expBits: number;
	/** Number of explicit mantissa bits (the implicit leading 1 is not stored). */
	mantBits: number;
	bias: number;
	/** False for E4M3: it has no infinity, and its NaN uses one code point. */
	hasInf: boolean;
	/** Largest finite value of the format. */
	maxFinite: number;
}

function makeFormat(
	id: FormatId,
	label: string,
	expBits: number,
	mantBits: number,
	hasInf: boolean,
): FloatFormat {
	const bias = 2 ** (expBits - 1) - 1;
	// The top exponent code is reserved for Inf/NaN in IEEE-like formats, not in E4M3.
	const maxExp = (hasInf ? 2 ** expBits - 2 : 2 ** expBits - 1) - bias;
	// E4M3 gives up its all-ones mantissa at the top exponent (that code is NaN).
	const mantMax = 2 - 2 ** -(hasInf ? mantBits : mantBits - 1);
	return { id, label, expBits, mantBits, bias, hasInf, maxFinite: mantMax * 2 ** maxExp };
}

export const FORMATS: Record<FormatId, FloatFormat> = {
	fp32: makeFormat('fp32', 'fp32', 8, 23, true),
	bf16: makeFormat('bf16', 'bf16', 8, 7, true),
	fp16: makeFormat('fp16', 'fp16', 5, 10, true),
	e4m3: makeFormat('e4m3', 'fp8 E4M3', 4, 3, false),
	e5m2: makeFormat('e5m2', 'fp8 E5M2', 5, 2, true),
};

export const FORMAT_IDS: readonly FormatId[] = ['fp32', 'bf16', 'fp16', 'e4m3', 'e5m2'];

export function isFormatId(v: unknown): v is FormatId {
	return typeof v === 'string' && (FORMAT_IDS as readonly string[]).includes(v);
}

/** Unit roundoff u = 2^-(m+1): the bound on the relative rounding error for normal numbers. */
export function unitRoundoff(fmt: FloatFormat): number {
	return 2 ** -(fmt.mantBits + 1);
}

/** Exponent of the smallest normal number: 1 - bias. */
function minNormalExp(fmt: FloatFormat): number {
	return 1 - fmt.bias;
}

/** floor(log2(a)) for a > 0, exact for powers of two. */
function floorLog2(a: number): number {
	let e = Math.floor(Math.log2(a));
	if (2 ** e > a) e -= 1;
	else if (2 ** (e + 1) <= a) e += 1;
	return e;
}

/** Rounds v >= 0 to an integer, ties to the even integer. */
function roundHalfEven(v: number): number {
	const f = Math.floor(v);
	const d = v - f;
	if (d > 0.5) return f + 1;
	if (d < 0.5) return f;
	return f % 2 === 0 ? f : f + 1;
}

/**
 * Rounds a real number to the nearest value of the format (ties to even).
 * Overflow gives Infinity for formats with infinity and NaN for E4M3.
 */
export function roundToFormat(x: number, fmt: FloatFormat): number {
	if (Number.isNaN(x)) return NaN;
	if (!Number.isFinite(x)) return fmt.hasInf ? x : NaN;
	if (x === 0) return x;
	const sign = x < 0 ? -1 : 1;
	const a = Math.abs(x);
	// Subnormal range uses the exponent of the smallest normal number, so its spacing is fixed.
	const e = Math.max(floorLog2(a), minNormalExp(fmt));
	const quantum = 2 ** (e - fmt.mantBits);
	const r = sign * roundHalfEven(a / quantum) * quantum;
	if (Math.abs(r) > fmt.maxFinite) return fmt.hasInf ? sign * Infinity : NaN;
	return r;
}

export interface BitPattern {
	sign: 0 | 1;
	/** Biased exponent field as an integer. */
	exponent: number;
	/** Mantissa field as an integer. */
	mantissa: number;
}

/**
 * Bit fields of a value that is already on the grid of the format (the output of roundToFormat).
 * Finite values only need the fields; NaN and Infinity get their reserved patterns.
 */
export function bitPattern(v: number, fmt: FloatFormat): BitPattern {
	const allOnes = 2 ** fmt.expBits - 1;
	if (Number.isNaN(v)) {
		return {
			sign: 0,
			exponent: allOnes,
			mantissa: fmt.hasInf ? 2 ** (fmt.mantBits - 1) : 2 ** fmt.mantBits - 1,
		};
	}
	const sign: 0 | 1 = v < 0 || Object.is(v, -0) ? 1 : 0;
	if (!Number.isFinite(v)) return { sign, exponent: allOnes, mantissa: 0 };
	if (v === 0) return { sign, exponent: 0, mantissa: 0 };
	const a = Math.abs(v);
	const e = floorLog2(a);
	const minExp = minNormalExp(fmt);
	if (e < minExp) {
		// Subnormal: exponent field 0, no implicit leading 1.
		return { sign, exponent: 0, mantissa: a / 2 ** (minExp - fmt.mantBits) };
	}
	return {
		sign,
		exponent: e + fmt.bias,
		mantissa: (a / 2 ** e - 1) * 2 ** fmt.mantBits,
	};
}

/** Bit string of the pattern, sign first, then exponent, then mantissa. */
export function bitString(p: BitPattern, fmt: FloatFormat): string {
	return (
		String(p.sign) +
		p.exponent.toString(2).padStart(fmt.expBits, '0') +
		p.mantissa.toString(2).padStart(fmt.mantBits, '0')
	);
}

export interface RoundingReport {
	input: number;
	rounded: number;
	absError: number;
	/** |rounded - input| / |input|; NaN when the input is 0. */
	relError: number;
	overflow: boolean;
	pattern: BitPattern;
	bits: string;
}

/** Everything the demo shows for one number in one format. */
export function roundingReport(x: number, fmt: FloatFormat): RoundingReport {
	const rounded = roundToFormat(x, fmt);
	const pattern = bitPattern(rounded, fmt);
	const absError = Math.abs(rounded - x);
	const relError = x === 0 ? NaN : absError / Math.abs(x);
	const overflow = Number.isFinite(x) && !Number.isFinite(rounded);
	const overflowNaN = Number.isFinite(x) && Number.isNaN(rounded);
	return {
		input: x,
		rounded,
		absError,
		relError,
		overflow: overflow || overflowNaN,
		pattern,
		bits: bitString(pattern, fmt),
	};
}

/** Short human-readable form of a number: plain for moderate values, exponent form otherwise. */
export function formatNumber(v: number): string {
	if (Number.isNaN(v)) return 'NaN';
	if (v === Infinity) return '∞';
	if (v === -Infinity) return '−∞';
	if (v === 0) return Object.is(v, -0) ? '−0' : '0';
	const a = Math.abs(v);
	if (a >= 1e6 || a < 1e-4) return v.toExponential(3).replace('e', ' · 10^').replace('+', '');
	return String(Number(v.toPrecision(8))).replace('.', ',');
}

/** Parses a decimal typed by a Russian or English reader: "1000,7", "1000.7", "1e-6". NaN if invalid. */
export function parseDecimal(s: string): number {
	const t = s.replace(/\s/g, '').replace(',', '.');
	if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
	return Number(t);
}

export interface PrecisionDemoState {
	format: FormatId;
	/** The real number that is rounded and written in bits. */
	value: number;
	intBits: IntBits;
	group: GroupKind;
}

export const DEFAULT_STATE: PrecisionDemoState = {
	format: 'fp16',
	value: 1000.7,
	intBits: 4,
	group: 'tensor',
};

/** Replaces every invalid or missing field of a partial state with its default. */
export function sanitizeState(p: Partial<PrecisionDemoState> | undefined): PrecisionDemoState {
	return {
		format: isFormatId(p?.format) ? p.format : DEFAULT_STATE.format,
		value: typeof p?.value === 'number' && Number.isFinite(p.value) ? p.value : DEFAULT_STATE.value,
		intBits: isIntBits(p?.intBits) ? p.intBits : DEFAULT_STATE.intBits,
		group: isGroupKind(p?.group) ? p.group : DEFAULT_STATE.group,
	};
}

// ---------------------------------------------------------------------------
// Integer quantization
// ---------------------------------------------------------------------------

export type IntBits = 4 | 8;
export type GroupKind = 'tensor' | 32 | 128;

export const INT_BITS: readonly IntBits[] = [8, 4];
export const GROUPS: readonly GroupKind[] = ['tensor', 128, 32];

export function isIntBits(v: unknown): v is IntBits {
	return v === 4 || v === 8;
}

export function isGroupKind(v: unknown): v is GroupKind {
	return v === 'tensor' || v === 32 || v === 128;
}

/**
 * Symmetric integer quantization: s = max|x| / (2^(b-1) - 1), q = round(x / s), x̂ = s·q.
 * With groupSize 'tensor' one scale covers the whole vector; otherwise each run of
 * groupSize values gets its own scale.
 */
export function quantizeSymmetric(
	xs: readonly number[],
	bits: IntBits,
	group: GroupKind,
): number[] {
	const qmax = 2 ** (bits - 1) - 1;
	const size = group === 'tensor' ? Math.max(1, xs.length) : group;
	const out: number[] = new Array<number>(xs.length);
	for (let start = 0; start < xs.length; start += size) {
		const end = Math.min(xs.length, start + size);
		let maxAbs = 0;
		for (let i = start; i < end; i++) maxAbs = Math.max(maxAbs, Math.abs(xs[i] ?? 0));
		const s = maxAbs / qmax;
		for (let i = start; i < end; i++) {
			const v = xs[i] ?? 0;
			if (s === 0) {
				out[i] = 0;
				continue;
			}
			const q = Math.sign(v) * Math.min(qmax, roundHalfEven(Math.abs(v) / s));
			out[i] = s * q;
		}
	}
	return out;
}

/** Relative L2 error: ||x - y|| / ||x||. Returns 0 for an all-zero x. */
export function relativeError(xs: readonly number[], ys: readonly number[]): number {
	let num = 0;
	let den = 0;
	for (let i = 0; i < xs.length; i++) {
		const x = xs[i] ?? 0;
		const y = ys[i] ?? 0;
		num += (x - y) ** 2;
		den += x ** 2;
	}
	return den === 0 ? 0 : Math.sqrt(num / den);
}

/** Small seeded PRNG (mulberry32): the same seed always gives the same sequence. */
export function seededRandom(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export const VECTOR_N = 4096;
export const OUTLIER_EVERY = 256;
export const OUTLIER_FACTOR = 20;
export const VECTOR_SEED = 20260;

/**
 * Deterministic test vector: VECTOR_N standard normal values, where every OUTLIER_EVERY-th
 * value (starting from index 0) is multiplied by OUTLIER_FACTOR.
 */
export function makeVector(): number[] {
	const rnd = seededRandom(VECTOR_SEED);
	const xs: number[] = [];
	for (let i = 0; i < VECTOR_N; i++) {
		// Box-Muller; u1 is kept away from 0 so log() is finite.
		const u1 = Math.max(rnd(), 1e-12);
		const u2 = rnd();
		let z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
		if (i % OUTLIER_EVERY === 0) z *= OUTLIER_FACTOR;
		xs.push(z);
	}
	return xs;
}

export interface QuantResult {
	bits: IntBits;
	group: GroupKind;
	error: number;
}

/** Error of every combination of bit width and grouping on the given vector. */
export function quantTable(xs: readonly number[]): QuantResult[] {
	const rows: QuantResult[] = [];
	for (const bits of INT_BITS) {
		for (const group of GROUPS) {
			rows.push({ bits, group, error: relativeError(xs, quantizeSymmetric(xs, bits, group)) });
		}
	}
	return rows;
}

export function groupLabel(group: GroupKind): string {
	return group === 'tensor' ? 'один масштаб' : `группа ${group}`;
}
