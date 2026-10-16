/**
 * Math of the LayerNorm demo: one token's activation vector before and after normalisation.
 * The demo uses a scalar γ and β shared by all features (the lab uses per-feature vectors).
 * The vector is fixed (deterministic), so every page load shows the same picture.
 * Pure functions only: no DOM, no Svelte.
 */

export const D_FEATURES = 16;
/** Stabiliser under the square root; the same value is used by the lab defaults. */
export const EPS = 1e-5;

export const GAMMA_MIN = 0.2;
export const GAMMA_MAX = 3;
export const GAMMA_STEP = 0.1;
export const BETA_MIN = -2;
export const BETA_MAX = 2;
export const BETA_STEP = 0.1;

export type NormKind = 'layer' | 'rms';

export interface LayerNormDemoState {
	/** Which normalisation is applied to the vector. */
	norm: NormKind;
	/** Scale γ, shared by all features. */
	gamma: number;
	/** Shift β, shared by all features. Ignored by RMSNorm (it has no shift). */
	beta: number;
}

export function isNormKind(v: unknown): v is NormKind {
	return v === 'layer' || v === 'rms';
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to one decimal and clamps to the γ slider range. Non-finite input gives 1. */
export function snapGamma(g: number): number {
	if (!Number.isFinite(g)) return 1;
	return Math.round(clamp(g, GAMMA_MIN, GAMMA_MAX) * 10) / 10;
}

/** Rounds to one decimal and clamps to the β slider range. Non-finite input gives 0. */
export function snapBeta(b: number): number {
	if (!Number.isFinite(b)) return 0;
	return Math.round(clamp(b, BETA_MIN, BETA_MAX) * 10) / 10;
}

/**
 * Activations of one token: a smooth pattern around 2 with one strong outlier (feature 6),
 * which is what makes normalisation visible in the chart.
 */
export function makeToken(d: number = D_FEATURES): number[] {
	const x: number[] = [];
	for (let i = 0; i < d; i++) {
		let v = 2 + 1.4 * Math.sin(1.7 * i + 0.3) + 0.8 * Math.cos(3.1 * i);
		if (i === 5) v += 3;
		x.push(v);
	}
	return x;
}

export function mean(xs: readonly number[]): number {
	if (xs.length === 0) return 0;
	return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/** Population variance (divides by d), as in LayerNorm. Two-pass for numerical stability. */
export function variance(xs: readonly number[]): number {
	const mu = mean(xs);
	return mean(xs.map((v) => (v - mu) * (v - mu)));
}

/** Root mean square: sqrt(mean(x²)). */
export function rms(xs: readonly number[]): number {
	return Math.sqrt(mean(xs.map((v) => v * v)));
}

/**
 * LayerNorm over the feature axis: y = γ·(x − μ)/√(σ² + ε) + β.
 * Mean and variance are computed over the features of one token.
 */
export function layerNorm(x: readonly number[], gamma: number, beta: number, eps = EPS): number[] {
	const mu = mean(x);
	const inv = 1 / Math.sqrt(variance(x) + eps);
	return x.map((v) => gamma * (v - mu) * inv + beta);
}

/** RMSNorm: y = γ·x/√(mean(x²) + ε). No centring and no shift. */
export function rmsNorm(x: readonly number[], gamma: number, eps = EPS): number[] {
	const inv = 1 / Math.sqrt(mean(x.map((v) => v * v)) + eps);
	return x.map((v) => gamma * v * inv);
}

/** Output of the chosen normalisation for the current γ and β. */
export function normalize(
	kind: NormKind,
	x: readonly number[],
	gamma: number,
	beta: number,
): number[] {
	return kind === 'layer' ? layerNorm(x, gamma, beta) : rmsNorm(x, gamma);
}

export interface VectorStats {
	mean: number;
	std: number;
	rms: number;
}

export function vectorStats(xs: readonly number[]): VectorStats {
	return { mean: mean(xs), std: Math.sqrt(variance(xs)), rms: rms(xs) };
}

/** Largest absolute value over the given vectors, with headroom, never below 1. */
export function domainMax(...vectors: ReadonlyArray<readonly number[]>): number {
	let m = 0;
	for (const xs of vectors) for (const v of xs) m = Math.max(m, Math.abs(v));
	return Math.max(1, m * 1.12);
}

export interface Bar {
	x: number;
	y: number;
	w: number;
	h: number;
	value: number;
}

export interface BarLayout {
	bars: Bar[];
	/** Pixel y of value 0. */
	zeroY: number;
	/** Pixels per unit of value. */
	scale: number;
}

export const PLOT_H = 170;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

/**
 * Bar geometry for a signed vector in a box `width` × PLOT_H. The value domain is symmetric
 * `[-domain, domain]`, so two charts with the same domain are comparable.
 */
export function barLayout(values: readonly number[], width: number, domain: number): BarLayout {
	const usable = PLOT_H - PAD_TOP - PAD_BOTTOM;
	const scale = usable / 2 / domain;
	const zeroY = PAD_TOP + usable / 2;
	const n = values.length || 1;
	const slot = width / n;
	const bars = values.map((value, i) => {
		const h = Math.abs(value) * scale;
		return {
			x: i * slot + slot * 0.15,
			w: slot * 0.7,
			y: value >= 0 ? zeroY - h : zeroY,
			h,
			value,
		};
	});
	return { bars, zeroY, scale };
}

/** Pixel y of a value inside a layout. */
export function valueY(value: number, layout: BarLayout): number {
	return layout.zeroY - value * layout.scale;
}

/** Text of the description line under the charts. Numbers are computed, not typed. */
export function describeNorm(
	kind: NormKind,
	x: readonly number[],
	y: readonly number[],
	gamma: number,
	beta: number,
): string {
	const sx = vectorStats(x);
	const sy = vectorStats(y);
	if (kind === 'layer') {
		return (
			`До: μ = ${sx.mean.toFixed(2)}, σ = ${sx.std.toFixed(2)}. ` +
			`После: μ = ${sy.mean.toFixed(2)} (равно β = ${beta.toFixed(1)}), ` +
			`σ = ${sy.std.toFixed(2)} (равно γ = ${gamma.toFixed(1)}). ` +
			'Выброс по признаку 6 теперь не может растянуть остальные.'
		);
	}
	return (
		`До: RMS = ${sx.rms.toFixed(2)}. После: RMS = ${sy.rms.toFixed(2)} (равно γ = ${gamma.toFixed(1)}). ` +
		`Среднее не обнуляется: μ = ${sy.mean.toFixed(2)}. Сдвига β у RMSNorm нет.`
	);
}
