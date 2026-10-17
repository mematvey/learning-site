import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	GRID_N,
	N_TEST,
	N_TRAIN,
	NU_MAX,
	NU_MIN,
	ROUNDS_MAX,
	TREES_MAX,
	TREE_DEPTH,
	accuracy,
	describeEnsembles,
	fitForestWithBags,
	fitGradientBoost,
	fitRegStump,
	fitForest,
	fitTree,
	forestProba,
	gbProba,
	gbScore,
	gridCells,
	oobAccuracy,
	makeDataset,
	predictTree,
	regionLabel,
	scoreModel,
	snapNu,
	snapRounds,
	snapTrees,
	type Point,
} from './ensembles';

const data = makeDataset();

function pt(x: number, y: number, label: 0 | 1): Point {
	return { x, y, label };
}

describe('makeDataset', () => {
	it('is deterministic and has the requested sizes with both classes', () => {
		expect(makeDataset()).toEqual(data);
		expect(data.train).toHaveLength(N_TRAIN);
		expect(data.test).toHaveLength(N_TEST);
		const ones = data.train.filter((p) => p.label === 1).length;
		expect(ones).toBeGreaterThan(0);
		expect(ones).toBeLessThan(N_TRAIN);
	});

	it('keeps points in the unit square and follows the region except for the noise', () => {
		const all = [...data.train, ...data.test];
		for (const p of all) {
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.x).toBeLessThan(1);
			expect(p.y).toBeGreaterThanOrEqual(0);
			expect(p.y).toBeLessThan(1);
		}
		const agree = all.filter((p) => regionLabel(p.x, p.y) === p.label).length / all.length;
		expect(agree).toBeGreaterThan(0.7);
		expect(agree).toBeLessThan(1);
	});
});

describe('fitTree', () => {
	it('is a single leaf with the class share at depth 0', () => {
		const node = fitTree(data.train, { maxDepth: 0, minLeaf: 1 });
		const share = data.train.filter((p) => p.label === 1).length / data.train.length;
		expect(node).toEqual({ leaf: true, p: share });
	});

	it('learns the training set exactly when grown deep enough', () => {
		const node = fitTree(data.train, { maxDepth: 30, minLeaf: 1 });
		expect(accuracy(data.train, (v) => predictTree(node, v))).toBe(1);
	});

	it('makes a constant prediction when minLeaf does not allow any split', () => {
		const node = fitTree(data.train, { maxDepth: 10, minLeaf: data.train.length });
		expect(node.leaf).toBe(true);
	});

	it('finds a clean split on one feature', () => {
		const pts = [pt(0.1, 0.5, 0), pt(0.2, 0.9, 0), pt(0.6, 0.1, 1), pt(0.9, 0.4, 1)];
		const node = fitTree(pts, { maxDepth: 1, minLeaf: 1 });
		expect(node.leaf).toBe(false);
		if (node.leaf) return;
		expect(node.feature).toBe(0);
		expect(node.threshold).toBeCloseTo(0.4, 12);
		expect(accuracy(pts, (v) => predictTree(node, v))).toBe(1);
	});
});

describe('gradient boosting', () => {
	it('fits a regression stump to a step and falls back to the mean without a split', () => {
		const pts = [pt(0.1, 0.5, 0), pt(0.2, 0.9, 0), pt(0.6, 0.1, 1), pt(0.9, 0.4, 1)];
		const stump = fitRegStump(pts, [0, 0, 1, 1]);
		expect(stump.feature).toBe(0);
		expect(stump.threshold).toBeCloseTo(0.4, 12);
		expect(stump.left).toBe(0);
		expect(stump.right).toBe(1);
		const flat = fitRegStump([pt(0.5, 0.5, 0), pt(0.5, 0.5, 1)], [1, 3]);
		expect(flat.left).toBe(2);
		expect(flat.right).toBe(2);
	});

	it('starts from the share of class 1 and takes one shrunken step', () => {
		const pts = [pt(0.1, 0.5, 0), pt(0.2, 0.9, 0), pt(0.6, 0.1, 1), pt(0.9, 0.4, 1)];
		const full = fitGradientBoost(pts, 1, 1);
		expect(full.base).toBe(0.5);
		expect(gbScore(full, 1, pts[0] as Point)).toBeCloseTo(0, 12);
		expect(gbScore(full, 1, pts[3] as Point)).toBeCloseTo(1, 12);
		const slow = fitGradientBoost(pts, 1, 0.1);
		expect(gbScore(slow, 1, pts[0] as Point)).toBeCloseTo(0.45, 12);
		expect(gbScore(slow, 1, pts[3] as Point)).toBeCloseTo(0.55, 12);
	});

	it('the squared training error does not grow with more rounds', () => {
		const model = fitGradientBoost(data.train, ROUNDS_MAX, 0.3);
		expect(model.stumps).toHaveLength(ROUNDS_MAX);
		let prev = Infinity;
		for (const k of [0, 1, 5, 20, ROUNDS_MAX]) {
			const mse =
				data.train.reduce((a, p) => a + (p.label - gbScore(model, k, p)) ** 2, 0) /
				data.train.length;
			expect(mse).toBeLessThanOrEqual(prev + 1e-12);
			prev = mse;
		}
	});

	it('a prefix does not depend on the total, probabilities are clipped, k beyond the end is safe', () => {
		const small = fitGradientBoost(data.train, 5, 0.3);
		const big = fitGradientBoost(data.train, 20, 0.3);
		expect(big.stumps.slice(0, 5)).toEqual(small.stumps);
		const v = { x: 0.5, y: 0.5 };
		expect(gbScore(big, 0, v)).toBe(big.base);
		expect(gbScore(big, 1000, v)).toBe(gbScore(big, big.stumps.length, v));
		const huge = fitGradientBoost(data.train, 50, NU_MAX);
		for (const c of gridCells((q) => gbProba(huge, 50, q))) {
			expect(c.p).toBeGreaterThanOrEqual(0);
			expect(c.p).toBeLessThanOrEqual(1);
		}
	});

	it('snaps the shrinkage to the slider grid', () => {
		expect(snapNu(0)).toBe(NU_MIN);
		expect(snapNu(5)).toBe(NU_MAX);
		expect(snapNu(0.31)).toBe(0.3);
		expect(snapNu('x')).toBe(DEFAULT_STATE.nu);
	});
});

