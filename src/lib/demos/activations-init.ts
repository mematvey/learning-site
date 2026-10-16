/**
 * Math of the activation and initialisation demo: activation functions and their slopes,
 * and a seeded simulation of a deep stack of dense layers (no bias) with Xavier or He weights.
 * The same seed is used for every configuration, so the demo is deterministic and the
 * curves for different initialisations differ only by the weight scale.
 * Pure functions only: no DOM, no Svelte.
 */

import { mulberry32 } from '../prob/rng';

export const ACT_KINDS = ['sigmoid', 'tanh', 'relu'] as const;
export type ActKind = (typeof ACT_KINDS)[number];

export const INIT_KINDS = ['xavier', 'he'] as const;
export type InitKind = (typeof INIT_KINDS)[number];

export const ACT_LABEL: Record<ActKind, string> = {
	sigmoid: 'сигмоида',
	tanh: 'tanh',
	relu: 'ReLU',
};

export const INIT_LABEL: Record<InitKind, string> = {
	xavier: 'Xavier',
	he: 'He',
};

/** Allowed layer widths (n_in = n_out = n). Powers of two keep the slider evenly spaced. */
export const WIDTHS = [16, 32, 64, 128, 256] as const;
/** Number of dense layers in the simulated stack. */
export const DEPTH = 10;
/** Input vectors per simulation: averages over batch × width values per layer. */
export const BATCH = 32;
/** Fixed seed: every page load shows the same picture. */
export const SEED = 20260601;

/** Histogram domain is [-HIST_RANGE, HIST_RANGE]; values outside go to the edge bins. */
export const HIST_RANGE = 3;
export const HIST_BINS = 24;

/** Range of the activation chart on the x axis. */
export const CURVE_MIN = -4;
export const CURVE_MAX = 4;
export const CURVE_POINTS = 161;

/** Variance chart: log10 of E[a²], clamped below at LOG_MIN. */
export const LOG_MIN = -4;
export const LOG_MAX = 1;

export interface ActivationInitDemoState {
	/** Activation function in both charts. */
	act: ActKind;
	/** Initialisation whose histogram is shown; both are always drawn in the variance chart. */
	init: InitKind;
	/** Layer whose histogram is shown, 1..DEPTH. */
	layer: number;
	/** Layer width n, one of WIDTHS. */
	width: number;
}

export const DEFAULT_STATE: ActivationInitDemoState = {
	act: 'relu',
	init: 'xavier',
	layer: DEPTH,
	width: 128,
};

export function isActKind(v: unknown): v is ActKind {
	return v === 'sigmoid' || v === 'tanh' || v === 'relu';
}

export function isInitKind(v: unknown): v is InitKind {
	return v === 'xavier' || v === 'he';
}

/** Rounds to an integer and clamps to 1..DEPTH. Non-finite input gives 1. */
export function snapLayer(l: number): number {
	if (!Number.isFinite(l)) return 1;
	return Math.min(DEPTH, Math.max(1, Math.round(l)));
}

/** Nearest allowed width. Non-finite input gives the default width. */
export function snapWidth(w: number): number {
	if (!Number.isFinite(w)) return DEFAULT_STATE.width;
	let best: number = WIDTHS[0];
	for (const c of WIDTHS) {
		if (Math.abs(c - w) < Math.abs(best - w)) best = c;
	}
	return best;
}

export function sigmoid(z: number): number {
	return 1 / (1 + Math.exp(-z));
}

/** Activation function f(z). */
export function activate(kind: ActKind, z: number): number {
	if (kind === 'sigmoid') return sigmoid(z);
	if (kind === 'tanh') return Math.tanh(z);
	return z > 0 ? z : 0;
}

/** Derivative f'(z). For ReLU the value at exactly z = 0 is taken as 0. */
export function slope(kind: ActKind, z: number): number {
	if (kind === 'sigmoid') {
		const s = sigmoid(z);
		return s * (1 - s);
	}
	if (kind === 'tanh') {
		const t = Math.tanh(z);
		return 1 - t * t;
	}
	return z > 0 ? 1 : 0;
}

