/**
 * Math of the random-variable demo: a discrete variable given by non-negative weights on its values.
 * The user edits the weights; probabilities are the weights divided by their total, so they always sum to 1.
 * Pure functions only: no DOM, no Svelte.
 */

export type Preset = 'die' | 'sum';

export interface RandomVariableDemoState {
	/** Which variable is shown: one die, or the sum of two dice. */
	preset: Preset;
}

/** Column weights are integers in this range (one step is one mouse or keyboard unit). */
export const W_MIN = 0;
export const W_MAX = 10;

export interface PresetDef {
	readonly id: Preset;
	readonly label: string;
	/** Possible values, consecutive integers in ascending order. */
	readonly values: readonly number[];
	/** Starting weights. For a fair die all weights are equal; for the sum they are the number of ways. */
	readonly initial: readonly number[];
	/** Short note about the standard columns, shown under the chart. */
	readonly note: string;
}

const SUM_VALUES: readonly number[] = Array.from({ length: 11 }, (_, i) => i + 2);

export const PRESETS: Record<Preset, PresetDef> = {
	die: {
		id: 'die',
		label: 'Один кубик',
		values: [1, 2, 3, 4, 5, 6],
		initial: [1, 1, 1, 1, 1, 1],
		note: 'Все грани равновероятны, столбцы ровные. Ожидание лежит в середине диапазона, на 3.5.',
	},
	sum: {
		id: 'sum',
		label: 'Сумма двух кубиков',
		values: SUM_VALUES,
		initial: [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1],
		note: 'Сумма сосредоточена вокруг семи: это значение получается больше всего способами. Дисперсия суммы вдвое больше, чем у одного кубика.',
	},
};

export function isPreset(v: unknown): v is Preset {
	return v === 'die' || v === 'sum';
}

/** Rounds to an integer and clamps to the weight range. Non-finite input gives W_MIN. */
export function clampWeight(w: number): number {
	if (!Number.isFinite(w)) return W_MIN;
	return Math.min(W_MAX, Math.max(W_MIN, Math.round(w)));
}

export function totalWeight(weights: readonly number[]): number {
	return weights.reduce((s, w) => s + w, 0);
}

export interface Summary {
	/** Probability of each value; sums to 1. */
	probs: number[];
	/** Expected value E[X]. */
	mean: number;
	/** Variance Var(X) = E[(X - E[X])^2]. */
	variance: number;
	/** Standard deviation sqrt(Var(X)). */
	std: number;
}

/**
 * Probabilities, expectation and variance of the variable with the given weights.
 * Returns null when all weights are zero, because the probabilities are then undefined.
 */
export function summarize(values: readonly number[], weights: readonly number[]): Summary | null {
	const total = totalWeight(weights);
	if (!(total > 0)) return null;
	const probs = weights.map((w) => w / total);
	const mean = values.reduce((s, x, i) => s + x * (probs[i] ?? 0), 0);
	const variance = values.reduce((s, x, i) => s + (x - mean) * (x - mean) * (probs[i] ?? 0), 0);
	return { probs, mean, variance, std: Math.sqrt(variance) };
}

/**
 * Returns a copy of the weights with one column set to `value` (rounded and clamped).
 * A change that would make every weight zero is refused, so the distribution always exists.
 */
export function setWeight(weights: readonly number[], index: number, value: number): number[] {
	const next = weights.slice();
	if (index < 0 || index >= next.length) return next;
	const candidate = next.map((w, i) => (i === index ? clampWeight(value) : w));
	return totalWeight(candidate) > 0 ? candidate : next;
}

/** Weight of a column from the pointer's y inside a plot of height `plotH` (y = 0 at the top, baseline at plotH). */
export function weightFromY(y: number, plotH: number): number {
	if (!(plotH > 0)) return W_MIN;
	return clampWeight(((plotH - y) / plotH) * W_MAX);
}

/** Starting weights of a preset, as a fresh array. */
export function initialWeights(preset: Preset): number[] {
	return PRESETS[preset].initial.slice();
}

/** Text of the status line under the chart. Numbers are computed, not typed. */
export function describeState(def: PresetDef, s: Summary | null): string {
	if (!s) {
		return 'Все столбцы нулевые, вероятности не определены. Задайте хотя бы один положительный столбец.';
	}
	const first = def.values[0];
	const last = def.values[def.values.length - 1];
	return (
		`${def.label}: значения от ${first} до ${last}. ` +
		`E[X] = ${s.mean.toFixed(2)}, Var(X) = ${s.variance.toFixed(2)}, σ = ${s.std.toFixed(2)}.`
	);
}
