/**
 * Math of the decision-tree demo: a fixed two-class dataset in the unit square, a greedy
 * CART-style tree grown level by level, and the impurity measures (Gini, entropy) behind each split.
 * The dataset is fixed, so every page load shows the same tree. Pure functions only: no DOM, no Svelte.
 */

export const MAX_DEPTH = 4;
export const DEPTH_MIN = 0;
export const DEPTH_MAX = MAX_DEPTH;

export const CRITERIA = ['gini', 'entropy'] as const;
export type Criterion = (typeof CRITERIA)[number];

/** Class labels: 0 is drawn in the first category colour, 1 in the second. */
export type ClassLabel = 0 | 1;
/** Feature index: 0 is x₁ (horizontal axis), 1 is x₂ (vertical axis). */
export type Feature = 0 | 1;
export const FEATURE_NAMES = ['x₁', 'x₂'] as const;

export interface Point {
	x: number;
	y: number;
	c: ClassLabel;
}

export interface DecisionTreeDemoState {
	/** Number of levels grown (each slider step adds one level). */
	depth: number;
	/** Impurity used to choose splits. */
	criterion: Criterion;
}

export const DEFAULT_STATE: DecisionTreeDemoState = { depth: 2, criterion: 'gini' };

/** Gains below this value count as no gain: the node stays a leaf. */
const GAIN_EPS = 1e-12;

/**
 * 32 points in [0, 1]². Class 1 forms a rough band in the upper-left and upper-right parts,
 * with a few noisy points on both sides, so the first splits are clear and the deeper ones look
 * like memorisation.
 */
export const DATASET: readonly Point[] = [
	{ x: 0.08, y: 0.15, c: 0 },
	{ x: 0.14, y: 0.32, c: 0 },
	{ x: 0.22, y: 0.08, c: 0 },
	{ x: 0.27, y: 0.41, c: 0 },
	{ x: 0.31, y: 0.22, c: 0 },
	{ x: 0.36, y: 0.57, c: 1 },
	{ x: 0.41, y: 0.12, c: 0 },
	{ x: 0.44, y: 0.78, c: 1 },
	{ x: 0.07, y: 0.66, c: 1 },
	{ x: 0.12, y: 0.89, c: 1 },
	{ x: 0.19, y: 0.72, c: 1 },
	{ x: 0.25, y: 0.55, c: 1 },
	{ x: 0.33, y: 0.93, c: 1 },
	{ x: 0.38, y: 0.38, c: 0 },
	{ x: 0.46, y: 0.46, c: 0 },
	{ x: 0.52, y: 0.18, c: 0 },
	{ x: 0.57, y: 0.07, c: 0 },
	{ x: 0.61, y: 0.29, c: 1 },
	{ x: 0.66, y: 0.83, c: 1 },
	{ x: 0.71, y: 0.14, c: 0 },
	{ x: 0.76, y: 0.38, c: 1 },
	{ x: 0.82, y: 0.61, c: 1 },
	{ x: 0.88, y: 0.24, c: 0 },
	{ x: 0.93, y: 0.47, c: 1 },
	{ x: 0.97, y: 0.09, c: 0 },
	{ x: 0.58, y: 0.52, c: 0 },
	{ x: 0.64, y: 0.66, c: 1 },
	{ x: 0.79, y: 0.87, c: 1 },
	{ x: 0.9, y: 0.76, c: 0 },
	{ x: 0.49, y: 0.61, c: 1 },
	{ x: 0.03, y: 0.41, c: 0 },
	{ x: 0.55, y: 0.91, c: 0 },
];

export function isCriterion(v: unknown): v is Criterion {
	return v === 'gini' || v === 'entropy';
}

/** Rounds and clamps the depth to the slider range. Non-finite input gives the default depth. */
export function snapDepth(d: number): number {
	if (!Number.isFinite(d)) return DEFAULT_STATE.depth;
	return Math.min(DEPTH_MAX, Math.max(DEPTH_MIN, Math.round(d)));
}

export function coord(p: Point, feature: Feature): number {
	return feature === 0 ? p.x : p.y;
}

