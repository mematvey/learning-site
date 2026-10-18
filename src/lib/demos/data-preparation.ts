/**
 * Math of the preprocessing leakage demo.
 *
 * The data is pure noise: features are independent of the label, so an honest
 * accuracy is 0.5. The pipeline selects the k features most correlated with the label
 * and classifies with their correlation-weighted vote. The only difference between the
 * two schemes is which rows the preprocessing (standardisation and feature selection)
 * is fitted on: all rows, including the held-out fold, or the training folds only.
 * Everything is deterministic: a dataset is fixed by its integer seed.
 * Pure functions only: no DOM, no Svelte.
 */

export const N_ROWS = 200;
export const N_FEATURES = 100;
export const FOLDS = 5;
/** Number of datasets in the strip plot; seeds are 1..SEED_COUNT. */
export const SEED_COUNT = 30;
export const K_MIN = 1;
export const K_MAX = 50;
export const K_DEFAULT = 10;
/** Honest accuracy on pure noise. */
export const CHANCE = 0.5;

export type Scope = 'all' | 'train';

export interface Dataset {
	X: number[][];
	y: number[];
}

export interface CvResult {
	/** Accuracy on each held-out fold. */
	folds: number[];
	/** Mean over the folds: the cross-validation estimate. */
	mean: number;
}

export function isScope(v: unknown): v is Scope {
	return v === 'all' || v === 'train';
}

export function clampK(k: number): number {
	if (!Number.isFinite(k)) return K_DEFAULT;
	return Math.min(K_MAX, Math.max(K_MIN, Math.round(k)));
}

export function clampSeed(s: number): number {
	if (!Number.isFinite(s)) return 1;
	return Math.min(SEED_COUNT, Math.max(1, Math.round(s)));
}

/** Small seeded PRNG (mulberry32). Returns floats in [0, 1). */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Pure noise dataset: N(0, 1) features and a random binary label, fixed by the seed. */
export function makeDataset(seed: number): Dataset {
	const rand = mulberry32(seed);
	const gauss = (): number => {
		const u1 = Math.max(rand(), 1e-12);
		const u2 = rand();
		return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	};
	const X: number[][] = [];
	const y: number[] = [];
	for (let i = 0; i < N_ROWS; i++) {
		y.push(rand() < 0.5 ? 1 : 0);
		const row: number[] = [];
		for (let j = 0; j < N_FEATURES; j++) row.push(gauss());
		X.push(row);
	}
	return { X, y };
}

/** Element access that treats a missing entry as 0 (keeps strict index checks happy). */
function at(xs: readonly number[], i: number): number {
	return xs[i] ?? 0;
}

/**
 * Cross-validation with a preprocessing pipeline.
 * Scope 'all': standardisation and feature selection are fitted on every row.
 * Scope 'train': they are fitted on the training folds of each split only.
 * The classifier weights are always fitted on the training folds.
 */
export function cvScores(data: Dataset, k: number, scope: Scope): CvResult {
	const { X, y } = data;
	const n = y.length;
	const p = X[0]?.length ?? 0;
	const kk = clampK(k);
	const everyRow = Array.from({ length: n }, (_, i) => i);
	const cell = (i: number, j: number): number => at(X[i] ?? [], j);
	const folds: number[] = [];

	for (let f = 0; f < FOLDS; f++) {
		const lo = Math.floor((f * n) / FOLDS);
		const hi = Math.floor(((f + 1) * n) / FOLDS);
		const test: number[] = [];
		const train: number[] = [];
		for (let i = 0; i < n; i++) (i >= lo && i < hi ? test : train).push(i);

		const statRows = scope === 'all' ? everyRow : train;
		const mu: number[] = [];
		const sd: number[] = [];
		for (let j = 0; j < p; j++) {
			let s = 0;
			for (const i of statRows) s += cell(i, j);
			const m = s / statRows.length;
			let v = 0;
			for (const i of statRows) v += (cell(i, j) - m) * (cell(i, j) - m);
			mu.push(m);
			sd.push(Math.sqrt(v / statRows.length) || 1);
		}

		// Correlation-like score of each standardised feature with the label.
		const corrOn = (rows: number[], j: number, yBar: number): number => {
			let c = 0;
			for (const i of rows) c += ((cell(i, j) - at(mu, j)) / at(sd, j)) * (at(y, i) - yBar);
			return c / rows.length;
		};
		const statYBar = statRows.reduce((s, i) => s + at(y, i), 0) / statRows.length;
		const statCorr = Array.from({ length: p }, (_, j) => corrOn(statRows, j, statYBar));
		const selected = Array.from({ length: p }, (_, j) => j)
			.sort((a, b) => Math.abs(at(statCorr, b)) - Math.abs(at(statCorr, a)) || a - b)
			.slice(0, kk);

		// Classifier: correlation-weighted vote over the selected features, fitted on train only.
		const trainYBar = train.reduce((s, i) => s + at(y, i), 0) / train.length;
		const weights = selected.map((j) => corrOn(train, j, trainYBar));

		let correct = 0;
		for (const i of test) {
			let score = 0;
			selected.forEach((j, t) => {
				score += at(weights, t) * ((cell(i, j) - at(mu, j)) / at(sd, j));
			});
			const pred = score > 0 ? 1 : 0;
			if (pred === at(y, i)) correct++;
		}
		folds.push(correct / test.length);
	}

	const mean = folds.reduce((s, v) => s + v, 0) / folds.length;
	return { folds, mean };
}

/** Cross-validation estimates for datasets with seeds 1..SEED_COUNT. */
export function sweep(k: number, scope: Scope): number[] {
	const out: number[] = [];
	for (let s = 1; s <= SEED_COUNT; s++) out.push(cvScores(makeDataset(s), k, scope).mean);
	return out;
}

export function average(xs: readonly number[]): number {
	return xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length;
}

/** Russian-style decimal with two digits, e.g. 0,62. */
export function formatAcc(v: number): string {
	return v.toFixed(2).replace('.', ',');
}

/** One sentence for the «Что заметить» note, based on the sweep averages. */
export function describeLeak(allMean: number, trainMean: number, k: number): string {
	const gap = allMean - trainMean;
	if (gap >= 0.05) {
		return (
			`При k = ${k} схема «на всей выборке» в среднем даёт ${formatAcc(allMean)}, ` +
			`а честная схема «только на train» даёт ${formatAcc(trainMean)}. ` +
			`Модель не стала лучше: признаки-шум отбирались по ответам тестовых фолдов.`
		);
	}
	return (
		`При k = ${k} обе схемы дают близкие значения (${formatAcc(allMean)} и ${formatAcc(trainMean)}). ` +
		`Завышение заметно, когда признаков много и отбор сильно зависит от ответов.`
	);
}
