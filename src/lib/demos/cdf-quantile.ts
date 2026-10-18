/**
 * Math of the CDF / quantile demo: step CDF of Bin(n, p), the quantile F^-1(u) and inverse-transform sampling.
 * Deterministic: a fixed seeded sequence of uniforms, so every page load shows the same picture.
 * Pure functions only: no DOM, no Svelte.
 */
import { binomPmf, snapStep } from './distributions';

export const CQ_N_MIN = 1;
export const CQ_N_MAX = 30;
export const CQ_P_MIN = 0.05;
export const CQ_P_MAX = 0.95;
export const CQ_P_STEP = 0.01;
export const CQ_U_MIN = 0.01;
export const CQ_U_MAX = 0.99;
export const CQ_U_STEP = 0.01;
export const CQ_SAMPLE_MIN = 10;
export const CQ_SAMPLE_MAX = 2000;
export const CQ_SAMPLE_STEP = 10;
/** Seed of the fixed uniform sequence. */
export const CQ_SEED = 20261017;

export interface CdfQuantileState {
	n: number;
	p: number;
	/** Level u in (0, 1) for the quantile. */
	u: number;
	/** Number of draws used for the sample histogram. */
	m: number;
}

export const CQ_DEFAULT: CdfQuantileState = { n: 10, p: 0.5, u: 0.5, m: 200 };

/** F(k) = P(X <= k) for X ~ Bin(n, p). Zero below 0, one from n. */
export function binomCdf(n: number, p: number, k: number): number {
	if (k < 0) return 0;
	if (k >= n) return 1;
	let s = 0;
	for (let j = 0; j <= Math.floor(k); j++) s += binomPmf(n, p, j);
	return Math.min(1, s);
}

/** F^-1(u): the smallest k with F(k) >= u (with a tiny tolerance for rounding). */
export function binomQuantile(n: number, p: number, u: number): number {
	let s = 0;
	for (let k = 0; k <= n; k++) {
		s += binomPmf(n, p, k);
		if (s >= u - 1e-12) return k;
	}
	return n;
}

/** Small seeded generator (mulberry32): uniforms in [0, 1). */
export function uniformSequence(count: number, seed: number = CQ_SEED): number[] {
	let a = seed >>> 0;
	const out: number[] = [];
	for (let i = 0; i < count; i++) {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296);
	}
	return out;
}

/** Counts of each value 0..n among m draws X = F^-1(U) for the first m fixed uniforms. */
export function sampleCounts(n: number, p: number, m: number): number[] {
	const counts = new Array<number>(n + 1).fill(0);
	for (const u of uniformSequence(m)) {
		const k = binomQuantile(n, p, u);
		counts[k] = (counts[k] ?? 0) + 1;
	}
	return counts;
}

/** Clamps every field to its slider range. */
export function mergeCdfState(
	base: CdfQuantileState,
	patch: Partial<CdfQuantileState>,
): CdfQuantileState {
	const next = { ...base, ...patch };
	return {
		n: snapStep(next.n, CQ_N_MIN, CQ_N_MAX, 1, CQ_DEFAULT.n),
		p: snapStep(next.p, CQ_P_MIN, CQ_P_MAX, CQ_P_STEP, CQ_DEFAULT.p),
		u: snapStep(next.u, CQ_U_MIN, CQ_U_MAX, CQ_U_STEP, CQ_DEFAULT.u),
		m: snapStep(next.m, CQ_SAMPLE_MIN, CQ_SAMPLE_MAX, CQ_SAMPLE_STEP, CQ_DEFAULT.m),
	};
}
