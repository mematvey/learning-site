/**
 * Geometry of the convergence chart: log-scaled trial axis, linear frequency axis.
 * Pure functions, no DOM.
 */

/** Smallest checkpoint shown on the log axis. */
export const MIN_AXIS_TRIALS = 10;

/** X position of `trials` on a log10 axis spanning [MIN_AXIS_TRIALS, maxTrials]. */
export function xForTrials(trials: number, maxTrials: number, left: number, right: number): number {
	const lo = Math.log10(MIN_AXIS_TRIALS);
	const hi = Math.log10(Math.max(maxTrials, MIN_AXIS_TRIALS * 10));
	const t = Math.log10(Math.max(trials, MIN_AXIS_TRIALS));
	return left + ((t - lo) / (hi - lo)) * (right - left);
}

/** Y position of a frequency in [0, yMax]; values outside are clamped to the plot edge. */
export function yForFreq(freq: number, yMax: number, top: number, bottom: number): number {
	const f = Math.min(yMax, Math.max(0, freq));
	return bottom - (f / yMax) * (bottom - top);
}

/** Upper bound of the frequency axis: close to the largest exact value, never above 1. */
export function frequencyMax(exact: number[]): number {
	const largest = Math.max(0, ...exact.filter((x) => Number.isFinite(x)));
	return Math.min(1, Math.max(0.1, largest * 1.5));
}

/** Powers of ten inside the trial axis plus the final value (for tick labels). */
export function logTicks(maxTrials: number): number[] {
	const ticks: number[] = [];
	for (let t = MIN_AXIS_TRIALS; t <= maxTrials; t *= 10) ticks.push(t);
	if (ticks[ticks.length - 1] !== maxTrials && maxTrials > MIN_AXIS_TRIALS * 10)
		ticks.push(maxTrials);
	return ticks;
}

/** SVG path through the points, or '' when there are none. */
export function linePath(
	points: Array<[number, number]>,
	toX: (t: number) => number,
	toY: (f: number) => number,
): string {
	return points
		.map(([t, f], i) => `${i === 0 ? 'M' : 'L'}${toX(t).toFixed(1)} ${toY(f).toFixed(1)}`)
		.join(' ');
}
