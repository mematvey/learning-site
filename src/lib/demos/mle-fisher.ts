/**
 * Math of the likelihood demo: Bernoulli likelihood for s successes in n trials.
 * The curve is the likelihood normalised to 1 at the maximum, so curves for different n
 * are drawn at the same height. Curvature of the log-likelihood at the maximum gives
 * the Fisher information, and its inverse square root gives the standard error.
 * Pure functions only: no DOM, no Svelte.
 */

export const N_MIN = 2;
export const N_MAX = 200;
export const N_STEP = 1;
export const DEFAULT_N = 80;
export const DEFAULT_S = 49;
/** z for the 95% Wald interval. */
export const Z95 = 1.96;
/** Number of grid points on the θ axis. */
export const GRID = 400;

export interface MleFisherDemoState {
	/** Number of observations (trials). */
	n: number;
	/** Number of successes (heads, defects, clicks...). */
	s: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an integer and clamps to [N_MIN, N_MAX]. Non-finite input gives DEFAULT_N. */
export function clampN(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_N;
	return clamp(Math.round(n), N_MIN, N_MAX);
}

/**
 * Rounds to an integer and clamps to [1, n - 1]. Zero or all successes are excluded:
 * the maximum then sits on the boundary and the standard error is 0, which the chapter warns about.
 */
export function clampS(s: number, n: number): number {
	const nn = clampN(n);
	if (!Number.isFinite(s)) return Math.min(DEFAULT_S, nn - 1);
	return clamp(Math.round(s), 1, nn - 1);
}

/** Maximum-likelihood estimate of θ for Bernoulli data: the sample share s / n. */
export function mle(s: number, n: number): number {
	return s / n;
}

/** Log-likelihood ℓ(p) = s·log p + (n − s)·log(1 − p), for 0 < p < 1. */
export function logLik(p: number, s: number, n: number): number {
	return s * Math.log(p) + (n - s) * Math.log(1 - p);
}

/** Likelihood divided by its maximum value, so it equals 1 at p̂ and lies in [0, 1]. */
export function relLik(p: number, s: number, n: number): number {
	const phat = mle(s, n);
	return Math.exp(logLik(p, s, n) - logLik(phat, s, n));
}

/**
 * Curvature of the negative log-likelihood at the maximum: −ℓ''(p̂) = n / (p̂(1 − p̂)).
 * This is the observed information; for Bernoulli it equals n·I(p̂).
 */
export function curvature(s: number, n: number): number {
	const phat = mle(s, n);
	return n / (phat * (1 - phat));
}

/** Fisher information of one Bernoulli observation: I(p) = 1 / (p(1 − p)). */
export function fisherPerObs(p: number): number {
	return 1 / (p * (1 - p));
}

/** Standard error from curvature: SE = 1 / √(n·I(p̂)) = √(p̂(1 − p̂)/n). */
export function standardError(s: number, n: number): number {
	return 1 / Math.sqrt(curvature(s, n));
}

/** Wald interval p̂ ± z·SE. Not clipped to [0, 1], as in the chapter text. */
export function waldInterval(s: number, n: number, z = Z95): [number, number] {
	const phat = mle(s, n);
	const se = standardError(s, n);
	return [phat - z * se, phat + z * se];
}

/**
 * Gaussian shape with the same curvature at the maximum, centred on p̂ with width SE.
 * Drawn as a dashed overlay: the closer the solid curve is to it, the more the quadratic approximation holds.
 */
export function gaussianApprox(p: number, s: number, n: number): number {
	const phat = mle(s, n);
	const se = standardError(s, n);
	const d = (p - phat) / se;
	return Math.exp(-0.5 * d * d);
}

export interface CurvePoint {
	p: number;
	exact: number;
	approx: number;
}

/** Grid of θ values strictly inside (0, 1) with exact and approximated normalised likelihood. */
export function curve(s: number, n: number, points = GRID): CurvePoint[] {
	const out: CurvePoint[] = [];
	for (let k = 1; k < points; k++) {
		const p = k / points;
		out.push({ p, exact: relLik(p, s, n), approx: gaussianApprox(p, s, n) });
	}
	return out;
}

/** Number of observations needed to halve the standard error from the current n (SE ∝ 1/√n, so 4n). */
export function nForHalfSE(n: number): number {
	return 4 * n;
}

/** Text of the description line under the chart. Numbers are computed, not typed. */
export function describeFisher(s: number, n: number): string {
	const phat = mle(s, n);
	const se = standardError(s, n);
	const [lo, hi] = waldInterval(s, n);
	return (
		`p̂ = ${s}/${n} = ${phat.toFixed(4).replace('.', ',')}. ` +
		`Кривизна в максимуме: ${curvature(s, n).toFixed(0)}, ` +
		`SE = ${se.toFixed(3).replace('.', ',')}, ` +
		`95% интервал [${lo.toFixed(3).replace('.', ',')}; ${hi.toFixed(3).replace('.', ',')}]. ` +
		`Чтобы SE стал вдвое меньше, нужно ${nForHalfSE(n)} наблюдений.`
	);
}
