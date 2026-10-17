import { describe, expect, it } from 'vitest';
import {
	assign,
	centroids,
	inertia,
	initPlusPlus,
	initState,
	kmeansStep,
	makeCloud,
	nearest,
	pca2,
	reconstructionError,
	reconstruct,
	runKmeans,
	snapComponents,
	snapK,
	type Point,
} from './clustering-pca';

const cloud = makeCloud();

describe('snapK and snapComponents', () => {
	it('clamp to the slider range and round', () => {
		expect(snapK(1)).toBe(2);
		expect(snapK(9)).toBe(5);
		expect(snapK(3.4)).toBe(3);
		expect(snapK(Number.NaN)).toBe(3);
		expect(snapComponents(0)).toBe(1);
		expect(snapComponents(5)).toBe(2);
	});
});

describe('makeCloud', () => {
	it('is deterministic for a fixed seed and has 3 clusters of the given size', () => {
		expect(makeCloud()).toEqual(cloud);
		expect(cloud).toHaveLength(90);
	});
});

describe('nearest and assign', () => {
	it('picks the closest centre and breaks ties towards the lowest index', () => {
		const centers: Point[] = [
			[0, 0],
			[2, 0],
		];
		expect(nearest([0.9, 0], centers)).toBe(0);
		expect(nearest([1.1, 0], centers)).toBe(1);
		expect(nearest([1, 0], centers)).toBe(0);
		expect(
			assign(
				[
					[0, 1],
					[2, 1],
				],
				centers,
			),
		).toEqual([0, 1]);
	});
});

describe('centroids', () => {
	it('gives the mean of each cluster and keeps the centre of an empty cluster', () => {
		const pts: Point[] = [
			[0, 0],
			[2, 0],
			[10, 10],
		];
		const prev: Point[] = [
			[1, 1],
			[5, 5],
			[7, 7],
		];
		const c = centroids(pts, [0, 0, 1], prev);
		expect(c[0]).toEqual([1, 0]);
		expect(c[1]).toEqual([10, 10]);
		expect(c[2]).toEqual([7, 7]);
	});
});

describe('k-means', () => {
	it('the objective J does not grow from step to step', () => {
		let s = initState(cloud, 3, 7);
		let prevJ = Infinity;
		for (let i = 0; i < 20 && !s.converged; i++) {
			s = kmeansStep(cloud, s);
			const labels = s.labels ?? [];
			const j = inertia(cloud, s.centers, labels);
			expect(j).toBeLessThanOrEqual(prevJ + 1e-9);
			prevJ = j;
		}
	});

	it('converges in a few steps on the fixed cloud and then stays put', () => {
		const done = runKmeans(cloud, initState(cloud, 3, 7));
		expect(done.converged).toBe(true);
		expect(done.iter).toBeLessThan(30);
		const again = kmeansStep(cloud, done);
		expect(again).toBe(done);
	});

	it('with k equal to the number of points every point is its own centre (J = 0)', () => {
		const few: Point[] = [
			[0, 0],
			[1, 3],
			[4, 1],
		];
		const done = runKmeans(few, initState(few, 2, 1));
		expect(done.centers.length).toBe(2);
		const withThree = runKmeans(few, initState(few, 3, 1));
		expect(inertia(few, withThree.centers, withThree.labels ?? [])).toBeCloseTo(0, 10);
	});

	it('the start is deterministic for a seed and returns k distinct points of the cloud', () => {
		const a = initPlusPlus(cloud, 4, 11);
		const b = initPlusPlus(cloud, 4, 11);
		expect(a).toEqual(b);
		expect(a).toHaveLength(4);
		for (const c of a) expect(cloud).toContainEqual(c);
	});
});

describe('pca2', () => {
	it('the first axis is unit length, orthogonal to the second, and the ratios sum to 1', () => {
		const p = pca2(cloud);
		const [v1, v2] = p.axes;
		expect(Math.hypot(v1[0], v1[1])).toBeCloseTo(1, 10);
		expect(v1[0] * v2[0] + v1[1] * v2[1]).toBeCloseTo(0, 10);
		expect(p.ratio[0] + p.ratio[1]).toBeCloseTo(1, 10);
		expect(p.variances[0]).toBeGreaterThanOrEqual(p.variances[1]);
	});

	it('finds the direction of a stretched line exactly', () => {
		const line: Point[] = [];
		for (let t = -3; t <= 3; t++) line.push([t, t]);
		const p = pca2(line);
		expect(Math.abs(p.axes[0][0])).toBeCloseTo(Math.SQRT1_2, 10);
		expect(Math.abs(p.axes[0][1])).toBeCloseTo(Math.SQRT1_2, 10);
		expect(p.ratio[0]).toBeCloseTo(1, 10);
	});

	it('keeping one component loses exactly the second eigenvalue in mean squared error', () => {
		const p = pca2(cloud);
		expect(reconstructionError(cloud, p, 1)).toBeCloseTo(p.variances[1], 8);
		expect(reconstructionError(cloud, p, 2)).toBeCloseTo(0, 10);
	});

	it('reconstruction from both components gives back the points', () => {
		const p = pca2(cloud);
		const rec = reconstruct(cloud, p, 2);
		cloud.forEach((pt, i) => {
			expect(rec[i]?.[0]).toBeCloseTo(pt[0], 10);
			expect(rec[i]?.[1]).toBeCloseTo(pt[1], 10);
		});
	});

	it('a constant cloud gives a finite result with the whole variance on the first axis', () => {
		const same: Point[] = [
			[1, 1],
			[1, 1],
		];
		const p = pca2(same);
		expect(p.ratio).toEqual([1, 0]);
		expect(p.axes[0].every(Number.isFinite)).toBe(true);
	});
});

describe('elbow curve', () => {
	it('has one point per k and falls as k grows', async () => {
		const { elbowCurve, makeCloud, K_MIN, K_MAX } = await import('./clustering-pca');
		const e = elbowCurve(makeCloud());
		expect(e).toHaveLength(K_MAX - K_MIN + 1);
		for (let i = 1; i < e.length; i++) expect(e[i]!.j).toBeLessThan(e[i - 1]!.j);
		// The cloud has three groups: the drop up to k = 3 is much larger than after it.
		expect(e[0]!.j - e[1]!.j).toBeGreaterThan(3 * (e[1]!.j - e[2]!.j));
	});
});