export interface CurveSample {
	z: number;
	f: number;
	d: number;
}

/** Samples f and f' on [CURVE_MIN, CURVE_MAX] with CURVE_POINTS evenly spaced points. */
export function curve(kind: ActKind): CurveSample[] {
	const out: CurveSample[] = [];
	const step = (CURVE_MAX - CURVE_MIN) / (CURVE_POINTS - 1);
	for (let i = 0; i < CURVE_POINTS; i++) {
		const z = CURVE_MIN + i * step;
		out.push({ z, f: activate(kind, z), d: slope(kind, z) });
	}
	return out;
}

/** Symmetric-free vertical domain of the activation chart: contains f, f' and the zero line. */
export function curveDomain(kind: ActKind): [number, number] {
	let lo = 0;
	let hi = 1;
	for (const p of curve(kind)) {
		lo = Math.min(lo, p.f, p.d);
		hi = Math.max(hi, p.f, p.d);
	}
	return [lo - 0.05, hi + 0.05];
}

/**
 * Variance of the weights. Xavier (Glorot): 2 / (n_in + n_out). He: 2 / n_in.
 * Both are the formulas of the chapter; the demo uses n_in = n_out = width.
 */
export function initVariance(init: InitKind, nIn: number, nOut: number): number {
	return init === 'xavier' ? 2 / (nIn + nOut) : 2 / nIn;
}

