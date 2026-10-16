import { describe, expect, it } from 'vitest';
import {
	PRESETS,
	W_MAX,
	W_MIN,
	clampWeight,
	describeState,
	initialWeights,
	isPreset,
	setWeight,
	summarize,
	weightFromY,
} from './random-variables';

const die = PRESETS.die;
const sum = PRESETS.sum;

/** Distribution of the sum of two independent dice, built by convolution from one die's weights. */
function convolveTwo(weights: readonly number[]): number[] {
	const out = new Array<number>(weights.length * 2 - 1).fill(0);
	weights.forEach((a, i) =>
		weights.forEach((b, j) => {
			out[i + j] = (out[i + j] ?? 0) + a * b;
		}),
	);
	return out;
}

describe('summarize', () => {
	it('gives expectation 3.5 and variance 35/12 for a fair die', () => {
		const s = summarize(die.values, die.initial);
		expect(s).not.toBeNull();
		expect(s!.mean).toBeCloseTo(3.5, 10);
		expect(s!.variance).toBeCloseTo(35 / 12, 10);
		expect(s!.std).toBeCloseTo(Math.sqrt(35 / 12), 10);
	});

	it('gives expectation 7 and variance 35/6 for the sum of two dice', () => {
		const s = summarize(sum.values, sum.initial);
		expect(s!.mean).toBeCloseTo(7, 10);
		expect(s!.variance).toBeCloseTo(35 / 6, 10);
	});

	it('matches the sum preset when the die is convolved with itself', () => {
		const conv = convolveTwo(die.initial);
		expect(conv).toEqual([...sum.initial]);
	});

	it('gives probabilities that sum to 1 whatever the weights are', () => {
		const s = summarize(die.values, [3, 0, 7, 2, 0, 9]);
		expect(s!.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
	});

	it('does not change when all weights are scaled by the same factor', () => {
		const a = summarize(sum.values, sum.initial);
		const b = summarize(
			sum.values,
			sum.initial.map((w) => w * 7),
		);
		expect(b!.mean).toBeCloseTo(a!.mean, 12);
		expect(b!.variance).toBeCloseTo(a!.variance, 12);
	});

	it('gives zero variance when one value has all the weight', () => {
		const s = summarize([1, 2, 3], [0, 5, 0]);
		expect(s!.mean).toBe(2);
		expect(s!.variance).toBe(0);
	});

	it('returns null when all weights are zero', () => {
		expect(summarize(die.values, [0, 0, 0, 0, 0, 0])).toBeNull();
	});
});

describe('setWeight', () => {
	it('sets one column and rounds the value', () => {
		expect(setWeight([1, 1, 1], 1, 4.6)).toEqual([1, 5, 1]);
	});

	it('clamps the weight to the allowed range', () => {
		expect(setWeight([1, 1], 0, 99)[0]).toBe(W_MAX);
		expect(setWeight([1, 1], 0, -3)[0]).toBe(W_MIN);
	});

	it('refuses a change that would make every weight zero', () => {
		expect(setWeight([0, 0, 4], 2, 0)).toEqual([0, 0, 4]);
	});

	it('ignores an index outside the array', () => {
		expect(setWeight([1, 2], 5, 9)).toEqual([1, 2]);
	});

	it('does not mutate the input array', () => {
		const input = [1, 2, 3];
		setWeight(input, 0, 8);
		expect(input).toEqual([1, 2, 3]);
	});
});

describe('clampWeight and weightFromY', () => {
	it('maps non-finite input to the minimum weight', () => {
		expect(clampWeight(Number.NaN)).toBe(W_MIN);
		expect(clampWeight(Number.POSITIVE_INFINITY)).toBe(W_MIN);
	});

	it('maps the top of the plot to the maximum and the baseline to zero', () => {
		expect(weightFromY(0, 200)).toBe(W_MAX);
		expect(weightFromY(200, 200)).toBe(W_MIN);
		expect(weightFromY(100, 200)).toBe(5);
	});

	it('clamps pointer positions outside the plot', () => {
		expect(weightFromY(-50, 200)).toBe(W_MAX);
		expect(weightFromY(900, 200)).toBe(W_MIN);
	});
});

describe('presets and helpers', () => {
	it('recognises the two presets only', () => {
		expect(isPreset('die')).toBe(true);
		expect(isPreset('sum')).toBe(true);
		expect(isPreset('coin')).toBe(false);
		expect(isPreset(undefined)).toBe(false);
	});

	it('returns fresh copies of the initial weights', () => {
		const w = initialWeights('die');
		w[0] = 9;
		expect(PRESETS.die.initial[0]).toBe(1);
	});

	it('keeps every starting weight inside the editable range', () => {
		for (const def of [die, sum]) {
			for (const w of def.initial) {
				expect(w).toBeGreaterThanOrEqual(W_MIN);
				expect(w).toBeLessThanOrEqual(W_MAX);
			}
		}
	});

	it('describes the state with computed numbers', () => {
		const text = describeState(die, summarize(die.values, die.initial));
		expect(text).toContain('E[X] = 3.50');
		expect(text).toContain('Var(X) = 2.92');
	});

	it('describes the all-zero state without numbers', () => {
		expect(describeState(die, null)).toContain('не определены');
	});
});
