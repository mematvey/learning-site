/**
 * Math of the sorting and searching demo: step traces of four comparison sorts and of binary search.
 * Pure functions only: no DOM, no Svelte.
 *
 * Every trace is a list of snapshots. Replaying the list shows the array after each elementary event,
 * the indices being compared or written, and running counters of comparisons and moves.
 * Snapshots are copies, so a trace never changes after it is built.
 */

import { mulberry32 } from './attention';

export const SORT_ALGOS = ['bubble', 'insertion', 'merge', 'quick'] as const;
export type SortAlgo = (typeof SORT_ALGOS)[number];
export type DemoAlgo = SortAlgo | 'binary';
export const DEMO_ALGOS: readonly DemoAlgo[] = [...SORT_ALGOS, 'binary'];

export const N_MIN = 5;
export const N_MAX = 16;
export const DEFAULT_N = 10;

/** Values are distinct integers from this pool, so every position in the answer is unambiguous. */
export const VALUE_MIN = 1;
export const VALUE_MAX = 99;
export const SEED_BASE = 4242;

export const DEFAULT_ALGO: DemoAlgo = 'bubble';
/** Target index: even values are present in the array, odd values are not (see `targetValue`). */
export const DEFAULT_TARGET = 6;

export interface SortingDemoState {
	/** Algorithm shown: one of the four sorts or binary search. */
	algo: DemoAlgo;
	/** Number of elements, integer in [N_MIN, N_MAX]. */
	n: number;
	/** Index of the generated array; the same index always gives the same array. */
	seed: number;
	/** Current step of the trace, integer >= 0 (clamped to the trace length by the UI). */
	step: number;
	/** Index of the search target in [0, 2n - 1]. */
	target: number;
}

export const DEFAULT_STATE: SortingDemoState = {
	algo: DEFAULT_ALGO,
	n: DEFAULT_N,
	seed: 0,
	step: 0,
	target: DEFAULT_TARGET,
};

export type StepKind = 'start' | 'compare' | 'swap' | 'write' | 'pivot' | 'done';

export interface SortStep {
	/** Array after this event (a copy). */
	array: number[];
	/** Indices compared or written by this event. */
	active: number[];
	/** Index of the pivot (quick sort) or of the moving key (insertion sort), if any. */
	pivot: number | null;
	/** Indices already in their final position, ascending. */
	fixed: number[];
	/** Comparisons made up to and including this event. */
	comparisons: number;
	/** Swaps and writes made up to and including this event. */
	moves: number;
	kind: StepKind;
	/** Short Russian description of the event, shown to the reader. */
	text: string;
}

export interface SortTrace {
	steps: SortStep[];
	comparisons: number;
	moves: number;
	/** Final array. */
	sorted: number[];
}

export interface BinaryStep {
	/** Search range before this comparison (inclusive). Empty when lo > hi. */
	lo: number;
	hi: number;
	/** Index compared at this step, null for the first and the final step. */
	mid: number | null;
	/** Index where the target was found, -1 otherwise. */
	found: number;
	/** Comparisons made up to and including this step. */
	comparisons: number;
	text: string;
}

export interface BinaryTrace {
	steps: BinaryStep[];
	/** Index of the target in the sorted array, -1 if absent. */
	index: number;
	comparisons: number;
}

/** Static facts about each algorithm, textbook values (big-O, stability, extra memory). */
export interface AlgoInfo {
	label: string;
	worst: string;
	average: string;
	stable: boolean;
	extraMemory: string;
}

export const ALGO_INFO: Record<DemoAlgo, AlgoInfo> = {
	bubble: {
		label: 'Пузырьком',
		worst: 'O(n²)',
		average: 'O(n²)',
		stable: true,
		extraMemory: 'O(1)',
	},
	insertion: {
		label: 'Вставками',
		worst: 'O(n²)',
		average: 'O(n²)',
		stable: true,
		extraMemory: 'O(1)',
	},
	merge: {
		label: 'Слиянием',
		worst: 'O(n log n)',
		average: 'O(n log n)',
		stable: true,
		extraMemory: 'O(n)',
	},
	quick: {
		label: 'Быстрая',
		worst: 'O(n²)',
		average: 'O(n log n)',
		stable: false,
		extraMemory: 'O(log n) стека',
	},
	binary: {
		label: 'Бинарный поиск',
		worst: 'O(log n)',
		average: 'O(log n)',
		stable: true,
		extraMemory: 'O(1)',
	},
};

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

export function isDemoAlgo(v: unknown): v is DemoAlgo {
	return typeof v === 'string' && (DEMO_ALGOS as readonly string[]).includes(v);
}

/** Rounds and clamps the array size to [N_MIN, N_MAX]. Non-numbers give the default. */
export function clampN(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_N;
	return clamp(Math.round(v), N_MIN, N_MAX);
}

/** Number of selectable search targets for an array of size n. */
export function targetCount(n: number): number {
	return 2 * n;
}

