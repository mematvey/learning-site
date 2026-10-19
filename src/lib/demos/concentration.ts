/**
 * Math of the concentration demo: the tail P(|X̄ − p| ≥ t) of the mean of n Bernoulli(p)
 * measurements, the three bounds on it (Markov, Chebyshev, Hoeffding), and the normal
 * approximation used in the chapter table. Exact values come from the binomial distribution,
 * not from simulation, so every page load shows the same numbers.
 * Pure functions only: no DOM, no Svelte.
 */

export const N_MIN = 1;
export const N_MAX = 1000;
export const N_DEFAULT = 100;
/** The n slider is log-scaled: n = round(10^(pos / POS_PER_DECADE)). */
export const POS_PER_DECADE = 2000;
export const POS_MAX = 3 * POS_PER_DECADE;
export const POS_DEFAULT = 2 * POS_PER_DECADE;

export const P_MIN = 0.05;
export const P_MAX = 0.95;
export const P_STEP = 0.05;
export const P_DEFAULT = 0.5;

export const EPS_MIN = 0.02;
export const EPS_MAX = 0.3;
export const EPS_STEP = 0.01;
export const EPS_DEFAULT = 0.1;

/** Level for the sample-size questions: P ≤ ALPHA. */
export const ALPHA = 0.05;
/** Width b − a of the interval for Bernoulli values [0, 1]. */
export const WIDTH = 1;
/** Lowest probability drawn on the log axis; smaller values are drawn at this level. */
export const PROB_FLOOR = 1e-12;
/** Number of points per curve (log-spaced n from 1 to N_MAX). */
export const CURVE_POINTS = 61;
/** n values of the chapter table. */
export const TABLE_NS: readonly number[] = [10, 100, 1000];

export interface ConcentrationDemoState {
	/** Number of measurements n in the mean. */
	n: number;
	/** Probability of success p of one measurement. */
	p: number;
	/** Deviation threshold ε: the event is |X̄ − p| ≥ ε. */
	eps: number;
}

