/**
 * Math of the complexity demo: operation counts for four growth functions and the crossover of K·n with n².
 * Deterministic: no random numbers. Pure functions only: no DOM, no Svelte.
 */

export const N_MIN = 1;
export const N_MAX = 120;
export const N_STEP = 1;
/** Default input size: below the crossover, so the quadratic curve is cheaper at the start. */
export const DEFAULT_N = 50;

/** Constant factor of the linear algorithm: its cost is K · n operations. */
export const K_MIN = 1;
export const K_MAX = 100;
export const K_STEP = 1;
/** Default K: the chapter example 100n against n², crossing at n = 100. */
export const DEFAULT_K = 100;

/** Top of the operations axis (linear scale). Curves above it leave the frame. */
export const Y_MAX = 15000;

export type GrowthName = 'linear' | 'nlogn' | 'quadratic' | 'exponential';

export const GROWTH_NAMES: readonly GrowthName[] = ['linear', 'nlogn', 'quadratic', 'exponential'];

export interface ComplexityDemoState {
	/** Input size. */
	n: number;
	/** Constant factor K of the linear algorithm K · n. */
	k: number;
}

/** Starting values. The reset button returns to them. */
export const DEFAULT_STATE: ComplexityDemoState = { n: DEFAULT_N, k: DEFAULT_K };

/** Operation count of one growth function at size n. The linear one carries the constant K. */
export function operations(name: GrowthName, n: number, k: number): number {
	switch (name) {
		case 'linear':
			return k * n;
		case 'nlogn':
			return n * Math.log2(n);
		case 'quadratic':
			return n * n;
		case 'exponential':
			return 2 ** n;
	}
}

/** Points (n, operations) of one curve over the whole axis [N_MIN, N_MAX]. */
export function curvePoints(name: GrowthName, k: number): [number, number][] {
	const pts: [number, number][] = [];
	for (let n = N_MIN; n <= N_MAX; n += N_STEP) {
		pts.push([n, operations(name, n, k)]);
	}
	return pts;
}

/**
 * Size where K · n equals n² (n > 0): n = K.
 * Below it the quadratic algorithm does fewer operations, above it the linear one does.
 */
export function crossover(k: number): number {
	return k;
}

/** Which of the two algorithms (linear with K, quadratic) does fewer operations at size n. */
export function cheaper(n: number, k: number): 'linear' | 'quadratic' | 'equal' {
	const lin = operations('linear', n, k);
	const quad = operations('quadratic', n, k);
	if (lin < quad) return 'linear';
	if (quad < lin) return 'quadratic';
	return 'equal';
}

/**
 * Human-readable count: integers below a million as is, larger values as a·10^e with a decimal comma.
 * Deterministic, does not depend on the locale.
 */
export function formatCount(value: number): string {
	if (!Number.isFinite(value)) return '∞';
	const v = Math.round(value);
	if (v < 1_000_000) return String(v);
	let e = Math.floor(Math.log10(v));
	let m = v / 10 ** e;
	if (Number(m.toFixed(2)) >= 10) {
		e += 1;
		m = v / 10 ** e;
	}
	return `${m.toFixed(2).replace('.', ',')}·10^${e}`;
}

/** Clamps the input size to the axis and rounds it to the step. */
export function snapN(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_N;
	const snapped = Math.round((n - N_MIN) / N_STEP) * N_STEP + N_MIN;
	return Math.min(N_MAX, Math.max(N_MIN, snapped));
}

/** Clamps the constant K to its range and rounds it to the step. */
export function snapK(k: number): number {
	if (!Number.isFinite(k)) return DEFAULT_K;
	const snapped = Math.round((k - K_MIN) / K_STEP) * K_STEP + K_MIN;
	return Math.min(K_MAX, Math.max(K_MIN, snapped));
}

/** Merges a patch into the state, snapping every field that is present. */
export function applyPatch(
	state: ComplexityDemoState,
	patch: Partial<ComplexityDemoState>,
): ComplexityDemoState {
	return {
		n: typeof patch.n === 'number' ? snapN(patch.n) : state.n,
		k: typeof patch.k === 'number' ? snapK(patch.k) : state.k,
	};
}

/** Text for aria-live: the counts at size n and which algorithm is cheaper there. */
export function describeState(state: ComplexityDemoState): string {
	const { n, k } = state;
	const lin = formatCount(operations('linear', n, k));
	const quad = formatCount(operations('quadratic', n, k));
	const who = cheaper(n, k);
	const verdict =
		who === 'linear'
			? `при n = ${n} быстрее линейный алгоритм`
			: who === 'quadratic'
				? `при n = ${n} быстрее квадратичный алгоритм`
				: `при n = ${n} оба делают одинаковое число операций`;
	return `При n = ${n}: ${k}·n = ${lin} операций, n² = ${quad}; ${verdict}. Пересечение при n = ${crossover(k)}.`;
}
