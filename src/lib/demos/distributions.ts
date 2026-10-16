/**
 * Math of the distributions demo: binomial and Poisson PMF, normal PDF, and the probability of a segment.
 * Deterministic: no random numbers, so every page load shows the same picture.
 * Pure functions only: no DOM, no Svelte.
 */

export const BINOM_N_MIN = 1;
export const BINOM_N_MAX = 40;
export const BINOM_P_MIN = 0.01;
export const BINOM_P_MAX = 0.99;
export const BINOM_P_STEP = 0.01;

export const LAMBDA_MIN = 0.1;
export const LAMBDA_MAX = 20;
export const LAMBDA_STEP = 0.1;

export const MU_MIN = -3;
export const MU_MAX = 3;
export const SIGMA_MIN = 0.2;
export const SIGMA_MAX = 3;
export const NORM_STEP = 0.1;

/** Upper bound of integer segment ends for the binomial and Poisson panels. */
export const SEG_K_MAX = 40;
/** Range of the normal segment ends (absolute x). */
export const SEG_X_MIN = -10;
export const SEG_X_MAX = 10;
export const SEG_X_STEP = 0.1;

/** The normal curve is drawn on [-NORM_AXIS, NORM_AXIS]. */
export const NORM_AXIS = 12;

export interface DistributionsDemoState {
	/** Binomial: number of trials. */
	n: number;
	/** Binomial: success probability. */
	p: number;
	/** Binomial: lower segment end (integer). */
	binomLo: number;
	/** Binomial: upper segment end (integer). */
	binomHi: number;
	/** Poisson: mean lambda. */
	lambda: number;
	/** Poisson: lower segment end (integer). */
	poisLo: number;
	/** Poisson: upper segment end (integer). */
	poisHi: number;
	/** Normal: mean. */
	mu: number;
	/** Normal: standard deviation (the demo sets sigma, not the variance). */
	sigma: number;
	/** Normal: lower segment end (absolute x). */
	normLo: number;
	/** Normal: upper segment end (absolute x). */
	normHi: number;
}

/** Starting values. Binomial and Poisson segments reproduce the chapter values 0,246 and 0,050. */
export const DEFAULT_STATE: DistributionsDemoState = {
	n: 10,
	p: 0.5,
	binomLo: 5,
	binomHi: 5,
	lambda: 3,
	poisLo: 0,
	poisHi: 0,
	mu: 0,
	sigma: 1,
	normLo: -1,
	normHi: 1,
};

export interface PmfBar {
	k: number;
	p: number;
	inside: boolean;
}

