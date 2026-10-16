import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	GRID_N,
	N_TEST,
	N_TRAIN,
	ROUNDS_MAX,
	TREES_MAX,
	TREE_DEPTH,
	accuracy,
	boostProba,
	boostScore,
	describeEnsembles,
	fitAdaBoost,
	fitForest,
	fitStump,
	fitTree,
	forestProba,
	gridCells,
	makeDataset,
	predictTree,
	regionLabel,
	scoreModel,
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

describe('fitStump and AdaBoost', () => {
	it('finds a zero-error stump with the right polarity', () => {
		const pts = [pt(0.1, 0.5, 0), pt(0.2, 0.9, 0), pt(0.6, 0.1, 1), pt(0.9, 0.4, 1)];
		const w = pts.map(() => 0.25);
		const fit = fitStump(pts, w);
		expect(fit.error).toBeCloseTo(0, 12);
		expect(fit.feature).toBe(0);
		expect(fit.polarity).toBe(1);
		expect(fit.threshold).toBeGreaterThan(0.2);
		expect(fit.threshold).toBeLessThan(0.6);
	});

	it('uses polarity -1 when the labels are reversed', () => {
		const pts = [pt(0.1, 0.5, 1), pt(0.2, 0.9, 1), pt(0.6, 0.1, 0), pt(0.9, 0.4, 0)];
		const fit = fitStump(
			pts,
			pts.map(() => 0.25),
		);
		expect(fit.error).toBeCloseTo(0, 12);
		expect(fit.polarity).toBe(-1);
	});

	it('gives positive alphas and does not get worse on the training set with more rounds', () => {
		const few = fitAdaBoost(data.train, 1);
		const many = fitAdaBoost(data.train, ROUNDS_MAX);
		expect(few).toHaveLength(1);
		expect(many.length).toBeGreaterThan(1);
		for (const s of many) expect(s.alpha).toBeGreaterThan(0);
		const fewAcc = accuracy(data.train, (v) => boostProba(few, 1, v));
		const manyAcc = accuracy(data.train, (v) => boostProba(many, many.length, v));
		expect(manyAcc).toBeGreaterThanOrEqual(fewAcc);
	});

	it('score of k rounds is the prefix sum of alpha · h(x)', () => {
		const stumps = fitAdaBoost(data.train, 5);
		const v = { x: 0.5, y: 0.5 };
		expect(boostScore(stumps, 0, v)).toBe(0);
		expect(boostScore(stumps, 1000, v)).toBeCloseTo(boostScore(stumps, stumps.length, v), 12);
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
		const text = describeEnsembles({ trees: 7, rounds: 12 }, 12, { tree: s, forest: s, boost: s });
		expect(text).toContain('Лес из 7 деревьев');
		expect(text).toContain('Бустинг из 12 итераций');
		expect(text).toContain('на контроле 80%');
	});
});
