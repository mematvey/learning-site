/**
 * Math of the Binomial-to-Poisson demo: Bin(n, lambda / n) against Pois(lambda) for growing n.
 * Pure functions only: no DOM, no Svelte.
 */
import { binomPmf, poissonPmf, snapStep } from './distributions';

export const BP_LAMBDA_MIN = 0.5;
export const BP_LAMBDA_MAX = 10;
export const BP_LAMBDA_STEP = 0.5;
export const BP_N_MAX = 200;

export interface BinomPoissonState {
	lambda: number;
	/** Number of trials; p = lambda / n, so n >= lambda. */
	n: number;
}

export const BP_DEFAULT: BinomPoissonState = { lambda: 3, n: 5 };

export interface BpBar {
	k: number;
	binom: number;
	poisson: number;
}

/** Last plotted value: the mean plus four standard deviations, at least 10. */
export function bpAxisMax(lambda: number): number {
	return Math.max(10, Math.ceil(lambda + 4 * Math.sqrt(lambda)));
}

/** Both PMFs for k = 0..bpAxisMax, with p = lambda / n. */
export function bpBars(lambda: number, n: number): BpBar[] {
	const p = lambda / n;
	const bars: BpBar[] = [];
	for (let k = 0; k <= bpAxisMax(lambda); k++) {
		bars.push({ k, binom: binomPmf(n, p, k), poisson: poissonPmf(lambda, k) });
	}
	return bars;
}

/** Total variation distance, half the sum of |P_bin(k) - P_pois(k)| over all k. */
export function totalVariation(lambda: number, n: number): number {
	const p = lambda / n;
	let s = 0;
	const top = Math.max(n, Math.ceil(lambda + 12 * Math.sqrt(lambda) + 20));
	for (let k = 0; k <= top; k++) s += Math.abs(binomPmf(n, p, k) - poissonPmf(lambda, k));
	return s / 2;
}

/** Clamps lambda and n to their ranges and keeps n >= lambda, so that p <= 1. */
export function mergeBpState(
	base: BinomPoissonState,
	patch: Partial<BinomPoissonState>,
): BinomPoissonState {
	const next = { ...base, ...patch };
	const lambda = snapStep(
		next.lambda,
		BP_LAMBDA_MIN,
		BP_LAMBDA_MAX,
		BP_LAMBDA_STEP,
		BP_DEFAULT.lambda,
	);
	const n = Math.max(Math.ceil(lambda), snapStep(next.n, 1, BP_N_MAX, 1, BP_DEFAULT.n));
	return { lambda, n };
}
