/**
 * Math of the conformal demo: split conformal prediction on heteroscedastic data.
 * The noise grows with x, so a constant-width band is too wide on the left and too narrow on the right.
 * Every sample comes from a seed, so one state always gives the same picture.
 * Pure functions only: no DOM, no Svelte.
 */

export const ALPHA_MIN = 0.01;
export const ALPHA_MAX = 0.5;
export const ALPHA_STEP = 0.01;
export const DEFAULT_ALPHA = 0.1;

/** Calibration sizes named in the chapter text. Each one has its own rank k. */
export const N_CHOICES = [8, 9, 19, 99, 999] as const;
export type CalibrationSize = (typeof N_CHOICES)[number];
export const DEFAULT_N: CalibrationSize = 99;
const N_MAX = 999;

export const DEFAULT_SEED = 1;
export const N_TRAIN = 3000;
export const N_TEST = 2000;
/** Test points drawn as dots. The coverage numbers use all N_TEST points. */
export const N_SHOW = 240;
/** Lower bound of the scale model, so the adaptive width never collapses to zero. */
const SIGMA_FLOOR = 0.01;
const CURVE_STEPS = 60;

export type Method = 'fixed' | 'adaptive';

export interface ConformalDemoState {
	/** Allowed miss rate α; the target coverage is 1 − α. */
	alpha: number;
	/** Calibration size n. */
	n: number;
	/** Seed of the sample; changing it draws a new sample. */
	seed: number;
	/** Which band the misses are highlighted for. */
	method: Method;
}

export interface ConformalInput {
	alpha: number;
	n: number;
	seed: number;
}

export function isMethod(v: unknown): v is Method {
	return v === 'fixed' || v === 'adaptive';
}

/** Rounds α to the slider step and clamps it to the range. Non-finite input gives the default. */
export function snapAlpha(a: number): number {
	if (!Number.isFinite(a)) return DEFAULT_ALPHA;
	const c = Math.min(ALPHA_MAX, Math.max(ALPHA_MIN, a));
	return Math.round(c * 100) / 100;
}

/** Returns the nearest allowed calibration size. Non-finite input gives the default. */
export function snapN(n: number): CalibrationSize {
	if (!Number.isFinite(n)) return DEFAULT_N;
	let best: CalibrationSize = N_CHOICES[0];
	for (const c of N_CHOICES) {
		if (Math.abs(c - n) < Math.abs(best - n)) best = c;
	}
	return best;
}

/** A non-negative integer seed. Non-finite input gives the default. */
export function snapSeed(s: number): number {
	if (!Number.isFinite(s)) return DEFAULT_SEED;
	return Math.abs(Math.floor(s)) % 1_000_000;
}

/** Rank of the threshold: k = ceil((n + 1)(1 − α)). The 1e-9 guard keeps float noise from adding 1. */
export function rankK(n: number, alpha: number): number {
	return Math.max(1, Math.ceil((n + 1) * (1 - alpha) - 1e-9));
}

/** Smallest calibration size for which the interval is finite: k ≤ n. */
export function minCalibrationSize(alpha: number): number {
	return Math.max(1, Math.ceil((1 - alpha) / alpha - 1e-9));
}

/** The k-th smallest score (1-based), or Infinity when k is larger than the number of scores. */
export function conformalQuantile(scores: readonly number[], k: number): number {
	if (k > scores.length) return Infinity;
	const sorted = [...scores].sort((a, b) => a - b);
	return sorted[Math.max(1, k) - 1] ?? Infinity;
}

/** Seeded PRNG (mulberry32). Returns numbers in [0, 1). */
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

