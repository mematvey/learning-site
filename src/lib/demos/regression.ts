/**
 * Math of the OLS residuals demo: least squares fit of one predictor, residuals,
 * standard error of the slope, t-based confidence interval and two-sided p-value.
 * The t distribution is computed numerically (regularised incomplete beta function),
 * so the demo needs no external statistics library.
 * Pure functions only: no DOM, no Svelte.
 */

export interface Point {
	x: number;
	y: number;
}

/** Points of the demo at start and after reset (matches the chapter text). */
export const INITIAL_POINTS: readonly Point[] = [
	{ x: 1, y: 2.1 },
	{ x: 2, y: 3.9 },
	{ x: 3, y: 6.2 },
	{ x: 4, y: 7.8 },
	{ x: 5, y: 10.1 },
];

/** Plot domain in data units; points are dragged inside it. */
export const X_MIN = 0;
export const X_MAX = 6;
export const Y_MIN = 0;
export const Y_MAX = 12;

/** Significance level of the confidence interval (95% by default). */
export const ALPHA = 0.05;

// ---------------------------------------------------------------------------
// Special functions
// ---------------------------------------------------------------------------

const LANCZOS = [
	0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
	-176.61503916999385, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
	1.5056327351493116e-7,
];

/** Natural log of the gamma function for z > 0 (Lanczos approximation). */
function lnGamma(z: number): number {
	if (z < 0.5) {
		// Reflection formula; not used by the demo, kept for completeness.
		return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lnGamma(1 - z);
	}
	const zz = z - 1;
	let a = LANCZOS[0] ?? 0;
	const t = zz + 7.5;
	for (let i = 1; i < 9; i++) a += (LANCZOS[i] ?? 0) / (zz + i);
	return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (modified Lentz method). */
function betaContinuedFraction(a: number, b: number, x: number): number {
	const FPMIN = 1e-300;
	const EPS = 1e-14;
	const qab = a + b;
	const qap = a + 1;
	const qam = a - 1;
	let c = 1;
	let d = 1 - (qab * x) / qap;
	if (Math.abs(d) < FPMIN) d = FPMIN;
	d = 1 / d;
	let h = d;
	for (let m = 1; m <= 1000; m++) {
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

/** Regularised incomplete beta function I_x(a, b) for x in [0, 1]. */
export function regIncBeta(x: number, a: number, b: number): number {
	if (x <= 0) return 0;
	if (x >= 1) return 1;
	const bt = Math.exp(
		lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
	);
	if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(a, b, x)) / a;
	return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Upper-tail probability P(T > t) of Student's t distribution with df degrees of freedom, t >= 0. */
function tUpperTail(t: number, df: number): number {
	if (t === Infinity) return 0;
	const x = df / (df + t * t);
	return 0.5 * regIncBeta(x, df / 2, 0.5);
}

/** Cumulative distribution function of Student's t distribution. */
export function tCdf(t: number, df: number): number {
	const upper = tUpperTail(Math.abs(t), df);
	return t >= 0 ? 1 - upper : upper;
}

/** Quantile of Student's t distribution for p in (0, 1), found by bisection on tCdf. */
export function tQuantile(p: number, df: number): number {
	if (!(p > 0 && p < 1) || !(df > 0)) return NaN;
	if (p === 0.5) return 0;
	const target = p > 0.5 ? p : 1 - p;
	// Work with the upper tail: find t >= 0 with P(T > t) = 1 - target.
	const tailWanted = 1 - target;
	let lo = 0;
	let hi = 1;
	while (tUpperTail(hi, df) > tailWanted) hi *= 2;
	for (let i = 0; i < 200; i++) {
		const mid = (lo + hi) / 2;
		if (tUpperTail(mid, df) > tailWanted) lo = mid;
		else hi = mid;
	}
	const q = (lo + hi) / 2;
	return p > 0.5 ? q : -q;
}

// ---------------------------------------------------------------------------
// Least squares
// ---------------------------------------------------------------------------

export interface OlsFit {
	intercept: number;
	slope: number;
	meanX: number;
	meanY: number;
	/** Sum of (x_i - mean x)^2. */
	sxx: number;
}

/** Least squares fit of y = intercept + slope * x. Returns null if the x values are all equal. */
export function fitOls(points: readonly Point[]): OlsFit | null {
	const n = points.length;
	if (n < 2) return null;
	let sx = 0;
	let sy = 0;
	for (const p of points) {
		sx += p.x;
		sy += p.y;
	}
	const meanX = sx / n;
	const meanY = sy / n;
	let sxx = 0;
	let sxy = 0;
	for (const p of points) {
		sxx += (p.x - meanX) * (p.x - meanX);
		sxy += (p.x - meanX) * (p.y - meanY);
	}
	if (sxx === 0) return null;
	const slope = sxy / sxx;
	return { intercept: meanY - slope * meanX, slope, meanX, meanY, sxx };
}

/** Residuals y_i - (intercept + slope * x_i), in the order of the points. */
export function residuals(points: readonly Point[], fit: OlsFit): number[] {
	return points.map((p) => p.y - (fit.intercept + fit.slope * p.x));
}

export interface SlopeAnalysis {
	n: number;
	intercept: number;
	slope: number;
	/** Sum of squared residuals. */
	sse: number;
	/** Degrees of freedom n - 2. */
	df: number;
	/** Residual standard deviation s = sqrt(SSE / df). */
	sigma: number;
	/** Standard error of the slope. */
	se: number;
	/** t statistic of H0: slope = 0. */
	t: number;
	/** Two-sided p-value of H0: slope = 0. */
	p: number;
	/** Critical t value for the confidence interval (1 - ALPHA/2 quantile). */
	tq: number;
	/** Confidence interval for the slope. */
	ci: { lo: number; hi: number };
	meanX: number;
	sxx: number;
}

/**
 * Full analysis of the regression: fit, residuals, slope SE, t, p-value and CI.
 * Returns null when there are fewer than 3 points or all x values are equal (df < 1 or no slope).
 */
export function analyze(points: readonly Point[], alpha: number = ALPHA): SlopeAnalysis | null {
	const n = points.length;
	const fit = fitOls(points);
	if (!fit || n < 3) return null;
	const df = n - 2;
	const res = residuals(points, fit);
	const sse = res.reduce((s, e) => s + e * e, 0);
	const sigma = Math.sqrt(sse / df);
	const se = sigma / Math.sqrt(fit.sxx);
	const t = se === 0 ? (fit.slope === 0 ? 0 : Math.sign(fit.slope) * Infinity) : fit.slope / se;
	const p = se === 0 ? 0 : 2 * tUpperTail(Math.abs(t), df);
	const tq = tQuantile(1 - alpha / 2, df);
	return {
		n,
		intercept: fit.intercept,
		slope: fit.slope,
		sse,
		df,
		sigma,
		se,
		t,
		p,
		tq,
		ci: { lo: fit.slope - tq * se, hi: fit.slope + tq * se },
		meanX: fit.meanX,
		sxx: fit.sxx,
	};
}

/**
 * Half-width of the confidence band for the mean response at x:
 * t_q * s * sqrt(1/n + (x - mean x)^2 / Sxx).
 */
export function bandHalfWidth(a: SlopeAnalysis, x: number): number {
	const dx = x - a.meanX;
	return a.tq * a.sigma * Math.sqrt(1 / a.n + (dx * dx) / a.sxx);
}

/** Clamps a coordinate to the plot domain and rounds it to 0.1 (keeps dragged values readable). */
export function snapX(v: number): number {
	if (!Number.isFinite(v)) return X_MIN;
	return Math.round(Math.min(X_MAX, Math.max(X_MIN, v)) * 10) / 10;
}

export function snapY(v: number): number {
	if (!Number.isFinite(v)) return Y_MIN;
	return Math.round(Math.min(Y_MAX, Math.max(Y_MIN, v)) * 10) / 10;
}

/** Formats a number with a decimal comma, as in Russian text. */
export function fmt(v: number, digits: number = 2): string {
	if (!Number.isFinite(v)) return '—';
	return v.toFixed(digits).replace('.', ',');
}

/** Formats a p-value: values below 0.001 are shown as "< 0,001". */
export function fmtP(p: number): string {
	if (!Number.isFinite(p)) return '—';
	if (p < 0.001) return '< 0,001';
	return fmt(p, 3);
}

/** One-sentence description of the current fit for aria-live. */
export function describeFit(a: SlopeAnalysis | null): string {
	if (!a) {
		return 'Все точки на одной вертикали: наклон не определён. Передвиньте точки так, чтобы их x отличались.';
	}
	const verdict =
		a.p < ALPHA ? 'наклон статистически отличим от нуля' : 'наклон не отличим от нуля';
	return (
		`Наклон ${fmt(a.slope)}, 95%-й интервал [${fmt(a.ci.lo)}; ${fmt(a.ci.hi)}], ` +
		`p-значение ${fmtP(a.p)}: ${verdict} при уровне 0,05. Сумма квадратов остатков ${fmt(a.sse, 3)}.`
	);
}
