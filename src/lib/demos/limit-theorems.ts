/**
 * Math of the limit theorems demo: the running mean of one measurement stream (law of large
 * numbers) and the histogram of sample means of n measurements (central limit theorem).
 * Everything is seeded, so every page load shows the same picture.
 * Pure functions only: no DOM, no Svelte.
 */

export const N_MIN = 1;
export const N_MAX = 200;
export const N_STEP = 1;
export const N_DEFAULT = 20;
/** Number of repeated samples of size n behind the histogram. */
export const REPS = 1000;
/** Number of histogram bins. */
export const BINS = 24;
/** Half-width of the histogram domain in standard errors. */
export const HIST_SPAN = 4;
/** Seed of the single measurement stream shown on the running-mean chart. */
export const PATH_SEED = 7;
/** Seed of the repeated samples behind the histogram. */
export const SAMPLE_SEED = 11;

export type SourceKind = 'uniform' | 'exponential' | 'die';
export const SOURCE_KINDS: readonly SourceKind[] = ['uniform', 'exponential', 'die'];

export interface LimitTheoremsDemoState {
	/** Distribution of one measurement. */
	source: SourceKind;
	/** Number of measurements n in one sample. */
	n: number;
}

export function isSourceKind(v: unknown): v is SourceKind {
	return v === 'uniform' || v === 'exponential' || v === 'die';
}

/** Rounds to an integer and clamps to the n slider range. Non-finite input gives N_DEFAULT. */
export function snapN(n: number): number {
	if (!Number.isFinite(n)) return N_DEFAULT;
	return Math.min(N_MAX, Math.max(N_MIN, Math.round(n)));
}

/**
 * Seeded generator (mulberry32). Returns numbers in [0, 1) and is deterministic for a seed.
 */
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

/** Maps a uniform number u in [0, 1) to one measurement of the given distribution. */
export function sampleOne(kind: SourceKind, u: number): number {
	switch (kind) {
		case 'uniform':
			return u;
		case 'exponential':
			// Rate 1: inverse CDF. 1 - u is in (0, 1], so the log is finite.
			return -Math.log(1 - u);
		case 'die':
			return Math.floor(u * 6) + 1;
	}
}

/** Exact expected value of one measurement. */
export function trueMean(kind: SourceKind): number {
	switch (kind) {
		case 'uniform':
			return 0.5;
		case 'exponential':
			return 1;
		case 'die':
			return 3.5;
	}
}

/** Exact variance of one measurement. */
export function trueVariance(kind: SourceKind): number {
	switch (kind) {
		case 'uniform':
			return 1 / 12;
		case 'exponential':
			return 1;
		case 'die':
			return 35 / 12;
	}
}

/** Standard error of the mean of n measurements: sigma / sqrt(n). */
export function standardError(kind: SourceKind, n: number): number {
	return Math.sqrt(trueVariance(kind) / Math.max(1, n));
}

/** Half-width of the band around the expected value: 2 standard errors at step k. */
export function bandHalfWidth(kind: SourceKind, k: number): number {
	return 2 * standardError(kind, k);
}

/** The first n measurements of the fixed stream. Prefixes are consistent across n. */
export function measurements(kind: SourceKind, n: number, seed = PATH_SEED): number[] {
	const rng = mulberry32(seed);
	const xs: number[] = [];
	for (let i = 0; i < n; i++) xs.push(sampleOne(kind, rng()));
	return xs;
}

/** Running mean: element k is the mean of the first k+1 measurements. */
export function runningMeans(xs: readonly number[]): number[] {
	const out: number[] = [];
	let sum = 0;
	for (let i = 0; i < xs.length; i++) {
		sum += xs[i] ?? 0;
		out.push(sum / (i + 1));
	}
	return out;
}

/**
 * Means of `reps` independent samples of size n. Deterministic for a seed.
 */