/** Standard normal draw (Box-Muller) from the given uniform source. */
function gaussian(rand: () => number): number {
	const u = Math.max(rand(), 1e-12);
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Separate streams for training, calibration and test, so changing n does not change training. */
function streamSeed(seed: number, salt: number): number {
	return (Math.imul(seed, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
}

/** True curve of the data: a parabola on [0, 1]. */
export function trueMean(x: number): number {
	return 1 + 3 * x - 2 * x * x;
}

/** True noise scale: grows from left to right (heteroscedastic). */
export function noiseScale(x: number): number {
	return 0.05 + 0.7 * x;
}

export interface Pair {
	x: number;
	y: number;
}

function draw(rand: () => number, count: number): Pair[] {
	const out: Pair[] = [];
	for (let i = 0; i < count; i++) {
		const x = rand();
		out.push({ x, y: trueMean(x) + noiseScale(x) * gaussian(rand) });
	}
	return out;
}

/** Gaussian elimination with partial pivoting. Modifies its inputs. */
function solveLinear(A: number[][], b: number[]): number[] {
	const m = b.length;
	for (let col = 0; col < m; col++) {
		let piv = col;
		for (let r = col + 1; r < m; r++) {
			if (Math.abs(A[r]![col]!) > Math.abs(A[piv]![col]!)) piv = r;
		}
		[A[col], A[piv]] = [A[piv]!, A[col]!];
		[b[col], b[piv]] = [b[piv]!, b[col]!];
		for (let r = col + 1; r < m; r++) {
			const f = A[r]![col]! / A[col]![col]!;
			for (let c = col; c < m; c++) A[r]![c]! -= f * A[col]![c]!;
			b[r]! -= f * b[col]!;
		}
	}
	const x: number[] = new Array<number>(m).fill(0);
	for (let r = m - 1; r >= 0; r--) {
		let s = b[r]!;
		for (let c = r + 1; c < m; c++) s -= A[r]![c]! * x[c]!;
		x[r] = s / A[r]![r]!;
	}
	return x;
}

/** Coefficients c0..cdeg of the least-squares polynomial fit (normal equations). */
export function polyFit(pairs: readonly Pair[], deg: number): number[] {
	const m = deg + 1;
	const A: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
	const b: number[] = new Array<number>(m).fill(0);
	for (const { x, y } of pairs) {
		const pw: number[] = [];
		for (let p = 0; p < 2 * m - 1; p++) pw.push(x ** p);
		for (let r = 0; r < m; r++) {
			for (let c = 0; c < m; c++) A[r]![c]! += pw[r + c]!;
			b[r]! += pw[r]! * y;
		}
	}
	return solveLinear(A, b);
}

/** Value of the polynomial with coefficients c0..cdeg at x. */
export function polyEval(coef: readonly number[], x: number): number {
	let s = 0;
	for (let p = coef.length - 1; p >= 0; p--) s = s * x + (coef[p] ?? 0);
	return s;
}

/** Region of x: 0 = left third, 1 = middle, 2 = right third. */
export function regionOf(x: number): 0 | 1 | 2 {
	return Math.min(2, Math.floor(x * 3)) as 0 | 1 | 2;
}

export interface BandStats {
	/** Half-width factor q; the constant band is ±q, the adaptive one is ±q·σ̂(x). */
	q: number;
	/** Average interval width over the test points (Infinity when the interval is unbounded). */
	width: number;
	/** Share of test points inside the band. */
	coverage: number;
	/** Coverage in the left, middle and right third of x. */
	byRegion: [number, number, number];
}

export interface CurvePoint {
	x: number;
	mu: number;
	fixedLo: number;
	fixedHi: number;
	adaptLo: number;
	adaptHi: number;
}

export interface DemoPoint {
	x: number;
	y: number;
	/** Test point outside the constant band. */
	missFixed: boolean;
	/** Test point outside the adaptive band. */
	missAdaptive: boolean;
}

export interface ConformalResult {
	alpha: number;
	n: number;
	seed: number;
	/** Rank of the threshold, k = ceil((n + 1)(1 − α)). */
	k: number;
	/** False when k > n: both intervals are unbounded. */
	kValid: boolean;
	/** Smallest n at which the interval is finite for this α. */
	minN: number;
	fixed: BandStats;
	adaptive: BandStats;
	curve: CurvePoint[];
	points: DemoPoint[];
}

/**
 * Runs the whole demo for one state: fits the model and the scale on the training sample,
 * computes scores on the calibration sample, and measures coverage on the test sample.
 */
export function evaluateConformal(input: ConformalInput): ConformalResult {
	const alpha = snapAlpha(input.alpha);
	const n = snapN(input.n);
	const seed = snapSeed(input.seed);

	const train = draw(mulberry32(streamSeed(seed, 0)), N_TRAIN);
	// The calibration sample is drawn at full size and cut to n, so a smaller n is a prefix of a larger one.
	const cal = draw(mulberry32(streamSeed(seed, 1)), N_MAX).slice(0, n);
	const test = draw(mulberry32(streamSeed(seed, 2)), N_TEST);

	// Model and scale are fitted on the training sample only.
	const mu = polyFit(train, 2);
	const scale = polyFit(
		train.map(({ x, y }) => ({ x, y: Math.abs(y - polyEval(mu, x)) })),
		1,
	);
	const muAt = (x: number) => polyEval(mu, x);
	const sigAt = (x: number) => Math.max(SIGMA_FLOOR, polyEval(scale, x));

	const k = rankK(n, alpha);
	const calFixed = cal.map(({ x, y }) => Math.abs(y - muAt(x)));
	const calAdapt = cal.map(({ x, y }) => Math.abs(y - muAt(x)) / sigAt(x));
	const qFixed = conformalQuantile(calFixed, k);
	const qAdapt = conformalQuantile(calAdapt, k);

	const tally = (halfWidth: (x: number) => number) => {
		const hit = [0, 0, 0];
		const cnt = [0, 0, 0];
		let covered = 0;
		for (const { x, y } of test) {
			const r = regionOf(x);
			const ok = Math.abs(y - muAt(x)) <= halfWidth(x);
			cnt[r]! += 1;
			if (ok) {
				hit[r]! += 1;
				covered += 1;
			}
		}
		return {
			coverage: covered / test.length,
			byRegion: [hit[0]! / cnt[0]!, hit[1]! / cnt[1]!, hit[2]! / cnt[2]!] as [
				number,
				number,
				number,
			],
		};
	};

	const fixedTally = tally(() => qFixed);
	const adaptTally = tally((x) => qAdapt * sigAt(x));
	const meanSigma = test.reduce((acc, { x }) => acc + sigAt(x), 0) / test.length;

	const curve: CurvePoint[] = [];
	for (let j = 0; j < CURVE_STEPS; j++) {
		const x = j / (CURVE_STEPS - 1);
		const m = muAt(x);
		const s = sigAt(x);
		curve.push({
			x,
			mu: m,
			fixedLo: m - qFixed,
			fixedHi: m + qFixed,
			adaptLo: m - qAdapt * s,
			adaptHi: m + qAdapt * s,
		});
	}

	const points: DemoPoint[] = test.slice(0, N_SHOW).map(({ x, y }) => {
		const r = Math.abs(y - muAt(x));
		return {
			x,
			y,
			missFixed: r > qFixed,
			missAdaptive: r / sigAt(x) > qAdapt,
		};
	});

	return {
		alpha,
		n,
		seed,
		k,
		kValid: k <= n,
		minN: minCalibrationSize(alpha),
		fixed: {
			q: qFixed,
			width: 2 * qFixed,
			coverage: fixedTally.coverage,
			byRegion: fixedTally.byRegion,
		},
		adaptive: {
			q: qAdapt,
			width: 2 * qAdapt * meanSigma,
			coverage: adaptTally.coverage,
			byRegion: adaptTally.byRegion,
		},
		curve,
		points,
	};
}
