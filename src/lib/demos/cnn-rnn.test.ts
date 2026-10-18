import { describe, expect, it } from 'vitest';
import {
	KERNEL,
	SIGNAL,
	conv1dValid,
	describeConv,
	describeRnn,
	formatNum,
	gradientAt,
	gradientProfile,
	profileMax,
	snapKernelPos,
	snapSteps,
	snapT,
	snapW,
	validPositions,
} from './cnn-rnn';

describe('conv1dValid', () => {
	it('gives the worked example of the chapter: [-2, -2, -2]', () => {
		expect(conv1dValid([1, 2, 3, 4, 5], [1, 0, -1])).toEqual([-2, -2, -2]);
	});

	it('returns n - k + 1 outputs and none when the kernel is longer than the signal', () => {
		expect(conv1dValid(SIGNAL, KERNEL)).toHaveLength(validPositions(SIGNAL.length, KERNEL.length));
		expect(conv1dValid([1, 2], [1, 0, -1])).toEqual([]);
	});
});

describe('gradientAt and gradientProfile', () => {
	it('gives 0.9^50 about 0.005 and 1.1^50 about 117 at the start of a 50-step chain', () => {
		expect(gradientAt(0.9, 50, 0)).toBeCloseTo(0.005, 3);
		expect(gradientAt(1.1, 50, 0)).toBeCloseTo(117, 0);
	});

	it('gives 0.9^10 about 0.349 and 0.9^20 about 0.122 for the chapter example', () => {
		expect(gradientAt(0.9, 10, 0)).toBeCloseTo(0.349, 3);
		expect(gradientAt(0.9, 20, 0)).toBeCloseTo(0.122, 3);
	});

	it('is exactly 1 at the end of the chain', () => {
		expect(gradientAt(0.7, 30, 30)).toBe(1);
	});

	it('has T + 1 values, ends at 1 and decreases towards the start when w < 1', () => {
		const p = gradientProfile(0.9, 50);
		expect(p).toHaveLength(51);
		expect(p[50]).toBe(1);
		p.slice(1).forEach((v, i) => expect(p[i]).toBeLessThan(v));
	});

	it('is deterministic for the same inputs', () => {
		expect(gradientProfile(1.1, 20)).toEqual(gradientProfile(1.1, 20));
	});
});

describe('snapping and clamping', () => {
	it('snaps w to one decimal inside the slider range', () => {
		expect(snapW(0.94)).toBe(0.9);
		expect(snapW(0.1)).toBe(0.5);
		expect(snapW(3)).toBe(1.5);
		expect(snapW(Number.NaN)).toBe(1);
	});

	it('clamps the number of steps to 1..50 and rounds it', () => {
		expect(snapSteps(0)).toBe(1);
		expect(snapSteps(500)).toBe(50);
		expect(snapSteps(20.4)).toBe(20);
	});

	it('keeps the step t within 0..T', () => {
		expect(snapT(-3, 10)).toBe(0);
		expect(snapT(99, 10)).toBe(10);
	});

	it('keeps the kernel position within the valid positions', () => {
		expect(snapKernelPos(-1)).toBe(0);
		expect(snapKernelPos(10)).toBe(2);
	});
});

describe('readouts', () => {
	it('shows the product terms and the output of the current position', () => {
		expect(describeConv(0)).toContain('y = (1)·1 + (0)·2 + (−1)·3 = −2');
	});

	it('shows the gradient factor with a decimal comma', () => {
		expect(describeRnn(0.9, 50, 0)).toContain('0,005');
	});

	it('formats numbers in Russian style', () => {
		expect(formatNum(0.5)).toBe('0,500');
		expect(formatNum(-2)).toBe('−2');
		expect(formatNum(117.39)).toBe('117');
	});

	it('keeps the bar scale at least 1', () => {
		expect(profileMax([0.1, 0.2])).toBeCloseTo(1.05, 10);
	});
});
