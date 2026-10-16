import { describe, expect, it } from 'vitest';
import type { TestResult } from '$lib/contracts';
import {
	comparePairs,
	countTests,
	errorLine,
	extent,
	firstFailedIndex,
	formatNumber,
	isDraftStale,
	USER_FILE,
} from './format';

const t = (name: string, status: TestResult['status'], line?: number): TestResult => ({
	name,
	status,
	hidden: false,
	...(line !== undefined ? { location: { file: USER_FILE, line } } : {}),
});

describe('lab result helpers', () => {
	const tests = [
		t('test_shape', 'pass'),
		t('test_scaling', 'fail', 17),
		t('test_mask', 'error', 18),
	];

	it('counts passed tests out of all', () => {
		expect(countTests(tests)).toEqual({ passed: 1, total: 3 });
	});

	it('finds the first failing test and its line', () => {
		expect(firstFailedIndex(tests)).toBe(1);
		expect(errorLine(tests)).toBe(17);
		expect(firstFailedIndex([t('a', 'pass')])).toBe(-1);
		expect(errorLine([t('a', 'pass')])).toBeNull();
	});

	it('does not mark the editor for a failure located in a test file', () => {
		const inTests: TestResult = {
			name: 'test_shape',
			status: 'fail',
			hidden: false,
			location: { file: 'tests_visible.py', line: 9 },
		};
		expect(errorLine([inTests])).toBeNull();
	});

	it('formats signed numbers', () => {
		expect(formatNumber(0.5)).toBe(' 0.500');
		expect(formatNumber(-0.1)).toBe('-0.100');
	});
});

describe('draft staleness', () => {
	it('is stale only when the draft came from other starter code', () => {
		expect(isDraftStale(undefined, 'abc')).toBe(false);
		expect(isDraftStale('abc', 'abc')).toBe(false);
		expect(isDraftStale('abc', 'def')).toBe(true);
	});
});

describe('series extent', () => {
	it('widens flat ranges so scales stay defined', () => {
		expect(extent([{ x: [2, 2], y: [5, 5] }])).toEqual({ x0: 2, x1: 3, y0: 5, y1: 6 });
	});

	it('covers all series', () => {
		expect(
			extent([
				{ x: [0, 1], y: [0.2, 0.9] },
				{ x: [0, 4], y: [0.1, 0.5] },
			]),
		).toEqual({ x0: 0, x1: 4, y0: 0.1, y1: 0.9 });
	});
});

describe('comparePairs', () => {
	it('pairs flat numeric arrays by position', () => {
		expect(comparePairs([1, 2], [1, 2.5])).toEqual([
			{ index: [0], expected: 1, actual: 1 },
			{ index: [1], expected: 2, actual: 2.5 },
		]);
	});

	it('walks nested arrays with the path as index', () => {
		expect(comparePairs([[1, 2]], [[1, 3]])?.[1]).toEqual({
			index: [0, 1],
			expected: 2,
			actual: 3,
		});
	});

	it('returns null for shape or type mismatch', () => {
		expect(comparePairs([1, 2], [1])).toBeNull();
		expect(comparePairs([1], ['a'])).toBeNull();
		expect(comparePairs(1, 1)).toBeNull();
	});
});