export interface Bounds {
	/** Exact tail of the binomial mean. */
	exact: number;
	/** Normal approximation 2(1 − Φ(ε√n/σ)). */
	clt: number;
	/** Markov bound on E|X̄ − p| / ε, uncapped. */
	markov: number;
	/** Chebyshev bound σ²/(nε²), uncapped. */
	chebyshev: number;
	/** Two-sided Hoeffding bound 2·exp(−2nε²/(b−a)²), uncapped. */
	hoeffding: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Integer n clamped to [N_MIN, N_MAX]. Non-finite input gives N_DEFAULT. */
export function clampN(n: number): number {
	if (!Number.isFinite(n)) return N_DEFAULT;
	return clamp(Math.round(n), N_MIN, N_MAX);
}

/** Rounds p to the slider step and clamps it. Non-finite input gives P_DEFAULT. */
export function snapP(p: number): number {
	if (!Number.isFinite(p)) return P_DEFAULT;
	return Number((Math.round(clamp(p, P_MIN, P_MAX) / P_STEP) * P_STEP).toFixed(2));
}

/** Rounds ε to the slider step and clamps it. Non-finite input gives EPS_DEFAULT. */
export function snapEps(e: number): number {
	if (!Number.isFinite(e)) return EPS_DEFAULT;
	return Number((Math.round(clamp(e, EPS_MIN, EPS_MAX) / EPS_STEP) * EPS_STEP).toFixed(2));
}

/** Slider position for n (log scale). */
export function posFromN(n: number): number {
	return Math.round(Math.log10(clampN(n)) * POS_PER_DECADE);
}

/** n for a slider position; the result is always in [N_MIN, N_MAX]. */
export function nFromPos(pos: number): number {
	const p = Number.isFinite(pos) ? clamp(pos, 0, POS_MAX) : POS_DEFAULT;
	return clampN(Math.round(Math.pow(10, p / POS_PER_DECADE)));
}

/** log(k!) for k = 0 … N_MAX. */
const LOG_FACT: Float64Array = (() => {
	const table = new Float64Array(N_MAX + 1);
	let acc = 0;
	for (let i = 1; i <= N_MAX; i++) {
		acc += Math.log(i);
		table[i] = acc;
	}
	return table;
})();

function logFact(k: number): number {
	return LOG_FACT[k] ?? 0;
}

/**
 * Exact P(|X̄ − p| ≥ t) for the mean of n Bernoulli(p) values, summed over the binomial
 * distribution in log space. n must be an integer in [1, N_MAX].
 */
export function exactTail(n: number, p: number, t: number): number {
	const lp = Math.log(p);
	const lq = Math.log(1 - p);
	let total = 0;
	for (let k = 0; k <= n; k++) {
		// the small tolerance keeps the boundary case k/n = p ± t inside the tail
		if (Math.abs(k / n - p) >= t - 1e-9) {
			const logTerm = logFact(n) - logFact(k) - logFact(n - k) + k * lp + (n - k) * lq;
			total += Math.exp(logTerm);
		}
	}
	return Math.min(1, total);
}

/** Standard deviation of one Bernoulli(p) value. */
export function sigma(p: number): number {
	return Math.sqrt(p * (1 - p));
}

/** Markov bound: E|X̄ − p| ≤ σ/√n, so P(|X̄ − p| ≥ t) ≤ σ/(√n·t). Uncapped. */
export function markovBound(n: number, p: number, t: number): number {
	return sigma(p) / (Math.sqrt(n) * t);
}

/** Chebyshev bound: Var X̄ = p(1 − p)/n, so P(|X̄ − p| ≥ t) ≤ p(1 − p)/(n·t²). Uncapped. */
export function chebyshevBound(n: number, p: number, t: number): number {
	return (p * (1 - p)) / (n * t * t);
}

/** Two-sided Hoeffding bound for values in an interval of width WIDTH. Uncapped. */
export function hoeffdingBound(n: number, t: number): number {
	return 2 * Math.exp((-2 * n * t * t) / (WIDTH * WIDTH));
}

/** erfc with fractional error below 1.2e-7 (Numerical Recipes, erfcc). */
function erfc(x: number): number {
	const z = Math.abs(x);
	const t = 1 / (1 + 0.5 * z);
	const r =
		t *
		Math.exp(
			-z * z -
				1.26551223 +
				t *
					(1.00002368 +
						t *
							(0.37409196 +
								t *
									(0.09678418 +
										t *
											(-0.18628806 +
												t *
													(0.27886807 +
														t *
															(-1.13520398 +
																t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
		);
	return x >= 0 ? r : 2 - r;
}

/** Normal approximation of the two-sided tail: 2(1 − Φ(t√n/σ)). */
export function cltTail(n: number, p: number, t: number): number {
	const z = (t * Math.sqrt(n)) / sigma(p);
	return erfc(z / Math.SQRT2);
}

/** All five values for one (n, p, ε). The bounds are uncapped; callers cap them at 1 for display. */
export function boundsAt(n: number, p: number, t: number): Bounds {
	return {
		exact: exactTail(n, p, t),
		clt: cltTail(n, p, t),
		markov: markovBound(n, p, t),
		chebyshev: chebyshevBound(n, p, t),
		hoeffding: hoeffdingBound(n, t),
	};
}

/** Smallest n with the Chebyshev bound ≤ alpha. May exceed N_MAX. */
export function chebyshevSampleSize(p: number, t: number, alpha: number): number {
	return Math.ceil((p * (1 - p)) / (alpha * t * t) - 1e-9);
}

/** Smallest n with the Hoeffding bound ≤ alpha (independent of p). May exceed N_MAX. */
export function hoeffdingSampleSize(t: number, alpha: number): number {
	return Math.ceil(Math.log(2 / alpha) / (2 * t * t) - 1e-9);
}

/** First n in [1, N_MAX] with the exact tail ≤ alpha, or null if there is none. */
export function exactSampleSize(p: number, t: number, alpha: number): number | null {
	for (let n = N_MIN; n <= N_MAX; n++) {
		if (exactTail(n, p, t) <= alpha) return n;
	}
	return null;
}

/** Curves on a log grid of n from 1 to N_MAX, with exact and bound values at the same n. */
export interface CurveSeries {
	ns: number[];
	exact: number[];
	markov: number[];
	chebyshev: number[];
	hoeffding: number[];
}

export function curveSeries(p: number, t: number): CurveSeries {
	const ns: number[] = [];
	for (let i = 0; i < CURVE_POINTS; i++) {
		const n = clampN(Math.round(Math.pow(N_MAX, i / (CURVE_POINTS - 1))));
		if (ns[ns.length - 1] !== n) ns.push(n);
	}
	const series: CurveSeries = { ns, exact: [], markov: [], chebyshev: [], hoeffding: [] };
	for (const n of ns) {
		series.exact.push(exactTail(n, p, t));
		series.markov.push(markovBound(n, p, t));
		series.chebyshev.push(chebyshevBound(n, p, t));
		series.hoeffding.push(hoeffdingBound(n, t));
	}
	return series;
}

/** Geometry of the chart in px: the outer box and the plot margins. */
export interface PlotBox {
	w: number;
	h: number;
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export function plotBox(w: number, h = 240): PlotBox {
	return { w, h, left: 52, right: 14, top: 12, bottom: 30 };
}

/** x of n on the log axis from 1 to N_MAX. */
export function xOfN(n: number, box: PlotBox): number {
	const frac = Math.log10(clampN(n)) / Math.log10(N_MAX);
	return box.left + frac * (box.w - box.left - box.right);
}

/** y of a probability on the log axis from PROB_FLOOR to 1. Values outside are clamped. */
export function yOfProb(v: number, box: PlotBox): number {
	const safe = Number.isFinite(v) && v > 0 ? clamp(v, PROB_FLOOR, 1) : PROB_FLOOR;
	const frac = -Math.log10(safe) / -Math.log10(PROB_FLOOR);
	return box.top + frac * (box.h - box.top - box.bottom);
}

/** SVG path through the points; values are clamped to the plot range. */
export function pathOf(ns: readonly number[], vals: readonly number[], box: PlotBox): string {
	return ns
		.map((n, i) => {
			const cmd = i === 0 ? 'M' : 'L';
			return `${cmd}${xOfN(n, box).toFixed(1)},${yOfProb(vals[i] ?? 0, box).toFixed(1)}`;
		})
		.join(' ');
}

const SUPERSCRIPT: Record<string, string> = {
	'-': '⁻',
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹',
};

function superscript(e: number): string {
	return String(e)
		.split('')
		.map((c) => SUPERSCRIPT[c] ?? c)
		.join('');
}

/** Label of a log-axis tick: 1, 10⁻², 10⁻⁴ … */
export function powLabel(e: number): string {
	return e === 0 ? '1' : `10${superscript(e)}`;
}

/**
 * Probability for the reader, in the chapter style with a decimal comma:
 * 0,0569; 0,25; 2,7·10⁻¹⁰. Zero and non-positive values give "0", values ≥ 1 give "1".
 */
export function formatProb(v: number): string {
	if (!Number.isFinite(v) || v <= 0) return '0';
	if (v >= 1) return '1';
	if (v >= 0.01) {
		const s = v
			.toPrecision(3)
			.replace(/(\.\d*?)0+$/, '$1')
			.replace(/\.$/, '');
		return s.replace('.', ',');
	}
	let e = Math.floor(Math.log10(v));
	let mant = (v / Math.pow(10, e)).toFixed(1);
	if (Number(mant) >= 10) {
		e += 1;
		mant = (v / Math.pow(10, e)).toFixed(1);
	}
	return `${mant.replace('.', ',')}·10${superscript(e)}`;
}

/** Bound value for the reader: values above 1 say that the bound is empty. */
export function formatBound(v: number): string {
	return v >= 1 ? 'больше 1, пустая' : formatProb(v);
}

/** Text for the live region: the current n with all five values. */
export function describeState(s: ConcentrationDemoState): string {
	const b = boundsAt(s.n, s.p, s.eps);
	return (
		`n = ${s.n}, p = ${formatP(s.p)}, ε = ${formatP(s.eps)}. ` +
		`Точная вероятность ${formatProb(b.exact)}. ` +
		`Граница Маркова ${formatBound(b.markov)}, Чебышёва ${formatBound(b.chebyshev)}, ` +
		`Хёффдинга ${formatBound(b.hoeffding)}.`
	);
}

/** Two-decimal number with a decimal comma. */
export function formatP(v: number): string {
	return v.toFixed(2).replace('.', ',');
}

/** Why the bounds look as they do: where p and ε enter the formulas. */
export function reasonNote(s: ConcentrationDemoState): string {
	return (
		`Порог ε = ${formatP(s.eps)} входит в границу Чебышёва как 1/ε², ` +
		`в границу Хёффдинга как exp(−2nε²). ` +
		`Дисперсия p(1 − p) = ${(s.p * (1 - s.p)).toFixed(3).replace('.', ',')} входит только в Чебышёва: ` +
		`граница Хёффдинга от p не зависит.`
	);
}

/** What follows from it for the current n. */
export function consequenceNote(s: ConcentrationDemoState): string {
	const b = boundsAt(s.n, s.p, s.eps);
	if (b.hoeffding < b.chebyshev) {
		return 'При этом n граница Хёффдинга уже ниже границы Чебышёва.';
	}
	return 'При этом n граница Хёффдинга ещё выше границы Чебышёва: экспонента не успела опуститься.';
}
