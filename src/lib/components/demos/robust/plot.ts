/**
 * Shared helpers for the robust-estimation demos: axis mappings, number format and a yield
 * between chunks of background work, so long Monte Carlo runs do not block input.
 */

/** Linear map from the domain [d0, d1] to the range [r0, r1]. */
export function linearMap(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
	const k = (r1 - r0) / (d1 - d0);
	return (v) => r0 + (v - d0) * k;
}

/** log10 of v, with v clamped from below to lo (keeps zero and negative values plottable). */
export function logClamp(v: number, lo: number): number {
	return Math.log10(Math.max(v, lo));
}

/** Russian decimal format: 0.828 -> "0,83". */
export function fmt(v: number, digits = 2): string {
	return v.toFixed(digits).replace('.', ',');
}

/** Resolves on the next macrotask, letting the browser handle input and paint between chunks. */
export function yieldToUi(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/** SVG polyline/path `d` attribute for a list of points. */
export function linePath(pts: ReadonlyArray<readonly [number, number]>): string {
	return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}