describe('forest', () => {
	it('is deterministic and its first k trees do not depend on the total number', () => {
		const small = fitForest(data.train, 5);
		const big = fitForest(data.train, TREES_MAX);
		expect(big.slice(0, 5)).toEqual(small);
		expect(fitForest(data.train, 5)).toEqual(small);
	});

	it('averages the trees: one tree is its own leaf value, probabilities stay in [0, 1]', () => {
		const trees = fitForest(data.train, 10);
		const v = { x: 0.3, y: 0.7 };
		const [first] = trees;
		if (first === undefined) throw new Error('no trees');
		expect(forestProba(trees, 1, v)).toBe(predictTree(first, v));
		for (const p of gridCells((q) => forestProba(trees, 10, q))) {
			expect(p.p).toBeGreaterThanOrEqual(0);
			expect(p.p).toBeLessThanOrEqual(1);
		}
		expect(forestProba(trees, 1000, v)).toBe(forestProba(trees, trees.length, v));
	});
});

describe('out-of-bag', () => {
	const { trees, inBag } = fitForestWithBags(data.train, TREES_MAX);

	it('draws the same trees as fitForest and marks about 63% of points as in bag', () => {
		expect(trees).toEqual(fitForest(data.train, TREES_MAX));
		const share =
			inBag.reduce((a, row) => a + row.filter(Boolean).length, 0) / (TREES_MAX * data.train.length);
		expect(share).toBeGreaterThan(0.58);
		expect(share).toBeLessThan(0.68);
	});

	it('covers no points without trees and almost all points with many trees', () => {
		expect(oobAccuracy(data.train, trees, inBag, 0)).toEqual({ accuracy: 0, covered: 0 });
		const full = oobAccuracy(data.train, trees, inBag, TREES_MAX);
		expect(full.covered).toBeGreaterThan(0.95 * N_TRAIN);
		expect(full.accuracy).toBeGreaterThan(0.6);
	});

	it('uses only trees that did not see the point', () => {
		const one = oobAccuracy(data.train, trees, inBag, 1);
		const expected = data.train.filter((_, i) => inBag[0]?.[i] !== true).length;
		expect(one.covered).toBe(expected);
	});
});

describe('scoring and text', () => {
	it('accuracy of an empty set is 0 and uses the 0.5 threshold', () => {
		expect(accuracy([], () => 1)).toBe(0);
		expect(accuracy([pt(0, 0, 1)], () => 0.5)).toBe(0);
		expect(accuracy([pt(0, 0, 1)], () => 0.51)).toBe(1);
	});

	it('scores the single tree on the training set at least as well as on the test set', () => {
		const tree = fitTree(data.train, { maxDepth: TREE_DEPTH, minLeaf: 1 });
		const s = scoreModel((v) => predictTree(tree, v), data);
		expect(s.train).toBeGreaterThanOrEqual(s.test);
	});

	it('builds GRID_N² cells in the unit square', () => {
		const cells = gridCells(() => 0.5);
		expect(cells).toHaveLength(GRID_N * GRID_N);
		for (const c of cells) {
			expect(c.x).toBeGreaterThanOrEqual(0);
			expect(c.x).toBeLessThan(1);
			expect(c.y).toBeGreaterThanOrEqual(0);
			expect(c.y).toBeLessThan(1);
		}
	});

	it('clamps the sliders and falls back to defaults for bad input', () => {
		expect(snapTrees(0)).toBe(1);
		expect(snapTrees(999)).toBe(TREES_MAX);
		expect(snapTrees(Number.NaN)).toBe(DEFAULT_STATE.trees);
		expect(snapRounds(2.6)).toBe(3);
		expect(snapRounds('x')).toBe(DEFAULT_STATE.rounds);
	});

	it('describes all three models with percentages', () => {
		const s = { train: 0.9, test: 0.8 };
		const text = describeEnsembles(
			{ trees: 7, rounds: 12, nu: 0.3 },
			12,
			{ tree: s, forest: s, boost: s },
			{ accuracy: 0.75, covered: 100 },
		);
		expect(text).toContain('Лес из 7 деревьев');
		expect(text).toContain('Бустинг из 12 итераций');
		expect(text).toContain('на контроле 80%');
		expect(text).toContain('out-of-bag для леса: 75% на 100');
	});
});
