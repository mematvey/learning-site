/**
 * Math of the drift demo: a reference (training) feature distribution against a production one
 * that has shifted. Two drift metrics: PSI (binned, by reference deciles) and the two-sample
 * Kolmogorov-Smirnov statistic D with its asymptotic p-value. Pure functions only: no DOM, no Svelte.
 *
 * Data: the reference sample is standard normal N(0, 1); the production sample is N(shift, 1).
 * Both are built from fixed seeds, so the picture is the same on every load and moving the slider
 * only shifts the same production draws.
 * PSI = sum_i (p_i - q_i) * ln(p_i / q_i), p = reference shares, q = production shares per bin.
 * KS: D = sup_x |F_ref(x) - F_prod(x)|; the alarm is D > c(alpha) * sqrt((n + m) / (n m)).
 */

import { mulberry32 } from './attention';

export const SHIFT_MIN = 0;
export const SHIFT_MAX = 3;
export const SHIFT_STEP = 0.1;
export const DEFAULT_SHIFT = 0;

/** Sample sizes of the reference (training) and production windows. */
export const REF_N = 1000;
export const PROD_N = 1000;
export const REF_SEED = 20241001;
export const PROD_SEED = 777;

/** Number of PSI bins; edges are the reference deciles. */
export const PSI_BINS = 10;
/** Shares below this value are floored so that ln(p / q) stays finite. */
export const PSI_EPS = 1e-4;

/** Common reading of PSI: below 0.1 stable, 0.1 to 0.25 a shift to watch, above 0.25 a serious shift. */
export const PSI_WARN = 0.1;
export const PSI_ALERT = 0.25;

/** Kolmogorov critical constant c(alpha) for alpha = 0.05 (two-sample test, asymptotic). */
export const KS_C_05 = 1.358;

/** Histogram range and bin width used for drawing the two densities. */
export const HIST_LO = -4;
export const HIST_HI = 7;
export const HIST_WIDTH = 0.5;

export interface DriftDemoState {
	/** Mean shift of the production feature, in reference standard deviations. */
	shift: number;
}

export type DriftLevel = 'stable' | 'warning' | 'alert';

export interface DriftSamples {
	/** Reference sample, N(0, 1). */
	ref: number[];
	/** Standard normal draws; production sample is shift + z. */
	z: number[];
}

export function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Clamps the shift to the slider range and snaps it to the slider step. */
export function snapShift(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_SHIFT;
	const c = clamp(v, SHIFT_MIN, SHIFT_MAX);
	const steps = Math.round((c - SHIFT_MIN) / SHIFT_STEP);
	// Round to remove floating-point noise such as 0.30000000000000004.
	return Math.round((SHIFT_MIN + steps * SHIFT_STEP) * 100) / 100;
}