/** Rounds and clamps the target index to [0, 2n - 1]. */
export function clampTarget(v: unknown, n: number): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_TARGET;
	return clamp(Math.round(v), 0, targetCount(n) - 1);
}

/** Non-negative integer seed index. */
export function clampSeed(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
	return Math.max(0, Math.floor(v));
}

/** Clamps a step index to [0, total - 1]. `total` is the number of steps in the trace (>= 1). */
export function clampStep(v: unknown, total: number): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
	return clamp(Math.floor(v), 0, Math.max(0, total - 1));
}

/** Applies a partial patch to a state and clamps every field. */
export function applyState(
	base: SortingDemoState,
	patch: Partial<SortingDemoState>,
): SortingDemoState {
	const n = patch.n !== undefined ? clampN(patch.n) : base.n;
	return {
		algo: isDemoAlgo(patch.algo) ? patch.algo : base.algo,
		n,
		seed: patch.seed !== undefined ? clampSeed(patch.seed) : base.seed,
		step: patch.step !== undefined ? clampStep(patch.step, Number.MAX_SAFE_INTEGER) : base.step,
		target: patch.target !== undefined ? clampTarget(patch.target, n) : clampTarget(base.target, n),
	};
}

/**
 * Generates an array of n distinct integers from [VALUE_MIN, VALUE_MAX].
 * Deterministic: the same seed index and size always give the same array.
 */
export function makeArray(seedIndex: number, n: number): number[] {
	const rand = mulberry32(SEED_BASE + clampSeed(seedIndex));
	const pool: number[] = [];
	for (let v = VALUE_MIN; v <= VALUE_MAX; v++) pool.push(v);
	// Partial Fisher-Yates: the first n entries are a uniform sample without repetition.
	for (let i = 0; i < n; i++) {
		const j = i + Math.floor(rand() * (pool.length - i));
		const tmp = pool[i] ?? 0;
		pool[i] = pool[j] ?? 0;
		pool[j] = tmp;
	}
	return pool.slice(0, n);
}

/** Sorted copy of the generated array: the input of binary search. */
export function sortedArray(seedIndex: number, n: number): number[] {
	return makeArray(seedIndex, n).sort((x, y) => x - y);
}

/**
 * Search target for a target index t: even t gives a value present in the sorted array,
 * odd t gives a value between two neighbours (x.5), which is absent.
 */
export function targetValue(sorted: readonly number[], t: number): number {
	const k = Math.floor(t / 2);
	const base = sorted[k] ?? 0;
	return t % 2 === 0 ? base : base + 0.5;
}

/** Swaps two positions of an array in place. */
function swapIn(a: number[], i: number, j: number): void {
	const x = a[i] ?? 0;
	const y = a[j] ?? 0;
	a[i] = y;
	a[j] = x;
}

/** Records steps while a sort runs on its own copy of the input. */
class Tracer {
	readonly a: number[];
	readonly steps: SortStep[] = [];
	readonly fixed = new Set<number>();
	comparisons = 0;
	moves = 0;

	constructor(input: readonly number[]) {
		this.a = [...input];
		this.emit('start', [], null, 'Исходный массив');
	}

	private emit(kind: StepKind, active: number[], pivot: number | null, text: string): void {
		this.steps.push({
			array: [...this.a],
			active,
			pivot,
			fixed: [...this.fixed].sort((x, y) => x - y),
			comparisons: this.comparisons,
			moves: this.moves,
			kind,
			text,
		});
	}

	compare(active: number[], pivot: number | null, text: string): void {
		this.comparisons += 1;
		this.emit('compare', active, pivot, text);
	}

	pivot(index: number, text: string): void {
		this.emit('pivot', [index], index, text);
	}

	swap(i: number, j: number, text: string): void {
		swapIn(this.a, i, j);
		this.moves += 1;
		this.emit('swap', [i, j], null, text);
	}

	write(index: number, value: number, text: string, pivot: number | null = null): void {
		this.a[index] = value;
		this.moves += 1;
		this.emit('write', [index], pivot, text);
	}

	markFixed(index: number): void {
		this.fixed.add(index);
	}

	finish(): SortTrace {
		for (let i = 0; i < this.a.length; i++) this.fixed.add(i);
		this.emit('done', [], null, 'Массив отсортирован');
		return {
			steps: this.steps,
			comparisons: this.comparisons,
			moves: this.moves,
			sorted: [...this.a],
		};
	}
}

function bubbleSort(t: Tracer): void {
	const n = t.a.length;
	for (let pass = 0; pass < n - 1; pass++) {
		let swapped = false;
		for (let j = 0; j < n - 1 - pass; j++) {
			t.compare([j, j + 1], null, `Сравниваем a[${j}] и a[${j + 1}]`);
			if ((t.a[j] ?? 0) > (t.a[j + 1] ?? 0)) {
				t.swap(j, j + 1, `Меняем местами a[${j}] и a[${j + 1}]`);
				swapped = true;
			}
		}
		// The largest remaining element has reached its place at the end of the pass.
		t.markFixed(n - 1 - pass);
		if (!swapped) break;
	}
}

