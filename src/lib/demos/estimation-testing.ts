/**
 * Math of the hypothesis-test demo: confidence intervals for a mean with known σ = 1
 * and a two-sided z-test of H0: μ = 0 against a true effect δ (in units of σ).
 * Every random number comes from a seeded generator, so the same seed gives the same picture.
 * Pure functions only: no DOM, no Svelte.
 */

export const N_MIN = 5;
export const N_MAX = 100;
export const ALPHA_MIN = 0.01;
export const ALPHA_MAX = 0.2;
export const ALPHA_STEP = 0.01;
export const EFFECT_MIN = 0;
export const EFFECT_MAX = 1;
export const EFFECT_STEP = 0.05;
/** Number of confidence intervals in one series (one row of the chart each). */
export const REPS = 40;
export const DEFAULT_SEED = 1;
/** Half-range of the chart of intervals, in units of σ. */
export const CI_DOMAIN = 2;
/** Left edge of the statistic chart, in units of the standard error. */
export const TEST_DOMAIN_MIN = -4;
/** Height of the top of the density peak 1/√(2π) rounded up: the y-scale of the test chart. */
export const PEAK_MAX = 0.4;

export interface HypothesisTestDemoState {
	/** Sample size of one experiment. */
	n: number;
	/** Significance level α (also 1 − α is the confidence level). */
	alpha: number;
	/** True effect δ of the alternative H1: μ = δ, in units of σ. */
	effect: number;
}

export const DEFAULT_STATE: HypothesisTestDemoState = { n: 20, alpha: 0.05, effect: 0.5 };

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an integer and clamps to the n slider range. Non-finite input gives the default. */
export function snapN(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_STATE.n;
	return Math.round(clamp(n, N_MIN, N_MAX));
}

/** Rounds to 0.01 and clamps to the α slider range. */
export function snapAlpha(a: number): number {
	if (!Number.isFinite(a)) return DEFAULT_STATE.alpha;
	return Math.round(clamp(a, ALPHA_MIN, ALPHA_MAX) * 100) / 100;
}

/** Rounds to 0.05 and clamps to the effect slider range. */
export function snapEffect(e: number): number {
	if (!Number.isFinite(e)) return DEFAULT_STATE.effect;
	return Math.round(clamp(e, EFFECT_MIN, EFFECT_MAX) * 20) / 20;
}

/** Seeded generator mulberry32: the same seed gives the same sequence of values in [0, 1). */
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

