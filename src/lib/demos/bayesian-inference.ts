/**
 * Math of the Beta-Binomial demo: a coin with a Beta(a, b) prior on the heads probability θ,
 * updated by the observed flips. The posterior is Beta(a + heads, b + tails).
 * No external libraries: log-gamma (Lanczos), regularised incomplete beta (continued fraction),
 * quantiles by bisection. Pure functions only: no DOM, no Svelte.
 */

export const PARAM_MIN = 1;
export const PARAM_MAX = 20;
export const PARAM_STEP = 1;

/** Credible level of the shaded interval. */
export const CREDIBLE = 0.95;

/** Number of points used to draw a density curve. */
export const CURVE_POINTS = 201;

export interface BayesDemoState {
	/** Prior pseudo-heads a (>= 1). */
	a: number;
	/** Prior pseudo-tails b (>= 1). */
	b: number;
	/** Observed heads (orel). */
	heads: number;
	/** Observed tails (reshka). */
	tails: number;
}

export interface BetaSummary {
	mean: number;
	lo: number;
	hi: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an integer in the prior range. Non-finite input gives the fallback. */
export function snapParam(v: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	return clamp(Math.round(v), PARAM_MIN, PARAM_MAX);
}

/**
 * ln Γ(x) for x > 0: shift x up to at least 12 with the recurrence Γ(x+1) = x Γ(x),
 * then Stirling's series (terms up to z^-9), which is accurate to about 1e-12 there.
 */
export function logGamma(x: number): number {
	let z = x;
	let acc = 0;
	while (z < 12) {
		acc -= Math.log(z);
		z += 1;
	}
	const z2 = 1 / (z * z);
	const series =
		(1 / z) * (1 / 12 - z2 * (1 / 360 - z2 * (1 / 1260 - z2 * (1 / 1680 - z2 / 1188))));
	return (z - 0.5) * Math.log(z) - z + 0.5 * Math.log(2 * Math.PI) + series + acc;
}

/** ln B(a, b) = ln Γ(a) + ln Γ(b) − ln Γ(a + b). */
export function logBeta(a: number, b: number): number {
	return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/** Beta probability density at θ. Returns 0 outside (0, 1). */
export function betaPdf(x: number, a: number, b: number): number {
	if (!(x > 0 && x < 1)) return 0;
	return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta(a, b));
}

const FPMIN = 1e-300;
const EPS = 1e-14;
const MAX_ITER = 500;

/** Continued fraction for the incomplete beta function (modified Lentz method). */
function betaContinuedFraction(x: number, a: number, b: number): number {
	const qab = a + b;
	const qap = a + 1;
	const qam = a - 1;
	let c = 1;
	let d = 1 - (qab * x) / qap;
	if (Math.abs(d) < FPMIN) d = FPMIN;
	d = 1 / d;
	let h = d;
	for (let m = 1; m <= MAX_ITER; m++) {
		const m2 = 2 * m;
		let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
		d = 1 + aa * d;
		if (Math.abs(d) < FPMIN) d = FPMIN;
		c = 1 + aa / c;
		if (Math.abs(c) < FPMIN) c = FPMIN;
		d = 1 / d;
		h *= d * c;
		aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
		d = 1 + aa * d;
		if (Math.abs(d) < FPMIN) d = FPMIN;
		c = 1 + aa / c;
		if (Math.abs(c) < FPMIN) c = FPMIN;
		d = 1 / d;
		const del = d * c;
		h *= del;
		if (Math.abs(del - 1) < EPS) break;
	}
	return h;
}

/** Regularised incomplete beta I_x(a, b): the Beta(a, b) CDF at x. */
function regIncBeta(x: number, a: number, b: number): number {
	if (x <= 0) return 0;
	if (x >= 1) return 1;
	const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b));
	// The continued fraction converges fast only on one side of the mean; use symmetry on the other.
	if (x < (a + 1) / (a + b + 2)) {
		return (front * betaContinuedFraction(x, a, b)) / a;
	}
	return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

