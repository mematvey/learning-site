/**
 * Math of the ensembles demo: one decision tree, a random forest (bagged trees with random
 * features) and gradient boosting with regression stumps, all on the same 2D data.
 * Pure functions only: no DOM, no Svelte.
 *
 * Everything is deterministic: the data and every random draw come from a seed, so every page
 * load shows the same picture. The forest and the boosting are built once for the maximum
 * number of members; the sliders only take a prefix (the first k trees, the first T rounds).
 */

import { mulberry32 } from './attention';

export const SEED = 20240917;
export const N_TRAIN = 120;
export const N_TEST = 120;
/** Share of labels flipped at random: the noise that a deep tree learns by heart. */
export const LABEL_NOISE = 0.12;
/** Radius of the round region of class 1 (centre (0.5, 0.5), unit square). */
export const REGION_RADIUS = 0.32;

/** Depth of the single tree of the demo. */
export const TREE_DEPTH = 6;
/** Depth of the trees inside the forest: shallower, the averaging does the rest. */
export const FOREST_DEPTH = 4;
const FOREST_SEED = SEED + 1;

export const TREES_MIN = 1;
export const TREES_MAX = 50;
export const TREES_DEFAULT = 25;
export const ROUNDS_MIN = 1;
export const ROUNDS_MAX = 100;
export const ROUNDS_DEFAULT = 50;
export const NU_MIN = 0.05;
export const NU_MAX = 1;
export const NU_STEP = 0.05;
export const NU_DEFAULT = 0.3;

/** Cells per side of the decision-region grid. */
export const GRID_N = 28;

export interface EnsembleDemoState {
	/** Number of trees in the forest. */
	trees: number;
	/** Number of boosting rounds (stumps). */
	rounds: number;
	/** Shrinkage nu of gradient boosting. */
	nu: number;
}

export const DEFAULT_STATE: EnsembleDemoState = {
	trees: TREES_DEFAULT,
	rounds: ROUNDS_DEFAULT,
	nu: NU_DEFAULT,
};

export interface Vec2 {
	x: number;
	y: number;
}

export interface Point extends Vec2 {
	label: 0 | 1;
}

export interface Dataset {
	train: Point[];
	test: Point[];
}

/** Probability of class 1 at a point. The label is 1 when this value is above 0.5. */
export type Classifier = (v: Vec2) => number;

export interface Scores {
	train: number;
	test: number;
}

export interface GridCell {
	/** Top-left corner in the unit square, SVG orientation (y grows downwards). */
	x: number;
	y: number;
	/** Probability of class 1 in the cell. */
	p: number;
}

/** Rounds to an integer in [lo, hi]. Non-numbers and non-finite values give the fallback. */
export function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
	return Math.min(hi, Math.max(lo, Math.round(v)));
}

export function snapTrees(v: unknown): number {
	return clampInt(v, TREES_MIN, TREES_MAX, TREES_DEFAULT);
}

export function snapRounds(v: unknown): number {
	return clampInt(v, ROUNDS_MIN, ROUNDS_MAX, ROUNDS_DEFAULT);
}

/** Shrinkage on the NU_STEP grid inside [NU_MIN, NU_MAX]. Non-numbers give the default. */
export function snapNu(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return NU_DEFAULT;
	const steps = Math.round(Math.min(NU_MAX, Math.max(NU_MIN, v)) / NU_STEP);
	return Math.round(steps * NU_STEP * 100) / 100;
}

/** Class of the noiseless region: inside the circle is 1. */
export function regionLabel(x: number, y: number): 0 | 1 {
	const dx = x - 0.5;
	const dy = y - 0.5;
	return dx * dx + dy * dy < REGION_RADIUS * REGION_RADIUS ? 1 : 0;
}

/** Train and test sets from the same region, with the same label noise. */
export function makeDataset(seed: number = SEED, nTrain = N_TRAIN, nTest = N_TEST): Dataset {
	const rand = mulberry32(seed);
	const make = (n: number): Point[] =>
		Array.from({ length: n }, () => {
			const x = rand();
			const y = rand();
			let label = regionLabel(x, y);
			if (rand() < LABEL_NOISE) label = label === 1 ? 0 : 1;
			return { x, y, label };
		});
	const train = make(nTrain);
	const test = make(nTest);
	return { train, test };
}

