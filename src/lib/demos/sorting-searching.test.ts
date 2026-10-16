import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	DEFAULT_TARGET,
	N_MAX,
	N_MIN,
	SORT_ALGOS,
	applyState,
	clampN,
	clampStep,
	clampTarget,
	makeArray,
	sortedArray,
	targetValue,
	traceBinarySearch,
	traceSort,
} from './sorting-searching';

/** Small deterministic generator for arrays with duplicates (independent of the demo code). */
function lcgArray(seed: number, n: number, max: number): number[] {
	let s = seed >>> 0;
	return Array.from({ length: n }, () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s % max;
	});
}

const ascending = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const descending = (n: number) => ascending(n).reverse();

describe('traceSort: correctness', () => {
	it('every algorithm sorts random arrays with duplicates', () => {
		for (let seed = 1; seed <= 60; seed++) {
			const n = seed % 17;
			const input = lcgArray(seed, n, 7);
			const expected = [...input].sort((x, y) => x - y);
			for (const algo of SORT_ALGOS) {
				expect(traceSort(algo, input).sorted).toEqual(expected);
			}
		}
	});

	it('handles empty and single-element arrays', () => {
		for (const algo of SORT_ALGOS) {
			expect(traceSort(algo, []).sorted).toEqual([]);
			expect(traceSort(algo, [5]).sorted).toEqual([5]);
		}
	});

	it('last step is done and fully fixed, first step is the input', () => {
		const input = makeArray(3, 9);
		for (const algo of SORT_ALGOS) {
			const { steps } = traceSort(algo, input);
			expect(steps[0]?.array).toEqual(input);
			expect(steps[0]?.kind).toBe('start');
			const last = steps[steps.length - 1];
			expect(last?.kind).toBe('done');
			expect(last?.fixed).toEqual(ascending(9).map((_, i) => i));
		}
	});

	it('snapshots are independent copies and the input is not mutated', () => {
		const input = [4, 1, 3, 2];
		const { steps } = traceSort('quick', input);
		expect(input).toEqual([4, 1, 3, 2]);
		expect(steps[0]?.array).toEqual([4, 1, 3, 2]);
		expect(steps[steps.length - 1]?.array).toEqual([1, 2, 3, 4]);
	});

	it('counters never decrease along the trace', () => {
		const input = makeArray(7, 12);
		for (const algo of SORT_ALGOS) {
			const { steps } = traceSort(algo, input);
			for (let i = 1; i < steps.length; i++) {
				expect(steps[i]?.comparisons ?? 0).toBeGreaterThanOrEqual(steps[i - 1]?.comparisons ?? 0);
				expect(steps[i]?.moves ?? 0).toBeGreaterThanOrEqual(steps[i - 1]?.moves ?? 0);
			}
		}
	});
});

describe('traceSort: comparison counts', () => {
	it('bubble and insertion take n-1 comparisons on sorted input', () => {
		for (const n of [5, 10, 16]) {
			expect(traceSort('bubble', ascending(n)).comparisons).toBe(n - 1);
			expect(traceSort('insertion', ascending(n)).comparisons).toBe(n - 1);
		}
	});

	it('bubble and insertion take n(n-1)/2 comparisons on reversed input', () => {
		for (const n of [5, 10, 16]) {
			const full = (n * (n - 1)) / 2;
			expect(traceSort('bubble', descending(n)).comparisons).toBe(full);
			expect(traceSort('insertion', descending(n)).comparisons).toBe(full);
		}
	});

	it('insertion sort makes no writes on sorted input', () => {
		expect(traceSort('insertion', ascending(8)).moves).toBe(0);
		expect(traceSort('bubble', ascending(8)).moves).toBe(0);
	});

	it('quick sort with the last element as pivot is quadratic on sorted input', () => {
		for (const n of [5, 10, 16]) {
			expect(traceSort('quick', ascending(n)).comparisons).toBe((n * (n - 1)) / 2);
		}
	});

	it('merge sort stays within n * ceil(log2 n) comparisons', () => {
		for (let seed = 1; seed <= 30; seed++) {
			const n = N_MIN + (seed % (N_MAX - N_MIN + 1));
			const input = lcgArray(seed, n, 1000);
			const bound = n * Math.ceil(Math.log2(n));
			expect(traceSort('merge', input).comparisons).toBeLessThanOrEqual(bound);
		}
	});
});