/** Beta(a, b) cumulative distribution function. */
export function betaCdf(x: number, a: number, b: number): number {
	return regIncBeta(x, a, b);
}

/** Beta(a, b) quantile: the θ with CDF(θ) = p, by bisection on [0, 1]. */
export function betaQuantile(p: number, a: number, b: number): number {
	if (p <= 0) return 0;
	if (p >= 1) return 1;
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 100; i++) {
		const mid = (lo + hi) / 2;
		if (betaCdf(mid, a, b) < p) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/** Conjugate update: Beta(a, b) prior and k heads, n − k tails give Beta(a + k, b + n − k). */
export function posterior(
	a: number,
	b: number,
	heads: number,
	tails: number,
): { a: number; b: number } {
	return { a: a + heads, b: b + tails };
}

export function betaMean(a: number, b: number): number {
	return a / (a + b);
}

/** Central credible interval with level `level` (equal tails). */
export function credibleInterval(
	a: number,
	b: number,
	level: number = CREDIBLE,
): { lo: number; hi: number } {
	const tail = (1 - level) / 2;
	return { lo: betaQuantile(tail, a, b), hi: betaQuantile(1 - tail, a, b) };
}

export function summarize(a: number, b: number): BetaSummary {
	const ci = credibleInterval(a, b);
	return { mean: betaMean(a, b), lo: ci.lo, hi: ci.hi };
}

/** Density samples on a uniform grid over [0, 1] (endpoints included). */
export function densityCurve(
	a: number,
	b: number,
	points: number = CURVE_POINTS,
): { x: number; y: number }[] {
	const out: { x: number; y: number }[] = [];
	for (let i = 0; i < points; i++) {
		const x = i / (points - 1);
		out.push({ x, y: betaPdf(x, a, b) });
	}
	return out;
}

/** Density samples between lo and hi (inclusive): the outline of the shaded credible interval. */
export function intervalCurve(
	a: number,
	b: number,
	lo: number,
	hi: number,
	points: number = 60,
): { x: number; y: number }[] {
	const out: { x: number; y: number }[] = [];
	for (let i = 0; i < points; i++) {
		const x = lo + ((hi - lo) * i) / (points - 1);
		out.push({ x, y: betaPdf(x, a, b) });
	}
	return out;
}

/** Deterministic pseudo-random generator (mulberry32), so the simulated coin is the same on every load. */
export function makeRng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Hidden heads probability of the simulated coin (the reader is not told it). */
export const TRUE_HEADS_P = 0.7;
export const SIM_SEED = 2026;

/** Simulates `count` flips of the hidden coin; returns the number of heads. */
export function simulateHeads(rng: () => number, count: number): number {
	let heads = 0;
	for (let i = 0; i < count; i++) if (rng() < TRUE_HEADS_P) heads++;
	return heads;
}

/** Formats a probability with three digits after the decimal point, comma as the separator. */
export function fmt(v: number): string {
	return v.toFixed(3).replace('.', ',');
}

/** One-sentence reading of the current state for the live note. */
export function describeState(s: BayesDemoState): string {
	const n = s.heads + s.tails;
	const post = posterior(s.a, s.b, s.heads, s.tails);
	const sm = summarize(post.a, post.b);
	const prior = summarize(s.a, s.b);
	if (n === 0) {
		return `Бросков ещё нет: интервал ${fmt(prior.lo)}–${fmt(prior.hi)} задаёт только априор Beta(${s.a}, ${s.b}).`;
	}
	const width = sm.hi - sm.lo;
	return (
		`После ${n} бросков (орёл ${s.heads}) интервал ${fmt(sm.lo)}–${fmt(sm.hi)}, ширина ${fmt(width)}. ` +
		(n < 100
			? 'Мало данных: ответ заметно зависит от априора.'
			: 'Данных уже много: априор почти не влияет на ответ.')
	);
}
