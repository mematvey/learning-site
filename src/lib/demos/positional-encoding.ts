/**
 * Math of the positional encoding demo: sinusoidal encodings PE(pos, 2i) = sin(ω_i·pos),
 * PE(pos, 2i+1) = cos(ω_i·pos) with ω_i = 10000^(-2i/d), and RoPE rotation of a pair of
 * components by angle pos·ω_i. Pure functions only: no DOM, no Svelte.
 */

/** Number of rows in the heatmap: positions 0 … N_POS − 1. */
export const N_POS = 41;
export const POS_MAX = N_POS - 1;
export const POS_MIN = 0;
export const DIM_MIN = 4;
export const DIM_MAX = 32;
export const DIM_STEP = 2;
export const DELTA_MAX = 20;
/** Base constant of the sinusoidal formula. */
export const BASE = 10000;

export interface PositionalEncodingDemoState {
	/** Vector size d (even). Columns of the heatmap. */
	dim: number;
	/** Position m of the query in the rotation panel. */
	pos: number;
	/** Index i of the rotated pair of components, 0 … d/2 − 1. */
	pair: number;
	/** Offset Δ = n − m between the key and the query. */
	delta: number;
}

export const DEFAULT_STATE: PositionalEncodingDemoState = {
	dim: 16,
	pos: 12,
	pair: 0,
	delta: 6,
};

/** Fixed base vectors of the rotation panel: a query and a key, both unit length. */
export const Q_BASE: readonly [number, number] = [1, 0];
export const K_BASE: readonly [number, number] = [0.6, 0.8];

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an even number and clamps to [DIM_MIN, DIM_MAX]. Non-finite input gives the default. */
export function snapDim(d: number): number {
	if (!Number.isFinite(d)) return DEFAULT_STATE.dim;
	return clamp(Math.round(d / DIM_STEP) * DIM_STEP, DIM_MIN, DIM_MAX);
}

/** Rounds to an integer position in [0, POS_MAX]. Non-finite input gives 0. */
export function snapPos(p: number): number {
	if (!Number.isFinite(p)) return POS_MIN;
	return clamp(Math.round(p), POS_MIN, POS_MAX);
}

/** Rounds to an integer offset in [0, DELTA_MAX]. Non-finite input gives 0. */
export function snapDelta(d: number): number {
	if (!Number.isFinite(d)) return 0;
	return clamp(Math.round(d), 0, DELTA_MAX);
}

/** Pair index clamped to the pairs that exist for dimension `dim`. */
export function clampPair(i: number, dim: number): number {
	const last = dim / 2 - 1;
	if (!Number.isFinite(i)) return 0;
	return clamp(Math.round(i), 0, last);
}

/** Frequencies ω_i = 10000^(-2i/d), one per pair; ω_0 = 1 and they decrease. */
export function frequencies(dim: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < dim / 2; i++) out.push(Math.pow(BASE, (-2 * i) / dim));
	return out;
}

/** Sinusoidal encoding of one position: interleaved sin/cos pairs, length `dim`. */
export function sinusoidalEncoding(pos: number, dim: number): number[] {
	const out: number[] = new Array<number>(dim);
	frequencies(dim).forEach((omega, i) => {
		out[2 * i] = Math.sin(omega * pos);
		out[2 * i + 1] = Math.cos(omega * pos);
	});
	return out;
}

/** Heatmap rows: encodings of positions 0 … N_POS − 1. */
export function encodingTable(dim: number): number[][] {
	const rows: number[][] = [];
	for (let p = 0; p < N_POS; p++) rows.push(sinusoidalEncoding(p, dim));
	return rows;
}

/** Rotation by angle φ (radians): R(φ) = [[cos φ, −sin φ], [sin φ, cos φ]]. */
export function rotate(v: readonly [number, number], angle: number): [number, number] {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return [c * v[0] - s * v[1], s * v[0] + c * v[1]];
}

export function dot(a: readonly [number, number], b: readonly [number, number]): number {
	return a[0] * b[0] + a[1] * b[1];
}

/** Dot product of RoPE-rotated query at position m and key at position n for frequency ω. */
export function ropeDot(
	q: readonly [number, number],
	k: readonly [number, number],
	m: number,
	n: number,
	omega: number,
): number {
	return dot(rotate(q, m * omega), rotate(k, n * omega));
}

/** Maps a value in [−1, 1] to a percent of `--seq-1` for the heatmap colour-mix. */
export function shadePercent(v: number): number {
	return clamp(((v + 1) / 2) * 100, 0, 100);
}

/** Angle in degrees, reduced to [0, 360). */
export function toDegrees(rad: number): number {
	const deg = (rad * 180) / Math.PI;
	return ((deg % 360) + 360) % 360;
}

export interface RopeReadout {
	/** Frequency of the chosen pair. */
	omega: number;
	/** Key position n = m + Δ. */
	n: number;
	/** Rotation angle of the query, degrees. */
	angleQ: number;
	/** Rotation angle of the key, degrees. */
	angleK: number;
	/** Score q·k after RoPE for the current m and n. */
	score: number;
	/** Score for m = 0 and the same Δ. Equal to `score` when only the offset matters. */
	scoreAtZero: number;
}

export function ropeReadout(state: PositionalEncodingDemoState): RopeReadout {
	const pair = clampPair(state.pair, state.dim);
	const omega = frequencies(state.dim)[pair] ?? 1;
	const n = state.pos + state.delta;
	return {
		omega,
		n,
		angleQ: toDegrees(state.pos * omega),
		angleK: toDegrees(n * omega),
		score: ropeDot(Q_BASE, K_BASE, state.pos, n, omega),
		scoreAtZero: ropeDot(Q_BASE, K_BASE, 0, state.delta, omega),
	};
}

/** Text of the live region under the demo. Numbers are computed, not typed. */
export function describeState(state: PositionalEncodingDemoState): string {
	const pair = clampPair(state.pair, state.dim);
	const r = ropeReadout({ ...state, pair });
	const same = Math.abs(r.score - r.scoreAtZero) < 1e-9;
	return (
		`Пара ${pair + 1} из ${state.dim / 2}: частота ω = ${r.omega.toFixed(4)}. ` +
		`Запрос в позиции ${state.pos} повернут на ${r.angleQ.toFixed(0)}°, ` +
		`ключ в позиции ${r.n} на ${r.angleK.toFixed(0)}°. ` +
		`Скалярное произведение ${r.score.toFixed(3)}` +
		(same
			? `, при m = 0 и том же смещении Δ = ${state.delta} оно равно ${r.scoreAtZero.toFixed(3)}: зависит только от Δ.`
			: `, при m = 0 оно ${r.scoreAtZero.toFixed(3)}.`)
	);
}
