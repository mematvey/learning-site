import { describe, expect, it } from 'vitest';
import {
	AXES,
	BATCH_SIZES,
	DEFAULT_MIN_ACC,
	DEFAULT_SELECTED,
	DROPOUT_STEPS,
	MAX_COMPARE,
	MIN_ACC_MAX,
	MIN_ACC_MIN,
	RUN_COUNT,
	accuracySurface,
	allDomains,
	axesValues,
	axisValue,
	bestRun,
	describeRuns,
	filterRuns,
	formatAxis,
	formatCell,
	formatLr,
	makeRuns,
	normalise,
	runName,
	sanitizeSelected,
	sanitizeState,
	snapMinAcc,
	sortRuns,
	toggleSelected,
	type Run,
} from './experiment-tracking';

function fake(id: number, valAcc: number, valLoss = 0.5, minutes = 10): Run {
	return {
		id,
		name: runName(id),
		lr: 0.001,
		batch: 32,
		layers: 2,
		dropout: 0.1,
		valAcc,
		valLoss,
		minutes,
	};
}

describe('makeRuns', () => {
	it('is deterministic for a seed', () => {
		expect(makeRuns(42)).toEqual(makeRuns(42));
	});

	it('gives a different table for another seed', () => {
		expect(makeRuns(42)).not.toEqual(makeRuns(43));
	});

	it('creates RUN_COUNT runs with stable ids and names', () => {
		const runs = makeRuns();
		expect(runs).toHaveLength(RUN_COUNT);
		runs.forEach((r, i) => {
			expect(r.id).toBe(i);
			expect(r.name).toBe(runName(i));
		});
		expect(runName(0)).toBe('run-01');
	});

	it('keeps every parameter inside its allowed set', () => {
		for (const r of makeRuns()) {
			expect(r.lr).toBeGreaterThanOrEqual(1e-4);
			expect(r.lr).toBeLessThanOrEqual(0.1);
			expect(BATCH_SIZES).toContain(r.batch);
			expect(r.layers).toBeGreaterThanOrEqual(1);
			expect(r.layers).toBeLessThanOrEqual(4);
			expect(DROPOUT_STEPS).toContain(r.dropout);
			expect(r.valAcc).toBeGreaterThanOrEqual(0.5);
			expect(r.valAcc).toBeLessThanOrEqual(0.99);
			expect(r.valLoss).toBeGreaterThan(0);
			expect(r.minutes).toBeGreaterThan(0);
		}
	});
});

describe('accuracySurface', () => {
	it('peaks at the reference configuration', () => {
		expect(accuracySurface(10 ** -2.5, 16, 3, 0.2)).toBeCloseTo(0.95, 10);
	});

	it('is lower far from the optimal learning rate and layer count', () => {
		const best = accuracySurface(10 ** -2.5, 16, 3, 0.2);
		expect(accuracySurface(1e-4, 16, 3, 0.2)).toBeLessThan(best);
		expect(accuracySurface(10 ** -2.5, 16, 1, 0.2)).toBeLessThan(best);
	});
});

describe('sortRuns', () => {
	const runs = [fake(0, 0.9), fake(1, 0.8), fake(2, 0.9), fake(3, 0.85)];

	it('sorts by a metric descending and ascending', () => {
		expect(sortRuns(runs, 'valAcc', true).map((r) => r.id)).toEqual([0, 2, 3, 1]);
		expect(sortRuns(runs, 'valAcc', false).map((r) => r.id)).toEqual([1, 3, 0, 2]);
	});

	it('keeps id order for equal values and does not mutate the input', () => {
		const before = runs.map((r) => r.id);
		sortRuns(runs, 'valAcc', true);
		expect(runs.map((r) => r.id)).toEqual(before);
		expect(sortRuns(runs, 'valAcc', true)[0]?.id).toBe(0);
	});

	it('sorts by id', () => {
		expect(sortRuns(runs, 'id', true).map((r) => r.id)).toEqual([3, 2, 1, 0]);
	});
});

describe('bestRun', () => {
	const runs = [fake(0, 0.9, 0.3, 40), fake(1, 0.95, 0.4, 5), fake(2, 0.9, 0.2, 20)];

	it('takes the maximum for accuracy and the minimum for loss and time', () => {
		expect(bestRun(runs, 'valAcc')?.id).toBe(1);
		expect(bestRun(runs, 'valLoss')?.id).toBe(2);
		expect(bestRun(runs, 'minutes')?.id).toBe(1);
	});

	it('returns undefined for no runs and the first run on a tie', () => {
		expect(bestRun([], 'valAcc')).toBeUndefined();
		expect(bestRun([fake(0, 0.9), fake(1, 0.9)], 'valAcc')?.id).toBe(0);
	});
});

