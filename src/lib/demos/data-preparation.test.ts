import { describe, expect, it } from 'vitest';
import {
	CHANCE,
	FOLDS,
	K_DEFAULT,
	K_MAX,
	K_MIN,
	N_FEATURES,
	N_ROWS,
	average,
	clampK,
	clampSeed,
	cvScores,
	describeLeak,
	isScope,
	makeDataset,
	sweep,
} from './data-preparation';

describe('makeDataset', () => {
	it('is deterministic for a seed and has the expected shape', () => {
		const a = makeDataset(3);
		const b = makeDataset(3);
		expect(a).toEqual(b);
		expect(a.X).toHaveLength(N_ROWS);
		expect(a.X[0]).toHaveLength(N_FEATURES);
		expect(a.y).toHaveLength(N_ROWS);
		expect(new Set(a.y)).toEqual(new Set([0, 1]));
	});

	it('gives different data for different seeds', () => {
		expect(makeDataset(1).y).not.toEqual(makeDataset(2).y);
	});
});

describe('cvScores', () => {
	it('returns one accuracy per fold, each in [0, 1]', () => {
		const r = cvScores(makeDataset(1), K_DEFAULT, 'train');
		expect(r.folds).toHaveLength(FOLDS);
		for (const v of r.folds) {
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(1);
		}
		expect(r.mean).toBeCloseTo(average(r.folds), 12);
	});

	it('is deterministic', () => {
		const d = makeDataset(5);
		expect(cvScores(d, 10, 'all')).toEqual(cvScores(d, 10, 'all'));
	});
});

describe('leakage effect', () => {
	const allSweep = sweep(K_DEFAULT, 'all');
	const trainSweep = sweep(K_DEFAULT, 'train');

	it('honest scheme stays near chance on pure noise', () => {
		expect(Math.abs(average(trainSweep) - CHANCE)).toBeLessThan(0.05);
	});

	it('fitting preprocessing on all rows inflates the estimate clearly', () => {
		expect(average(allSweep)).toBeGreaterThan(average(trainSweep) + 0.1);
	});

	it('the inflated estimate is higher than chance on most datasets', () => {
		const above = allSweep.filter((v) => v > CHANCE).length;
		expect(above).toBeGreaterThanOrEqual(Math.floor(allSweep.length * 0.9));
	});
});

describe('input helpers', () => {
	it('clamps k and seed to their ranges and handles non-finite input', () => {
		expect(clampK(0)).toBe(K_MIN);
		expect(clampK(999)).toBe(K_MAX);
		expect(clampK(Number.NaN)).toBe(K_DEFAULT);
		expect(clampSeed(0)).toBe(1);
		expect(clampSeed(1000)).toBe(30);
	});

	it('recognises scopes', () => {
		expect(isScope('all')).toBe(true);
		expect(isScope('train')).toBe(true);
		expect(isScope('both')).toBe(false);
	});

	it('describes the gap only when it is large', () => {
		expect(describeLeak(0.7, 0.5, 10)).toContain('0,70');
		expect(describeLeak(0.52, 0.5, 10)).toContain('близкие');
	});
});
