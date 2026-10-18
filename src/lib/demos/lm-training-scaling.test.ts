import { describe, expect, it } from 'vitest';
import {
	LOG_C_DEFAULT,
	LOG_C_MAX,
	LOG_C_MIN,
	computeBudget,
	describeScaling,
	formatSci,
	lossCurve,
	optimalParams,
	optimalTokens,
	predictedLoss,
	scalingPoint,
	snapLogC,
} from './lm-training-scaling';

describe('computeBudget', () => {
	it('gives the chapter example: 1e9 parameters and 2e10 tokens need 1.2e20 FLOP', () => {
		expect(computeBudget(1e9, 2e10)).toBeCloseTo(1.2e20, -10);
	});
});

describe('optimalParams and optimalTokens', () => {
	it('recovers the chapter example from the budget 1.2e20', () => {
		expect(optimalParams(1.2e20)).toBeCloseTo(1e9, -1);
		expect(optimalTokens(1.2e20)).toBeCloseTo(2e10, -1);
	});

	it('keeps the tokens-per-parameter ratio fixed as the budget grows', () => {
		for (const c of [1e18, 1e20, 1e22, 1e24]) {
			expect(optimalTokens(c) / optimalParams(c)).toBeCloseTo(20, 9);
		}
	});

	it('spends the budget exactly: 6 N D equals C', () => {
		for (const c of [1e18, 3e21, 1e24]) {
			const n = optimalParams(c);
			const d = optimalTokens(c);
			expect(computeBudget(n, d) / c).toBeCloseTo(1, 9);
		}
	});

	it('grows both optima with the budget', () => {
		expect(optimalParams(1e22)).toBeGreaterThan(optimalParams(1e21));
		expect(optimalTokens(1e22)).toBeGreaterThan(optimalTokens(1e21));
	});
});

describe('predictedLoss', () => {
	it('falls when parameters or tokens grow, and tends to the constant E', () => {
		expect(predictedLoss(2e9, 2e10)).toBeLessThan(predictedLoss(1e9, 2e10));
		expect(predictedLoss(1e9, 4e10)).toBeLessThan(predictedLoss(1e9, 2e10));
		expect(predictedLoss(1e15, 1e15)).toBeGreaterThan(1.69);
		expect(predictedLoss(1e15, 1e15)).toBeLessThan(1.75);
	});
});

describe('scalingPoint and lossCurve', () => {
	it('gives a loss that falls as the budget grows along the optimal path', () => {
		const curve = lossCurve(61);
		expect(curve).toHaveLength(61);
		expect(curve.every((p, i) => i === 0 || p.loss < (curve[i - 1]?.loss ?? Infinity))).toBe(true);
	});

	it('clamps the log budget to the slider range', () => {
		expect(Math.log10(scalingPoint(LOG_C_MAX + 5).c)).toBeCloseTo(LOG_C_MAX, 9);
		expect(Math.log10(scalingPoint(LOG_C_MIN - 5).c)).toBeCloseTo(LOG_C_MIN, 9);
	});
});

describe('snapLogC', () => {
	it('rounds to the slider step and clamps to the range', () => {
		expect(snapLogC(20.004)).toBeCloseTo(20.0, 10);
		expect(snapLogC(20.006)).toBeCloseTo(20.01, 10);
		expect(snapLogC(99)).toBe(LOG_C_MAX);
		expect(snapLogC(-99)).toBe(LOG_C_MIN);
	});

	it('gives the default for non-finite input', () => {
		expect(snapLogC(Number.NaN)).toBe(LOG_C_DEFAULT);
		expect(snapLogC(Number.POSITIVE_INFINITY)).toBe(LOG_C_DEFAULT);
	});

	it('default budget is close to the chapter example 1.2e20', () => {
		expect(10 ** LOG_C_DEFAULT / 1.2e20).toBeCloseTo(1, 1);
	});
});

describe('formatSci', () => {
	it('formats with a superscript exponent', () => {
		expect(formatSci(1.2e20)).toBe('1.20·10²⁰');
		expect(formatSci(1e9)).toBe('1.00·10⁹');
		expect(formatSci(3.5e-4)).toBe('3.50·10⁻⁴');
	});

	it('moves to the next power when rounding gives 10.00', () => {
		expect(formatSci(9.999e5)).toBe('1.00·10⁶');
	});

	it('shows a dash for non-positive input', () => {
		expect(formatSci(0)).toBe('—');
		expect(formatSci(Number.NaN)).toBe('—');
	});
});

describe('describeScaling', () => {
	it('states that the numbers come from the model, not from training', () => {
		const text = describeScaling(scalingPoint(20.08));
		expect(text).toContain('1.20·10²⁰');
		expect(text).toContain('расчёт по модели');
	});
});