function insertionSort(t: Tracer): void {
	const n = t.a.length;
	for (let i = 1; i < n; i++) {
		const key = t.a[i] ?? 0;
		let j = i - 1;
		while (j >= 0) {
			const cur = t.a[j] ?? 0;
			// The gap right of j is where the key will go.
			t.compare([j], j + 1, `Ключ ${key} против a[${j}] = ${cur}`);
			if (cur <= key) break;
			t.write(j + 1, cur, `Сдвигаем ${cur} вправо`, j + 1);
			j -= 1;
		}
		if (j + 1 !== i) t.write(j + 1, key, `Вставляем ${key} на позицию ${j + 1}`, j + 1);
	}
}

function mergeSort(t: Tracer): void {
	const a = t.a;
	const sortRange = (lo: number, hi: number): void => {
		// Half-open range [lo, hi): a single element is already sorted.
		if (hi - lo <= 1) return;
		const mid = Math.floor((lo + hi) / 2);
		sortRange(lo, mid);
		sortRange(mid, hi);
		const left = a.slice(lo, mid);
		const right = a.slice(mid, hi);
		let i = 0;
		let j = 0;
		let k = lo;
		while (i < left.length && j < right.length) {
			const li = left[i] ?? 0;
			const rj = right[j] ?? 0;
			t.compare([k, mid + j], null, `Сравниваем ${li} и ${rj}, пишем меньшее в позицию ${k}`);
			if (li <= rj) {
				t.write(k, li, `Пишем ${li} в позицию ${k}`);
				i += 1;
			} else {
				t.write(k, rj, `Пишем ${rj} в позицию ${k}`);
				j += 1;
			}
			k += 1;
		}
		while (i < left.length) {
			t.write(k, left[i] ?? 0, `Хвост левой половины: ${left[i] ?? 0} в позицию ${k}`);
			i += 1;
			k += 1;
		}
		while (j < right.length) {
			t.write(k, right[j] ?? 0, `Хвост правой половины: ${right[j] ?? 0} в позицию ${k}`);
			j += 1;
			k += 1;
		}
	};
	sortRange(0, a.length);
}

function quickSort(t: Tracer): void {
	const a = t.a;
	const sortRange = (lo: number, hi: number): void => {
		if (lo > hi) return;
		if (lo === hi) {
			t.markFixed(lo);
			return;
		}
		// Lomuto partition with the last element as the pivot.
		const pivotValue = a[hi] ?? 0;
		t.pivot(hi, `Опорный элемент a[${hi}] = ${pivotValue}`);
		let i = lo;
		for (let j = lo; j < hi; j++) {
			const v = a[j] ?? 0;
			t.compare([j, hi], hi, `a[${j}] = ${v} ${v <= pivotValue ? '≤' : '>'} ${pivotValue}?`);
			if (v <= pivotValue) {
				if (i !== j) t.swap(i, j, `Переносим ${v} влево, в позицию ${i}`);
				i += 1;
			}
		}
		if (i !== hi) t.swap(i, hi, `Ставим опорный элемент на позицию ${i}`);
		t.markFixed(i);
		sortRange(lo, i - 1);
		sortRange(i + 1, hi);
	};
	sortRange(0, a.length - 1);
}

/** Runs one comparison sort on a copy of the input and records every event. */
export function traceSort(algo: SortAlgo, input: readonly number[]): SortTrace {
	const t = new Tracer(input);
	if (algo === 'bubble') bubbleSort(t);
	else if (algo === 'insertion') insertionSort(t);
	else if (algo === 'merge') mergeSort(t);
	else quickSort(t);
	return t.finish();
}

/** Binary search on a sorted array. Each step shows the range and the element compared. */
export function traceBinarySearch(sorted: readonly number[], target: number): BinaryTrace {
	let lo = 0;
	let hi = sorted.length - 1;
	let comparisons = 0;
	const steps: BinaryStep[] = [
		{ lo, hi, mid: null, found: -1, comparisons, text: `Ищем ${target} в отсортированном массиве` },
	];
	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2);
		const v = sorted[mid] ?? 0;
		comparisons += 1;
		if (v === target) {
			steps.push({
				lo,
				hi,
				mid,
				found: mid,
				comparisons,
				text: `a[${mid}] = ${v}: нашли за ${comparisons} сравн.`,
			});
			return { steps, index: mid, comparisons };
		}
		if (v < target) {
			steps.push({
				lo,
				hi,
				mid,
				found: -1,
				comparisons,
				text: `a[${mid}] = ${v} < ${target}: ищем справа`,
			});
			lo = mid + 1;
		} else {
			steps.push({
				lo,
				hi,
				mid,
				found: -1,
				comparisons,
				text: `a[${mid}] = ${v} > ${target}: ищем слева`,
			});
			hi = mid - 1;
		}
	}
	steps.push({
		lo,
		hi,
		mid: null,
		found: -1,
		comparisons,
		text: `Диапазон пуст: ${target} в массиве нет`,
	});
	return { steps, index: -1, comparisons };
}
