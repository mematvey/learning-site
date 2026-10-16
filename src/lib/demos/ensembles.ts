/**
 * Math of the ensembles demo: one decision tree, a random forest (bagged trees with random
 * features) and AdaBoost with decision stumps, all on the same 2D data.
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

/** Cells per side of the decision-region grid. */
export const GRID_N = 28;

export interface EnsembleDemoState {
	/** Number of trees in the forest. */
	trees: number;
	/** Number of boosting rounds (stumps). */
	rounds: number;
}

export const DEFAULT_STATE: EnsembleDemoState = {
	trees: TREES_DEFAULT,
	rounds: ROUNDS_DEFAULT,
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
 */
export function fitForest(
	train: readonly Point[],
	maxTrees: number,
	seed: number = FOREST_SEED,
): TreeNode[] {
	const rand = mulberry32(seed);
	const n = train.length;
	const trees: TreeNode[] = [];
	for (let t = 0; t < maxTrees; t++) {
		const boot: Point[] = [];
		for (let i = 0; i < n; i++) {
			const drawn = train[Math.floor(rand() * n)];
			if (drawn !== undefined) boot.push(drawn);
		}
		const pickFeatures = (): readonly (0 | 1)[] => [Math.floor(rand() * 2) as 0 | 1];
		trees.push(fitTree(boot, { maxDepth: FOREST_DEPTH, minLeaf: 1, pickFeatures }));
	}
	return trees;
}

/** Average probability of the first k trees. */
export function forestProba(trees: readonly TreeNode[], k: number, v: Vec2): number {
	const m = Math.min(k, trees.length);
	if (m <= 0) return 0.5;
	let sum = 0;
	for (const tree of trees.slice(0, m)) sum += predictTree(tree, v);
	return sum / m;
}

/* ---------- AdaBoost with decision stumps ---------- */

/** A stump: predicts polarity · (+1 if x_f > threshold, else −1). */
export interface StumpRule {
	feature: 0 | 1;
	threshold: number;
	polarity: 1 | -1;
}

export interface Stump extends StumpRule {
	alpha: number;
}

function stumpOutput(rule: StumpRule, v: Vec2): number {
	return rule.polarity * (coord(v, rule.feature) > rule.threshold ? 1 : -1);
}

interface StumpFit extends StumpRule {
	/** Weighted error of the rule (weights sum to `total`). */
	error: number;
}

function offerStump(
	best: StumpFit | null,
	feature: 0 | 1,
	threshold: number,
	errPlus: number,
	total: number,
): StumpFit {
	const errMinus = total - errPlus;
	const cand: StumpFit =
		errPlus <= errMinus
			? { feature, threshold, polarity: 1, error: errPlus }
			: { feature, threshold, polarity: -1, error: errMinus };
	return best === null || cand.error < best.error ? cand : best;
}

/** Stump with the smallest weighted error. Sweeps the sorted values of each feature once. */
export function fitStump(samples: readonly Point[], w: readonly number[]): StumpFit {
	const items = samples.map((point, i) => ({ point, w: w[i] ?? 0 }));
	let total = 0;
	for (const it of items) total += it.w;
	let best: StumpFit | null = null;
	for (const f of [0, 1] as const) {
		const sorted = [...items].sort((a, b) => coord(a.point, f) - coord(b.point, f));
		// Threshold below every value: predicts +1 everywhere, so the error is the weight of label 0.
		let errPlus = 0;
		for (const it of items) if (it.point.label === 0) errPlus += it.w;
		const first = sorted[0];
		if (first !== undefined) {
			best = offerStump(best, f, coord(first.point, f) - 1, errPlus, total);
		}
		for (let k = 0; k < sorted.length; k++) {
			const cur = sorted[k];
			if (cur === undefined) continue;
			// Moving the threshold past this point: it is now predicted −1.
			errPlus += cur.point.label === 1 ? cur.w : -cur.w;
			const v = coord(cur.point, f);
			const nxt = sorted[k + 1];
			if (nxt === undefined) {
				best = offerStump(best, f, v + 1, errPlus, total);
			} else {
				const next = coord(nxt.point, f);
				if (v !== next) best = offerStump(best, f, (v + next) / 2, errPlus, total);
			}
		}
	}
	return best ?? { feature: 0, threshold: 0, polarity: 1, error: total };
}

/**
 * Discrete AdaBoost on stumps. Each round fits the best stump to the current weights,
 * gives it weight alpha and moves weight to the points it got wrong. Stops early if no stump
 * beats chance (error ≥ 0.5).
 */
export function fitAdaBoost(train: readonly Point[], maxRounds: number): Stump[] {
	const n = train.length;
	let w = train.map(() => 1 / n);
	const stumps: Stump[] = [];
	for (let r = 0; r < maxRounds && n > 0; r++) {
		const fit = fitStump(train, w);
		const eps = Math.min(1 - 1e-10, Math.max(1e-10, fit.error));
		if (eps >= 0.5) break;
		const alpha = 0.5 * Math.log((1 - eps) / eps);
		const rule: StumpRule = {
			feature: fit.feature,
			threshold: fit.threshold,
			polarity: fit.polarity,
		};
		stumps.push({ ...rule, alpha });
		let z = 0;
		const next = train.map((p, i) => {
			const s = p.label === 1 ? 1 : -1;
			const wi = (w[i] ?? 0) * Math.exp(-alpha * s * stumpOutput(rule, p));
			z += wi;
			return wi;
		});
		w = next.map((v) => v / z);
	}
	return stumps;
}

/** Weighted vote of the first k stumps: sum of alpha · h(x). Positive means class 1. */
export function boostScore(stumps: readonly Stump[], k: number, v: Vec2): number {
	const m = Math.min(k, stumps.length);
	let f = 0;
	for (const s of stumps.slice(0, m)) f += s.alpha * stumpOutput(s, v);
	return f;
}

/** Logistic squashing of the boosting score: 2F gives a probability-like value. */
export function boostProba(stumps: readonly Stump[], k: number, v: Vec2): number {
	return 1 / (1 + Math.exp(-2 * boostScore(stumps, k, v)));
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
): string {
	return [
		describeModel('Одно дерево', scores.tree),
		describeModel(`Лес из ${state.trees} деревьев`, scores.forest),
		describeModel(`Бустинг из ${boostApplied} итераций`, scores.boost),
	].join(' ');
}
