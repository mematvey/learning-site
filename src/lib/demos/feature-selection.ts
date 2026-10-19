/**
 * Math of the feature selection demo: pure noise, binary target, selection by |corr| above a threshold.
 * Selection is either done once on all rows (before the split) or inside each training fold.
 * The classifier is a linear correlation-weighted vote: the weight of a feature is its signed
 * correlation with the target on the training rows, and the class is the sign of the weighted sum.
 * Repetitions use fixed seeds 0..N_REPS-1, so every page load shows the same numbers.
 * Pure functions only: no DOM, no Svelte.
 */

export const N_SAMPLES = 50;
export const N_FEATURES = 1000;
export const N_FOLDS = 5;
export const N_REPS = 50;

export const THRESHOLD_MIN = 0.15;
export const THRESHOLD_MAX = 0.55;
export const THRESHOLD_STEP = 0.01;
/** Chosen so that the average number of features kept before the split is about 20 (see the test). */
export const THRESHOLD_DEFAULT = 0.33;

/** Where the selection happens: on all rows (before the split) or inside each training fold. */
export type SelectionMode = 'before' | 'inside';

export interface FeatureSelectionDemoState {
	/** Threshold on |corr(x_j, y)|: features at or above it are kept. */
	threshold: number;
	/** Where the selection is done. */
	mode: SelectionMode;
}

export interface Outcome {
	/** Mean CV accuracy when the selection sees all rows (before the split). */
	before: number;
	/** Mean CV accuracy when the selection is refit inside each training fold. */
	inside: number;
	/** Average number of features kept before the split, over the repetitions. */
	beforeCount: number;
	/** Average number of features kept inside a training fold, over repetitions and folds. */
	insideCount: number;
	/** Features kept before the split in the displayed run (run 0). */
	runCount: number;
}

export interface Rep {
	/** Feature matrix, row-major, N_SAMPLES x N_FEATURES. */
	x: Float32Array;
	/** Binary target. */
	y: Uint8Array;
	/** Row indices of each test fold. */
	folds: number[][];
	/** |corr| of every feature on all rows. */
	fullScores: Float64Array;
	/** |corr| of every feature on the training rows of each fold. */
	foldScores: Float64Array[];
}

