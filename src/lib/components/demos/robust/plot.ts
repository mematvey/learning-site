/**
 * Shared helpers for the robust-estimation demos: axis mappings, number format and a yield
 * between chunks of background work, so long Monte Carlo runs do not block input.
 */
import { drho, psi, rho, weight } from '$lib/demos/robust-core';

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

export type CurveFamily = 'huber' | 'bisquare' | 'clipped';

export interface CurvePreset {
	c: number;
	label: string;
}

export const FAMILY_LABEL: Record<CurveFamily, string> = {
	huber: 'Хубер',
	bisquare: 'Tukey bisquare',
	clipped: 'Клипованная квадратичная',
};

export const FAMILIES: CurveFamily[] = ['huber', 'bisquare', 'clipped'];

export const C_RANGE: Record<CurveFamily, { min: number; max: number }> = {
	huber: { min: 0.5, max: 3 },
	bisquare: { min: 2, max: 6 },
	clipped: { min: 0.5, max: 4 },
};

export const PRESETS: Record<CurveFamily, CurvePreset[]> = {
	huber: [
		{ c: 1.345, label: '1,345: 95% эффективности при нормали' },
		{ c: 1.5, label: '1,5: из ноутбука' },
	],
	bisquare: [{ c: 4.685, label: '4,685: 95% эффективности при нормали' }],
	clipped: [{ c: 2, label: '2: из ноутбука' }],
};

/** Default tuning constant of a family (first preset). */
export function defaultC(family: CurveFamily): number {
	return PRESETS[family][0]?.c ?? 1;
}

/** Huber rho: u^2/2 inside |u| <= c, c|u| - c^2/2 outside. */
export function huberRho(u: number, c: number): number {
	const a = Math.abs(u);
	return a <= c ? 0.5 * u * u : c * a - 0.5 * c * c;
}

export interface CurveSet {
	rho: (u: number) => number;
	psi: (u: number) => number;
	weight: (u: number) => number;
}

/** rho, psi = rho' and weight psi(u)/u of a family, built on robust-core. */
export function curveSet(family: CurveFamily, c: number): CurveSet {
	if (family === 'huber') {
		return {
			rho: (u) => huberRho(u, c),
			psi: (u) => psi('huber', u, c),
			weight: (u) => weight('huber', u, c),
		};
	}
	if (family === 'bisquare') {
		return {
			rho: (u) => rho('bisquare', u, c),
			psi: (u) => psi('bisquare', u, c),
			weight: (u) => weight('bisquare', u, c),
		};
	}
	return {
		rho: (u) => rho('clipped', u, c),
		psi: (u) => drho('clipped', u, c),
		weight: (u) => (Math.abs(u) < c ? 2 / (c * c) : 0),
	};
}

/** Evenly spaced grid of n points on [a, b]. */
export function range(a: number, b: number, n: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < n; i++) out.push(a + ((b - a) * i) / (n - 1));
	return out;
}

/** SVG path 'M x y L ...' through the points; non-finite points are skipped. */
export function polyPath(
	xs: readonly number[],
	ys: readonly number[],
	sx: (v: number) => number,
	sy: (v: number) => number,
): string {
	let d = '';
	let pen = 'M';
	for (let i = 0; i < xs.length; i++) {
		const y = ys[i] ?? NaN;
		if (!Number.isFinite(y)) {
			pen = 'M';
			continue;
		}
		d += `${pen}${sx(xs[i] ?? 0).toFixed(1)} ${sy(y).toFixed(1)}`;
		pen = 'L';
	}
	return d;
}

/** Sample for the IRLS demo: centre about 3, two outliers at 9.5 and 11. */
export const SAMPLE_OUTLIERS: number[] = [
	0.8, 1.1, 1.5, 1.9, 2.0, 2.3, 2.6, 2.8, 3.1, 3.4, 3.6, 4.0, 4.4, 9.5, 11.0,
];

/**
 * Two groups: 9 points near 0 and 5 points near 8. The median start ends in the first group,
 * a start in the second group ends in the second group (a second root of the bisquare equation).
 */
export const SAMPLE_TWO_CLUSTERS: number[] = [
	-0.6, -0.3, -0.1, 0, 0.1, 0.2, 0.4, 0.5, 0.7, 7.6, 7.9, 8.0, 8.2, 8.5,
];
