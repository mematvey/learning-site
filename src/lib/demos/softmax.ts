/**
 * Math of the softmax demo. Pure functions only: no DOM, no Svelte.
 * Five logits z_i, temperature T, and two switches: the stable variant (subtract max) and
 * "big logits" (add a common shift to every logit, which must not change the result).
 */

/** Number of classes (logits) in the demo. */
export const SOFTMAX_SIZE = 5;

export const LOGIT_MIN = -5;
export const LOGIT_MAX = 5;
export const LOGIT_STEP = 0.1;

export const T_MIN = 0.1;
export const T_MAX = 5;
export const T_STEP = 0.1;

/** Common shift added to every logit when "big logits" is on. exp(709) is the double limit. */
export const BIG_SHIFT = 800;

export const DEFAULT_LOGITS: readonly number[] = [2.2, 1.4, 0.3, -0.8, 0];

/** State of `SoftmaxDemo`. Chapter text drives it through `DemoLink` (`set(patch)`). */
export interface SoftmaxDemoState {
	/** Raw logits z_i, SOFTMAX_SIZE values in [LOGIT_MIN, LOGIT_MAX]. */
	logits: number[];
	/** Temperature T in [T_MIN, T_MAX]. */
	temperature: number;
	/** true: subtract max before exp (stable); false: naive exp. */
	stable: boolean;
	/** true: add BIG_SHIFT to every logit before scaling by T. */
	big: boolean;
}

export const DEFAULT_STATE: SoftmaxDemoState = {
	logits: [...DEFAULT_LOGITS],
	temperature: 1,
	stable: true,
	big: false,
};

/** Rounds to the slider step and clamps into [min, max]. Non-finite input gives `min` clamped to 0. */
function snapTo(value: number, min: number, max: number, step: number): number {
	if (!Number.isFinite(value)) return Math.min(max, Math.max(min, 0));
	const snapped = Math.round(value / step) * step;
	// Round to the step's precision to avoid 0.30000000000000004 in the state.
	const fixed = Number(snapped.toFixed(2));
	return Math.min(max, Math.max(min, fixed));
}

export function clampLogit(z: number): number {
	return snapTo(z, LOGIT_MIN, LOGIT_MAX, LOGIT_STEP);
}

export function clampTemperature(t: number): number {
	return snapTo(t, T_MIN, T_MAX, T_STEP);
}

/** Returns clamped logits if the input has exactly SOFTMAX_SIZE entries, otherwise null. */
export function normalizeLogits(xs: readonly unknown[]): number[] | null {
	if (xs.length !== SOFTMAX_SIZE) return null;
	return xs.map((x) => clampLogit(Number(x)));
}

/** Naive softmax: exp(z_i) / sum exp(z_j). Overflows to Infinity for z > ~709. */
export function softmaxNaive(z: readonly number[]): number[] {
	const e = z.map((v) => Math.exp(v));
	const s = sumOf(e);
	return e.map((v) => v / s);
}

/** Stable softmax: subtracts max(z) first; the result is identical mathematically. */
export function softmaxStable(z: readonly number[]): number[] {
	const m = z.reduce((a, b) => Math.max(a, b), -Infinity);
	const e = z.map((v) => Math.exp(v - m));
	const s = sumOf(e);
	return e.map((v) => v / s);
}

export function softmax(z: readonly number[], stable: boolean): number[] {
	return stable ? softmaxStable(z) : softmaxNaive(z);
}

/** Logits as fed to softmax: (z_i + shift) / T. */
export function effectiveLogits(state: SoftmaxDemoState): number[] {
	const shift = state.big ? BIG_SHIFT : 0;
	return state.logits.map((z) => (z + shift) / state.temperature);
}

/** Probabilities p_i for the current state. May contain NaN in the naive variant. */
export function probabilities(state: SoftmaxDemoState): number[] {
	return softmax(effectiveLogits(state), state.stable);
}

export function sumOf(xs: readonly number[]): number {
	return xs.reduce((s, v) => s + v, 0);
}

/** Index of the largest probability (first one on ties); NaN entries are skipped. */
export function argmaxFinite(ps: readonly number[]): number {
	let best = -1;
	let bestVal = -Infinity;
	ps.forEach((p, i) => {
		if (Number.isFinite(p) && p > bestVal) {
			best = i;
			bestVal = p;
		}
	});
	return best;
}

/** Text describing the current state. The component shows it under the chart. */
export function describeSoftmax(state: SoftmaxDemoState): string {
	const ps = probabilities(state);
	if (ps.some((p) => !Number.isFinite(p))) {
		return (
			'Наивный softmax: exp переполнился до Infinity (предел double около e^709), ' +
			'а Infinity / Infinity даёт NaN. Включите устойчивый вариант: максимум вычитается, и сумма снова 1.'
		);
	}
	const top = argmaxFinite(ps);
	const topText = top >= 0 ? `Сильнейший класс z${top + 1}: p = ${(ps[top] ?? 0).toFixed(2)}.` : '';
	if (state.big && !state.stable) {
		return (
			`Большие логиты пока не сломали наивный вариант: при T = ${state.temperature.toFixed(1)} ` +
			`максимум z/T остаётся в пределах double. Уменьшите T, и exp переполнится. ${topText}`
		);
	}
	return `Сумма вероятностей равна 1. Меньшая T делает распределение резче, большая делает его мягче. ${topText}`;
}
