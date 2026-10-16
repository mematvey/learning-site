import { describe, expect, it } from 'vitest';
import {
	BIG_SHIFT,
	DEFAULT_STATE,
	SOFTMAX_SIZE,
	argmaxFinite,
	clampLogit,
	clampTemperature,
	describeSoftmax,
	normalizeLogits,
	probabilities,
	softmaxNaive,
	softmaxStable,
	sumOf,
	type SoftmaxDemoState,
} from './softmax';

const small = [2.2, 1.4, 0.3, -0.8, 0];

describe('softmax variants', () => {
	it('sums to 1 for both variants on ordinary logits', () => {
		expect(sumOf(softmaxNaive(small))).toBeCloseTo(1, 12);
		expect(sumOf(softmaxStable(small))).toBeCloseTo(1, 12);
	});

	it('stable and naive agree on ordinary logits', () => {
		const a = softmaxNaive(small);
		const b = softmaxStable(small);
		a.forEach((p, i) => expect(p).toBeCloseTo(b[i] ?? NaN, 12));
	});

	it('naive softmax gives NaN for large logits, stable stays finite and sums to 1', () => {
		const big = [1000, 999, 998, 0, -1];
		expect(softmaxNaive(big).some((p) => Number.isNaN(p))).toBe(true);
		const stable = softmaxStable(big);
		expect(stable.every((p) => Number.isFinite(p))).toBe(true);
		expect(sumOf(stable)).toBeCloseTo(1, 12);
		expect(stable[0] ?? 0).toBeGreaterThan(stable[1] ?? 0);
	});

	it('stable softmax is invariant to a common shift of all logits', () => {
		const base = softmaxStable(small);
		const shifted = softmaxStable(small.map((z) => z + 123.4));
		base.forEach((p, i) => expect(shifted[i]).toBeCloseTo(p, 12));
	});
});

describe('clamping and normalisation', () => {
	it('clampLogit keeps values in range and on the 0.1 grid', () => {
		expect(clampLogit(9)).toBe(5);
		expect(clampLogit(-9)).toBe(-5);
		expect(clampLogit(0.123)).toBe(0.1);
		expect(clampLogit(Number.NaN)).toBe(0);
	});

	it('clampTemperature keeps T in [0.1, 5]', () => {
		expect(clampTemperature(0)).toBe(0.1);
		expect(clampTemperature(7)).toBe(5);
		expect(clampTemperature(1.04)).toBe(1);
	});

	it('normalizeLogits requires exactly SOFTMAX_SIZE entries', () => {
		expect(normalizeLogits([1, 2])).toBeNull();
		expect(normalizeLogits([1, 2, 3, 4, 9])).toEqual([1, 2, 3, 4, 5]);
		expect(SOFTMAX_SIZE).toBe(5);
	});
});

describe('probabilities for the demo state', () => {
	const base: SoftmaxDemoState = { ...DEFAULT_STATE, logits: [...small] };

	it('lower temperature sharpens the distribution', () => {
		const sharp = probabilities({ ...base, temperature: 0.1 });
		const soft = probabilities({ ...base, temperature: 5 });
		expect(Math.max(...sharp)).toBeGreaterThan(Math.max(...soft));
	});

	it('big logits overflow in the naive variant but not in the stable one', () => {
		const naive = probabilities({ ...base, big: true, stable: false });
		expect(naive.some((p) => Number.isNaN(p))).toBe(true);
		const stable = probabilities({ ...base, big: true, stable: true });
		expect(stable.every((p) => Number.isFinite(p))).toBe(true);
	});

	it('the stable result does not change when the big shift is switched on', () => {
		const off = probabilities({ ...base, stable: true });
		const on = probabilities({ ...base, stable: true, big: true });
		off.forEach((p, i) => expect(on[i]).toBeCloseTo(p, 10));
	});

	it('big shift is large enough to overflow the naive variant at T = 1', () => {
		expect(BIG_SHIFT).toBeGreaterThan(709);
	});

	it('argmaxFinite skips NaN and returns -1 when nothing is finite', () => {
		expect(argmaxFinite([NaN, 0.2, 0.5])).toBe(2);
		expect(argmaxFinite([NaN, NaN])).toBe(-1);
	});

	it('describeSoftmax mentions NaN for the naive overflow case', () => {
		expect(describeSoftmax({ ...base, big: true, stable: false })).toContain('NaN');
	});
});