/* ---------- Decision tree (CART with Gini) ---------- */

export type TreeNode =
	| { leaf: true; p: number }
	| { leaf: false; feature: 0 | 1; threshold: number; left: TreeNode; right: TreeNode };

export interface TreeOptions {
	maxDepth: number;
	/** Smallest number of samples allowed in a leaf. */
	minLeaf: number;
	/** Features tried at one split. Default: both. Random forest picks one at random. */
	pickFeatures?: () => readonly (0 | 1)[];
}

function coord(v: Vec2, feature: 0 | 1): number {
	return feature === 0 ? v.x : v.y;
}

/** Gini impurity of a node times its size: 2·ones·(n − ones)/n. Child sums add up to the split score. */
function weightedGini(ones: number, n: number): number {
	if (n === 0) return 0;
	return (2 * ones * (n - ones)) / n;
}

interface Split {
	feature: 0 | 1;
	threshold: number;
	score: number;
}

/** Best threshold over the given features by the sum of weighted Gini impurities of the children. */
function bestSplit(
	samples: readonly Point[],
	features: readonly (0 | 1)[],
	minLeaf: number,
): Split | null {
	const n = samples.length;
	let totalOnes = 0;
	for (const s of samples) totalOnes += s.label;
	let best: Split | null = null;
	for (const f of features) {
		const sorted = [...samples].sort((a, b) => coord(a, f) - coord(b, f));
		let leftOnes = 0;
		for (let i = 0; i < n - 1; i++) {
			const a = sorted[i];
			const b = sorted[i + 1];
			if (a === undefined || b === undefined) continue;
			leftOnes += a.label;
			const v = coord(a, f);
			const next = coord(b, f);
			if (v === next) continue;
			const nl = i + 1;
			const nr = n - nl;
			if (nl < minLeaf || nr < minLeaf) continue;
			const score = weightedGini(leftOnes, nl) + weightedGini(totalOnes - leftOnes, nr);
			if (best === null || score < best.score - 1e-12) {
				best = { feature: f, threshold: (v + next) / 2, score };
			}
		}
	}
	return best;
}

/** Grows a tree on the given samples (duplicates allowed, as in a bootstrap sample). */
export function fitTree(samples: readonly Point[], opts: TreeOptions, depth = 0): TreeNode {
	const n = samples.length;
	let ones = 0;
	for (const s of samples) ones += s.label;
	const p = n === 0 ? 0.5 : ones / n;
	if (depth >= opts.maxDepth || ones === 0 || ones === n || n < 2 * opts.minLeaf) {
		return { leaf: true, p };
	}
	const features: readonly (0 | 1)[] = opts.pickFeatures ? opts.pickFeatures() : [0, 1];
	const split = bestSplit(samples, features, opts.minLeaf);
	if (split === null) return { leaf: true, p };
	const left = samples.filter((s) => coord(s, split.feature) <= split.threshold);
	const right = samples.filter((s) => coord(s, split.feature) > split.threshold);
	return {
		leaf: false,
		feature: split.feature,
		threshold: split.threshold,
		left: fitTree(left, opts, depth + 1),
		right: fitTree(right, opts, depth + 1),
	};
}

/** Probability of class 1 in the leaf the point falls into. */
export function predictTree(node: TreeNode, v: Vec2): number {
	let cur: TreeNode = node;
	while (!cur.leaf) {
		cur = coord(v, cur.feature) <= cur.threshold ? cur.left : cur.right;
	}
	return cur.p;
}

/* ---------- Random forest (bagging + random feature per split) ---------- */

/**
 * Trees for a forest: each one on a bootstrap sample (n draws with replacement) and with one
 * random feature per split. The first k trees do not depend on maxTrees, so a prefix is a forest.
 * `inBag[t][i]` tells whether training point i is in the bootstrap sample of tree t.
 */
