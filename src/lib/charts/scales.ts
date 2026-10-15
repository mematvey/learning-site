import { scaleBand, scaleLinear, type ScaleBand, type ScaleLinear } from 'd3';

/** Chart text is never smaller than 12px (design-system: tick labels, axis captions). */
export const CHART_TICK_PX = 12;
export const CHART_LABEL_PX = 13;

/** Lower bound for chart width, so axes stay legible on narrow phones. */
export const MIN_CHART_WIDTH = 240;

/** Data-colour token for series index `i` (1-based, wraps over `--cat-1..6`). */
export function catVar(i: number): string {
	const n = ((((Math.floor(i) - 1) % 6) + 6) % 6) + 1;
	return `var(--cat-${n})`;
}

/**
 * Padded extent of `values`. Always returns a non-empty span: a constant series
 * gets a unit span around its value so the scale never divides by zero.
 */
export function niceExtent(values: number[], pad = 0.05, includeZero = false): [number, number] {
	let lo = Infinity;
	let hi = -Infinity;
	for (const v of values) {
		if (!Number.isFinite(v)) continue;
		if (v < lo) lo = v;
		if (v > hi) hi = v;
	}
	if (includeZero) {
		lo = Math.min(lo, 0);
		hi = Math.max(hi, 0);
	}
	if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
	if (hi === lo) return lo === 0 ? [-1, 1] : [lo - Math.abs(lo) * 0.5, hi + Math.abs(hi) * 0.5];
	const span = hi - lo;
	return [lo - span * pad, hi + span * pad];
}

export function linearScale(
	domain: [number, number],
	range: [number, number],
): ScaleLinear<number, number> {
	return scaleLinear().domain(domain).range(range);
}

export function bandScale(
	labels: string[],
	range: [number, number],
	padding = 0.2,
): ScaleBand<string> {
	return scaleBand<string>()
		.domain(labels)
		.range(range)
		.paddingInner(padding)
		.paddingOuter(padding / 2);
}

/** Clamps a measured container width to the chart minimum. */
export function clampChartWidth(width: number): number {
	return Math.max(MIN_CHART_WIDTH, Math.floor(width));
}
