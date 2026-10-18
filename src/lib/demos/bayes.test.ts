import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	POPULATION,
	computeBayes,
	describeBayes,
	formatPercent,
	mosaicRects,
	positiveSplitWidth,
	snapPrevalence,
	snapSensitivity,
	snapSpecificity,
} from './bayes';

describe('computeBayes', () => {
	it('gives 9 of 108 for the default test (1%, 90%, 90%)', () => {
		const r = computeBayes(DEFAULT_STATE);
		expect(r.posterior).toBeCloseTo(9 / 108, 10);
		expect(formatPercent(r.posterior)).toBe('8.3%');
		expect(r.people.positive).toBeCloseTo(10.8, 10);
		expect(r.people.truePositive).toBeCloseTo(0.9, 10);
	});

	it('matches the chapter task about a 2% prevalence test', () => {
		const r = computeBayes({ prevalence: 2, sensitivity: 95, specificity: 90 });
		expect(r.posterior).toBeCloseTo(19 / 117, 10);
	});

	it('gives the prior when the test does not separate the groups', () => {
		// P(+ | sick) = P(+ | healthy): sensitivity 90% and 1 - specificity 90%.
		const r = computeBayes({ prevalence: 30, sensitivity: 90, specificity: 10 });
		expect(r.posterior).toBeCloseTo(0.3, 10);
	});

	it('gives posterior 1 for a perfect test and 0 when there are no false positives', () => {
		expect(computeBayes({ prevalence: 1, sensitivity: 100, specificity: 100 }).posterior).toBe(1);
		expect(computeBayes({ prevalence: 1, sensitivity: 90, specificity: 100 }).posterior).toBe(1);
		expect(computeBayes({ prevalence: 1, sensitivity: 0, specificity: 100 }).posterior).toBe(0);
	});

	it('returns 0 instead of NaN when a denominator is zero', () => {
		const r = computeBayes({ prevalence: 0, sensitivity: 90, specificity: 100 });
		expect(r.posterior).toBe(0);
		expect(Number.isNaN(r.posteriorNegative)).toBe(false);
	});

	it('sums the four groups to the population', () => {
		const p = computeBayes({ prevalence: 17, sensitivity: 73, specificity: 81 }).people;
		expect(p.truePositive + p.falseNegative + p.falsePositive + p.trueNegative).toBeCloseTo(
			POPULATION,
			10,
		);
		expect(p.sick + p.healthy).toBeCloseTo(POPULATION, 10);
	});
});

describe('snapping', () => {
	it('clamps to the slider range and rounds to the step', () => {
		expect(snapPrevalence(-5)).toBe(0.5);
		expect(snapPrevalence(80)).toBe(50);
		expect(snapPrevalence(1.3)).toBe(1.5);
		expect(snapSensitivity(12)).toBe(50);
		expect(snapSensitivity(90.4)).toBe(90);
		expect(snapSpecificity(101)).toBe(100);
	});

	it('falls back to the default for non-finite input', () => {
		expect(snapPrevalence(Number.NaN)).toBe(DEFAULT_STATE.prevalence);
		expect(snapSensitivity(Number.POSITIVE_INFINITY)).toBe(DEFAULT_STATE.sensitivity);
		expect(snapSpecificity(Number.NaN)).toBe(DEFAULT_STATE.specificity);
	});
});

describe('mosaicRects', () => {
	it('gives rectangles whose areas are the group shares of the population', () => {
		const W = 200;
		const H = 100;
		const m = mosaicRects(DEFAULT_STATE, W, H);
		const area = (r: { width: number; height: number }) => (r.width * r.height) / (W * H);
		expect(area(m.truePositive)).toBeCloseTo(0.009, 10);
		expect(area(m.falseNegative)).toBeCloseTo(0.001, 10);
		expect(area(m.falsePositive)).toBeCloseTo(0.099, 10);
		expect(area(m.trueNegative)).toBeCloseTo(0.891, 10);
	});

	it('fills the whole box', () => {
		const m = mosaicRects({ prevalence: 40, sensitivity: 60, specificity: 75 }, 300, 170);
		const total = Object.values(m).reduce((s, r) => s + r.width * r.height, 0);
		expect(total).toBeCloseTo(300 * 170, 6);
	});
});

describe('positiveSplitWidth', () => {
	it('splits the positive bar by the posterior', () => {
		expect(positiveSplitWidth(DEFAULT_STATE, 108)).toBeCloseTo(9, 10);
	});
});

describe('describeBayes', () => {
	it('is deterministic and mentions the posterior', () => {
		const text = describeBayes(DEFAULT_STATE);
		expect(text).toBe(describeBayes({ ...DEFAULT_STATE }));
		expect(text).toContain('8.3%');
	});
});

describe('posteriorTwoPositives', () => {
	it('uses the first posterior as the prior for a second positive test', () => {
		expect(computeBayes(DEFAULT_STATE).posteriorTwoPositives).toBeCloseTo(0.45, 10);
	});
});