export function fitForestWithBags(
	train: readonly Point[],
	maxTrees: number,
	seed: number = FOREST_SEED,
): { trees: TreeNode[]; inBag: boolean[][] } {
	const rand = mulberry32(seed);
	const n = train.length;
	const trees: TreeNode[] = [];
	const inBag: boolean[][] = [];
	for (let t = 0; t < maxTrees; t++) {
		const boot: Point[] = [];
		const used: boolean[] = train.map(() => false);
		for (let i = 0; i < n; i++) {
			const j = Math.floor(rand() * n);
			const drawn = train[j];
			if (drawn !== undefined) {
				boot.push(drawn);
				used[j] = true;
			}
		}
		const pickFeatures = (): readonly (0 | 1)[] => [Math.floor(rand() * 2) as 0 | 1];
		trees.push(fitTree(boot, { maxDepth: FOREST_DEPTH, minLeaf: 1, pickFeatures }));
		inBag.push(used);
	}
	return { trees, inBag };
}

export function fitForest(
	train: readonly Point[],
	maxTrees: number,
	seed: number = FOREST_SEED,
): TreeNode[] {
	return fitForestWithBags(train, maxTrees, seed).trees;
}

export interface OobScore {
	/** Accuracy over the points that have at least one tree that did not see them. */
	accuracy: number;
	/** Number of such points. */
	covered: number;
}

/**
 * Out-of-bag accuracy of the first k trees: each training point is predicted only by the trees
 * whose bootstrap sample did not contain it. No separate validation set is needed.
 */
export function oobAccuracy(
	train: readonly Point[],
	trees: readonly TreeNode[],
	inBag: readonly (readonly boolean[])[],
	k: number,
): OobScore {
	const m = Math.min(k, trees.length, inBag.length);
	let covered = 0;
	let ok = 0;
	train.forEach((p, i) => {
		let sum = 0;
		let cnt = 0;
		for (let t = 0; t < m; t++) {
			const tree = trees[t];
			if (tree === undefined || inBag[t]?.[i] === true) continue;
			sum += predictTree(tree, p);
			cnt += 1;
		}
		if (cnt === 0) return;
		covered += 1;
		if ((sum / cnt > 0.5 ? 1 : 0) === p.label) ok += 1;
	});
	return { accuracy: covered === 0 ? 0 : ok / covered, covered };
}

/** Average probability of the first k trees. */
export function forestProba(trees: readonly TreeNode[], k: number, v: Vec2): number {
	const m = Math.min(k, trees.length);
	if (m <= 0) return 0.5;
	let sum = 0;
	for (const tree of trees.slice(0, m)) sum += predictTree(tree, v);
	return sum / m;
}

/* ---------- Gradient boosting with regression stumps ---------- */

/** A regression stump: a sample goes left when x_f <= threshold. Leaf values are residual means. */
export interface RegStump {
	feature: 0 | 1;
	threshold: number;
	left: number;
	right: number;
}

export interface GbModel {
	/** Start value: the share of class 1, F_0. */
	base: number;
	/** Shrinkage nu: every stump is multiplied by it. */
	nu: number;
	stumps: RegStump[];
}

function stumpValue(s: RegStump, v: Vec2): number {
	return coord(v, s.feature) <= s.threshold ? s.left : s.right;
}

/** Stump with the smallest squared error on the targets r (gain: sum_L²/n_L + sum_R²/n_R). */
export function fitRegStump(samples: readonly Vec2[], r: readonly number[]): RegStump {
	const n = samples.length;
	let total = 0;
	for (const t of r) total += t;
	const mean = n === 0 ? 0 : total / n;
	let best: RegStump = { feature: 0, threshold: Infinity, left: mean, right: mean };
	let bestGain = -Infinity;
	for (const f of [0, 1] as const) {
		const order = samples
			.map((_, i) => i)
			.sort((i, j) => {
				const a = samples[i];
				const b = samples[j];
				return a === undefined || b === undefined ? 0 : coord(a, f) - coord(b, f);
			});
		let sumL = 0;
		for (let k = 0; k < n - 1; k++) {
			const i = order[k];
			const j = order[k + 1];
			const a = i === undefined ? undefined : samples[i];
			const b = j === undefined ? undefined : samples[j];
			if (i === undefined || a === undefined || b === undefined) continue;
			sumL += r[i] ?? 0;
			const lo = coord(a, f);
			const hi = coord(b, f);
			if (lo === hi) continue;
			const nl = k + 1;
			const nr = n - nl;
			const sumR = total - sumL;
			const gain = (sumL * sumL) / nl + (sumR * sumR) / nr;
			if (gain > bestGain + 1e-12) {
				bestGain = gain;
				best = { feature: f, threshold: (lo + hi) / 2, left: sumL / nl, right: sumR / nr };
			}
		}
	}
	return best;
}