describe('threshold filter and snapping', () => {
	const runs = [fake(0, 0.85), fake(1, 0.84), fake(2, 0.9)];

	it('keeps runs at or above the threshold, boundary included', () => {
		expect(filterRuns(runs, 0.85).map((r) => r.id)).toEqual([0, 2]);
		expect(filterRuns(runs, 0.95)).toEqual([]);
	});

	it('clamps and snaps the threshold to its step', () => {
		expect(snapMinAcc(0.9123)).toBe(0.91);
		expect(snapMinAcc(0.5)).toBe(MIN_ACC_MIN);
		expect(snapMinAcc(2)).toBe(MIN_ACC_MAX);
		expect(snapMinAcc('x')).toBe(DEFAULT_MIN_ACC);
	});
});

describe('toggleSelected', () => {
	it('adds and removes ids', () => {
		expect(toggleSelected([1], 2)).toEqual([1, 2]);
		expect(toggleSelected([1, 2], 1)).toEqual([2]);
	});

	it('drops the oldest id when the set is full', () => {
		expect(toggleSelected([0, 1, 2], 5)).toEqual([1, 2, 5]);
		expect(toggleSelected([0, 1], 5, 2)).toEqual([1, 5]);
		expect(MAX_COMPARE).toBe(3);
	});

	it('does not mutate its input', () => {
		const sel = [0, 1];
		toggleSelected(sel, 2);
		expect(sel).toEqual([0, 1]);
	});
});

describe('sanitizeState and sanitizeSelected', () => {
	it('gives defaults for an empty input', () => {
		expect(sanitizeState()).toEqual({
			sortKey: 'valAcc',
			sortDesc: true,
			selected: [...DEFAULT_SELECTED],
			minAcc: DEFAULT_MIN_ACC,
		});
	});

	it('rejects an unknown sort key and a non-boolean direction', () => {
		const s = sanitizeState({ sortKey: 'nope' as never, sortDesc: 'yes' as never });
		expect(s.sortKey).toBe('valAcc');
		expect(s.sortDesc).toBe(true);
	});

	it('keeps unique in-range ids and at most MAX_COMPARE of them', () => {
		expect(sanitizeSelected([3, 3, -1, 99, 1.5, 4, 5, 6])).toEqual([4, 5, 6]);
		expect(sanitizeSelected([])).toEqual([]);
		expect(sanitizeSelected('x')).toEqual([...DEFAULT_SELECTED]);
	});
});

describe('parallel coordinates', () => {
	it('maps values to [0, 1] and handles a degenerate range', () => {
		expect(normalise(5, [0, 10])).toBeCloseTo(0.5, 10);
		expect(normalise(0, [0, 10])).toBe(0);
		expect(normalise(10, [0, 10])).toBe(1);
		expect(normalise(3, [3, 3])).toBe(0.5);
	});

	it('puts lr on a log scale and batch on log2', () => {
		const r = fake(0, 0.9);
		expect(axisValue({ ...r, lr: 0.01 }, 'lr')).toBeCloseTo(-2, 10);
		expect(axisValue({ ...r, batch: 64 }, 'batch')).toBe(6);
	});

	it('gives one value per axis, each in [0, 1]', () => {
		const runs = makeRuns();
		const domains = allDomains(runs);
		for (const r of runs) {
			const vals = axesValues(r, domains);
			expect(vals).toHaveLength(AXES.length);
			for (const v of vals) {
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(1);
			}
		}
	});

	it('formats axis ends and learning rate', () => {
		expect(formatLr(0.0032)).toBe('3.2e-3');
		expect(formatAxis('lr', -2)).toBe('1.0e-2');
		expect(formatAxis('batch', 6)).toBe('64');
		expect(formatAxis('valAcc', 0.9)).toBe('0.900');
	});

	it('formats table cells', () => {
		const r = { ...fake(0, 0.9123, 0.4567, 12.345), lr: 0.0032, dropout: 0.2 };
		expect(formatCell(r, 'lr')).toBe('3.2e-3');
		expect(formatCell(r, 'valAcc')).toBe('0.912');
		expect(formatCell(r, 'minutes')).toBe('12.3');
		expect(formatCell(r, 'dropout')).toBe('0.2');
		expect(formatCell(r, 'id')).toBe('run-01');
	});
});

describe('describeRuns', () => {
	it('names the best visible run and the compared ones', () => {
		const runs = [fake(0, 0.9), fake(1, 0.95), fake(2, 0.8)];
		const text = describeRuns(runs, 0.85, [0, 1]);
		expect(text).toContain('Показано 2 из 3');
		expect(text).toContain('Лучший: run-02');
		expect(text).toContain('Сравниваются: run-01, run-02');
	});

	it('reports when no run passes the threshold', () => {
		expect(describeRuns([fake(0, 0.5)], 0.9, [])).toContain('Ни один запуск не прошёл порог');
	});
});
