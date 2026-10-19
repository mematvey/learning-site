import { describe, expect, it } from 'vitest';
import {
	N,
	N_SPLITS,
	SERIES,
	clampFold,
	describeSplit,
	modeMae,
	rangeText,
	scoreFold,
	splitFor,
} from './time-series-validation';

describe('splitFor', () => {
	it('time mode gives the example from the chapter: train 0-5 test 6-7, then growing train', () => {
		expect(splitFor('time', 1)).toEqual({ train: [0, 1, 2, 3, 4, 5], test: [6, 7] });
		expect(splitFor('time', 2)).toEqual({ train: [0, 1, 2, 3, 4, 5, 6, 7], test: [8, 9] });
		expect(splitFor('time', 3)).toEqual({
			train: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
			test: [10, 11],
		});
	});

	it('time mode never puts a test point before a training point', () => {
		for (let f = 1; f <= N_SPLITS; f++) {
			const { train, test } = splitFor('time', f);
			expect(Math.min(...test)).toBeGreaterThan(Math.max(...train));
		}
	});

	it('sliding mode keeps the training window at a fixed length of 6', () => {
		expect(splitFor('sliding', 1)).toEqual({ train: [0, 1, 2, 3, 4, 5], test: [6, 7] });
		expect(splitFor('sliding', 2)).toEqual({ train: [2, 3, 4, 5, 6, 7], test: [8, 9] });
		expect(splitFor('sliding', 3)).toEqual({ train: [4, 5, 6, 7, 8, 9], test: [10, 11] });
	});

	it('random mode has test points spread over the series, with training points on both sides', () => {
		for (let f = 1; f <= N_SPLITS; f++) {
			const { train, test } = splitFor('random', f);
			expect(train.length + test.length).toBe(N);
			expect(train.some((t) => t > Math.max(...test))).toBe(true);
			expect(train.some((t) => t < Math.min(...test))).toBe(true);
		}
	});

	it('the three random folds have disjoint test sets', () => {
		const all = [1, 2, 3].flatMap((f) => splitFor('random', f).test);
		expect(new Set(all).size).toBe(all.length);
	});

	it('clamps the fold number to 1..3', () => {
		expect(clampFold(0)).toBe(1);
		expect(clampFold(9)).toBe(3);
		expect(clampFold(Number.NaN)).toBe(1);
		expect(splitFor('time', 7)).toEqual(splitFor('time', 3));
	});
});

describe('scores', () => {
	it('random split scores better than time split: the test sits between seen points', () => {
		expect(modeMae('random')).toBeLessThan(modeMae('time'));
	});

	it('mean errors for the default series match the values shown in the demo', () => {
		expect(modeMae('random')).toBeCloseTo(0.9122, 3);
		expect(modeMae('time')).toBeCloseTo(1.8415, 3);
		expect(modeMae('sliding')).toBeCloseTo(2.2095, 3);
	});

	it('the fold error is the mean absolute error of its test points', () => {
		const s = scoreFold('time', 1);
		const manual = s.points.reduce((acc, p) => acc + Math.abs(p.actual - p.pred), 0) / 2;
		expect(s.mae).toBeCloseTo(manual, 10);
		expect(s.points.map((p) => p.actual)).toEqual([SERIES[6], SERIES[7]]);
	});

	it('the predictions are finite for every mode and fold', () => {
		for (const m of ['random', 'time', 'sliding'] as const) {
			for (let f = 1; f <= N_SPLITS; f++) {
				for (const p of scoreFold(m, f).points) expect(Number.isFinite(p.pred)).toBe(true);
			}
		}
	});
});

describe('text helpers', () => {
	it('rangeText writes consecutive indices as a range and gaps as a list', () => {
		expect(rangeText([6, 7])).toBe('6–7');
		expect(rangeText([3])).toBe('3');
		expect(rangeText([2, 8])).toBe('2, 8');
		expect(rangeText([])).toBe('нет');
	});

	it('describeSplit names the mode, the split and the score', () => {
		const text = describeSplit('time', 1);
		expect(text).toContain('По времени');
		expect(text).toContain('разбиение 1 из 3');
		expect(text).toContain('Обучение: точки 0–5');
		expect(text).toContain('Тест: точки 6–7');
		expect(text).toContain('2.07');
	});
});
