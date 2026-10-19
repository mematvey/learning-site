import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ALPHA_US,
	DEFAULT_B_GBS,
	DEFAULT_S_BYTES,
	GB,
	MB,
	applyRingStep,
	completeChunks,
	contribAfter,
	crossoverBytes,
	formatBytes,
	formatDuration,
	initialContrib,
	latencyCurve,
	ringSchedule,
	ringSteps,
	ringTime,
	ringVolume,
	snapAlpha,
	snapB,
	snapN,
	snapSExp,
	timeCurve,
} from './collectives';

const B = DEFAULT_B_GBS * GB;
const ALPHA = DEFAULT_ALPHA_US * 1e-6;

/** Element access that fails the test instead of returning undefined. */
function at<T>(xs: readonly T[], i: number): T {
	const v = xs[i];
	if (v === undefined) throw new Error(`index ${i} out of range`);
	return v;
}

describe('ring all-reduce model', () => {
	it('volume per GPU is 2(N-1)/N of the message', () => {
		expect(ringVolume(8, GB) / GB).toBeCloseTo(1.75, 10);
		expect(ringVolume(64, GB) / GB).toBeCloseTo(1.96875, 10);
	});

	it('reproduces the 1 GB times on 8 and 64 GPUs from the chapter', () => {
		expect(ringTime(8, DEFAULT_S_BYTES, B, ALPHA).total).toBeCloseTo(0.01764, 6);
		expect(ringTime(64, DEFAULT_S_BYTES, B, ALPHA).total).toBeCloseTo(0.02095, 5);
	});

	it('reproduces the 1 MB times and the eightfold growth from the chapter', () => {
		const t8 = ringTime(8, MB, B, ALPHA).total;
		const t64 = ringTime(64, MB, B, ALPHA).total;
		expect(t8).toBeCloseTo(0.0001575, 7);
		expect(t64).toBeCloseTo(0.00128, 5);
		expect(t64 / t8).toBeGreaterThan(7.9);
		expect(t64 / t8).toBeLessThan(8.3);
	});

	it('latency part is 2(N-1)·α and parts add up to the total', () => {
		const t = ringTime(64, MB, B, ALPHA);
		expect(t.steps).toBe(126);
		expect(t.latency).toBeCloseTo(126 * 1e-5, 12);
		expect(t.latency + t.transfer).toBeCloseTo(t.total, 15);
		expect(t.stepTime * t.steps).toBeCloseTo(t.total, 12);
	});

	it('crossover is N·α·B: 8 MB for 8 GPUs and 64 MB for 64 GPUs', () => {
		expect(crossoverBytes(8, B, ALPHA)).toBeCloseTo(8 * MB, 0);
		expect(crossoverBytes(64, B, ALPHA)).toBeCloseTo(64 * MB, 0);
	});

	it('quiz: 500 separate 1 MB calls cost about 0.64 s, one 500 MB call about 11 ms', () => {
		expect(500 * ringTime(64, MB, B, ALPHA).total).toBeCloseTo(0.64, 2);
		expect(ringTime(64, 500 * MB, B, ALPHA).total).toBeCloseTo(0.0111, 4);
	});

	it('curves have one point per N', () => {
		const ns = [2, 8, 64];
		expect(timeCurve(ns, GB, B, ALPHA)).toHaveLength(3);
		const lat = latencyCurve(ns, ALPHA);
		expect(lat[0]).toBeCloseTo(2e-5, 12);
		expect(lat[1]).toBeCloseTo(14e-5, 12);
		expect(lat[2]).toBeCloseTo(126e-5, 12);
	});
});

describe('ring schedule', () => {
	it('has 2(N-1) steps, each with one send per GPU to the next GPU', () => {
		for (const n of [2, 3, 8, 64]) {
			const steps = ringSchedule(n);
			expect(steps).toHaveLength(ringSteps(n));
			for (const step of steps) {
				expect(step.sends).toHaveLength(n);
				for (const s of step.sends) expect(s.to).toBe((s.from + 1) % n);
			}
		}
	});

	it('after the whole schedule every GPU holds the full sum of every chunk', () => {
		for (const n of [2, 3, 4, 8, 16, 64]) {
			const done = contribAfter(n, ringSteps(n));
			expect(completeChunks(done, n)).toBe(n * n);
		}
	});

	it('after reduce-scatter GPU i holds chunk (i+1) mod N complete and nothing else complete', () => {
		const n = 8;
		const after = contribAfter(n, n - 1);
		for (let i = 0; i < n; i++) {
			for (let k = 0; k < n; k++) {
				const full = at(at(after, i), k).size === n;
				expect(full).toBe(k === (i + 1) % n);
			}
		}
		expect(completeChunks(after, n)).toBe(n);
	});

	it('an all-gather step never reduces, only copies complete chunks', () => {
		const n = 4;
		const steps = ringSchedule(n);
		const before = contribAfter(n, n - 1);
		const next = applyRingStep(before, at(steps, n - 1));
		expect(completeChunks(next, n)).toBe(n + n);
		const first = applyRingStep(initialContrib(n), at(steps, 0));
		expect(at(at(first, 1), 0)).toEqual(new Set([0, 1]));
	});

	it('returns no steps for fewer than two GPUs', () => {
		expect(ringSchedule(1)).toEqual([]);
	});
});

describe('demo controls and formatting', () => {
	it('snaps controls to their ranges and steps', () => {
		expect(snapN(100)).toBe(64);
		expect(snapN(1)).toBe(2);
		expect(snapN(Number.NaN)).toBe(8);
		expect(snapSExp(9.04)).toBe(9);
		expect(snapSExp(20)).toBe(10);
		expect(snapB(123)).toBe(120);
		expect(snapAlpha(0)).toBe(1);
	});

	it('formats sizes and durations with a decimal comma', () => {
		expect(formatBytes(GB)).toBe('1 ГБ');
		expect(formatBytes(MB)).toBe('1 МБ');
		expect(formatBytes(3.16e9)).toBe('3,2 ГБ');
		expect(formatDuration(0.0176)).toBe('17,6 мс');
		expect(formatDuration(0.00128)).toBe('1,28 мс');
		expect(formatDuration(2e-6)).toBe('2 мкс');
	});
});
