/**
 * Location efficiency for the robust-estimation demos: cached asymptotic factors V_mu(c) on
 * the contaminated mixture, computed in chunks so that the UI thread is never blocked for long.
 * Pure logic, no DOM.
 */
import { dpsi, psi, type PsiKind } from '$lib/demos/robust-core';
import { locationFactor, makeMixture, medianFactor, type Mixture } from '$lib/demos/robust-model';

export const EPS_MIN = 0;
export const EPS_MAX = 0.3;
export const EPS_STEP = 0.01;
/** Contamination level of the lab (the notebook's table and the default demo state). */
export const EPS_DEFAULT = 0.05;

export interface LocPoint {
	kind: PsiKind;
	c: number;
}

function range(a: number, b: number, step: number): number[] {
	const n = Math.round((b - a) / step);
	return Array.from({ length: n + 1 }, (_, i) => Math.round((a + i * step) * 1000) / 1000);
}

/** Grid of tuning constants for the curve plot. */
export const GRID_HUBER = range(0.5, 3.5, 0.1);
export const GRID_BISQ = range(1.5, 7, 0.1);
/** Constants of the notebook table (eps = 0.05). */
export const TABLE_HUBER = [0.8, 1.0, 1.2, 1.345, 1.5, 2.0, 3.0];
export const TABLE_BISQ = [2.0, 2.5, 3.0, 3.5, 4.0, 4.685, 6.0];
/** Tuning constants used by the simulation and the joint demo. */
export const HUBER_C = 1.5;
export const BISQ_C = 4.685;

/** Snaps an eps value to the slider grid and clamps it to [EPS_MIN, EPS_MAX]. */
export function snapEps(v: number): number {
	const clamped = Math.min(EPS_MAX, Math.max(EPS_MIN, v));
	return Math.round(clamped * 100) / 100;
}

/** Cache key for eps: two decimals, which is the slider resolution. */
export function epsKey(eps: number): string {
	return snapEps(eps).toFixed(2);
}

const mixtures = new Map<string, Mixture>();
const values = new Map<string, number>();
const medians = new Map<string, number>();

/** Mixture model for a contamination level (cached: the model is immutable). */
export function mixtureFor(eps: number): Mixture {
	const key = epsKey(eps);
	let m = mixtures.get(key);
	if (!m) {
		m = makeMixture({ eps: Number(key) });
		mixtures.set(key, m);
	}
	return m;
}

function pointKey(eps: number, p: LocPoint): string {
	return `${epsKey(eps)}|${p.kind}|${p.c.toFixed(3)}`;
}

function computeLoc(m: Mixture, p: LocPoint): number {
	return locationFactor(
		m,
		(u) => psi(p.kind, u, p.c),
		(u) => dpsi(p.kind, u, p.c),
	);
}

/** V_mu for one psi at one tuning constant and contamination level (cached). */
export function locValue(eps: number, p: LocPoint): number {
	const key = pointKey(eps, p);
	let v = values.get(key);
	if (v === undefined) {
		v = computeLoc(mixtureFor(eps), p);
		values.set(key, v);
	}
	return v;
}

/** Already computed V_mu, or undefined if it has not been filled yet. */
export function cachedLocValue(eps: number, p: LocPoint): number | undefined {
	return values.get(pointKey(eps, p));
}

/** Asymptotic factor of the sample median (cached). */
export function medianValue(eps: number): number {
	const key = epsKey(eps);
	let v = medians.get(key);
	if (v === undefined) {
		v = medianFactor(mixtureFor(eps));
		medians.set(key, v);
	}
	return v;
}

/** Yields control to the event loop so that pending input and paints can run. */
export function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Fills the cache for `points` at `eps`, `chunk` points per task. Stops early when
 * `isCurrent()` turns false (the slider moved on). Resolves to true when all points are filled.
 */
export async function fillLocValues(
	eps: number,
	points: readonly LocPoint[],
	o: { chunk?: number; isCurrent?: () => boolean; onChunk?: () => void } = {},
): Promise<boolean> {
	const chunk = o.chunk ?? 4;
	const isCurrent = o.isCurrent ?? (() => true);
	for (let i = 0; i < points.length; i += chunk) {
		if (!isCurrent()) return false;
		for (const p of points.slice(i, i + chunk)) locValue(eps, p);
		o.onChunk?.();
		await yieldToEventLoop();
	}
	return isCurrent();
}
