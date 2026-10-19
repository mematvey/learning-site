/**
 * Math of the A/B-test demo: sample size and power for a two-sided test on the mean difference,
 * and a simulation of peeking (several looks at one experiment with the same α).
 * Two equal groups, observations with standard deviation σ, minimal effect δ (difference of means).
 * Pure functions only: no DOM, no Svelte. The simulation is seeded, so the same inputs give the same output.
 */

export const ALPHA = 0.05;
export const POWER = 0.8;
export const SIGMA_MIN = 0.1;
export const SIGMA_MAX = 2;
export const SIGMA_STEP = 0.1;
export const DELTA_MIN = 0.01;
export const DELTA_MAX = 1;
export const DELTA_STEP = 0.01;
export const LOOKS_MIN = 1;
export const LOOKS_MAX = 10;
/** Number of simulated experiments for the peeking chart. */
export const SIM_RUNS = 8000;

export interface AbTestDemoState {
	/** Standard deviation of one observation (σ). */
	sigma: number;
	/** Minimal effect: difference of the group means (δ). */
	delta: number;
	/** Number of intermediate looks, including the final one. */
	looks: number;
	/** Seed of the simulation; changing it draws a new series of experiments. */
	seed: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to the slider step and clamps to its range. Non-finite input gives `fallback`. */
function snap(v: number, lo: number, hi: number, step: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	const rounded = Math.round(clamp(v, lo, hi) / step) * step;
	return Number(rounded.toFixed(4));
}

export function snapSigma(v: number): number {
	return snap(v, SIGMA_MIN, SIGMA_MAX, SIGMA_STEP, 1);
}

export function snapDelta(v: number): number {
	return snap(v, DELTA_MIN, DELTA_MAX, DELTA_STEP, 0.2);
}

export function snapLooks(v: number): number {
	if (!Number.isFinite(v)) return LOOKS_MAX;
	return Math.round(clamp(v, LOOKS_MIN, LOOKS_MAX));
}

/** Standard normal CDF Φ(z). Abramowitz–Stegun 7.1.26 for erf, absolute error about 1.5e-7. */
export function normCdf(z: number): number {
	const x = Math.abs(z) / Math.SQRT2;
	const t = 1 / (1 + 0.3275911 * x);
	const poly =
		t *
		(0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
	const erf = 1 - poly * Math.exp(-x * x);
	return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Inverse of Φ by bisection (about 1e-7 accuracy, enough for the quantiles used here). */
export function normInv(p: number): number {
	if (!(p > 0 && p < 1)) throw new RangeError('normInv: p must be in (0, 1)');
	let lo = -10;
	let hi = 10;
	for (let i = 0; i < 100; i++) {
		const mid = (lo + hi) / 2;
		if (normCdf(mid) < p) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/** Two-sided critical value for the given α, z_{1-α/2}. */
export function criticalZ(alpha: number = ALPHA): number {
	return normInv(1 - alpha / 2);
}

/**
 * Sample size per group for a two-sided test: n = 2σ²(z_{1-α/2} + z_{1-β})² / δ², rounded up.
 * With α = 0,05 and power 0,8 this is about 15,7σ²/δ².
 */
export function sampleSize(
	sigma: number,
	delta: number,
	alpha: number = ALPHA,
	power: number = POWER,
): number {
	if (!(sigma > 0) || !(delta > 0)) throw new RangeError('sampleSize: sigma and delta must be > 0');
	const zSum = criticalZ(alpha) + normInv(power);
	return Math.ceil((2 * sigma * sigma * zSum * zSum) / (delta * delta));
}

/**
 * Power at sample size n per group: 1 - β ≈ Φ(δ / √(2σ²/n) - z_{1-α/2}).
 * One tail only, as in the text. Returns 0 for n < 1.
 */
export function power(n: number, sigma: number, delta: number, alpha: number = ALPHA): number {
	if (!(n >= 1)) return 0;
	const shift = delta / Math.sqrt((2 * sigma * sigma) / n);
	return normCdf(shift - criticalZ(alpha));
}

export interface PowerPoint {
	n: number;
	power: number;
}

/** Power curve for n = 1..nMax (inclusive), sampled at `points` evenly spaced values of n. */
export function powerCurve(
	sigma: number,
	delta: number,
	nMax: number,
	points: number = 200,
): PowerPoint[] {
	const out: PowerPoint[] = [];
	for (let i = 0; i <= points; i++) {
		const n = Math.max(1, Math.round((nMax * i) / points));
		out.push({ n, power: power(n, sigma, delta) });
	}
	return out;
}

/** Mulberry32: a small seeded PRNG that returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Standard normal draws by Box–Muller on top of a uniform generator. */
export function normalSampler(uniform: () => number): () => number {
	return () => {
		const u1 = 1 - uniform(); // in (0, 1], avoids log(0)
		const u2 = uniform();
		return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	};
}

/**
 * Z-statistics of `runs` null experiments (no real effect), each looked at `looks` times.
 * Looks are evenly spaced: look k uses k·m observations per group. Unit σ is assumed.
 * The difference of group sums over one block of m pairs is N(0, 2m), so the cumulative
 * sum S_k of k such blocks gives z_k = S_k / √(2·k·m) exactly, without simulating every observation.
 * Result is a flat array: element [run * looks + k] is z at look k (0-based).
 */
export function nullZPaths(looks: number, runs: number = SIM_RUNS, seed: number = 1): Float64Array {
	const k = snapLooks(looks);
	const gauss = normalSampler(mulberry32(seed));
	const out = new Float64Array(runs * k);
	// Sd of one block increment: a difference of unit-σ observations has variance 2, block size m = 1.
	const blockSd = Math.SQRT2;
	for (let r = 0; r < runs; r++) {
		let s = 0;
		for (let j = 0; j < k; j++) {
			s += blockSd * gauss();
			out[r * k + j] = s / Math.sqrt(2 * (j + 1));
		}
	}
	return out;
}

/**
 * Share of null experiments where |z| exceeds `zCrit` at at least one look
 * (the experiment would be stopped and declared a win).
 */
export function falsePositiveRate(paths: Float64Array, looks: number, zCrit: number): number {
	const k = snapLooks(looks);
	const runs = paths.length / k;
	let hits = 0;
	for (let r = 0; r < runs; r++) {
		for (let j = 0; j < k; j++) {
			if (Math.abs(paths[r * k + j] ?? 0) > zCrit) {
				hits++;
				break;
			}
		}
	}
	return hits / runs;
}

export interface PeekingResult {
	/** Share of false wins with the usual critical value and a single look at the end. */
	single: number;
	/** Share of false wins with the usual critical value and `looks` looks (no correction). */
	peeking: number;
	/** Share of false wins with the Bonferroni critical value for `looks` looks. */
	bonferroni: number;
	/** Bonferroni critical value, z_{1-α/(2k)}. */
	zBonferroni: number;
}

/**
 * Runs the peeking simulation for `looks` looks. The single-look rate is taken from the same
 * paths: only the final look is used, so the comparison is on identical data.
 */
export function simulatePeeking(
	looks: number,
	seed: number,
	runs: number = SIM_RUNS,
	alpha: number = ALPHA,
): PeekingResult & { paths: Float64Array } {
	const k = snapLooks(looks);
	const paths = nullZPaths(k, runs, seed);
	const zCrit = criticalZ(alpha);
	const zBonferroni = normInv(1 - alpha / (2 * k));
	const finalOnly = new Float64Array(runs);
	for (let r = 0; r < runs; r++) finalOnly[r] = paths[r * k + k - 1] ?? 0;
	return {
		single: falsePositiveRate(finalOnly, 1, zCrit),
		peeking: falsePositiveRate(paths, k, zCrit),
		bonferroni: falsePositiveRate(paths, k, zBonferroni),
		zBonferroni,
		paths,
	};
}
