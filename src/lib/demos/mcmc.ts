/**
 * Math of the MCMC demo: Metropolis–Hastings with a symmetric Gaussian random walk
 * on the two-mode target f(x) = exp(-(x-2)²/2) + exp(-(x+2)²/2), known up to a constant.
 * Every run is deterministic: the same step and seed always give the same chain.
 * Pure functions only: no DOM, no Svelte.
 */

/** Steps in the full run that the demo animates. */
export const N_STEPS = 20_000;
/** Burn-in: the first steps are dropped from histograms, statistics and R-hat. */
export const BURN_IN = 2_000;

export const STEP_MIN = 0.1;
export const STEP_MAX = 10;
export const STEP_STEP = 0.1;
export const STEP_DEFAULT = 2;

/** Seeds the user can cycle through; every value is fixed, so results repeat. */
export const SEED_DEFAULT = 1;
export const SEED_COUNT = 5;

/** Starting points of the chains. The first one is the main chain shown in trace and histogram. */
export const START_POINTS: readonly number[] = [0, -4, 4, 1];

/** Domain of the x axis of the charts. */
export const X_MIN = -6;
export const X_MAX = 6;
export const BINS = 48;

/** Threshold quoted in the text for the rank-normalised R-hat. The demo shows the classic R-hat. */
export const RHAT_WARN = 1.01;

export interface McmcDemoState {
	/** Symmetric proposal scale (standard deviation of the random-walk step). */
	step: number;
	/** Seed index, 1..SEED_COUNT. */
	seed: number;
	/** Number of displayed steps of every chain, 0..N_STEPS. */
	t: number;
}

export interface ChainRun {
	samples: Float64Array;
	/** 1 where the proposal was accepted, 0 otherwise. */
	accepted: Uint8Array;
}

