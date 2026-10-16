/**
 * Math of the experiment tracking demo: a table of training runs, sorting, best-run search,
 * filtering by a metric threshold and normalisation for parallel coordinates.
 * Pure functions only: no DOM, no Svelte.
 *
 * The runs are simulated. Each run draws its hyperparameters at random and gets its metrics
 * from a made-up response surface plus uniform noise. The numbers show the workflow; they are not measurements.
 */

import { mulberry32 } from './attention';

export const RUN_COUNT = 12;
export const RUN_SEED = 20241001;
export const BATCH_SIZES: readonly number[] = [16, 32, 64, 128, 256];
export const LAYERS_MIN = 1;
export const LAYERS_MAX = 4;
/** Learning rate is drawn on a log10 scale in [LOG_LR_MIN, LOG_LR_MAX]. */
export const LOG_LR_MIN = -4;
export const LOG_LR_MAX = -1;
export const DROPOUT_STEPS: readonly number[] = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
/** Half-width of the uniform noise added to val_acc. */
export const ACC_NOISE = 0.006;

export const MIN_ACC_MIN = 0.8;
export const MIN_ACC_MAX = 0.95;
export const MIN_ACC_STEP = 0.01;
export const DEFAULT_MIN_ACC = 0.85;

/** How many runs can be compared at once (lines on the parallel-coordinates plot). */
export const MAX_COMPARE = 3;
export const DEFAULT_SELECTED: readonly number[] = [0, 1, 2];

export type ParamKey = 'lr' | 'batch' | 'layers' | 'dropout';
export type MetricKey = 'valAcc' | 'valLoss' | 'minutes';
export type SortKey = 'id' | ParamKey | MetricKey;
/** Axes of the parallel-coordinates plot: all parameters and the main metric. */
export type AxisKey = ParamKey | 'valAcc';

export const PARAM_KEYS: readonly ParamKey[] = ['lr', 'batch', 'layers', 'dropout'];
export const METRIC_KEYS: readonly MetricKey[] = ['valAcc', 'valLoss', 'minutes'];
export const SORT_KEYS: readonly SortKey[] = ['id', ...PARAM_KEYS, ...METRIC_KEYS];
export const AXES: readonly AxisKey[] = ['lr', 'batch', 'layers', 'dropout', 'valAcc'];

export const DEFAULT_SORT_KEY: SortKey = 'valAcc';

export interface Run {
	/** Zero-based, stable across sorting. */
	id: number;
	/** Display name, `run-01` for id 0. */
	name: string;
	/** Learning rate. */
	lr: number;
	/** Batch size, one of BATCH_SIZES. */
	batch: number;
	/** Number of hidden layers. */
	layers: number;
	/** Dropout probability. */
	dropout: number;
	/** Validation accuracy in [0, 1]; higher is better. */
	valAcc: number;
	/** Validation loss; lower is better. */
	valLoss: number;
	/** Training time in minutes; lower is better. */
	minutes: number;
}