/** Number of points of each class: [count of class 0, count of class 1]. */
export function countOf(points: readonly Point[]): [number, number] {
	let c0 = 0;
	let c1 = 0;
	for (const p of points) {
		if (p.c === 1) c1 += 1;
		else c0 += 1;
	}
	return [c0, c1];
}

/** Impurity of a node from class counts. Gini: 1 − Σp². Entropy: −Σp·log₂p, in bits. */
export function impurity(counts: readonly number[], criterion: Criterion): number {
	const n = counts.reduce((s, v) => s + v, 0);
	if (n === 0) return 0;
	let sum = 0;
	for (const c of counts) {
		if (c === 0) continue;
		const p = c / n;
		sum += criterion === 'gini' ? p * p : -p * Math.log2(p);
	}
	return criterion === 'gini' ? 1 - sum : sum;
}

/** Majority class; a tie goes to class 0. */
export function majority(counts: readonly number[]): ClassLabel {
	return (counts[1] ?? 0) > (counts[0] ?? 0) ? 1 : 0;
}

export interface Split {
	feature: Feature;
	/** Points with value ≤ threshold go left. */
	threshold: number;
	/** Decrease of the weighted impurity. */
	gain: number;
}

/**
 * Best binary split of the points over both features. Thresholds are midpoints between
 * neighbouring distinct values. Ties keep the first candidate (x₁ before x₂, lower threshold).
 * Returns null for a pure node, a node with fewer than two points, or no positive gain.
 */
export function bestSplit(points: readonly Point[], criterion: Criterion): Split | null {
	const n = points.length;
	if (n < 2) return null;
	const parent = impurity(countOf(points), criterion);
	if (parent === 0) return null;

	let best: Split | null = null;
	for (const feature of [0, 1] as const) {
		const sorted = [...points].sort((a, b) => coord(a, feature) - coord(b, feature));
		const total = countOf(sorted);
		const left: [number, number] = [0, 0];
		for (let i = 0; i < n - 1; i++) {
			const p = sorted[i];
			const q = sorted[i + 1];
			if (!p || !q) continue;
			left[p.c] += 1;
			const vp = coord(p, feature);
			const vq = coord(q, feature);
			if (vp === vq) continue;
			const nLeft = i + 1;
			const right: [number, number] = [total[0] - left[0], total[1] - left[1]];
			const weighted =
				(nLeft * impurity(left, criterion) + (n - nLeft) * impurity(right, criterion)) / n;
			const gain = parent - weighted;
			if (gain > GAIN_EPS && (best === null || gain > best.gain + GAIN_EPS)) {
				best = { feature, threshold: (vp + vq) / 2, gain };
			}
		}
	}
	return best;
}

export interface TreeNode {
	depth: number;
	/** Number of points in the node. */
	n: number;
	counts: [number, number];
	impurity: number;
	prediction: ClassLabel;
	split: Split | null;
	left: TreeNode | null;
	right: TreeNode | null;
}

/**
 * Greedy tree of at most `maxDepth` levels. A node at `maxDepth` stays a leaf, so the tree
 * with depth d is the top d levels of the tree with depth d + 1 (the splits do not depend on the limit).
 */
export function buildTree(
	points: readonly Point[],
	maxDepth: number,
	criterion: Criterion,
	depth = 0,
): TreeNode {
	const counts = countOf(points);
	const node: TreeNode = {
		depth,
		n: points.length,
		counts,
		impurity: impurity(counts, criterion),
		prediction: majority(counts),
		split: null,
		left: null,
		right: null,
	};
	if (depth >= maxDepth) return node;
	const split = bestSplit(points, criterion);
	if (!split) return node;
	const leftPoints = points.filter((p) => coord(p, split.feature) <= split.threshold);
	const rightPoints = points.filter((p) => coord(p, split.feature) > split.threshold);
	node.split = split;
	node.left = buildTree(leftPoints, maxDepth, criterion, depth + 1);
	node.right = buildTree(rightPoints, maxDepth, criterion, depth + 1);
	return node;
}