export interface ChainStats {
	/** Share of accepted proposals among the displayed steps; null before the first step. */
	rate: number | null;
	/** Mean of the chain after burn-in; null while burn-in is not finished. */
	mean: number | null;
	/** Population standard deviation after burn-in, as numpy's default. */
	std: number | null;
	/** Share of post-burn-in values above zero (the right mode). */
	shareRight: number | null;
	/** Number of post-burn-in values. */
	n: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to one decimal and clamps to the step slider range. Non-finite input gives the default. */
export function snapStep(s: number): number {
	if (!Number.isFinite(s)) return STEP_DEFAULT;
	return Math.round(clamp(s, STEP_MIN, STEP_MAX) * 10) / 10;
}

/** Integer seed in 1..SEED_COUNT. Non-finite input gives the default. */
export function snapSeed(s: number): number {
	if (!Number.isFinite(s)) return SEED_DEFAULT;
	return clamp(Math.round(s), 1, SEED_COUNT);
}

/** Next seed in the cycle 1 → 2 → … → SEED_COUNT → 1. */
export function nextSeed(s: number): number {
	return (snapSeed(s) % SEED_COUNT) + 1;
}

/** Integer number of displayed steps in 0..N_STEPS. */
export function snapT(t: number): number {
	if (!Number.isFinite(t)) return N_STEPS;
	return Math.round(clamp(t, 0, N_STEPS));
}

/** log of the unnormalised target: log(exp(-(x-2)²/2) + exp(-(x+2)²/2)), computed stably. */
export function logTarget(x: number): number {
	const a = -0.5 * (x - 2) * (x - 2);
	const b = -0.5 * (x + 2) * (x + 2);
	const m = Math.max(a, b);
	return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
}

/** Normalised target density. Each mode is a unit normal with weight 1/2, so the sum integrates to 1. */
export function targetDensity(x: number): number {
	return Math.exp(logTarget(x)) / (2 * Math.sqrt(2 * Math.PI));
}

/** Mulberry32 generator: a small seeded PRNG returning values in [0, 1). */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Standard normal draw by the Box–Muller transform. */
function gaussian(rng: () => number): number {
	const u1 = Math.max(rng(), Number.MIN_VALUE);
	const u2 = rng();
	return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Metropolis–Hastings with a symmetric proposal: x' = x + step·z, z ~ N(0, 1).
 * The candidate is accepted with probability min(1, f(x')/f(x)); otherwise the chain stays at x.
 */
export function runChain(steps: number, step: number, x0: number, seed: number): ChainRun {
	const rng = mulberry32(seed);
	const samples = new Float64Array(steps);
	const accepted = new Uint8Array(steps);
	let x = x0;
	let lx = logTarget(x);
	for (let i = 0; i < steps; i++) {
		const proposal = x + step * gaussian(rng);
		const lp = logTarget(proposal);
		const u = Math.max(rng(), Number.MIN_VALUE);
		if (Math.log(u) < lp - lx) {
			x = proposal;
			lx = lp;
			accepted[i] = 1;
		}
		samples[i] = x;
	}
	return { samples, accepted };
}

/** One chain per starting point; chain k uses seed + 1000·k, so the chains are independent. */
export function runChains(
	step: number,
	seed: number,
	starts: readonly number[] = START_POINTS,
	steps: number = N_STEPS,
): ChainRun[] {
	return starts.map((x0, k) => runChain(steps, step, x0, seed + 1000 * k));
}

/** Statistics of the first `t` steps of a chain, with the first `burn` steps dropped from the values. */
export function chainStats(run: ChainRun, t: number, burn: number = BURN_IN): ChainStats {
	const end = snapT(t);
	let acc = 0;
	for (let i = 0; i < end; i++) acc += run.accepted[i] ?? 0;
	const rate = end > 0 ? acc / end : null;

	const n = Math.max(0, end - burn);
	if (n === 0) return { rate, mean: null, std: null, shareRight: null, n };
	let sum = 0;
	let right = 0;
	for (let i = burn; i < end; i++) {
		const x = run.samples[i] ?? 0;
		sum += x;
		if (x > 0) right++;
	}
	const mean = sum / n;
	let sq = 0;
	for (let i = burn; i < end; i++) sq += ((run.samples[i] ?? 0) - mean) ** 2;
	return { rate, mean, std: Math.sqrt(sq / n), shareRight: right / n, n };
}

/**
 * Classic Gelman–Rubin R-hat for m chains of equal length n:
 * W = mean of sample variances, B = n/(m-1)·Σ(mean_j − mean)², V̂ = (n−1)/n·W + B/n, R̂ = √(V̂/W).
 * Returns null when there is not enough data or W is zero.
 */
export function rhat(chains: ReadonlyArray<ArrayLike<number>>): number | null {
	const m = chains.length;
	if (m < 2) return null;
	const first = chains[0];
	if (!first) return null;
	const n = first.length;
	if (n < 2 || chains.some((c) => c.length !== n)) return null;

	const means: number[] = [];
	let wSum = 0;
	for (const c of chains) {
		let s = 0;
		for (let i = 0; i < n; i++) s += c[i] ?? 0;
		const mu = s / n;
		let sq = 0;
		for (let i = 0; i < n; i++) sq += ((c[i] ?? 0) - mu) ** 2;
		means.push(mu);
		wSum += sq / (n - 1);
	}
	const w = wSum / m;
	const grand = means.reduce((a, b) => a + b, 0) / m;
	const b = (n / (m - 1)) * means.reduce((a, mu) => a + (mu - grand) ** 2, 0);
	if (w === 0) return null;
	const v = ((n - 1) / n) * w + b / n;
	return Math.sqrt(v / w);
}

/** R-hat of the first `t` steps of every chain after burn-in; null while there is too little data. */
export function rhatAt(
	runs: readonly ChainRun[],
	t: number,
	burn: number = BURN_IN,
): number | null {
	const end = snapT(t);
	if (end - burn < 2) return null;
	return rhat(runs.map((r) => r.samples.subarray(burn, end)));
}

/** Histogram of values in [lo, hi) as densities (integrate to 1 over the range). Other values are ignored. */
export function histogram(
	values: ArrayLike<number>,
	lo: number = X_MIN,
	hi: number = X_MAX,
	bins: number = BINS,
): number[] {
	const counts = new Array<number>(bins).fill(0);
	const width = (hi - lo) / bins;
	let total = 0;
	for (let i = 0; i < values.length; i++) {
		const v = values[i];
		if (v === undefined || v < lo || v >= hi) continue;
		const k = Math.min(bins - 1, Math.floor((v - lo) / width));
		counts[k] = (counts[k] ?? 0) + 1;
		total++;
	}
	if (total === 0) return counts;
	return counts.map((c) => c / (total * width));
}

/** Formats a share in 0..1 as a whole percent, or a dash when there is no value. */
export function percent(share: number | null): string {
	return share === null ? '—' : `${Math.round(share * 100)}%`;
}

/** Formats a number with one or two decimals and a decimal comma, as in the text. */
export function fmt(v: number | null, digits = 2): string {
	if (v === null || !Number.isFinite(v)) return '—';
	return v.toFixed(digits).replace('.', ',');
}

/** Pixel coordinates of the trace: time runs along x over the full run, value along y. */
export function tracePoints(
	samples: ArrayLike<number>,
	t: number,
	width: number,
	height: number,
): string {
	const end = snapT(t);
	if (end < 2 || width <= 0) return '';
	const stride = Math.max(1, Math.ceil(end / width));
	const pad = 10;
	const half = (height - 2 * pad) / 2;
	const mid = height / 2;
	const parts: string[] = [];
	for (let i = 0; i < end; i += stride) {
		const x = (i / N_STEPS) * width;
		const v = clamp(samples[i] ?? 0, X_MIN, X_MAX);
		const y = mid - (v / X_MAX) * half;
		parts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
	}
	return parts.join(' ');
}

/** Pixel y of a value on the trace or the histogram y axis with the given domain and height. */
export function valueToY(v: number, height: number, lo: number, hi: number): number {
	return height - ((v - lo) / (hi - lo)) * height;
}

/** Target density sampled at the centres of the histogram bins, for the overlay curve. */
export function targetCurve(bins: number = BINS, lo: number = X_MIN, hi: number = X_MAX): number[] {
	const width = (hi - lo) / bins;
	const out: number[] = [];
	for (let i = 0; i < bins; i++) out.push(targetDensity(lo + (i + 0.5) * width));
	return out;
}

/** Short text for the live region: what the current settings produce. */
export function describeRun(step: number, stats: ChainStats, rh: number | null, t: number): string {
	if (t === 0)
		return 'Цепь ещё не сделала ни одного шага. Нажмите «Играть» или перетащите ползунок шагов.';
	if (stats.n === 0) {
		return `Прогрев: ${fmt(t, 0)} из ${BURN_IN} шагов, выборка для гистограммы ещё не начата.`;
	}
	const quality =
		stats.rate !== null && stats.rate > 0.9
			? 'Почти все предложения приняты: шаг мал, и цепь медленно уходит от старой точки.'
			: stats.rate !== null && stats.rate < 0.2
				? 'Большинство предложений отклонено: цепь часто стоит на месте.'
				: 'Доля принятых в средней области.';
	const conv =
		rh === null
			? ''
			: rh > RHAT_WARN
				? ` R-hat ${fmt(rh)}: цепи ещё не перемешались.`
				: ` R-hat ${fmt(rh)}: цепи согласуются.`;
	return `Шаг ${fmt(step, 1)}, доля принятых ${percent(stats.rate)}, в правом пике ${percent(stats.shareRight)}. ${quality}${conv}`;
}