export interface ExperimentTrackingState {
	sortKey: SortKey;
	/** Descending order when true. */
	sortDesc: boolean;
	/** Ids of the runs marked for comparison, at most MAX_COMPARE. */
	selected: number[];
	/** Threshold on val_acc: the table shows runs with valAcc >= minAcc. */
	minAcc: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

function round(v: number, digits: number): number {
	const f = 10 ** digits;
	return Math.round(v * f) / f;
}

export function runName(id: number): string {
	return `run-${String(id + 1).padStart(2, '0')}`;
}

/**
 * Expected val_acc of a configuration: the made-up response surface without noise.
 * Peak 0.95 at lr = 10^-2.5, 3 layers, dropout 0.2, batch 16.
 */
export function accuracySurface(
	lr: number,
	batch: number,
	layers: number,
	dropout: number,
): number {
	const lrPenalty = 0.035 * (Math.log10(lr) + 2.5) ** 2;
	const layersPenalty = 0.012 * Math.abs(layers - 3);
	const dropoutPenalty = 0.2 * (dropout - 0.2) ** 2;
	const batchPenalty = 0.004 * Math.log2(batch / 16);
	return 0.95 - lrPenalty - layersPenalty - dropoutPenalty - batchPenalty;
}

/** Deterministic set of runs for a seed: the same seed always gives the same table. */
export function makeRuns(seed: number = RUN_SEED, n: number = RUN_COUNT): Run[] {
	const rand = mulberry32(seed);
	const runs: Run[] = [];
	for (let id = 0; id < n; id++) {
		const lr = Number((10 ** (LOG_LR_MIN + rand() * (LOG_LR_MAX - LOG_LR_MIN))).toPrecision(2));
		const batch = BATCH_SIZES[Math.floor(rand() * BATCH_SIZES.length)] ?? 32;
		const layers = LAYERS_MIN + Math.floor(rand() * (LAYERS_MAX - LAYERS_MIN + 1));
		const dropout = DROPOUT_STEPS[Math.floor(rand() * DROPOUT_STEPS.length)] ?? 0;
		const acc = accuracySurface(lr, batch, layers, dropout) + (rand() * 2 - 1) * ACC_NOISE;
		const valAcc = round(clamp(acc, 0.5, 0.99), 3);
		const valLoss = round(0.1 + 1.2 * (1 - valAcc) + (rand() * 2 - 1) * 0.01, 3);
		// Smaller batches mean more steps per epoch, so the run takes longer.
		const minutes = round(((layers * 300) / batch) * (1 + 0.2 * rand()), 1);
		runs.push({ id, name: runName(id), lr, batch, layers, dropout, valAcc, valLoss, minutes });
	}
	return runs;
}

/** Text of a table cell for a column. */
export function formatCell(run: Run, key: SortKey): string {
	switch (key) {
		case 'id':
			return run.name;
		case 'lr':
			return formatLr(run.lr);
		case 'batch':
			return String(run.batch);
		case 'layers':
			return String(run.layers);
		case 'dropout':
			return run.dropout.toFixed(1);
		case 'valAcc':
		case 'valLoss':
			return run[key].toFixed(3);
		case 'minutes':
			return run.minutes.toFixed(1);
	}
}

/** Learning rate in scientific notation with two significant digits: 0.0032 -> "3.2e-3". */
export function formatLr(lr: number): string {
	return lr.toExponential(1);
}

/** Value of a run for a sort key; `id` sorts by the row number. */
export function valueOf(run: Run, key: SortKey): number {
	return key === 'id' ? run.id : run[key];
}

/** Stable sort by a key; equal values keep the id order. Returns a new array. */
export function sortRuns(runs: readonly Run[], key: SortKey, desc: boolean): Run[] {
	const sign = desc ? -1 : 1;
	return [...runs].sort((a, b) => sign * (valueOf(a, key) - valueOf(b, key)) || a.id - b.id);
}

export function isHigherBetter(metric: MetricKey): boolean {
	return metric === 'valAcc';
}

/** Best run by a metric (max for val_acc, min for loss and time). Ties keep the first run. */
export function bestRun(runs: readonly Run[], metric: MetricKey): Run | undefined {
	const higher = isHigherBetter(metric);
	let best: Run | undefined;
	for (const r of runs) {
		if (best === undefined || (higher ? r[metric] > best[metric] : r[metric] < best[metric])) {
			best = r;
		}
	}
	return best;
}

/** Runs with val_acc at or above the threshold. A tiny tolerance absorbs float rounding. */
export function filterRuns(runs: readonly Run[], minAcc: number): Run[] {
	return runs.filter((r) => r.valAcc >= minAcc - 1e-9);
}

export function snapMinAcc(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_MIN_ACC;
	const c = clamp(v, MIN_ACC_MIN, MIN_ACC_MAX);
	const steps = Math.round((c - MIN_ACC_MIN) / MIN_ACC_STEP);
	return round(MIN_ACC_MIN + steps * MIN_ACC_STEP, 2);
}

/**
 * Adds an id to the comparison set or removes it. When the set is full, the oldest id is dropped.
 * Returns a new array.
 */
export function toggleSelected(
	selected: readonly number[],
	id: number,
	max: number = MAX_COMPARE,
): number[] {
	if (selected.includes(id)) return selected.filter((x) => x !== id);
	const next = [...selected, id];
	return next.length > max ? next.slice(next.length - max) : next;
}

/** Keeps valid, unique ids in range, at most MAX_COMPARE of them (the newest). A non-array gives the default. */
export function sanitizeSelected(v: unknown): number[] {
	if (!Array.isArray(v)) return [...DEFAULT_SELECTED];
	const ids: number[] = [];
	for (const x of v) {
		if (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < RUN_COUNT) {
			if (!ids.includes(x)) ids.push(x);
		}
	}
	return ids.slice(-MAX_COMPARE);
}

function isSortKey(v: unknown): v is SortKey {
	return typeof v === 'string' && (SORT_KEYS as readonly string[]).includes(v);
}

/** Fills missing or invalid fields with defaults. */
export function sanitizeState(initial?: Partial<ExperimentTrackingState>): ExperimentTrackingState {
	const key: unknown = initial?.sortKey;
	const desc: unknown = initial?.sortDesc;
	return {
		sortKey: isSortKey(key) ? key : DEFAULT_SORT_KEY,
		sortDesc: typeof desc === 'boolean' ? desc : true,
		selected: sanitizeSelected(initial?.selected),
		minAcc: snapMinAcc(initial?.minAcc),
	};
}

/**
 * Position of a run on one axis: lr on a log10 scale, batch on log2 (its values are powers of two),
 * the other axes as is.
 */
export function axisValue(run: Run, key: AxisKey): number {
	if (key === 'lr') return Math.log10(run.lr);
	if (key === 'batch') return Math.log2(run.batch);
	if (key === 'layers') return run.layers;
	if (key === 'dropout') return run.dropout;
	return run.valAcc;
}

export type Domains = Record<AxisKey, [number, number]>;

/** Min and max of an axis over the runs. */
export function axisDomain(runs: readonly Run[], key: AxisKey): [number, number] {
	if (runs.length === 0) return [0, 1];
	let lo = Infinity;
	let hi = -Infinity;
	for (const r of runs) {
		const v = axisValue(r, key);
		lo = Math.min(lo, v);
		hi = Math.max(hi, v);
	}
	return [lo, hi];
}

export function allDomains(runs: readonly Run[]): Domains {
	return {
		lr: axisDomain(runs, 'lr'),
		batch: axisDomain(runs, 'batch'),
		layers: axisDomain(runs, 'layers'),
		dropout: axisDomain(runs, 'dropout'),
		valAcc: axisDomain(runs, 'valAcc'),
	};
}

/** Maps v from [lo, hi] to [0, 1]. A degenerate range gives the middle, 0.5. */
export function normalise(v: number, [lo, hi]: readonly [number, number]): number {
	if (hi - lo < 1e-12) return 0.5;
	return (v - lo) / (hi - lo);
}

/** Normalised position of a run on each axis, in AXES order. */
export function axesValues(run: Run, domains: Domains): number[] {
	return AXES.map((k) => normalise(axisValue(run, k), domains[k]));
}

/** Text of an axis end value, in the units of the axis (inverse of axisValue). */
export function formatAxis(key: AxisKey, v: number): string {
	if (key === 'lr') return formatLr(10 ** v);
	if (key === 'batch') return String(Math.round(2 ** v));
	if (key === 'layers') return String(Math.round(v));
	if (key === 'dropout') return v.toFixed(1);
	return v.toFixed(3);
}

/** Sentence for the live region: how many runs pass the threshold, the best one, and the compared ones. */
export function describeRuns(
	runs: readonly Run[],
	minAcc: number,
	selected: readonly number[],
): string {
	const visible = filterRuns(runs, minAcc);
	const best = bestRun(visible, 'valAcc');
	const head = `Показано ${visible.length} из ${runs.length} запусков с val_acc не ниже ${minAcc.toFixed(2)}.`;
	const bestText = best
		? ` Лучший: ${best.name}, val_acc ${best.valAcc.toFixed(3)}.`
		: ' Ни один запуск не прошёл порог.';
	const names = selected
		.map((id) => runs.find((r) => r.id === id)?.name)
		.filter((n): n is string => n !== undefined);
	const cmp = names.length
		? ` Сравниваются: ${names.join(', ')}.`
		: ' Для сравнения отметьте запуски.';
	return head + bestText + cmp;
}