/** Class predicted for the point (x, y): walks the tree until a leaf. */
export function predict(tree: TreeNode, x: number, y: number): ClassLabel {
	let node = tree;
	while (node.split && node.left && node.right) {
		const v = node.split.feature === 0 ? x : y;
		node = v <= node.split.threshold ? node.left : node.right;
	}
	return node.prediction;
}

/** Leaves of the tree in left-to-right order. */
export function leaves(tree: TreeNode): TreeNode[] {
	if (!tree.split || !tree.left || !tree.right) return [tree];
	return [...leaves(tree.left), ...leaves(tree.right)];
}

/** Sum over leaves of (leaf size / total) × leaf impurity. Falls as the tree grows. */
export function weightedImpurity(tree: TreeNode): number {
	if (tree.n === 0) return 0;
	return leaves(tree).reduce((s, l) => s + (l.n / tree.n) * l.impurity, 0);
}

/** Share of points whose class is predicted correctly by the tree. */
export function accuracy(tree: TreeNode, points: readonly Point[]): number {
	if (points.length === 0) return 0;
	const correct = points.filter((p) => predict(tree, p.x, p.y) === p.c).length;
	return correct / points.length;
}

export interface Box {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
}

export const UNIT_BOX: Box = { x0: 0, x1: 1, y0: 0, y1: 1 };

export interface Cell {
	box: Box;
	prediction: ClassLabel;
	depth: number;
}

export interface SplitLine {
	feature: Feature;
	threshold: number;
	/** Region of the node that is split; the line spans this box. */
	box: Box;
	depth: number;
}

/**
 * Regions of the plane for the tree: one cell per leaf (coloured by its prediction) and one
 * line per split. Cells of the leaves tile the unit square.
 */
export function partition(
	tree: TreeNode,
	box: Box = UNIT_BOX,
): { cells: Cell[]; lines: SplitLine[] } {
	const cells: Cell[] = [];
	const lines: SplitLine[] = [];
	const walk = (node: TreeNode, b: Box): void => {
		if (!node.split || !node.left || !node.right) {
			cells.push({ box: b, prediction: node.prediction, depth: node.depth });
			return;
		}
		const { feature, threshold } = node.split;
		lines.push({ feature, threshold, box: b, depth: node.depth });
		if (feature === 0) {
			walk(node.left, { ...b, x1: threshold });
			walk(node.right, { ...b, x0: threshold });
		} else {
			walk(node.left, { ...b, y1: threshold });
			walk(node.right, { ...b, y0: threshold });
		}
	};
	walk(tree, box);
	return { cells, lines };
}

export interface CurvePoint {
	/** Share of class 1 in a node. */
	p: number;
	gini: number;
	entropy: number;
}

/** Gini and entropy of a two-class node as a function of the share p of class 1. */
export function impurityCurve(steps = 100): CurvePoint[] {
	const out: CurvePoint[] = [];
	for (let i = 0; i <= steps; i++) {
		const p = i / steps;
		out.push({
			p,
			gini: impurity([1 - p, p], 'gini'),
			entropy: impurity([1 - p, p], 'entropy'),
		});
	}
	return out;
}

/** Text under the plane: numbers are computed from the tree, not typed. */
export function describeTree(
	tree: TreeNode,
	points: readonly Point[],
	criterion: Criterion,
): string {
	const name = criterion === 'gini' ? 'Джини' : 'энтропия';
	const leafCount = leaves(tree).length;
	const pct = Math.round(accuracy(tree, points) * 100);
	const root = tree.impurity.toFixed(2);
	const weighted = weightedImpurity(tree).toFixed(2);
	return (
		`Листьев: ${leafCount}. Точность на обучении: ${pct}%. ` +
		`Корень: ${name} = ${root}; взвешенная ${name} по листьям = ${weighted}.`
	);
}

/** Label of a node for the tree list: the test for a split, or the predicted class for a leaf. */
export function nodeText(node: TreeNode): string {
	if (node.split) {
		return `${FEATURE_NAMES[node.split.feature]} ≤ ${node.split.threshold.toFixed(2)}?`;
	}
	return `класс ${node.prediction}`;
}