export function isSelectionMode(v: unknown): v is SelectionMode {
	return v === 'before' || v === 'inside';
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to the threshold step and clamps to the slider range. Non-finite input gives the default. */
export function snapThreshold(t: number): number {
	if (!Number.isFinite(t)) return THRESHOLD_DEFAULT;
	const steps = Math.round(clamp(t, THRESHOLD_MIN, THRESHOLD_MAX) / THRESHOLD_STEP);
	return Math.round(steps * THRESHOLD_STEP * 100) / 100;
}

/** Formats a number with a decimal comma, as in Russian text. */
export function formatRu(v: number, digits: number): string {
	return v.toFixed(digits).replace('.', ',');
}

/** Seeded PRNG (mulberry32): the same seed gives the same sequence in [0, 1). */
export function mulberry32(seed: number): () => number {
	let a = seed | 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Standard normal value by Box-Muller. */
function gaussian(rand: () => number): number {
	let u = 0;
	while (u === 0) u = rand();
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Signed Pearson correlation of column j with y over the given rows. Zero for a constant column. */
function signedCorr(x: Float32Array, j: number, y: Uint8Array, rows: readonly number[]): number {
	const n = rows.length;
	let ma = 0;
	let mb = 0;
	for (const i of rows) {
		ma += x[i * N_FEATURES + j];
		mb += y[i];
	}
	ma /= n;
	mb /= n;
	let sab = 0;
	let saa = 0;
	let sbb = 0;
	for (const i of rows) {
		const da = x[i * N_FEATURES + j] - ma;
		const db = y[i] - mb;
		sab += da * db;
		saa += da * da;
		sbb += db * db;
	}
	return sab / Math.sqrt(saa * sbb || 1);
}

function absCorrAll(x: Float32Array, y: Uint8Array, rows: readonly number[]): Float64Array {
	const s = new Float64Array(N_FEATURES);
	for (let j = 0; j < N_FEATURES; j++) s[j] = Math.abs(signedCorr(x, j, y, rows));
	return s;
}

/** Builds one repetition: pure-noise features, a random binary target, shuffled folds, and the scores. */
export function makeRep(seed: number): Rep {
	const rand = mulberry32(seed);
	const x = new Float32Array(N_SAMPLES * N_FEATURES);
	for (let k = 0; k < x.length; k++) x[k] = gaussian(rand);
	const y = new Uint8Array(N_SAMPLES);
	for (let i = 0; i < N_SAMPLES; i++) y[i] = rand() < 0.5 ? 1 : 0;

	const all = Array.from({ length: N_SAMPLES }, (_, i) => i);
	const perm = all.slice();
	for (let i = perm.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[perm[i], perm[j]] = [perm[j], perm[i]];
	}
	const folds: number[][] = [];
	for (let f = 0; f < N_FOLDS; f++) folds.push(perm.filter((_, idx) => idx % N_FOLDS === f));

	const fullScores = absCorrAll(x, y, all);
	const foldScores = folds.map((test) => {
		const train = all.filter((i) => !test.includes(i));
		return absCorrAll(x, y, train);
	});
	return { x, y, folds, fullScores, foldScores };
}

let repCache: Rep[] | null = null;

/** All repetitions, built once on first use. */
export function reps(): Rep[] {
	if (repCache === null) {
		repCache = Array.from({ length: N_REPS }, (_, s) => makeRep(s));
	}
	return repCache;
}

/** Features whose score is at or above the threshold, in index order. */
export function selectAbove(scores: Float64Array, threshold: number): number[] {
	const out: number[] = [];
	for (let j = 0; j < scores.length; j++) if (scores[j] >= threshold) out.push(j);
	return out;
}

/**
 * Fits the correlation-weighted vote on the given rows and features.
 * Weight of feature j is its signed correlation with y on those rows; the class is the sign of the sum.
 * With no features the vote is always 0, so the accuracy is the share of zeros in the test rows.
 */
export function fitVote(
	x: Float32Array,
	y: Uint8Array,
	feats: readonly number[],
	rows: readonly number[],
): (row: number) => 0 | 1 {
	const w = feats.map((j) => signedCorr(x, j, y, rows));
	return (row: number) => {
		let s = 0;
		for (let t = 0; t < feats.length; t++) s += w[t] * x[row * N_FEATURES + feats[t]];
		return s > 0 ? 1 : 0;
	};
}

/** Share of correct predictions on the test rows, for the features chosen by the selection. */
function accuracy(
	rep: Rep,
	feats: readonly number[],
	train: readonly number[],
	test: readonly number[],
): number {
	const predict = fitVote(rep.x, rep.y, feats, train);
	let ok = 0;
	for (const i of test) if (predict(i) === rep.y[i]) ok++;
	return ok / test.length;
}

/** Training rows of fold f: all rows that are not in its test fold, in index order. */
function trainRows(rep: Rep, f: number): number[] {
	const test = new Set(rep.folds[f]);
	const out: number[] = [];
	for (let i = 0; i < N_SAMPLES; i++) if (!test.has(i)) out.push(i);
	return out;
}

/**
 * Mean CV accuracy for both places of selection at one threshold.
 * Averages over the folds of each repetition, then over the repetitions.
 */
export function evaluate(threshold: number): Outcome {
	const t = snapThreshold(threshold);
	const all = reps();
	let before = 0;
	let inside = 0;
	let beforeCount = 0;
	let insideCount = 0;
	for (const rep of all) {
		const beforeFeats = selectAbove(rep.fullScores, t);
		beforeCount += beforeFeats.length / N_REPS;
		let repBefore = 0;
		let repInside = 0;
		for (let f = 0; f < N_FOLDS; f++) {
			const train = trainRows(rep, f);
			const test = rep.folds[f];
			const feats = selectAbove(rep.foldScores[f], t);
			insideCount += feats.length / (N_FOLDS * N_REPS);
			repBefore += accuracy(rep, beforeFeats, train, test) / N_FOLDS;
			repInside += accuracy(rep, feats, train, test) / N_FOLDS;
		}
		before += repBefore / N_REPS;
		inside += repInside / N_REPS;
	}
	return {
		before,
		inside,
		beforeCount,
		insideCount,
		runCount: selectAbove(all[0].fullScores, t).length,
	};
}

/** Scores the selection sees in the displayed run (run 0): all rows before the split, or fold 0 inside. */
function shownScores(mode: SelectionMode): Float64Array {
	const r = reps()[0];
	return mode === 'before' ? r.fullScores : r.foldScores[0];
}

/** Sorted scores of the displayed run for a mode, from the largest. */
export function sortedCurve(mode: SelectionMode): Float64Array {
	return Float64Array.from(shownScores(mode)).sort((a, b) => b - a);
}

/** Number of features the threshold keeps in the displayed run for a mode. */
export function displayedCount(mode: SelectionMode, threshold: number): number {
	return selectAbove(shownScores(mode), snapThreshold(threshold)).length;
}

/** Mean over repetitions of the largest |corr| among the pure-noise features on all rows. */
export function noiseMaxMean(): number {
	const all = reps();
	let s = 0;
	for (const rep of all) s += Math.max(...rep.fullScores) / all.length;
	return s;
}

/** Rough bound sqrt(2 ln p / n) for the largest |corr| of p noise features on n rows. */
export const NOISE_MAX_BOUND = Math.sqrt((2 * Math.log(N_FEATURES)) / N_SAMPLES);
