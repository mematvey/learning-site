/**
 * Math of the profiling demo: a modelled GPU timeline of one training step and Amdahl's law.
 * The timeline is illustrative, not a measurement: kernel durations and gaps are fixed numbers
 * chosen so that the sum of kernels is 45 ms within a 100 ms step (the example in the chapter).
 * Pure functions only: no DOM, no Svelte.
 */

/** Duration of one training step on the modelled timeline, ms. */
export const STEP_MS = 100;

/** Durations of kernels in launch order, ms. Their sum is 45 ms. */
export const KERNEL_MS: readonly number[] = [8, 2, 3, 1.5, 6, 2, 1, 4, 2.5, 5, 1, 9];

/**
 * Idle gap before each kernel, ms. Their sum with KERNEL_MS is exactly STEP_MS (55 ms of gaps).
 * Gaps are many and short on purpose: the chapter's point is that idle time between kernels matters.
 */
export const GAP_MS: readonly number[] = [4, 2, 6, 3, 5, 2, 7, 4, 3, 5, 6, 8];

export interface TimelineKernel {
	/** Index in launch order, from 0. */
	index: number;
	/** Start of the kernel from the beginning of the step, ms. */
	start: number;
	/** Duration, ms. */
	duration: number;
	/** Idle gap before this kernel, ms. */
	gapBefore: number;
}

export interface Timeline {
	stepMs: number;
	kernels: TimelineKernel[];
	/** Sum of kernel durations, ms. */
	busyMs: number;
	/** Step time minus busy time, ms. */
	idleMs: number;
	/** Busy share of the step, 0..1. */
	load: number;
}

/**
 * Builds the timeline from kernel durations and gaps. Kernels run one after another, each one
 * after its gap. Throws if the lengths differ or the step does not match the sums, so the
 * displayed numbers always agree with the picture.
 */
export function buildTimeline(
	kernelMs: readonly number[] = KERNEL_MS,
	gapMs: readonly number[] = GAP_MS,
	stepMs: number = STEP_MS,
): Timeline {
	if (kernelMs.length !== gapMs.length) {
		throw new Error('kernelMs and gapMs must have the same length');
	}
	const kernels: TimelineKernel[] = [];
	let t = 0;
	kernelMs.forEach((duration, index) => {
		const gapBefore = gapMs[index] ?? 0;
		t += gapBefore;
		kernels.push({ index, start: t, duration, gapBefore });
		t += duration;
	});
	const busyMs = kernelMs.reduce((s, v) => s + v, 0);
	const idleMs = stepMs - busyMs;
	if (Math.abs(t - stepMs) > 1e-9) {
		throw new Error('kernels and gaps must fill the step exactly');
	}
	return { stepMs, kernels, busyMs, idleMs, load: busyMs / stepMs };
}

/** Load in whole percent, for display. */
export function loadPercent(timeline: Timeline): number {
	return Math.round(timeline.load * 100);
}

/** Position of a kernel on the timeline as percentages of the step: left and width. */
export function kernelBox(kernel: TimelineKernel, stepMs: number): { left: number; width: number } {
	return { left: (kernel.start / stepMs) * 100, width: (kernel.duration / stepMs) * 100 };
}

/* ---------- Amdahl's law ---------- */

export const FRACTION_MIN = 0.01;
export const FRACTION_MAX = 0.99;
export const FRACTION_STEP = 0.01;
export const SPEEDUP_MIN = 1;
export const SPEEDUP_MAX = 20;
export const SPEEDUP_STEP = 1;

export interface AmdahlState {
	/** Share f of the whole time taken by the part we change, 0..1. */
	fraction: number;
	/** Speed-up s of that part. */
	speedup: number;
}

/** New time relative to the old one: T'/T = (1 - f) + f / s. */
export function amdahlTime(fraction: number, speedup: number): number {
	return 1 - fraction + fraction / speedup;
}

/** Speed-up of the whole program: T / T' = 1 / ((1 - f) + f / s). */
export function amdahlSpeedup(fraction: number, speedup: number): number {
	return 1 / amdahlTime(fraction, speedup);
}

/** Speed-up limit when the part becomes infinitely fast: 1 / (1 - f). */
export function amdahlLimit(fraction: number): number {
	return 1 / (1 - fraction);
}

/** Share of the whole time saved: 1 - T'/T. */
export function savedShare(fraction: number, speedup: number): number {
	return 1 - amdahlTime(fraction, speedup);
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Clamps the fraction to its slider range and rounds to the slider step. Non-finite gives 0.3. */
export function snapFraction(f: number): number {
	if (!Number.isFinite(f)) return 0.3;
	return Math.round(clamp(f, FRACTION_MIN, FRACTION_MAX) * 100) / 100;
}

/** Clamps the speed-up to its slider range and rounds to an integer. Non-finite gives 2. */
export function snapSpeedup(s: number): number {
	if (!Number.isFinite(s)) return 2;
	return Math.round(clamp(s, SPEEDUP_MIN, SPEEDUP_MAX));
}

/** Two examples from the chapter text. */
export const AMDAHL_PRESETS: ReadonlyArray<{ id: string; label: string; state: AmdahlState }> = [
	{ id: 'attention', label: 'Attention: 30%, ×2', state: { fraction: 0.3, speedup: 2 } },
	{ id: 'small', label: 'Малый участок: 3%, ×10', state: { fraction: 0.03, speedup: 10 } },
];
