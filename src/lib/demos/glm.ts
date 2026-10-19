/**
 * Math of the GLM demo: Poisson and negative-binomial GLMs fitted by IRLS on a few counts.
 * The variance function is mu + alpha * mu^2 (alpha = 0 gives Poisson).
 * Matrices are flat row-major arrays; the model has one or two coefficients.
 * Pure functions only: no DOM, no Svelte.
 */

/** Feature values of the six observations (x = 1..6). */
export const X_VALUES = [1, 2, 3, 4, 5, 6];
/** Counts of the worked example in the chapter: mean 16/6 = 2,667. */
export const DEFAULT_COUNTS = [0, 1, 1, 2, 4, 8];
export const COUNT_MIN = 0;
export const COUNT_MAX = 20;
export const ALPHA_MIN = 0;
export const ALPHA_MAX = 1;
export const ALPHA_STEP = 0.05;
export const DEFAULT_ALPHA = 0.3;
/** Pearson dispersion above this value is reported as overdispersion. */
export const OVERDISP_THRESHOLD = 1.5;
/** Two-sided 95 % normal quantile. */
export const Z95 = 1.96;

const MU_FLOOR = 1e-6;
const ETA_LIMIT = 30;
const MAX_ITER = 50;
const TOL = 1e-10;
/** Feature value at which the level (mu) is reported. */
const LEVEL_X = X_VALUES[0] ?? 1;

/** Plot geometry in SVG user units (the SVG scales to the container width). */
export const PLOT = {
	W: 360,
	H: 260,
	padL: 40,
	padR: 12,
	padT: 12,
	padB: 32,
	xMin: 0.5,
	xMax: 6.5,
	yMax: 24,
} as const;

/** Grid for the drawn curves and bands. */
export const GRID: number[] = Array.from(
	{ length: 61 },
	(_, i) => PLOT.xMin + (i * (PLOT.xMax - PLOT.xMin)) / 60,
);

export type Link = 'log' | 'identity';

export interface GlmDemoState {
	/** One count per observation, same order as X_VALUES. */
	counts: number[];
	/** Log link (counts) or identity link (plain linear mean). */
	link: Link;
	/** Whether the linear predictor includes the feature x (slope) or only the intercept. */
	slope: boolean;
	/** Extra variance alpha in mu + alpha * mu^2 used by the negative-binomial model. */
	alpha: number;
}

export interface FitOptions {
	slope: boolean;
	link: Link;
	alpha: number;
}

export interface GlmFit {
	opts: FitOptions;
	/** Coefficients: [beta0] or [beta0, beta1]. */
	beta: number[];
	/** Unscaled covariance (X'WX)^-1, row-major; the real covariance is phi * cov. */
	cov: number[];
	/** Fitted mean at each observation. */
	mu: number[];
	/** Pearson dispersion: sum (y - mu)^2 / V(mu) divided by (n - p). */
	phi: number;
	/** False when a fitted mean is not positive (possible with the identity link). */
	valid: boolean;
}

export interface Interval {
	se: number;
	lo: number;
	hi: number;
}

export interface CoefRow {
	name: string;
	value: number;
	seRaw: number;
	seScaled: number;
}

export interface GlmSummary {
	/** Pearson dispersion of the Poisson fit. */
	phi: number;
	/** sqrt(phi): factor by which the Poisson standard errors are too small. */
	factor: number;
	/** Mean at x = 1 (exp(beta0) for the intercept-only log model). */
	level: number;
	/** Interval of the mean at x = 1 without the dispersion correction. */
	levelRaw: Interval;
	/** Interval of the mean at x = 1 with the correction by phi. */
	levelScaled: Interval;
	coefs: CoefRow[];
}

/** One observation of the plot: index, feature value and count. */
export interface PlotPoint {
	index: number;
	x: number;
	value: number;
}

