import { describe, expect, it } from 'vitest';
import {
	DOMAIN,
	C_VALUES,
	applyPatch,
	buildClassifier,
	classifyGrid,
	fitSvm,
	knnPredict,
	makeDataset,
	regionPath,
	snapC,
	snapGamma,
	snapK,
	svmDecision,
	type KnnSvmDemoState,
	type Point,
} from './knn-svm';

const STATE: KnnSvmDemoState = { model: 'knn', k: 5, C: 1, kernel: 'rbf', gamma: 2 };

describe('makeDataset', () => {
	it('is deterministic for a fixed seed and has both classes inside the plane', () => {
		const a = makeDataset();
		const b = makeDataset();
		expect(a).toEqual(b);
		expect(a.some((p) => p.label === 0)).toBe(true);
		expect(a.some((p) => p.label === 1)).toBe(true);
		for (const p of a) {
			expect(Math.abs(p.x)).toBeLessThanOrEqual(DOMAIN);
			expect(Math.abs(p.y)).toBeLessThanOrEqual(DOMAIN);
		}
	});
});

describe('knnPredict', () => {
	const pts: Point[] = [
		{ x: 0, y: 0, label: 0 },
		{ x: 1, y: 0, label: 1 },
		{ x: 0.1, y: 0.1, label: 0 },
		{ x: 2, y: 2, label: 1 },
	];

	it('with k = 1 returns the label of the nearest point', () => {
		expect(knnPredict(pts, 0.05, 0.05, 1)).toBe(0);
		expect(knnPredict(pts, 1.1, 0, 1)).toBe(1);
	});

	it('with k = 1 reproduces every training label when the points are distinct', () => {
		for (const p of pts) expect(knnPredict(pts, p.x, p.y, 1)).toBe(p.label);
	});

	it('takes the majority of the k nearest points', () => {
		// Three nearest to (0.5, 0): two of class 0 and one of class 1
		expect(knnPredict(pts, 0.5, 0, 3)).toBe(0);
	});

	it('breaks a tie of votes by the nearest point', () => {
		// k = 2 at (0.9, 0): nearest is class 1 (distance 0.1), second is class 0
		expect(knnPredict(pts, 0.9, 0, 2)).toBe(1);
	});

	it('clamps k to the number of points', () => {
		expect(knnPredict(pts, 0, 0, 100)).toBe(knnPredict(pts, 0, 0, 4));
	});
});

describe('fitSvm', () => {
	const separable: Point[] = [
		{ x: -1, y: -1, label: 0 },
		{ x: -1.2, y: -0.5, label: 0 },
		{ x: -0.8, y: -1.4, label: 0 },
		{ x: 1, y: 1, label: 1 },
		{ x: 1.2, y: 0.4, label: 1 },
		{ x: 0.8, y: 1.3, label: 1 },
	];

	it('keeps every alpha inside [0, C] and the sum of alpha·y at zero', () => {
		const C = 2;
		const m = fitSvm(makeDataset(), C, 'rbf', 2);
		let sum = 0;
		m.alpha.forEach((a, i) => {
			expect(a).toBeGreaterThanOrEqual(-1e-9);
			expect(a).toBeLessThanOrEqual(C + 1e-9);
			sum += a * (m.y[i] ?? 0);
		});
		expect(Math.abs(sum)).toBeLessThan(1e-6);
	});

	it('separates linearly separable points with a large C', () => {
		const m = fitSvm(separable, 10, 'linear', 0);
		for (const p of separable) {
			const f = svmDecision(m, p.x, p.y);
			expect(f >= 0 ? 1 : 0).toBe(p.label);
		}
		expect(m.support.length).toBeGreaterThan(0);
	});

	it('gives the same model when trained twice (deterministic)', () => {
		const data = makeDataset();
		const a = fitSvm(data, 1, 'rbf', 2);
		const b = fitSvm(data, 1, 'rbf', 2);
		expect(a.alpha).toEqual(b.alpha);
		expect(a.b).toBe(b.b);
	});

	it('RBF kernel fits the curved island of the demo dataset better than a linear kernel', () => {
		const data = makeDataset();
		const svm = { ...STATE, model: 'svm' as const, C: 10 };
		const linear = buildClassifier({ ...svm, kernel: 'linear' }, data);
		const rbf = buildClassifier({ ...svm, kernel: 'rbf', gamma: 2 }, data);
		expect(rbf.trainErrors).toBeLessThan(linear.trainErrors);
		expect(rbf.support.length).toBeGreaterThan(0);
	});
});

describe('buildClassifier', () => {
	it('kNN has no support vectors', () => {
		const clf = buildClassifier(STATE, makeDataset());
		expect(clf.support).toEqual([]);
	});

	it('kNN with k = 1 makes no training errors on the demo dataset', () => {
		const clf = buildClassifier({ ...STATE, k: 1 }, makeDataset());
		expect(clf.trainErrors).toBe(0);
	});
});

describe('classifyGrid and regionPath', () => {
	it('returns n×n cells, all in {0, 1}', () => {
		const cells = classifyGrid(() => 1, 8);
		expect(cells.length).toBe(64);
		expect(cells.every((c) => c === 1)).toBe(true);
	});

	it('draws nothing for a class that is absent and a full square for a class that fills the plane', () => {
		const n = 4;
		const all1 = classifyGrid(() => 1, n);
		expect(regionPath(all1, n, 0, 100)).toBe('');
		expect(regionPath(all1, n, 1, 100)).toBe(
			'M0.0 0.0h100.0v25.0h-100.0Z' +
				'M0.0 25.0h100.0v25.0h-100.0Z' +
				'M0.0 50.0h100.0v25.0h-100.0Z' +
				'M0.0 75.0h100.0v25.0h-100.0Z',
		);
	});
});

describe('snapping and patches', () => {
	it('snapK rounds and clamps to 1..15', () => {
		expect(snapK(0)).toBe(1);
		expect(snapK(99)).toBe(15);
		expect(snapK(4.6)).toBe(5);
		expect(snapK(Number.NaN)).toBe(5);
	});

	it('snapC picks the nearest allowed value', () => {
		expect(C_VALUES).toContain(snapC(1.1));
		expect(snapC(1.1)).toBe(1);
		expect(snapC(1000)).toBe(50);
		expect(snapC(Number.NaN)).toBe(1);
	});

	it('snapGamma rounds to the step and clamps', () => {
		expect(snapGamma(2.3)).toBe(2.5);
		expect(snapGamma(100)).toBe(8);
		expect(snapGamma(0)).toBe(0.5);
	});

	it('applyPatch ignores unknown values and keeps the rest', () => {
		const next = applyPatch(STATE, { model: 'svm', kernel: 'nope' as 'rbf', k: 7 });
		expect(next.model).toBe('svm');
		expect(next.kernel).toBe('rbf');
		expect(next.k).toBe(7);
		expect(next.gamma).toBe(STATE.gamma);
	});
});
