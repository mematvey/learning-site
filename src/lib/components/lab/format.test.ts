import { describe, expect, it } from 'vitest';
import type { TestResult } from '$lib/contracts';
import {
	countTests,
	errorLine,
	extent,
	firstFailedIndex,
	formatNumber,
	isDraftStale,
} from './format';

const t = (name: string, status: TestResult['status'], line?: number): TestResult => ({
	name,
	status,
	hidden: false,
	...(line !== undefined ? { location: { file: 'attention.py', line } } : {}),
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
