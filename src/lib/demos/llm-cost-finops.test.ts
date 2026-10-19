import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	PRICE_HIGH,
	callCost,
	computeBreakdown,
	describeBreakdown,
	formatUnits,
	normalizeState,
} from './llm-cost-finops';

describe('computeBreakdown', () => {
	it('default state gives 0,027 per successful task and 0,045 without routing', () => {
		const b = computeBreakdown(DEFAULT_STATE);
		expect(b.success).toBeCloseTo(0.78, 10);
		expect(b.perSuccess.total).toBeCloseTo(0.027, 10);
		expect(b.reference).toBeCloseTo(0.045, 10);
		expect(b.saving).toBeCloseTo(0.4, 10);
	});

	it('50 percent cache gives 0,0216 per successful task', () => {
		const b = computeBreakdown({ ...DEFAULT_STATE, cacheShare: 50 });
		expect(b.perSuccess.total).toBeCloseTo(0.0216, 10);
	});

	it('one call costs 0,0135 on the expensive route and 0,0027 on the cheap one', () => {
		expect(callCost(PRICE_HIGH, 0).total).toBeCloseTo(0.0135, 10);
		const b = computeBreakdown(DEFAULT_STATE);
		expect(b.high.task.total).toBeCloseTo(0.0405, 10);
		expect(b.low.task.total).toBeCloseTo(0.0081, 10);
	});

	it('cache changes only the input part: output cost stays the same', () => {
		const cold = computeBreakdown(DEFAULT_STATE);
		const warm = computeBreakdown({ ...DEFAULT_STATE, cacheShare: 100 });
		expect(warm.high.call.output).toBeCloseTo(cold.high.call.output, 12);
		expect(warm.high.call.input).toBeLessThan(cold.high.call.input);
	});

	it('the split into input and output adds up to the total', () => {
		const b = computeBreakdown({ ...DEFAULT_STATE, routeShare: 35, cacheShare: 40 });
		expect(b.perSuccess.input + b.perSuccess.output).toBeCloseTo(b.perSuccess.total, 12);
		expect(b.failed).toBeGreaterThan(0);
	});

	it('0 percent routing equals the expensive route, 100 percent equals the cheap one', () => {
		const none = computeBreakdown({ ...DEFAULT_STATE, routeShare: 0 });
		expect(none.perSuccess.total).toBeCloseTo(0.045, 10);
		const all = computeBreakdown({ ...DEFAULT_STATE, routeShare: 100 });
		expect(all.perSuccess.total).toBeCloseTo(0.0081 / 0.7, 10);
	});
});

describe('normalizeState and formatting', () => {
	it('snaps to the slider grid and clamps success rates', () => {
		const s = normalizeState({ routeShare: 62, successLow: 5, cacheShare: 150 });
		expect(s.routeShare).toBe(60);
		expect(s.successLow).toBe(30);
		expect(s.cacheShare).toBe(100);
		expect(s.successHigh).toBe(DEFAULT_STATE.successHigh);
	});

	it('non-finite input falls back to the default', () => {
		expect(normalizeState({ routeShare: Number.NaN })).toEqual(DEFAULT_STATE);
	});

	it('formats money with a comma and at least three decimals', () => {
		expect(formatUnits(0.027)).toBe('0,027');
		expect(formatUnits(0.0216)).toBe('0,0216');
		expect(formatUnits(0.045)).toBe('0,045');
		expect(formatUnits(0.01)).toBe('0,010');
	});
});

describe('describeBreakdown', () => {
	it('explains the default state with the cause and the effect lines', () => {
		const lines = describeBreakdown(DEFAULT_STATE, computeBreakdown(DEFAULT_STATE));
		expect(lines.length).toBeGreaterThanOrEqual(5);
		expect(lines[0]).toContain('0,0211');
		expect(lines.at(-1)).toContain('Экономия');
	});
});
