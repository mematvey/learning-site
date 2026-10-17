import { describe, expect, it } from 'vitest';
import {
	DATASET,
	TEST_DATASET,
	accuracyByDepth,
	MAX_DEPTH,
	accuracy,
	bestSplit,
	buildTree,
	countOf,
	impurity,
	impurityCurve,
	leaves,
	partition,
	predict,
	snapDepth,
	weightedImpurity,
	type Point,
} from './decision-trees';

describe('impurity', () => {
	it('is zero for a pure node under both criteria', () => {
		expect(impurity([5, 0], 'gini')).toBe(0);
		expect(impurity([0, 5], 'entropy')).toBe(0);
	});

	it('is maximal for an even split: Gini 0.5, entropy 1 bit', () => {
		expect(impurity([3, 3], 'gini')).toBeCloseTo(0.5, 12);
		expect(impurity([3, 3], 'entropy')).toBeCloseTo(1, 12);
	});

	it('matches hand-computed values for 3 to 1', () => {
		expect(impurity([3, 1], 'gini')).toBeCloseTo(0.375, 12);
		expect(impurity([3, 1], 'entropy')).toBeCloseTo(0.811278, 5);
	});

	it('gives zero for an empty node', () => {
		expect(impurity([0, 0], 'gini')).toBe(0);
	});
});

describe('bestSplit', () => {
	const separable: Point[] = [
		{ x: 0.1, y: 0.9, c: 0 },
		{ x: 0.2, y: 0.1, c: 0 },
		{ x: 0.3, y: 0.5, c: 0 },
		{ x: 0.7, y: 0.2, c: 1 },
		{ x: 0.8, y: 0.8, c: 1 },
	];

	it('finds the midpoint threshold of a separable feature', () => {
		const s = bestSplit(separable, 'gini');
		expect(s).not.toBeNull();
		expect(s?.feature).toBe(0);
		expect(s?.threshold).toBeCloseTo(0.5, 12);
	});

	it('gain equals the parent impurity when the split is perfect', () => {
		const s = bestSplit(separable, 'entropy');
		const parent = impurity(countOf(separable), 'entropy');
		expect(s?.gain).toBeCloseTo(parent, 12);
	});

	it('returns null for a pure node and for identical points', () => {
		expect(bestSplit([separable[0]!, separable[1]!], 'gini')).toBeNull();
		const same: Point[] = [
			{ x: 0.5, y: 0.5, c: 0 },
			{ x: 0.5, y: 0.5, c: 1 },
		];
		expect(bestSplit(same, 'gini')).toBeNull();
	});
});

describe('buildTree', () => {
	it('depth 0 gives one leaf that predicts the majority class', () => {
		const tree = buildTree(DATASET, 0, 'gini');
		expect(tree.split).toBeNull();
		expect(tree.n).toBe(DATASET.length);
		expect(tree.prediction).toBe(countOf(DATASET)[1] > countOf(DATASET)[0] ? 1 : 0);
	});

	it('never exceeds the depth limit', () => {
		for (let d = 0; d <= MAX_DEPTH; d++) {
			const tree = buildTree(DATASET, d, 'gini');
			const deepest = Math.max(...leaves(tree).map((l) => l.depth));
			expect(deepest).toBeLessThanOrEqual(d);
		}
	});

	it('children hold all points of the parent', () => {
		const tree = buildTree(DATASET, MAX_DEPTH, 'gini');
		const check = (node: ReturnType<typeof buildTree>): void => {
			if (!node.left || !node.right) return;
			expect(node.left.n + node.right.n).toBe(node.n);
			check(node.left);
			check(node.right);
		};
		check(tree);
	});

	it('is deterministic for the fixed dataset', () => {
		const a = JSON.stringify(buildTree(DATASET, MAX_DEPTH, 'entropy'));
		const b = JSON.stringify(buildTree(DATASET, MAX_DEPTH, 'entropy'));
		expect(a).toBe(b);
	});

	it('training accuracy does not drop when the tree grows', () => {
		let previous = -1;
		for (let d = 0; d <= 8; d++) {
			const acc = accuracy(buildTree(DATASET, d, 'gini'), DATASET);
			expect(acc).toBeGreaterThanOrEqual(previous);
			previous = acc;
		}
	});

	it('weighted impurity falls as the tree grows', () => {
		const shallow = weightedImpurity(buildTree(DATASET, 1, 'gini'));
		const deep = weightedImpurity(buildTree(DATASET, MAX_DEPTH, 'gini'));
		expect(deep).toBeLessThanOrEqual(shallow);
	});
});

describe('predict and partition', () => {
	it('predict agrees with the leaf that contains the point', () => {
		const tree = buildTree(DATASET, MAX_DEPTH, 'gini');
		const { cells } = partition(tree);
		for (const cell of cells) {
			const cx = (cell.box.x0 + cell.box.x1) / 2;
			const cy = (cell.box.y0 + cell.box.y1) / 2;
			expect(predict(tree, cx, cy)).toBe(cell.prediction);
		}
	});

	it('leaf cells tile the unit square without overlap', () => {
		const tree = buildTree(DATASET, MAX_DEPTH, 'entropy');
		const { cells } = partition(tree);
		const area = cells.reduce((s, c) => s + (c.box.x1 - c.box.x0) * (c.box.y1 - c.box.y0), 0);
		expect(area).toBeCloseTo(1, 10);
	});

	it('number of split lines equals number of internal nodes', () => {
		const tree = buildTree(DATASET, 2, 'gini');
		const { cells, lines } = partition(tree);
		expect(cells.length).toBe(lines.length + 1);
	});
});

describe('dataset and helpers', () => {
	it('has distinct coordinates, so the full tree can separate all points', () => {
		const keys = new Set(DATASET.map((p) => `${p.x},${p.y}`));
		expect(keys.size).toBe(DATASET.length);
		const tree = buildTree(DATASET, 20, 'gini');
		expect(accuracy(tree, DATASET)).toBeGreaterThan(0.9);
	});

	it('impurity curve has both ends at zero and a peak at 0.5', () => {
		const curve = impurityCurve(100);
		expect(curve[0]?.gini).toBe(0);
		expect(curve[100]?.entropy).toBe(0);
		expect(curve[50]?.gini).toBeCloseTo(0.5, 12);
		expect(curve[50]?.entropy).toBeCloseTo(1, 12);
	});

	it('snapDepth rounds, clamps and maps non-finite input to the default', () => {
		expect(snapDepth(2.4)).toBe(2);
		expect(snapDepth(-3)).toBe(0);
		expect(snapDepth(99)).toBe(MAX_DEPTH);
		expect(snapDepth(Number.NaN)).toBe(2);
	});
});

describe('held-out points', () => {
	it('are fixed and independent of the training set', () => {
		expect(TEST_DATASET.length).toBe(100);
		expect(TEST_DATASET.some((p) => p.c === 0) && TEST_DATASET.some((p) => p.c === 1)).toBe(true);
	});

	it('gini: train accuracy is 0.97 at depths 3 and 4, held-out accuracy at depth 4 is below depth 2', () => {
		const rows = accuracyByDepth('gini');
		expect(rows[3]?.train).toBeCloseTo(rows[4]?.train ?? 0, 10);
		expect(rows[4]?.train).toBeGreaterThan(0.96);
		expect(rows[4]?.test).toBeLessThan(rows[2]?.test ?? 0);
	});
});
