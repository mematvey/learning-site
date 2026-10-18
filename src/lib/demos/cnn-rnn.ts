/**
 * Math of the convolution and recurrent gradient demo.
 * Top part: a valid 1-D convolution of a fixed signal with a fixed kernel, one output per kernel position.
 * Bottom part: how the gradient arriving from the end of a linear recurrent chain h_t = w·h_{t-1}
 * scales with the step t, i.e. w^(T - t). The demo is deterministic: no random numbers.
 * Pure functions only: no DOM, no Svelte.
 */

/** Fixed input signal of the convolution part (matches the worked example in the chapter). */
export const SIGNAL: readonly number[] = [1, 2, 3, 4, 5];
/** Fixed kernel: a difference of neighbours with a zero in the middle. */
export const KERNEL: readonly number[] = [1, 0, -1];

export const W_MIN = 0.5;
export const W_MAX = 1.5;
export const W_STEP = 0.1;
export const STEPS_MIN = 1;
export const STEPS_MAX = 50;

export interface ConvRnnDemoState {
	/** Index of the kernel position in the convolution part (0-based). */
	kernelPos: number;
	/** Recurrent weight w of the linear chain. */
	w: number;
	/** Number of recurrent steps T. */
	steps: number;
	/** Step t at which the gradient is read, 0 is the start of the chain, T is the end. */
	t: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Valid convolution: output i is sum_j kernel[j] * x[i + j], only where the kernel fits fully. */
export function conv1dValid(x: readonly number[], kernel: readonly number[]): number[] {
	const k = kernel.length;
	const out: number[] = [];
	for (let i = 0; i + k <= x.length; i++) {
		let s = 0;
		for (let j = 0; j < k; j++) s += (kernel[j] ?? 0) * (x[i + j] ?? 0);
		out.push(s);
	}
	return out;
}

/** Number of valid kernel positions: n - k + 1, never below 0. */
export function validPositions(n: number, k: number): number {
	return Math.max(0, n - k + 1);
}

/** Rounds to one decimal and clamps to the w slider range. Non-finite input gives 1. */
export function snapW(w: number): number {
	if (!Number.isFinite(w)) return 1;
	return Math.round(clamp(w, W_MIN, W_MAX) * 10) / 10;
}

/** Rounds to an integer and clamps to the T slider range. Non-finite input gives STEPS_MAX / 2. */
export function snapSteps(steps: number): number {
	if (!Number.isFinite(steps)) return 25;
	return Math.round(clamp(steps, STEPS_MIN, STEPS_MAX));
}

/** Clamps the step t to [0, steps]. Non-finite input gives 0. */
export function snapT(t: number, steps: number): number {
	if (!Number.isFinite(t)) return 0;
	return Math.round(clamp(t, 0, steps));
}

/** Clamps the kernel position to the valid range for the signal length. */
export function snapKernelPos(
	pos: number,
	n: number = SIGNAL.length,
	k: number = KERNEL.length,
): number {
	const last = Math.max(0, validPositions(n, k) - 1);
	if (!Number.isFinite(pos)) return 0;
	return Math.round(clamp(pos, 0, last));
}

/**
 * Gradient factor that reaches step t from the end of a chain of T steps, for h_t = w·h_{t-1}:
 * dh_T/dh_t = w^(T - t). Equals 1 at the end (t = T).
 */
export function gradientAt(w: number, steps: number, t: number): number {
	return Math.pow(w, steps - t);
}

/** Gradient factors for every step t = 0..T, from the start to the end of the chain. */
export function gradientProfile(w: number, steps: number): number[] {
	const out: number[] = [];
	for (let t = 0; t <= steps; t++) out.push(gradientAt(w, steps, t));
	return out;
}

/** Largest value of a profile with headroom, never below 1. Used as the bar scale. */
export function profileMax(profile: readonly number[]): number {
	let m = 1;
	for (const v of profile) if (Number.isFinite(v)) m = Math.max(m, v);
	return m * 1.05;
}

/**
 * Russian decimal formatting for the readouts: a decimal comma, three digits below 10,
 * no decimals from 10 up.
 */
export function formatNum(v: number): string {
	if (!Number.isFinite(v)) return '—';
	const abs = Math.abs(v);
	const s = Number.isInteger(abs) || abs >= 10 ? Math.round(abs).toString() : abs.toFixed(3);
	const body = s.replace('.', ',');
	return v < 0 && Math.round(abs * 1000) !== 0 ? `−${body}` : body;
}

/** Text of the convolution readout for the current kernel position. */
export function describeConv(kernelPos: number): string {
	const pos = snapKernelPos(kernelPos);
	const out = conv1dValid(SIGNAL, KERNEL);
	const terms = KERNEL.map(
		(wj, j) => `(${String(wj).replace('-', '−')})·${SIGNAL[pos + j] ?? 0}`,
	).join(' + ');
	return `Позиция ${pos + 1} из ${out.length}: y = ${terms} = ${formatNum(out[pos] ?? 0)}.`;
}

/** Text of the recurrent readout for the current w, T and t. */
export function describeRnn(w: number, steps: number, t: number): string {
	const g = gradientAt(w, steps, t);
	const where = t === steps ? 'в конце цепочки' : `на шаге ${t} из ${steps}`;
	return `w = ${formatNum(w)}, T = ${steps}: градиент ${where} равен w^(${steps} − ${t}) = ${formatNum(g)} от градиента в конце.`;
}