describe('traceBinarySearch', () => {
	it('finds every present value at its index', () => {
		const sorted = sortedArray(2, 13);
		sorted.forEach((v, i) => {
			const r = traceBinarySearch(sorted, v);
			expect(r.index).toBe(i);
		});
	});

	it('returns -1 for absent values, including values below and above the array', () => {
		const sorted = sortedArray(5, 10);
		for (let t = 0; t < 2 * sorted.length; t++) {
			const v = targetValue(sorted, t);
			const present = Number.isInteger(v);
			expect(traceBinarySearch(sorted, v).index).toBe(present ? sorted.indexOf(v) : -1);
		}
		expect(traceBinarySearch(sorted, 0).index).toBe(-1);
		expect(traceBinarySearch(sorted, 1000).index).toBe(-1);
	});

	it('uses at most floor(log2 n) + 1 comparisons', () => {
		for (let n = N_MIN; n <= N_MAX; n++) {
			const sorted = sortedArray(1, n);
			const bound = Math.floor(Math.log2(n)) + 1;
			for (let t = 0; t < 2 * n; t++) {
				expect(traceBinarySearch(sorted, targetValue(sorted, t)).comparisons).toBeLessThanOrEqual(
					bound,
				);
			}
		}
	});

	it('shrinks the range at every step and ends with an empty range when absent', () => {
		const sorted = sortedArray(4, 12);
		const r = traceBinarySearch(sorted, targetValue(sorted, 1));
		// Step 0 is the start state, step 1 is the first comparison on the same full range.
		for (let i = 2; i < r.steps.length; i++) {
			const prev = r.steps[i - 1];
			const cur = r.steps[i];
			expect((cur?.hi ?? 0) - (cur?.lo ?? 0)).toBeLessThan((prev?.hi ?? 0) - (prev?.lo ?? 0));
		}
		const last = r.steps[r.steps.length - 1];
		expect((last?.lo ?? 0) > (last?.hi ?? 0)).toBe(true);
	});
});

describe('makeArray and targets', () => {
	it('is deterministic, has n distinct values in range, and changes with the seed', () => {
		const a = makeArray(0, 16);
		expect(makeArray(0, 16)).toEqual(a);
		expect(new Set(a).size).toBe(16);
		for (const v of a) {
			expect(v).toBeGreaterThanOrEqual(1);
			expect(v).toBeLessThanOrEqual(99);
		}
		expect(makeArray(1, 16)).not.toEqual(a);
	});

	it('targetValue: even indices are present, odd indices are absent', () => {
		const sorted = sortedArray(0, 6);
		expect(targetValue(sorted, 0)).toBe(sorted[0]);
		expect(targetValue(sorted, 4)).toBe(sorted[2]);
		expect(targetValue(sorted, 5)).toBe((sorted[2] ?? 0) + 0.5);
	});
});

describe('state clamping', () => {
	it('clampN rounds into range and falls back to the default', () => {
		expect(clampN(1)).toBe(N_MIN);
		expect(clampN(100)).toBe(N_MAX);
		expect(clampN(7.4)).toBe(7);
		expect(clampN(Number.NaN)).toBe(DEFAULT_STATE.n);
	});

	it('clampTarget depends on n', () => {
		expect(clampTarget(40, 10)).toBe(19);
		expect(clampTarget(-3, 10)).toBe(0);
		expect(clampTarget('x', 10)).toBe(DEFAULT_TARGET);
	});

	it('clampStep keeps the index inside the trace', () => {
		expect(clampStep(-1, 5)).toBe(0);
		expect(clampStep(9, 5)).toBe(4);
		expect(clampStep(2.7, 5)).toBe(2);
	});

	it('applyState clamps the target after n changes', () => {
		const s = applyState({ ...DEFAULT_STATE, target: 18 }, { n: 5 });
		expect(s.n).toBe(5);
		expect(s.target).toBe(9);
	});
});
