import { describe, expect, it } from 'vitest';
import {
	ALPHA_MAX,
	ALPHA_MIN,
	DEFAULT_STATE,
	TRUE_EFFECT,
	describeState,
	estimate,
	isScenario,
	snapAlpha,
} from './causal-dag';

describe('estimate', () => {
	it('confounder: without control the slope is biased, with control it equals the true effect', () => {
		expect(estimate('confounder', false, 1)).toBeCloseTo(2.5, 10);
		expect(estimate('confounder', false, 2)).toBeCloseTo(2.4, 10);
		expect(estimate('confounder', true, 1)).toBe(TRUE_EFFECT);
	});

	it('confounder: no confounding (alpha 0) gives the true effect even without control', () => {
		expect(estimate('confounder', false, 0)).toBeCloseTo(TRUE_EFFECT, 10);
	});

	it('mediator: total effect without control, zero direct effect with control', () => {
		expect(estimate('mediator', false, 1)).toBe(2);
		expect(estimate('mediator', true, 1)).toBe(0);
	});

	it('collider: control for the collider creates bias', () => {
		expect(estimate('collider', false, 1)).toBe(TRUE_EFFECT);
		expect(estimate('collider', true, 1)).toBe(0.5);
	});
});

describe('snapAlpha', () => {
	it('clamps to the range and snaps to the step', () => {
		expect(snapAlpha(-3)).toBe(ALPHA_MIN);
		expect(snapAlpha(9)).toBe(ALPHA_MAX);
		expect(snapAlpha(0.8)).toBe(1);
		expect(snapAlpha(Number.NaN)).toBe(DEFAULT_STATE.alpha);
	});
});

describe('isScenario', () => {
	it('accepts only known scenario names', () => {
		expect(isScenario('collider')).toBe(true);
		expect(isScenario('chain')).toBe(false);
		expect(isScenario(3)).toBe(false);
	});
});

describe('describeState', () => {
	it('mentions the value and the control status', () => {
		const text = describeState({ scenario: 'confounder', adjust: false, alpha: 1 });
		expect(text).toContain('2.50');
		expect(text).toContain('без контроля');
	});
});