/**
 * Gradient boosting with squared loss on 0/1 labels. Starts from the share of class 1; each round
 * fits a stump to the residuals y − F and adds nu times it. The stumps depend on nu, so the
 * model is refit when nu changes; the first k rounds do not depend on the total number of rounds.
 */
export function fitGradientBoost(train: readonly Point[], maxRounds: number, nu: number): GbModel {
	const n = train.length;
	const base = n === 0 ? 0.5 : train.reduce((a, p) => a + p.label, 0) / n;
	const f = train.map(() => base);
	const stumps: RegStump[] = [];
	for (let m = 0; m < maxRounds && n > 0; m++) {
		const residual = train.map((p, i) => p.label - (f[i] ?? base));
		const stump = fitRegStump(train, residual);
		stumps.push(stump);
		train.forEach((p, i) => {
			f[i] = (f[i] ?? base) + nu * stumpValue(stump, p);
		});
	}
	return { base, nu, stumps };
}

/** Raw ensemble value F_k(x) after the first k rounds. */
export function gbScore(model: GbModel, k: number, v: Vec2): number {
	const m = Math.max(0, Math.min(k, model.stumps.length));
	let f = model.base;
	for (const s of model.stumps.slice(0, m)) f += model.nu * stumpValue(s, v);
	return f;
}

/** F_k clipped to [0, 1]: read as the probability of class 1. */
export function gbProba(model: GbModel, k: number, v: Vec2): number {
	return Math.min(1, Math.max(0, gbScore(model, k, v)));
}

/* ---------- Scoring and drawing ---------- */

/** Share of points whose label matches the classifier (threshold 0.5). */
export function accuracy(points: readonly Point[], proba: Classifier): number {
	if (points.length === 0) return 0;
	let ok = 0;
	for (const p of points) {
		const label = proba(p) > 0.5 ? 1 : 0;
		if (label === p.label) ok += 1;
	}
	return ok / points.length;
}

export function scoreModel(proba: Classifier, data: Dataset): Scores {
	return { train: accuracy(data.train, proba), test: accuracy(data.test, proba) };
}

/** Probabilities on a GRID_N × GRID_N grid over the unit square, row by row from the top. */
export function gridCells(proba: Classifier, n: number = GRID_N): GridCell[] {
	const cells: GridCell[] = [];
	for (let j = 0; j < n; j++) {
		for (let i = 0; i < n; i++) {
			const v = { x: (i + 0.5) / n, y: 1 - (j + 0.5) / n };
			cells.push({ x: i / n, y: j / n, p: proba(v) });
		}
	}
	return cells;
}

/* ---------- Text ---------- */

export function percent(v: number): string {
	return `${Math.round(v * 100)}%`;
}

/** One model as a sentence for the SVG description and the live region. */
export function describeModel(label: string, s: Scores): string {
	return `${label}: точность на обучении ${percent(s.train)}, на контроле ${percent(s.test)}.`;
}

export function describeEnsembles(
	state: EnsembleDemoState,
	boostApplied: number,
	scores: { tree: Scores; forest: Scores; boost: Scores },
	oob?: OobScore,
): string {
	return [
		describeModel('Одно дерево', scores.tree),
		describeModel(`Лес из ${state.trees} деревьев`, scores.forest),
		oob && oob.covered > 0
			? `Оценка out-of-bag для леса: ${percent(oob.accuracy)} на ${oob.covered} примерах.`
			: '',
		describeModel(`Бустинг из ${boostApplied} итераций со сжатием ${state.nu}`, scores.boost),
	]
		.filter((t) => t !== '')
		.join(' ');
}