/** One standard normal value by the Box–Muller transform. */
export function gaussian(rand: () => number): number {
	let u = 0;
	while (u === 0) u = rand();
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Error function, Abramowitz and Stegun 7.1.26 (absolute error below 1.5e-7). */
function erf(x: number): number {
	const sign = x < 0 ? -1 : 1;
	const ax = Math.abs(x);
	const t = 1 / (1 + 0.3275911 * ax);
	const poly =
		((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
	return sign * (1 - poly * Math.exp(-ax * ax));
}

/** Standard normal CDF Φ(z). */
export function normalCdf(z: number): number {
	return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Standard normal density φ(x - mu). */
export function normalDensity(x: number, mu = 0): number {
	const d = x - mu;
	return Math.exp(-(d * d) / 2) / Math.sqrt(2 * Math.PI);
}

/** Inverse of Φ by bisection on [-10, 10]; p is clamped to (0, 1). */
export function normalQuantile(p: number): number {
	const target = clamp(p, 1e-12, 1 - 1e-12);
	let lo = -10;
	let hi = 10;
	for (let i = 0; i < 100; i++) {
		const mid = (lo + hi) / 2;
		if (normalCdf(mid) < target) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/** Two-sided critical value z = Φ⁻¹(1 − α/2). */
export function criticalZ(alpha: number): number {
	return normalQuantile(1 - alpha / 2);
}

/** Half-width of the z-interval for the mean with known σ = 1: z·σ/√n. */
export function ciHalfWidth(n: number, alpha: number): number {
	return criticalZ(alpha) / Math.sqrt(n);
}

export interface Interval {
	/** Sample mean of the experiment. */
	mean: number;
	lo: number;
	hi: number;
	/** True when the interval contains the true mean. */
	covers: boolean;
}

/**
 * One series of `reps` experiments: each draws n values from N(trueMean, 1) and builds the
 * z-interval at level 1 − α. Deterministic for a given seed.
 */
export function simulateIntervals(
	n: number,
	alpha: number,
	trueMean: number,
	seed: number,
	reps: number = REPS,
): Interval[] {
	const rand = mulberry32(seed);
	const hw = ciHalfWidth(n, alpha);
	const out: Interval[] = [];
	for (let r = 0; r < reps; r++) {
		let sum = 0;
		for (let i = 0; i < n; i++) sum += trueMean + gaussian(rand);
		const mean = sum / n;
		out.push({
			mean,
			lo: mean - hw,
			hi: mean + hw,
			covers: Math.abs(mean - trueMean) <= hw,
		});
	}
	return out;
}

export interface Coverage {
	covered: number;
	total: number;
	/** Share of intervals that contain the true mean, in [0, 1]. */
	share: number;
}

export function coverageShare(intervals: readonly Interval[]): Coverage {
	const covered = intervals.filter((iv) => iv.covers).length;
	const total = intervals.length;
	return { covered, total, share: total === 0 ? 0 : covered / total };
}

export interface TestOutcome {
	/** Critical value z for the two-sided test at level α. */
	zCrit: number;
	/** Shift of the test statistic under H1: δ·√n. */
	shift: number;
	/** Type I error rate under H0 (equals α by construction; computed as a check). */
	alphaErr: number;
	/** Type II error rate under H1: P(fail to reject H0 | μ = δ). */
	betaErr: number;
	/** Power 1 − β. */
	power: number;
}

/**
 * Two-sided z-test of H0: μ = 0 with σ = 1. The statistic is Z = x̄·√n, which is N(0, 1) under H0
 * and N(δ√n, 1) under H1 = {μ = δ}.
 */
export function testOutcome(n: number, alpha: number, effect: number): TestOutcome {
	const zCrit = criticalZ(alpha);
	const shift = effect * Math.sqrt(n);
	const alphaErr = 2 * (1 - normalCdf(zCrit));
	const betaErr = normalCdf(zCrit - shift) - normalCdf(-zCrit - shift);
	return { zCrit, shift, alphaErr, betaErr, power: 1 - betaErr };
}

/** Horizontal domain of the statistic chart: from TEST_DOMAIN_MIN to cover the shifted H1 curve. */
export function testDomain(shift: number): [number, number] {
	return [TEST_DOMAIN_MIN, Math.max(4, shift + 4)];
}

/** Linear map from [d0, d1] to [r0, r1]. Works with inverted ranges (for y axes). */
export function makeScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
	const k = (r1 - r0) / (d1 - d0);
	return (v: number) => r0 + (v - d0) * k;
}

/** SVG path of the density N(mu, 1) over [a, b]. */
export function densityPath(
	mu: number,
	a: number,
	b: number,
	sx: (v: number) => number,
	sy: (v: number) => number,
	points = 160,
): string {
	const parts: string[] = [];
	for (let i = 0; i <= points; i++) {
		const x = a + ((b - a) * i) / points;
		const cmd = i === 0 ? 'M' : 'L';
		parts.push(`${cmd}${sx(x).toFixed(1)},${sy(normalDensity(x, mu)).toFixed(1)}`);
	}
	return parts.join(' ');
}

/** Closed SVG area under the density N(mu, 1) between a and b, down to the baseline y. */
export function shadePath(
	mu: number,
	a: number,
	b: number,
	sx: (v: number) => number,
	sy: (v: number) => number,
	baseY: number,
	points = 80,
): string {
	if (b <= a) return '';
	const parts: string[] = [`M${sx(a).toFixed(1)},${baseY.toFixed(1)}`];
	for (let i = 0; i <= points; i++) {
		const x = a + ((b - a) * i) / points;
		parts.push(`L${sx(x).toFixed(1)},${sy(normalDensity(x, mu)).toFixed(1)}`);
	}
	parts.push(`L${sx(b).toFixed(1)},${baseY.toFixed(1)} Z`);
	return parts.join(' ');
}

const pct = (share: number): string => `${Math.round(share * 100)}%`;

/** Text under the interval chart. Numbers are computed, not typed. */
export function describeCoverage(cov: Coverage, alpha: number): string {
	return (
		`Интервалы накрыли истинное μ = 0 в ${cov.covered} из ${cov.total} серий (${pct(cov.share)}). ` +
		`По построению доля должна быть около ${pct(1 - alpha)}; отдельная серия может отличаться.`
	);
}

/** Text under the test chart. Numbers are computed, not typed. */
export function describeTest(n: number, alpha: number, effect: number, out: TestOutcome): string {
	const head = `Если H₀ верна, она отвергается в ${pct(alpha)} случаев: это ошибка I рода α = ${alpha.toFixed(2)}. `;
	if (effect === 0) {
		return head + 'Эффект нулевой, H₀ верна: любое отвержение здесь ошибочно, и мощность равна α.';
	}
	return (
		head +
		`Если эффект δ = ${effect.toFixed(2)}σ, при n = ${n} мощность 1 − β = ${out.power.toFixed(2)}, ` +
		`ошибка II рода β = ${out.betaErr.toFixed(2)}.`
	);
}
