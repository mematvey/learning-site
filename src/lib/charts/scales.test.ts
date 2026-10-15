import { describe, expect, it } from 'vitest';
import {
	bandScale,
	catVar,
	clampChartWidth,
	linearScale,
	MIN_CHART_WIDTH,
	niceExtent,
} from './scales';

describe('scales', () => {
	it('pads extent and never returns a zero span', () => {
		const [lo, hi] = niceExtent([0, 10], 0.1);
		expect(lo).toBeCloseTo(-1);
		expect(hi).toBeCloseTo(11);
		const [clo, chi] = niceExtent([4, 4]);
		expect(chi).toBeGreaterThan(clo);
		const [zlo, zhi] = niceExtent([]);
		expect([zlo, zhi]).toEqual([0, 1]);
	});

	it('includes zero when asked', () => {
		expect(niceExtent([5, 9], 0, true)[0]).toBe(0);
	});

	it('maps linear domain onto an inverted range', () => {
		const y = linearScale([0, 10], [100, 0]);
		expect(y(0)).toBe(100);
		expect(y(10)).toBe(0);
	});

	it('gives every band a position inside the range', () => {
		const band = bandScale(['a', 'b', 'c'], [0, 300]);
		const [x0 = -1, x1 = -1, x2 = -1] = ['a', 'b', 'c'].map((l) => band(l) ?? -1);
		expect(x0).toBeGreaterThanOrEqual(0);
		expect(x2 + band.bandwidth()).toBeLessThanOrEqual(300);
		expect(x0 < x1 && x1 < x2).toBe(true);
	});

	it('wraps series colours over --cat-1..6', () => {
		expect(catVar(1)).toBe('var(--cat-1)');
		expect(catVar(6)).toBe('var(--cat-6)');
		expect(catVar(7)).toBe('var(--cat-1)');
	});

	it('clamps width to the minimum', () => {
		expect(clampChartWidth(100)).toBe(MIN_CHART_WIDTH);
		expect(clampChartWidth(500.7)).toBe(500);
	});
});