/** Array read that never yields undefined (out-of-range reads give 0). */
function at(a: readonly number[], i: number): number {
	return a[i] ?? 0;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an integer count and clamps to the allowed range. Non-finite input gives 0. */
export function snapCount(v: number): number {
	if (!Number.isFinite(v)) return 0;
	return clamp(Math.round(v), COUNT_MIN, COUNT_MAX);
}

/** Rounds alpha to the slider step and clamps it. Non-finite input gives DEFAULT_ALPHA. */
export function snapAlpha(a: number): number {
	if (!Number.isFinite(a)) return DEFAULT_ALPHA;
	const stepped = Math.round(clamp(a, ALPHA_MIN, ALPHA_MAX) / ALPHA_STEP) * ALPHA_STEP;
	return Math.round(stepped * 100) / 100;
}

export function isLink(v: unknown): v is Link {
	return v === 'log' || v === 'identity';
}

/** Returns a new counts array with one value replaced (snapped). */
export function setCount(counts: number[], i: number, value: number): number[] {
	const next = [...counts];
	next[i] = snapCount(value);
	return next;
}

/** Accepts only an array of the right length; otherwise the default counts. */
export function normalizeCounts(v: unknown): number[] {
	if (!Array.isArray(v) || v.length !== X_VALUES.length) return [...DEFAULT_COUNTS];
	return v.map((c) => snapCount(Number(c)));
}

/** Observations for the plot. */
export function plotPoints(counts: number[]): PlotPoint[] {
	return counts.map((value, index) => ({ index, x: at(X_VALUES, index), value }));
}

/** Formats a number with a decimal comma, as in Russian text. */
export function fmt(n: number, digits = 2): string {
	return n.toFixed(digits).replace('.', ',');
}

function dot(a: readonly number[], b: readonly number[]): number {
	let s = 0;
	for (const [i, v] of a.entries()) s += v * at(b, i);
	return s;
}

/** Inverse of a 1x1 or 2x2 matrix stored row-major (the model has at most two coefficients). */
export function invertSmall(m: readonly number[]): number[] {
	if (m.length === 1) {
		const d = at(m, 0);
		if (Math.abs(d) < 1e-12) throw new Error('singular matrix');
		return [1 / d];
	}
	const a = at(m, 0);
	const b = at(m, 1);
	const c = at(m, 2);
	const d = at(m, 3);
	const det = a * d - b * c;
	if (Math.abs(det) < 1e-12) throw new Error('singular matrix');
	return [d / det, -b / det, -c / det, a / det];
}

/** Variance function V(mu) = mu + alpha * mu^2, with mu floored to keep it positive. */
export function varianceFn(mu: number, alpha: number): number {
	const m = Math.max(mu, MU_FLOOR);
	return m + alpha * m * m;
}

function meanOf(eta: number, link: Link): number {
	if (link === 'identity') return eta;
	return Math.exp(clamp(eta, -ETA_LIMIT, ETA_LIMIT));
}

/** d mu / d eta: mu for the log link, 1 for the identity link. */
function dMuDEta(mu: number, link: Link): number {
	return link === 'log' ? Math.max(mu, MU_FLOOR) : 1;
}

function design(slope: boolean, xv: number): number[] {
	return slope ? [1, xv] : [1];
}

/** Normal equations of one IRLS step: A = X'WX (row-major), b = X'Wz. */
function normalEquations(
	xs: number[],
	y: number[],
	beta: number[],
	opts: FitOptions,
): { A: number[]; b: number[] } {
	const p = beta.length;
	const A = new Array<number>(p * p).fill(0);
	const b = new Array<number>(p).fill(0);
	for (const [i, xi] of xs.entries()) {
		const r = design(opts.slope, xi);
		const eta = dot(r, beta);
		const mu = meanOf(eta, opts.link);
		const d = dMuDEta(mu, opts.link);
		const w = (d * d) / varianceFn(mu, opts.alpha);
		const z = eta + (at(y, i) - mu) / d;
		for (let j = 0; j < p; j++) {
			const rj = at(r, j);
			b[j] = at(b, j) + w * rj * z;
			for (let k = 0; k < p; k++) {
				A[j * p + k] = at(A, j * p + k) + w * rj * at(r, k);
			}
		}
	}
	return { A, b };
}

/** Fits the GLM by iteratively reweighted least squares. */
export function fitGlm(x: number[], y: number[], opts: FitOptions): GlmFit {
	const n = y.length;
	const p = opts.slope ? 2 : 1;
	const mean = y.reduce((s, v) => s + v, 0) / n;
	let beta = new Array<number>(p).fill(0);
	beta[0] = opts.link === 'log' ? Math.log(Math.max(mean, 0.5)) : mean;

	for (let iter = 0; iter < MAX_ITER; iter++) {
		const { A, b } = normalEquations(x, y, beta, opts);
		const inv = invertSmall(A);
		const next = Array.from({ length: p }, (_, j) => dot(inv.slice(j * p, j * p + p), b));
		const delta = Math.max(...next.map((v, j) => Math.abs(v - at(beta, j))));
		beta = next;
		if (!(delta > TOL)) break;
	}

	const { A } = normalEquations(x, y, beta, opts);
	const cov = invertSmall(A);
	const mu: number[] = [];
	let chi2 = 0;
	for (const [i, xi] of x.entries()) {
		const m = meanOf(dot(design(opts.slope, xi), beta), opts.link);
		mu.push(m);
		chi2 += (at(y, i) - m) ** 2 / varianceFn(m, opts.alpha);
	}
	return {
		opts,
		beta,
		cov,
		mu,
		phi: chi2 / (n - p),
		valid: mu.every((m) => m > 0),
	};
}

/** Mean and its interval at feature value xv. The scale multiplies the covariance. */
export function intervalAt(fit: GlmFit, xv: number, scale: number): Interval & { mu: number } {
	const r = design(fit.opts.slope, xv);
	const p = r.length;
	let v = 0;
	for (let j = 0; j < p; j++) {
		for (let k = 0; k < p; k++) v += at(r, j) * at(fit.cov, j * p + k) * at(r, k);
	}
	const mu = meanOf(dot(r, fit.beta), fit.opts.link);
	const se = dMuDEta(mu, fit.opts.link) * Math.sqrt(v * scale);
	return { mu, se, lo: mu - Z95 * se, hi: mu + Z95 * se };
}

/** Fitted mean on a grid of feature values. */
export function curveAt(fit: GlmFit, grid: number[]): number[] {
	return grid.map((xv) => meanOf(dot(design(fit.opts.slope, xv), fit.beta), fit.opts.link));
}

/** 95 % predictive band for one observation: mu +- Z95 * sqrt(V(mu)), lower end not below 0. */
export function predictiveBand(mus: number[], alpha: number): { lo: number[]; hi: number[] } {
	const lo: number[] = [];
	const hi: number[] = [];
	for (const m of mus) {
		const s = Math.sqrt(varianceFn(m, alpha));
		lo.push(Math.max(0, m - Z95 * s));
		hi.push(m + Z95 * s);
	}
	return { lo, hi };
}

/** Summary of the Poisson fit: level at x = 1, intervals with and without the phi correction. */
export function summarize(fitP: GlmFit): GlmSummary {
	const phi = fitP.phi;
	const p = fitP.beta.length;
	const levelRaw = intervalAt(fitP, LEVEL_X, 1);
	const levelScaled = intervalAt(fitP, LEVEL_X, phi);
	const names = fitP.opts.slope ? ['β₀', 'β₁'] : ['β₀'];
	const coefs: CoefRow[] = names.map((name, j) => ({
		name,
		value: at(fitP.beta, j),
		seRaw: Math.sqrt(at(fitP.cov, j * p + j)),
		seScaled: Math.sqrt(at(fitP.cov, j * p + j) * phi),
	}));
	return {
		phi,
		factor: Math.sqrt(Math.max(phi, 0)),
		level: levelRaw.mu,
		levelRaw: { se: levelRaw.se, lo: levelRaw.lo, hi: levelRaw.hi },
		levelScaled: { se: levelScaled.se, lo: levelScaled.lo, hi: levelScaled.hi },
		coefs,
	};
}

/** Text of the «Что заметить» block: cause (dispersion) and effect (standard errors). */
export function describeGlm(fitP: GlmFit, fitN: GlmFit, summary: GlmSummary): string {
	const parts: string[] = [];
	if (!fitP.valid) {
		parts.push(
			'Тождественная связь дала неположительное среднее: для счётчика такая модель бессмысленна, нужна логарифмическая связь.',
		);
	}
	if (summary.phi > OVERDISP_THRESHOLD) {
		parts.push(
			`Переразброс: φ̂ = ${fmt(summary.phi)}. Пуассоновская модель занижает стандартные ошибки в √φ̂ = ${fmt(summary.factor)} раза, поэтому интервал с поправкой заметно шире.`,
		);
	} else {
		parts.push(
			`φ̂ = ${fmt(summary.phi)} близко к 1: допущение «дисперсия равна среднему» не опровергнуто.`,
		);
	}
	const closeToOne = Math.abs(fitN.phi - 1) < 0.2;
	parts.push(
		`Отрицательно-биномиальная модель с α = ${fmt(fitN.opts.alpha)} даёт φ̂ = ${fmt(fitN.phi)}${closeToOne ? ', это близко к 1' : ''}.`,
	);
	return parts.join(' ');
}

/** Maps a feature value to an SVG x coordinate. */
export function xToPx(xv: number): number {
	return (
		PLOT.padL + ((xv - PLOT.xMin) / (PLOT.xMax - PLOT.xMin)) * (PLOT.W - PLOT.padL - PLOT.padR)
	);
}

/** Maps a count value to an SVG y coordinate, clamped to the plot. */
export function yToPx(v: number): number {
	const c = clamp(v, 0, PLOT.yMax);
	return PLOT.H - PLOT.padB - (c / PLOT.yMax) * (PLOT.H - PLOT.padT - PLOT.padB);
}

/** Maps an SVG y coordinate back to a count value (unrounded). */
export function pxToValue(py: number): number {
	return ((PLOT.H - PLOT.padB - py) / (PLOT.H - PLOT.padT - PLOT.padB)) * PLOT.yMax;
}

/** SVG polyline path through (grid, values). */
export function linePath(grid: number[], values: number[]): string {
	return grid
		.map(
			(xv, i) => `${i === 0 ? 'M' : 'L'}${xToPx(xv).toFixed(1)},${yToPx(at(values, i)).toFixed(1)}`,
		)
		.join(' ');
}

/** SVG closed path of the band between lower and upper values. */
export function bandPath(grid: number[], lo: number[], hi: number[]): string {
	const top = grid.map(
		(xv, i) => `${i === 0 ? 'M' : 'L'}${xToPx(xv).toFixed(1)},${yToPx(at(hi, i)).toFixed(1)}`,
	);
	const bottom = grid.map((_, i) => {
		const k = grid.length - 1 - i;
		return `L${xToPx(at(grid, k)).toFixed(1)},${yToPx(at(lo, k)).toFixed(1)}`;
	});
	return `${top.join(' ')} ${bottom.join(' ')} Z`;
}
