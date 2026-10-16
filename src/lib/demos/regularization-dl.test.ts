import { describe, expect, it } from 'vitest';
import {
	DEFAULT_P,
	DEFAULT_WD,
	EPOCHS,
	N_NEURONS,
	bestEpoch,
	dropoutMask,
	finalGap,
	keepScale,
	keptFraction,
	lossCurves,
	regStrength,
	snapP,
	snapStep,
	snapWd,
	trainLoss,
	valLoss,
} from './regularization-dl';

const minVal = (v: readonly number[]): number => v[bestEpoch(v)] ?? Infinity;

describe('snapping of sliders', () => {
	it('rounds p to the step and clamps it to the range', () => {
		expect(snapP(0.34)).toBe(0.3);
		expect(snapP(-1)).toBe(0);
		expect(snapP(5)).toBeCloseTo(0.8, 10);
		expect(snapP(Number.NaN)).toBe(DEFAULT_P);
	});

	it('rounds the weight decay and gives the default for non-finite input', () => {
		expect(snapWd(0.054)).toBeCloseTo(0.05, 10);
		expect(snapWd(1)).toBeCloseTo(0.1, 10);
		expect(snapWd(Number.POSITIVE_INFINITY)).toBe(DEFAULT_WD);
	});

	it('keeps the step a non-negative integer', () => {
		expect(snapStep(-3)).toBe(0);
		expect(snapStep(2.7)).toBe(2);
	});
});

describe('dropoutMask', () => {
	it('is deterministic for the same step and changes between steps', () => {
		expect(dropoutMask(N_NEURONS, 0.5, 3)).toEqual(dropoutMask(N_NEURONS, 0.5, 3));
		expect(dropoutMask(N_NEURONS, 0.5, 3)).not.toEqual(dropoutMask(N_NEURONS, 0.5, 4));
	});

	it('keeps every neuron when p is 0', () => {
		for (let step = 0; step < 10; step++) {
			expect(dropoutMask(N_NEURONS, 0, step).every(Boolean)).toBe(true);
		}
	});

	it('drops about p of the neurons on average over many steps', () => {
		let kept = 0;
		const steps = 200;
		for (let step = 0; step < steps; step++) {
			kept += keptFraction(dropoutMask(N_NEURONS, 0.8, step));
		}
		expect(kept / steps).toBeCloseTo(0.2, 1);
	});

	it('scales kept neurons by 1 / (1 - p), so the expected output equals the input', () => {
		expect(keepScale(0.5)).toBeCloseTo(2, 10);
		expect(keepScale(0)).toBe(1);
		expect(keepScale(0.5) * (1 - 0.5)).toBeCloseTo(1, 10);
	});
});

describe('loss curves', () => {
	it('has one value per epoch from 0 to EPOCHS', () => {
		const c = lossCurves(0.3, 0.03);
		expect(c.epochs.length).toBe(EPOCHS + 1);
		expect(c.train.length).toBe(EPOCHS + 1);
		expect(c.val.length).toBe(EPOCHS + 1);
	});

	it('without regularisation the validation loss rises after its minimum (overfitting)', () => {
		const c = lossCurves(0, 0);
		const best = bestEpoch(c.val);
		expect(best).toBeGreaterThan(0);
		expect(best).toBeLessThan(EPOCHS);
		expect(valLoss(EPOCHS, 0, 0)).toBeGreaterThan(minVal(c.val) + 0.5);
	});

	it('the training loss does not grow with epochs when p and wd are 0', () => {
		const { train } = lossCurves(0, 0);
		train.slice(1).forEach((v, i) => expect(v).toBeLessThanOrEqual(train[i] ?? Infinity));
	});

	it('stronger regularisation raises the training loss and shrinks the final gap', () => {
		expect(trainLoss(EPOCHS, 0.5, 0.05)).toBeGreaterThan(trainLoss(EPOCHS, 0, 0));
		expect(finalGap(0.5, 0.05)).toBeLessThan(finalGap(0, 0));
	});

	it('too strong regularisation underfits: its best validation loss is above a moderate setting', () => {
		const moderate = lossCurves(0.5, 0.05);
		const strong = lossCurves(0.8, 0.1);
		expect(minVal(strong.val)).toBeGreaterThan(minVal(moderate.val));
	});

	it('the regularisation strength stays within [0, 0.9]', () => {
		expect(regStrength(0, 0)).toBe(0);
		expect(regStrength(0.8, 0.1)).toBe(0.9);
	});

	it('is pure: the same settings give the same curves', () => {
		expect(lossCurves(0.3, 0.03)).toEqual(lossCurves(0.3, 0.03));
	});
});

describe('bestEpoch', () => {
	it('returns the index of the smallest value and the first one on ties', () => {
		expect(bestEpoch([3, 1, 2, 1])).toBe(1);
		expect(bestEpoch([0])).toBe(0);
	});
});