export interface CurvePoint {
	x: number;
	y: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Clamps to [min, max] and rounds to the grid anchored at min. Non-finite input gives fallback. */
export function snapStep(
	v: number,
	min: number,
	max: number,
	step: number,
	fallback: number,
): number {
	if (!Number.isFinite(v)) return fallback;
	const c = clamp(v, min, max);
	const r = Math.round((c - min) / step) * step + min;
	return Number(clamp(r, min, max).toFixed(6));
}

/** Natural log of k!, computed as a sum of logs (stable for the sizes used here). */
export function logFactorial(k: number): number {
	let s = 0;
	for (let i = 2; i <= k; i++) s += Math.log(i);
	return s;
}

/** Natural log of the binomial coefficient C(n, k). */
export function logChoose(n: number, k: number): number {
	return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/** P(X = k) for X ~ Bin(n, p). Zero outside 0..n. */
export function binomPmf(n: number, p: number, k: number): number {
	if (!Number.isInteger(k) || k < 0 || k > n) return 0;
	if (p <= 0) return k === 0 ? 1 : 0;
	if (p >= 1) return k === n ? 1 : 0;
	return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
}

/** P(X = k) for X ~ Pois(lambda). Zero for negative or non-integer k. */
export function poissonPmf(lambda: number, k: number): number {
	if (!Number.isInteger(k) || k < 0) return 0;
	if (lambda <= 0) return k === 0 ? 1 : 0;
	return Math.exp(k * Math.log(lambda) - lambda - logFactorial(k));
}

/** Density of N(mu, sigma^2) at x. Returns 0 for a non-positive sigma. */
export function normalPdf(x: number, mu: number, sigma: number): number {
	if (!(sigma > 0)) return 0;
	const z = (x - mu) / sigma;
	return Math.exp(-(z * z) / 2) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Sum of the binomial PMF over lo <= k <= hi (integers, clipped to 0..n). */
export function binomSegmentProb(n: number, p: number, lo: number, hi: number): number {
	let s = 0;
	for (let k = Math.max(0, lo); k <= Math.min(n, hi); k++) s += binomPmf(n, p, k);
	return s;
}

/** Sum of the Poisson PMF over lo <= k <= hi (integers, from 0). */
export function poissonSegmentProb(lambda: number, lo: number, hi: number): number {
	let s = 0;
	for (let k = Math.max(0, lo); k <= hi; k++) s += poissonPmf(lambda, k);
	return s;
}

/**
 * P(a <= X <= b) for X ~ N(mu, sigma^2): Simpson's rule on the density.
 * The range is clipped to mu +- 10 sigma, where the rest of the mass is negligible.
 */
export function normalSegmentProb(mu: number, sigma: number, a: number, b: number): number {
	if (!(sigma > 0)) return 0;
	const lo = Math.max(a, mu - 10 * sigma);
	const hi = Math.min(b, mu + 10 * sigma);
	if (!(hi > lo)) return 0;
	const N = 2000;
	const h = (hi - lo) / N;
	let s = normalPdf(lo, mu, sigma) + normalPdf(hi, mu, sigma);
	for (let i = 1; i < N; i++) {
		s += normalPdf(lo + i * h, mu, sigma) * (i % 2 === 1 ? 4 : 2);
	}
	return (s * h) / 3;
}

/** Bars of Bin(n, p) for k = 0..n; `inside` marks the segment [lo, hi]. */
export function binomBars(n: number, p: number, lo: number, hi: number): PmfBar[] {
	const bars: PmfBar[] = [];
	for (let k = 0; k <= n; k++) {
		bars.push({ k, p: binomPmf(n, p, k), inside: k >= lo && k <= hi });
	}
	return bars;
}

/** Right end of the Poisson plot: the mean plus four standard deviations, at least 10, at most 40. */
export function poissonAxisMax(lambda: number): number {
	return Math.min(SEG_K_MAX, Math.max(10, Math.ceil(lambda + 4 * Math.sqrt(lambda))));
}

/** Bars of Pois(lambda) for k = 0..poissonAxisMax(lambda). */
export function poissonBars(lambda: number, lo: number, hi: number): PmfBar[] {
	const bars: PmfBar[] = [];
	const top = poissonAxisMax(lambda);
	for (let k = 0; k <= top; k++) {
		bars.push({ k, p: poissonPmf(lambda, k), inside: k >= lo && k <= hi });
	}
	return bars;
}

/** Points of the normal density on [-NORM_AXIS, NORM_AXIS]. */
export function normalCurve(mu: number, sigma: number, count = 241): CurvePoint[] {
	const pts: CurvePoint[] = [];
	for (let i = 0; i < count; i++) {
		const x = -NORM_AXIS + (2 * NORM_AXIS * i) / (count - 1);
		pts.push({ x, y: normalPdf(x, mu, sigma) });
	}
	return pts;
}

/** Formats a number with a decimal comma, as in Russian text. */
export function formatNumber(v: number, digits: number): string {
	return v.toFixed(digits).replace('.', ',');
}

/** Clamps every field to its slider range and keeps every segment ordered (lo <= hi). */
export function mergeState(
	base: DistributionsDemoState,
	patch: Partial<DistributionsDemoState>,
): DistributionsDemoState {
	const next: DistributionsDemoState = { ...base, ...patch };

	const n = snapStep(next.n, BINOM_N_MIN, BINOM_N_MAX, 1, DEFAULT_STATE.n);
	const p = snapStep(next.p, BINOM_P_MIN, BINOM_P_MAX, BINOM_P_STEP, DEFAULT_STATE.p);
	const lambda = snapStep(next.lambda, LAMBDA_MIN, LAMBDA_MAX, LAMBDA_STEP, DEFAULT_STATE.lambda);
	const mu = snapStep(next.mu, MU_MIN, MU_MAX, NORM_STEP, DEFAULT_STATE.mu);
	const sigma = snapStep(next.sigma, SIGMA_MIN, SIGMA_MAX, NORM_STEP, DEFAULT_STATE.sigma);

	// A patched lower end pushes the upper end up; a patched upper end pulls the lower end down.
	const [bLo, bHi] = ordered(next.binomLo, next.binomHi, 'binomLo' in patch);
	const [pLo, pHi] = ordered(next.poisLo, next.poisHi, 'poisLo' in patch);
	const [xLo, xHi] = ordered(next.normLo, next.normHi, 'normLo' in patch);

	// Binomial segment lives inside 0..n.
	const binomLo = Math.min(snapStep(bLo, 0, BINOM_N_MAX, 1, 0), n);
	const binomHi = Math.max(Math.min(snapStep(bHi, 0, BINOM_N_MAX, 1, 0), n), binomLo);

	const poisLo = snapStep(pLo, 0, SEG_K_MAX, 1, 0);
	const poisHi = Math.max(snapStep(pHi, 0, SEG_K_MAX, 1, 0), poisLo);

	return {
		n,
		p,
		binomLo,
		binomHi,
		lambda,
		poisLo,
		poisHi,
		mu,
		sigma,
		normLo: snapStep(xLo, SEG_X_MIN, SEG_X_MAX, SEG_X_STEP, DEFAULT_STATE.normLo),
		normHi: snapStep(xHi, SEG_X_MIN, SEG_X_MAX, SEG_X_STEP, DEFAULT_STATE.normHi),
	};
}

function ordered(lo: number, hi: number, loPatched: boolean): [number, number] {
	return loPatched ? [lo, Math.max(lo, hi)] : [Math.min(lo, hi), hi];
}

/** Text for screen readers: the binomial parameters and the segment probability. */
export function describeBinomial(s: DistributionsDemoState): string {
	const prob = binomSegmentProb(s.n, s.p, s.binomLo, s.binomHi);
	return `Bin(n = ${s.n}, p = ${formatNumber(s.p, 2)}): P(${s.binomLo} ≤ X ≤ ${s.binomHi}) = ${formatNumber(prob, 3)}.`;
}

/** Text for screen readers: the Poisson parameter and the segment probability. */
export function describePoisson(s: DistributionsDemoState): string {
	const prob = poissonSegmentProb(s.lambda, s.poisLo, s.poisHi);
	return `Pois(λ = ${formatNumber(s.lambda, 1)}): P(${s.poisLo} ≤ X ≤ ${s.poisHi}) = ${formatNumber(prob, 3)}.`;
}

/** Text for screen readers: the normal parameters and the segment probability. */
export function describeNormal(s: DistributionsDemoState): string {
	const prob = normalSegmentProb(s.mu, s.sigma, s.normLo, s.normHi);
	return `N(μ = ${formatNumber(s.mu, 1)}, σ = ${formatNumber(s.sigma, 1)}): P(${formatNumber(s.normLo, 1)} ≤ X ≤ ${formatNumber(s.normHi, 1)}) = ${formatNumber(prob, 3)}.`;
}
