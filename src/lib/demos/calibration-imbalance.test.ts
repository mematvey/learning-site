import { describe, expect, it } from 'vitest';
import {
	binGroups,
	computeDemo,
	costThreshold,
	decide,
	DEFAULT_STATE,
	expectedCalibrationError,
	fitIsotonic,
	fitPlatt,
	isotonicPredict,
	makeNoise,
	makeSample,
	mulberry32,
	plattPredict,
	snapCost,
	snapOverconfidence,
	snapPrevalence,
	weightedProbability,
	logit,
	sigmoid,
} from './calibration-imbalance';

describe('expectedCalibrationError', () => {
	it('gives 0.16875 for the example from the chapter text', () => {
		const groups = [
			{ count: 4, conf: 0.25, acc: 0.25 },
			{ count: 4, conf: 0.8375, acc: 0.5 },
		];
		expect(expectedCalibrationError(groups)).toBeCloseTo(0.16875, 10);
	});

	it('is zero for a perfectly calibrated set of groups', () => {
		expect(expectedCalibrationError([{ count: 10, conf: 0.3, acc: 0.3 }])).toBe(0);
	});

	it('bins predictions and keeps only non-empty bins', () => {
		const groups = binGroups([0.05, 0.06, 0.95], [0, 1, 1], 10);
		expect(groups.map((g) => g.count)).toEqual([2, 1]);
		expect(groups[0]?.acc).toBeCloseTo(0.5, 10);
	});
});

describe('cost threshold and class weights', () => {
	it('gives 1/51 for a missed positive that costs 50 times a false alarm', () => {
		expect(costThreshold(1, 50)).toBeCloseTo(1 / 51, 12);
	});

	it('gives p = 0.5 for p = 0.1 and weight 9', () => {
		expect(weightedProbability(0.1, 9)).toBeCloseTo(0.5, 12);
	});

	it('keeps weight 1 unchanged', () => {
		expect(weightedProbability(0.37, 1)).toBeCloseTo(0.37, 12);
	});
});

describe('seeded data', () => {
	it('mulberry32 gives the same sequence for the same seed', () => {
		const a = mulberry32(7);
		const b = mulberry32(7);
		for (let i = 0; i < 20; i++) expect(a()).toBe(b());
	});

	it('makes the same sample for the same state', () => {
		const s1 = makeSample(DEFAULT_STATE, makeNoise());
		const s2 = makeSample(DEFAULT_STATE, makeNoise());
		expect(s1.raw).toEqual(s2.raw);
		expect(s1.y).toEqual(s2.y);
	});

	it('with zero overconfidence the raw score is the true probability', () => {
		const s = makeSample({ prevalence: 0.3, overconfidence: 0 });
		const noise = makeNoise();
		for (let i = 0; i < 5; i++) {
			const l = logit(0.3) + 1.5 * (noise.z[i] ?? 0);
			expect(s.raw[i]).toBeCloseTo(sigmoid(l), 10);
		}
	});
});

describe('Platt scaling', () => {
	it('recovers the slope 1 / k and the intercept 0 when the raw score is k times the true logit', () => {
		const state = { prevalence: 0.3, overconfidence: 0.5 };
		const { raw, y } = makeSample(state);
		const fit = fitPlatt(raw.map(logit), y);
		// k = 1 + 2 * 0.5 = 2, so the true slope is 1 / 2 and the intercept is 0 in the model.
		expect(fit.a).toBeGreaterThan(0.3);
		expect(fit.a).toBeLessThan(0.7);
		expect(Math.abs(fit.b)).toBeLessThan(0.3);
	});

	it('keeps the order of the objects (it is monotone)', () => {
		const p = { a: 0.5, b: 0.1 };
		const grid = [0.01, 0.2, 0.5, 0.8, 0.99];
		const out = grid.map((s) => plattPredict(p, s));
		for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThan(out[i - 1] ?? NaN);
	});
});

describe('isotonic regression', () => {
	it('returns a non-decreasing step function', () => {
		const { raw, y } = makeSample({ prevalence: 0.2, overconfidence: 0.8 });
		const iso = fitIsotonic(raw, y);
		let prev = -Infinity;
		for (let s = 0.001; s < 1; s += 0.01) {
			const v = isotonicPredict(iso, s);
			expect(v).toBeGreaterThanOrEqual(prev);
			prev = v;
		}
	});
});

describe('computeDemo', () => {
	it('reduces ECE after Platt calibration on an overconfident model', () => {
		const r = computeDemo({ ...DEFAULT_STATE, overconfidence: 1, method: 'platt' });
		expect(r.eceAfter).not.toBeNull();
		expect(r.eceAfter as number).toBeLessThan(r.eceBefore);
	});

	it('has no calibrated part when the method is none', () => {
		const r = computeDemo({ ...DEFAULT_STATE, method: 'none' });
		expect(r.after).toBeNull();
		expect(r.eceAfter).toBeNull();
	});

	it('uses the cost threshold from the cost slider', () => {
		const r = computeDemo({ ...DEFAULT_STATE, costFn: 50 });
		expect(r.threshold).toBeCloseTo(1 / 51, 12);
	});

	it('the expensive-miss threshold flags more objects than 0.5', () => {
		const r = computeDemo({ ...DEFAULT_STATE, prevalence: 0.05, costFn: 50 });
		expect(r.atThreshold.flagged).toBeGreaterThanOrEqual(r.atHalf.flagged);
	});
});

describe('decide', () => {
	it('sums false alarms and misses with the cost weights', () => {
		const d = decide([0.9, 0.1, 0.6, 0.2], [1, 1, 0, 0], 0.5, 10);
		expect(d.caught).toBe(1);
		expect(d.missed).toBe(1);
		expect(d.falseAlarms).toBe(1);
		expect(d.cost).toBe(1 + 10);
	});
});

describe('snapping sliders', () => {
	it('clamps and rounds the controls', () => {
		expect(snapPrevalence(0.2349)).toBe(0.23);
		expect(snapPrevalence(9)).toBe(0.5);
		expect(snapOverconfidence(0.52)).toBe(0.5);
		expect(snapCost(0)).toBe(1);
		expect(snapCost(NaN)).toBe(50);
	});
});