export function sampleMeans(
	kind: SourceKind,
	n: number,
	reps: number = REPS,
	seed = SAMPLE_SEED,
): number[] {
	const rng = mulberry32(seed);
	const size = Math.max(1, Math.floor(n));
	const means: number[] = [];
	for (let r = 0; r < reps; r++) {
		let sum = 0;
		for (let i = 0; i < size; i++) sum += sampleOne(kind, rng());
		means.push(sum / size);
	}
	return means;
}

export function mean(xs: readonly number[]): number {
	if (xs.length === 0) return 0;
	return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/** Sample standard deviation (divides by len - 1). */
export function sampleSd(xs: readonly number[]): number {
	if (xs.length < 2) return 0;
	const mu = mean(xs);
	let s = 0;
	for (const v of xs) s += (v - mu) * (v - mu);
	return Math.sqrt(s / (xs.length - 1));
}

/** Sample skewness (third standardised moment). Zero for a symmetric sample. */
export function skewness(xs: readonly number[]): number {
	if (xs.length < 3) return 0;
	const mu = mean(xs);
	let m2 = 0;
	let m3 = 0;
	for (const v of xs) {
		const d = v - mu;
		m2 += d * d;
		m3 += d * d * d;
	}
	m2 /= xs.length;
	m3 /= xs.length;
	return m2 === 0 ? 0 : m3 / Math.pow(m2, 1.5);
}

/**
 * Counts values into `bins` equal bins over [lo, hi]. Values outside the range are skipped;
 * hi falls into the last bin.
 */
export function histogram(
	values: readonly number[],
	bins: number,
	lo: number,
	hi: number,
): number[] {
	const counts = new Array<number>(bins).fill(0);
	const width = hi - lo;
	if (!(width > 0) || bins < 1) return counts;
	for (const v of values) {
		if (!(v >= lo && v <= hi)) continue;
		const i = Math.min(bins - 1, Math.floor(((v - lo) / width) * bins));
		counts[i] = (counts[i] ?? 0) + 1;
	}
	return counts;
}

/** Domain of the histogram of sample means: expected value ± HIST_SPAN standard errors. */
export function histogramDomain(kind: SourceKind, n: number): [number, number] {
	const c = trueMean(kind);
	const half = HIST_SPAN * standardError(kind, n);
	return [c - half, c + half];
}

/** Normal density with mean mu and standard deviation sigma. */
export function normalPdf(x: number, mu: number, sigma: number): number {
	if (!(sigma > 0)) return 0;
	const z = (x - mu) / sigma;
	return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Summary of the simulated means against the formula. */
export interface SampleSummary {
	/** Mean of the simulated sample means (should be close to the expected value). */
	mean: number;
	/** Standard deviation of the simulated sample means: the simulated standard error. */
	se: number;
	/** Standard error from the formula sigma / sqrt(n). */
	seTheory: number;
}

export function summarize(kind: SourceKind, n: number, means: readonly number[]): SampleSummary {
	return {
		mean: mean(means),
		se: sampleSd(means),
		seTheory: standardError(kind, n),
	};
}

/** Text of the state line for aria-live. Numbers are computed, not typed. */
export function describeState(kind: SourceKind, n: number, s: SampleSummary): string {
	const plural = n === 1 ? 'измерение' : n < 5 ? 'измерения' : 'измерений';
	return (
		`n = ${n} ${plural}. Среднее выборочных средних ${s.mean.toFixed(3)}, ` +
		`ожидание ${trueMean(kind).toFixed(3)}. ` +
		`Стандартная ошибка по симуляции ${s.se.toFixed(3)}, по формуле σ/√n ${s.seTheory.toFixed(3)}.`
	);
}

/** SVG path for a polyline through the points. Empty input gives an empty string. */
export function pathFromPoints(points: readonly (readonly [number, number])[]): string {
	if (points.length === 0) return '';
	return points
		.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
		.join(' ');
}

/** Linear map from the domain [d0, d1] to the range [r0, r1]. A degenerate domain gives r0. */
export function scaleLinear(v: number, d0: number, d1: number, r0: number, r1: number): number {
	if (d1 === d0) return r0;
	return r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}
