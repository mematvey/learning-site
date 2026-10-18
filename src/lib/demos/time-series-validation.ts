/**
 * Math of the time-series split demo: twelve points and three ways to split them into train and test.
 * The model is a straight line fitted on the training points and extended to the test points.
 * Pure functions only: no DOM, no Svelte.
 */

export const N = 12;
export const N_SPLITS = 3;
export const TEST_SIZE = 2;
/** Length of the training window in the sliding mode. */
export const TRAIN_SIZE = 6;

export const SPLIT_MODES = ['random', 'time', 'sliding'] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export interface TimeSplitDemoState {
	/** Which way the points are split into train and test. */
	mode: SplitMode;
	/** Split number, from 1 to N_SPLITS. */
	fold: number;
}

export const MODE_LABELS: Record<SplitMode, string> = {
	random: 'Случайное разбиение',
	time: 'По времени',
	sliding: 'Скользящее окно',
};

export const MODE_NOTES: Record<SplitMode, string> = {
	random:
		'Тестовые точки разбросаны по всему ряду. Обучение стоит и до, и после каждой из них, поэтому модель видит будущее относительно теста.',
	time: 'Обучение всегда левее теста: растёт от начала ряда. Оценка честная, но тест дальше от обучения и ошибка больше.',
	sliding: 'Обучение фиксированной длины едет вперёд вместе с тестом. Старые точки отбрасываются.',
};

/** Values of the series at indices 0..11: a rising trend with some noise. */
export const SERIES: readonly number[] = [10, 12, 11, 15, 14, 16, 13, 18, 17, 15, 19, 20];

/** Test indices of the three random folds: disjoint and scattered over the whole series. */
const RANDOM_TESTS: readonly (readonly number[])[] = [
	[2, 8],
	[4, 10],
	[1, 6],
];

export interface Split {
	train: number[];
	test: number[];
}

export interface TestPoint {
	/** Index of the point in the series. */
	t: number;
	/** Value predicted by the model. */
	pred: number;
	/** Real value of the series. */
	actual: number;
}

export interface FoldScore {
	split: Split;
	points: TestPoint[];
	/** Mean absolute error on the test points of this split. */
	mae: number;
}

export function isSplitMode(v: unknown): v is SplitMode {
	return v === 'random' || v === 'time' || v === 'sliding';
}

/** Rounds to an integer and clamps to 1..N_SPLITS. Non-finite input gives 1. */
export function clampFold(f: number): number {
	if (!Number.isFinite(f)) return 1;
	return Math.min(N_SPLITS, Math.max(1, Math.round(f)));
}

function indices(from: number, count: number): number[] {
	return Array.from({ length: count }, (_, j) => from + j);
}

/** Train and test indices of one split. The fold number must already be clamped. */
export function splitFor(mode: SplitMode, fold: number): Split {
	const k = clampFold(fold) - 1;
	if (mode === 'random') {
		const test = [...(RANDOM_TESTS[k] ?? [])];
		const train = indices(0, N).filter((i) => !test.includes(i));
		return { train, test };
	}
	// The test blocks go to the end of the series, one after another.
	const start = N - N_SPLITS * TEST_SIZE + k * TEST_SIZE;
	const test = indices(start, TEST_SIZE);
	const from = mode === 'time' ? 0 : start - TRAIN_SIZE;
	const train = indices(from, start - from);
	return { train, test };
}

/** Value of the series at index t. Indices come from splitFor, so a missing point is a bug. */
function valueAt(t: number): number {
	const v = SERIES[t];
	if (v === undefined) throw new RangeError(`no point ${t} in the series`);
	return v;
}

/** Least-squares line y = a + b * t fitted on the training points. */
export function fitLine(train: readonly number[]): { a: number; b: number } {
	const n = train.length;
	const mt = train.reduce((s, t) => s + t, 0) / n;
	const my = train.reduce((s, t) => s + valueAt(t), 0) / n;
	let num = 0;
	let den = 0;
	for (const t of train) {
		num += (t - mt) * (valueAt(t) - my);
		den += (t - mt) * (t - mt);
	}
	const b = den === 0 ? 0 : num / den;
	return { a: my - b * mt, b };
}

/** Fits the model on the split's training points and scores it on the test points. */
export function scoreSplit(split: Split): FoldScore {
	const { a, b } = fitLine(split.train);
	const points = split.test.map((t) => ({ t, pred: a + b * t, actual: valueAt(t) }));
	const mae = points.reduce((s, p) => s + Math.abs(p.actual - p.pred), 0) / points.length;
	return { split, points, mae };
}

/** Score of one split of one mode. The fold number is clamped first. */
export function scoreFold(mode: SplitMode, fold: number): FoldScore {
	return scoreSplit(splitFor(mode, fold));
}

/** Mean of the MAE over all N_SPLITS splits of the mode. */
export function modeMae(mode: SplitMode): number {
	let sum = 0;
	for (let f = 1; f <= N_SPLITS; f++) sum += scoreFold(mode, f).mae;
	return sum / N_SPLITS;
}

/** Compact range text like "0–5" for a list of consecutive indices, or "нет" when empty. */
export function rangeText(xs: readonly number[]): string {
	if (xs.length === 0) return 'нет';
	const sorted = [...xs].sort((p, q) => p - q);
	const first = sorted[0] ?? 0;
	const last = sorted[sorted.length - 1] ?? first;
	if (last - first + 1 === sorted.length) return first === last ? `${first}` : `${first}–${last}`;
	return sorted.join(', ');
}

/** One sentence for the aria-live region: the mode, the split and the score. */
export function describeSplit(mode: SplitMode, fold: number): string {
	const k = clampFold(fold);
	const s = splitFor(mode, k);
	const score = scoreSplit(s);
	return (
		`${MODE_LABELS[mode]}, разбиение ${k} из ${N_SPLITS}. ` +
		`Обучение: точки ${rangeText(s.train)}. Тест: точки ${rangeText(s.test)}. ` +
		`Средняя ошибка на тесте ${score.mae.toFixed(2)}.`
	);
}
