import type { LabResult, Series, TestResult } from '$lib/contracts';

/** Counts tests with status `pass` out of all reported tests. */
export function countTests(tests: TestResult[]): { passed: number; total: number } {
	return { passed: tests.filter((t) => t.status === 'pass').length, total: tests.length };
}

/** Summary line for the result panel, e.g. `Пройдено тестов: 2 из 4`. */
export function summaryText(passed: number, total: number): string {
	return `Пройдено тестов: ${passed} из ${total}`;
}

/** Index of the first failing or erroring test, or -1. The panel opens it by default. */
export function firstFailedIndex(tests: TestResult[]): number {
	return tests.findIndex((t) => t.status === 'fail' || t.status === 'error');
}

/** File name the harness gives the learner's code (see `USER_FILE` in `labs/harness.py`). */
export const USER_FILE = 'code.py';

/**
 * Line of the first failing test whose location is in the learner's file (used to highlight
 * the editor line). Failures located in the test files (`tests_*.py`) do not mark the editor.
 */
export function errorLine(tests: TestResult[], userFile: string = USER_FILE): number | null {
	const failed = tests.find(
		(t) => (t.status === 'fail' || t.status === 'error') && t.location?.file === userFile,
	);
	return failed?.location?.line ?? null;
}

/** Milliseconds as seconds with two decimals, e.g. `0.42 с`. */
export function formatSeconds(ms: number): string {
	return `${(ms / 1000).toFixed(2)} с`;
}

/** Signed number with three decimals, aligned in the diff table. */
export function formatNumber(v: number): string {
	return (v >= 0 ? ' ' : '') + v.toFixed(3);
}

/** A draft is stale when it was started from different starter code. */
export function isDraftStale(draftHash: string | undefined, starterHash: string): boolean {
	return draftHash !== undefined && draftHash !== starterHash;
}

/** Bounds of all series points, widened when a range is flat so scales stay defined. */
export function extent(series: Series[]): { x0: number; x1: number; y0: number; y1: number } {
	let x0 = Infinity;
	let x1 = -Infinity;
	let y0 = Infinity;
	let y1 = -Infinity;
	for (const s of series) {
		for (const x of s.x) {
			x0 = Math.min(x0, x);
			x1 = Math.max(x1, x);
		}
		for (const y of s.y) {
			y0 = Math.min(y0, y);
			y1 = Math.max(y1, y);
		}
	}
	if (!Number.isFinite(x0)) return { x0: 0, x1: 1, y0: 0, y1: 1 };
	if (x1 === x0) x1 = x0 + 1;
	if (y1 === y0) y1 = y0 + 1;
	return { x0, x1, y0, y1 };
}

/** Whether a result needs the error banner (failure outside the tests). */
export function hasRunError(result: LabResult): boolean {
	return result.error !== undefined;
}

/** One compared number: its multi-dimensional index and both values. */
export interface ComparedValue {
	index: number[];
	expected: number;
	actual: number;
}

/**
 * Pairs `expected` and `actual` element by element when both are numeric arrays of the same
 * shape (nested arrays are walked, the index is the path). Returns null otherwise, so the panel
 * falls back to the plain value table.
 */
export function comparePairs(expected: unknown, actual: unknown): ComparedValue[] | null {
	if (!Array.isArray(expected) || !Array.isArray(actual)) return null;
	const out: ComparedValue[] = [];
	const walk = (e: unknown, a: unknown, index: number[]): boolean => {
		if (Array.isArray(e) || Array.isArray(a)) {
			if (!Array.isArray(e) || !Array.isArray(a) || e.length !== a.length) return false;
			return e.every((item, i) => walk(item, a[i], [...index, i]));
		}
		if (typeof e !== 'number' || typeof a !== 'number') return false;
		out.push({ index, expected: e, actual: a });
		return true;
	};
	return walk(expected, actual, []) ? out : null;
}