/** Standard normal N(0, 1) via Box-Muller on the given generator. */
function gauss(rand: () => number): number {
	const u = Math.max(rand(), 1e-12);
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Fixed reference sample and the standard normal draws behind the production sample. */
export function makeSamples(): DriftSamples {
	const rRef = mulberry32(REF_SEED);
	const ref: number[] = [];
	for (let i = 0; i < REF_N; i++) ref.push(gauss(rRef));
	const rProd = mulberry32(PROD_SEED);
	const z: number[] = [];
	for (let i = 0; i < PROD_N; i++) z.push(gauss(rProd));
	return { ref, z };
}

/** Production sample for a given shift: the same draws moved by `shift`. */
export function productionSample(z: readonly number[], shift: number): number[] {
	return z.map((v) => v + shift);
}

/**
 * Interior bin edges (bins - 1 values): the k/bins sample quantiles of the reference sample.
 * Assumes a non-empty sample.
 */
export function quantileEdges(ref: readonly number[], bins: number = PSI_BINS): number[] {
	const sorted = [...ref].sort((a, b) => a - b);
	const n = sorted.length;
	const edges: number[] = [];
	for (let k = 1; k < bins; k++) {
		const idx = Math.min(n - 1, Math.floor((k * n) / bins));
		edges.push(sorted[idx] ?? 0);
	}
	return edges;
}

/** Index of the bin of x: the number of interior edges that are <= x. */
export function binIndex(x: number, edges: readonly number[]): number {
	let lo = 0;
	let hi = edges.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if ((edges[mid] ?? 0) <= x) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

/** Share of the sample in each bin (sums to 1 for a non-empty sample). */
export function binShares(xs: readonly number[], edges: readonly number[]): number[] {
	const counts = new Array<number>(edges.length + 1).fill(0);
	for (const x of xs) {
		const k = binIndex(x, edges);
		counts[k] = (counts[k] ?? 0) + 1;
	}
	const n = xs.length;
	return counts.map((c) => (n === 0 ? 0 : c / n));
}

/** Population Stability Index between two binned distributions with the same bins. */
export function psiFromShares(p: readonly number[], q: readonly number[]): number {
	let s = 0;
	for (let i = 0; i < p.length; i++) {
		const pi = Math.max(p[i] ?? 0, PSI_EPS);
		const qi = Math.max(q[i] ?? 0, PSI_EPS);
		s += (pi - qi) * Math.log(pi / qi);
	}
	return s;
}

/** PSI of the production sample against the reference, with bins from reference deciles. */
export function psi(
	ref: readonly number[],
	prod: readonly number[],
	bins: number = PSI_BINS,
): number {
	const edges = quantileEdges(ref, bins);
	return psiFromShares(binShares(ref, edges), binShares(prod, edges));
}

/**
 * Two-sample Kolmogorov-Smirnov statistic D = sup |F_a(x) - F_b(x)|.
 * Walks both sorted samples together; ties are consumed together so the ECDF is read after each value.
 */
export function ksStatistic(a: readonly number[], b: readonly number[]): number {
	const sa = [...a].sort((x, y) => x - y);
	const sb = [...b].sort((x, y) => x - y);
	const n = sa.length;
	const m = sb.length;
	if (n === 0 || m === 0) return 0;
	let i = 0;
	let j = 0;
	let d = 0;
	while (i < n || j < m) {
		const va = i < n ? (sa[i] ?? 0) : Infinity;
		const vb = j < m ? (sb[j] ?? 0) : Infinity;
		const v = Math.min(va, vb);
		while (i < n && (sa[i] ?? 0) === v) i++;
		while (j < m && (sb[j] ?? 0) === v) j++;
		d = Math.max(d, Math.abs(i / n - j / m));
	}
	return d;
}

/** Critical value of D for the two-sample test at level alpha = 0.05 (c * sqrt((n + m) / (n m))). */
export function ksCritical(n: number, m: number, c: number = KS_C_05): number {
	if (n <= 0 || m <= 0) return Infinity;
	return c * Math.sqrt((n + m) / (n * m));
}

/**
 * Asymptotic p-value of the two-sample KS test: Q(lambda) = 2 sum_k (-1)^(k-1) exp(-2 k^2 lambda^2)
 * with lambda = (sqrt(en) + 0.12 + 0.11 / sqrt(en)) D, en = n m / (n + m).
 */
export function ksPValue(d: number, n: number, m: number): number {
	if (d <= 0) return 1;
	const en = (n * m) / (n + m);
	const lambda = (Math.sqrt(en) + 0.12 + 0.11 / Math.sqrt(en)) * d;
	let sum = 0;
	for (let k = 1; k <= 100; k++) {
		const term = Math.exp(-2 * k * k * lambda * lambda);
		sum += (k % 2 === 1 ? 1 : -1) * term;
		if (term < 1e-12) break;
	}
	return clamp(2 * sum, 0, 1);
}

/** Traffic-light level of a PSI value. */
export function psiLevel(value: number): DriftLevel {
	if (value < PSI_WARN) return 'stable';
	if (value < PSI_ALERT) return 'warning';
	return 'alert';
}

/** Histogram density per bin over [lo, hi) with the given width (values outside are dropped). */
export function histogram(
	xs: readonly number[],
	lo: number = HIST_LO,
	hi: number = HIST_HI,
	width: number = HIST_WIDTH,
): number[] {
	const count = Math.round((hi - lo) / width);
	const counts = new Array<number>(count).fill(0);
	for (const x of xs) {
		if (x < lo || x >= hi) continue;
		const k = Math.min(count - 1, Math.floor((x - lo) / width));
		counts[k] = (counts[k] ?? 0) + 1;
	}
	const n = xs.length;
	return counts.map((c) => (n === 0 ? 0 : c / (n * width)));
}

/** Text of the description line under the chart. Numbers are computed, not typed. */
export function describeDrift(
	shift: number,
	psiValue: number,
	d: number,
	critical: number,
	pValue: number,
): string {
	const level = psiLevel(psiValue);
	const verdict =
		level === 'stable'
			? 'PSI ниже 0.1: распределение почти не сдвинулось.'
			: level === 'warning'
				? 'PSI от 0.1 до 0.25: сдвиг стоит проверить.'
				: 'PSI выше 0.25: сильный сдвиг, пора разбираться с моделью.';
	const ks =
		d > critical
			? `KS: D = ${d.toFixed(3)} больше критического ${critical.toFixed(3)}, p ≈ ${pValue.toFixed(3)}, тревога.`
			: `KS: D = ${d.toFixed(3)} не превышает критического ${critical.toFixed(3)}, p ≈ ${pValue.toFixed(3)}.`;
	return `Сдвиг ${shift.toFixed(1)} σ. PSI = ${psiValue.toFixed(3)}. ${verdict} ${ks}`;
}