/** Standard normal sample by the Box–Muller transform. Guards against log(0). */
function gauss(rng: () => number): number {
	let u = 0;
	while (u === 0) u = rng();
	const v = rng();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface LayerStats {
	/** Mean of the values over batch × width. */
	mean: number;
	/** Standard deviation of the values. */
	std: number;
	/** Second moment E[a²]: the quantity the chapter's formulas track. */
	secondMoment: number;
}

export interface Simulation {
	/** stats[0] is the input, stats[l] is the output of layer l (1..depth). */
	stats: LayerStats[];
	/** values[l] are all outputs of layer l, flattened batch × width; values[0] is the input. */
	values: Float64Array[];
}

function statsOf(a: Float64Array): LayerStats {
	let sum = 0;
	let sq = 0;
	for (const v of a) {
		sum += v;
		sq += v * v;
	}
	const n = a.length || 1;
	const mu = sum / n;
	return {
		mean: mu,
		std: Math.sqrt(Math.max(0, sq / n - mu * mu)),
		secondMoment: sq / n,
	};
}

/**
 * Forward pass through `depth` dense layers a_l = f(W_l a_{l-1}) with zero bias.
 * Input: standard normal, so E[x²] = 1. Weights: normal with variance from `initVariance`.
 * The random draws do not depend on `act` or `init`, so only the scale and the activation differ.
 */
export function simulate(
	act: ActKind,
	init: InitKind,
	width: number,
	depth: number = DEPTH,
	batch: number = BATCH,
	seed: number = SEED,
): Simulation {
	const rng = mulberry32(seed);
	const n = width;
	const weightStd = Math.sqrt(initVariance(init, n, n));

	let a = new Float64Array(batch * n);
	for (let k = 0; k < a.length; k++) a[k] = gauss(rng);
	const values: Float64Array[] = [a];
	const stats: LayerStats[] = [statsOf(a)];

	for (let l = 1; l <= depth; l++) {
		const w = new Float64Array(n * n);
		for (let k = 0; k < w.length; k++) w[k] = weightStd * gauss(rng);
		const next = new Float64Array(batch * n);
		for (let b = 0; b < batch; b++) {
			const row = b * n;
			for (let j = 0; j < n; j++) {
				let z = 0;
				const wrow = j * n;
				for (let i = 0; i < n; i++) z += (w[wrow + i] ?? 0) * (a[row + i] ?? 0);
				next[row + j] = activate(act, z);
			}
		}
		a = next;
		values.push(a);
		stats.push(statsOf(a));
	}
	return { stats, values };
}

/**
 * Average multiplier of E[a²] per layer between layer 1 and `layer`:
 * (E[a²]_layer / E[a²]_1)^(1 / (layer − 1)). Returns 1 for layer 1.
 */
export function perLayerFactor(stats: readonly LayerStats[], layer: number): number {
	if (layer <= 1) return 1;
	const first = Math.max(stats[1]?.secondMoment ?? 0, 1e-300);
	const last = Math.max(stats[layer]?.secondMoment ?? 0, 1e-300);
	return Math.pow(last / first, 1 / (layer - 1));
}

export interface Histogram {
	/** Share of values per bin, sums to 1 (0 for empty input). */
	fractions: number[];
	/** Share of values with |a| > HIST_RANGE; they are counted in the edge bins. */
	outside: number;
}

/** Fixed-domain histogram: [-range, range] split into `bins` bins, outliers go to the edges. */
export function histogram(
	values: ArrayLike<number>,
	range: number = HIST_RANGE,
	bins: number = HIST_BINS,
): Histogram {
	const counts = new Array<number>(bins).fill(0);
	const n = values.length;
	let outside = 0;
	const width = (2 * range) / bins;
	for (let k = 0; k < n; k++) {
		const v = values[k] ?? 0;
		if (Math.abs(v) > range) outside++;
		const idx = Math.min(bins - 1, Math.max(0, Math.floor((v + range) / width)));
		counts[idx] = (counts[idx] ?? 0) + 1;
	}
	return {
		fractions: counts.map((c) => (n > 0 ? c / n : 0)),
		outside: n > 0 ? outside / n : 0,
	};
}

/** log10 of E[a²], clamped to [LOG_MIN, LOG_MAX] for the variance chart. */
export function logSecondMoment(e: number): number {
	return Math.min(LOG_MAX, Math.max(LOG_MIN, Math.log10(Math.max(e, 10 ** LOG_MIN))));
}

/** Short note under the charts: what the current pair of activation and initialisation does. */
export function noteFor(act: ActKind, init: InitKind): string {
	if (act === 'relu') {
		return init === 'xavier'
			? 'Для ReLU с Xavier множитель около 1/2: половина значений обнуляется, и E[a²] теряет половину на каждом слое.'
			: 'Для ReLU с He множитель около 1: E[a²] сохраняется от слоя к слою.';
	}
	if (act === 'tanh') {
		return init === 'xavier'
			? 'Для tanh с Xavier масштаб сигнала тоже падает от слоя к слою, медленнее, чем у ReLU с Xavier.'
			: 'Для tanh с He масштаб сигнала держится выше, чем с Xavier, но производная около больших |z| близка к нулю.';
	}
	return 'Для сигмоиды выходы положительны и сдвинуты к 0.5: сигнал не уходит в ноль, но производная не больше 1/4, и градиент проходит слабо.';
}

/**
 * Text of the live region: numbers are computed for the chosen layer and initialisation.
 * `sim` is the simulation for `state.act` and `state.init`.
 */
export function describeState(state: ActivationInitDemoState, sim: Simulation): string {
	const s = sim.stats[state.layer] ?? sim.stats[0];
	if (!s) return '';
	const head =
		`Слой ${state.layer} из ${DEPTH}, ${ACT_LABEL[state.act]}, ${INIT_LABEL[state.init]}: ` +
		`E[a²] = ${s.secondMoment.toFixed(3)}, σ = ${s.std.toFixed(3)}.`;
	if (state.layer === 1) return head;
	const f = perLayerFactor(sim.stats, state.layer);
	return `${head} От слоя 1 до слоя ${state.layer} в среднем ×${f.toFixed(2)} на слой.`;
}
