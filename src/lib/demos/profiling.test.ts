import { describe, expect, it } from 'vitest';
import {
	AMDAHL_PRESETS,
	GAP_MS,
	KERNEL_MS,
	STEP_MS,
	amdahlLimit,
	amdahlSpeedup,
	amdahlTime,
	buildTimeline,
	kernelBox,
	loadPercent,
	savedShare,
	snapFraction,
	snapSpeedup,
} from './profiling';

describe('buildTimeline', () => {
	const t = buildTimeline();

	it('matches the chapter example: 100 ms step, 45 ms of kernels, 55 ms idle, load 45%', () => {
		expect(t.stepMs).toBe(100);
		expect(t.busyMs).toBeCloseTo(45, 10);
		expect(t.idleMs).toBeCloseTo(55, 10);
		expect(t.load).toBeCloseTo(0.45, 10);
		expect(loadPercent(t)).toBe(45);
	});

	it('places kernels in order after their gaps and ends exactly at the step', () => {
		let prevEnd = 0;
		for (const k of t.kernels) {
			expect(k.start).toBeCloseTo(prevEnd + k.gapBefore, 10);
			expect(k.start).toBeGreaterThanOrEqual(prevEnd);
			prevEnd = k.start + k.duration;
		}
		expect(prevEnd).toBeCloseTo(STEP_MS, 10);
	});

	it('has one gap of positive length before every kernel and no kernel is empty', () => {
		expect(t.kernels).toHaveLength(KERNEL_MS.length);
		for (const k of t.kernels) {
			expect(k.gapBefore).toBeGreaterThan(0);
			expect(k.duration).toBeGreaterThan(0);
		}
	});

	it('rejects inputs whose sums do not fill the step', () => {
		expect(() => buildTimeline([10, 10], [5, 5], 100)).toThrow();
		expect(() => buildTimeline([10, 10], [5], 25)).toThrow();
	});

	it('the fixed data has gaps that add up to the idle time', () => {
		const gaps = GAP_MS.reduce((s, v) => s + v, 0);
		expect(gaps).toBeCloseTo(t.idleMs, 10);
	});
});

describe('kernelBox', () => {
	it('gives left and width as percentages of the step', () => {
		const t = buildTimeline();
		const k = t.kernels[0];
		if (!k) throw new Error('timeline has no kernels');
		const box = kernelBox(k, t.stepMs);
		expect(box.left).toBeCloseTo((k.start / 100) * 100, 10);
		expect(box.width).toBeCloseTo(8, 10);
	});
});

describe('Amdahl law', () => {
	it("gives the chapter example: f = 0.3, s = 2 -> T' = 0.85 T, speed-up about 1.18", () => {
		expect(amdahlTime(0.3, 2)).toBeCloseTo(0.85, 10);
		expect(amdahlSpeedup(0.3, 2)).toBeCloseTo(1 / 0.85, 10);
		expect(amdahlSpeedup(0.3, 2).toFixed(2)).toBe('1.18');
	});

	it('gives the limit for f = 0.3: 1 / 0.7 about 1.43, and the speed-up never exceeds it', () => {
		expect(amdahlLimit(0.3)).toBeCloseTo(1 / 0.7, 10);
		expect(amdahlLimit(0.3).toFixed(2)).toBe('1.43');
		for (const s of [1, 2, 10, 1000, 1e9]) {
			expect(amdahlSpeedup(0.3, s)).toBeLessThanOrEqual(amdahlLimit(0.3) + 1e-9);
		}
	});

	it('gives the small-share example: f = 0.03, s = 10 saves 2.7% of the time', () => {
		expect(amdahlTime(0.03, 10)).toBeCloseTo(0.973, 10);
		expect(savedShare(0.03, 10)).toBeCloseTo(0.027, 10);
	});

	it('does not change the time when s = 1', () => {
		expect(amdahlTime(0.5, 1)).toBeCloseTo(1, 12);
		expect(amdahlSpeedup(0.5, 1)).toBeCloseTo(1, 12);
	});

	it('the presets from the text reproduce the numbers above', () => {
		const attention = AMDAHL_PRESETS.find((p) => p.id === 'attention');
		const small = AMDAHL_PRESETS.find((p) => p.id === 'small');
		expect(attention).toBeDefined();
		expect(small).toBeDefined();
		if (!attention || !small) return;
		expect(amdahlSpeedup(attention.state.fraction, attention.state.speedup).toFixed(2)).toBe(
			'1.18',
		);
		expect(savedShare(small.state.fraction, small.state.speedup).toFixed(3)).toBe('0.027');
	});
});

describe('input snapping', () => {
	it('clamps and rounds the fraction and the speed-up', () => {
		expect(snapFraction(0)).toBe(0.01);
		expect(snapFraction(2)).toBe(0.99);
		expect(snapFraction(0.304)).toBe(0.3);
		expect(snapSpeedup(0.2)).toBe(1);
		expect(snapSpeedup(50)).toBe(20);
		expect(snapSpeedup(3.6)).toBe(4);
	});

	it('falls back to defaults for non-finite input', () => {
		expect(snapFraction(Number.NaN)).toBe(0.3);
		expect(snapSpeedup(Number.POSITIVE_INFINITY)).toBe(2);
	});
});
