/**
 * Math of the regularisation demo: a dropout mask over one layer and synthetic learning curves
 * that react to the dropout rate `p` and the weight decay `wd`.
 * The curves are an illustration of the trends, not a measured training run.
 * The mask is deterministic for a given step (seeded PRNG), so every page load shows the same masks.
 * Pure functions only: no DOM, no Svelte.
 */

/** Neurons in the drawn layer. */
export const N_NEURONS = 12;
/** Training epochs on the curves: the x axis runs from 0 to EPOCHS. */
export const EPOCHS = 60;

export const P_MIN = 0;
export const P_MAX = 0.8;
export const P_STEP = 0.1;
export const WD_MIN = 0;
export const WD_MAX = 0.1;
export const WD_STEP = 0.01;

/** Initial state of the demo (also the state after reset). */
export const DEFAULT_P = 0.3;
export const DEFAULT_WD = 0.03;
export const DEFAULT_STEP = 0;
export const DEFAULT_SCALED = true;
/** Number of masks averaged to estimate the expected layer output. */
export const AVG_MASKS = 400;

const MASK_SEED = 20260;

export interface DropoutDemoState {
	/** Share of neurons dropped on one step, in [P_MIN, P_MAX]. */
	p: number;
	/** Weight decay coefficient λ, in [WD_MIN, WD_MAX]. */
	wd: number;
	/** Index of the mask (training step). Each step draws a new mask. */
	step: number;
	/** Whether kept neurons are multiplied by 1/(1 - p) (inverted dropout). */
	scaled: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to the slider step and clamps to the range. Non-finite input gives the default. */
export function snapP(p: number): number {
	if (!Number.isFinite(p)) return DEFAULT_P;
	return Math.round(clamp(p, P_MIN, P_MAX) * 10) / 10;
}

/** Rounds to the slider step and clamps to the range. Non-finite input gives the default. */
export function snapWd(wd: number): number {
	if (!Number.isFinite(wd)) return DEFAULT_WD;
	return Math.round(clamp(wd, WD_MIN, WD_MAX) * 100) / 100;
}

/** Non-negative integer step. Non-finite input gives 0. */
export function snapStep(step: number): number {
	if (!Number.isFinite(step)) return DEFAULT_STEP;
	return Math.max(0, Math.floor(step));
}

/** Small seeded PRNG (mulberry32). Returns numbers in [0, 1). */
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

/**
 * Dropout mask of one step: `true` means the neuron is kept, `false` means it is dropped.
 * Each neuron is dropped independently with probability `p`. The same step always gives the same mask.
 */
export function dropoutMask(n: number, p: number, step: number, seed = MASK_SEED): boolean[] {
	const rnd = mulberry32(seed + snapStep(step) * 7919);
	const keep: boolean[] = [];
	for (let i = 0; i < n; i++) keep.push(rnd() >= p);
	return keep;
}

/** Factor applied to kept neurons during training: 1 / (1 - p). */
export function keepScale(p: number): number {
	return 1 / (1 - clamp(p, 0, 0.99));
}

/**
 * Average output of a layer of ones over `AVG_MASKS` masks: a neuron gives 1/(1 - p) when kept
 * and scaled, 1 when kept and unscaled, 0 when dropped. With scaling the mean is close to 1.
 */
export function averageOutput(p: number, scaled: boolean, n: number = N_NEURONS): number {
	const f = scaled ? keepScale(p) : 1;
	let total = 0;
	for (let step = 0; step < AVG_MASKS; step++) {
		const keep = dropoutMask(n, p, step);
		total += keep.filter(Boolean).length * f;
	}
	return total / (AVG_MASKS * n);
}

/** Share of kept neurons in a mask. */
export function keptFraction(keep: readonly boolean[]): number {
	if (keep.length === 0) return 1;
	return keep.filter(Boolean).length / keep.length;
}

/** Strength of the regularisation in [0, 0.9]: both knobs push it up, the cap keeps the model learnable. */
export function regStrength(p: number, wd: number): number {
	return Math.min(0.9, 1.5 * p + 3 * wd);
}

/** Shared decrease of the loss with training time (the fit to the signal). */
function signalLoss(t: number): number {
	return 0.1 + 0.9 * Math.exp(-t / 8);
}

/** Growth of the overfitting term after the epoch where the model starts to memorise. */
function overfitTerm(t: number): number {
	return 0.02 * Math.max(0, t - 6);
}

/** Training loss: dropout noise and weight decay add a constant offset, the signal part decreases. */
export function trainLoss(t: number, p: number, wd: number): number {
	return signalLoss(t) + 0.5 * p + 2 * wd;
}

/**
 * Validation loss: regularisation reduces the overfitting term, while too much of it
 * (large p or wd) adds an underfitting penalty at every epoch.
 */
export function valLoss(t: number, p: number, wd: number): number {
	const reg = regStrength(p, wd);
	return signalLoss(t) + overfitTerm(t) * (1 - reg) + 0.6 * p * p + 8 * wd * wd;
}

export interface LossCurves {
	/** Epochs 0..EPOCHS. */
	epochs: number[];
	train: number[];
	val: number[];
}

/** Both curves for the given settings, one value per epoch. */
export function lossCurves(p: number, wd: number): LossCurves {
	const epochs: number[] = [];
	const train: number[] = [];
	const val: number[] = [];
	for (let t = 0; t <= EPOCHS; t++) {
		epochs.push(t);
		train.push(trainLoss(t, p, wd));
		val.push(valLoss(t, p, wd));
	}
	return { epochs, train, val };
}

/** Index of the smallest validation loss: the point where early stopping would keep the weights. */
export function bestEpoch(val: readonly number[]): number {
	let best = 0;
	for (let i = 1; i < val.length; i++) if ((val[i] ?? Infinity) < (val[best] ?? Infinity)) best = i;
	return best;
}

/** Gap between the validation and the training loss at the last epoch. */
export function finalGap(p: number, wd: number): number {
	return valLoss(EPOCHS, p, wd) - trainLoss(EPOCHS, p, wd);
}

/** Short Russian description of the state for the live region. */
export function describeState(state: DropoutDemoState): string {
	const keep = dropoutMask(N_NEURONS, state.p, state.step);
	const dropped = keep.filter((k) => !k).length;
	const best = bestEpoch(lossCurves(state.p, state.wd).val);
	return (
		`Шаг ${state.step + 1}: выключено ${dropped} из ${N_NEURONS} нейронов, ` +
		(state.scaled
			? `оставшиеся умножаются на ${keepScale(state.p).toFixed(2)}. `
			: 'масштабирование выключено, оставшиеся не меняются. ') +
		`Минимум ошибки на валидации на эпохе ${best}.`
	);
}
