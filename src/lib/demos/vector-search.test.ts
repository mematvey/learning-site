import { describe, expect, it } from 'vitest';
import {
	EF_VALUES,
	K,
	N_LISTS,
	N_POINTS,
	buildGraph,
	buildIvf,
	entryPoint,
	exactKnn,
	getDemoIndex,
	graphSearch,
	ivfSearch,
	makePoints,
	mulberry32,
	recallAt,
	reportQuery,
} from './vector-search';

describe('mulberry32', () => {
	it('gives the same sequence for the same seed and values in [0, 1)', () => {
		const a = mulberry32(42);
		const b = mulberry32(42);
		for (let i = 0; i < 100; i++) {
			const v = a();
			expect(v).toBe(b());
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('exactKnn', () => {
	it('returns the K nearest points in order and compares with every point', () => {
		const points = makePoints();
		const q = { x: 0.3, y: 0.7 };
		const r = exactKnn(points, q);
		expect(r.ids).toHaveLength(K);
		expect(r.cost).toBe(N_POINTS);
		const dists = r.ids.map((i) => {
			const p = points[i];
			return p ? (p.x - q.x) ** 2 + (p.y - q.y) ** 2 : NaN;
		});
		for (let t = 1; t < dists.length; t++) {
			expect(dists[t]).toBeGreaterThanOrEqual(dists[t - 1] ?? 0);
		}
	});
});

describe('graph search', () => {
	it('builds an undirected graph with no self-loops', () => {
		const points = makePoints();
		const graph = buildGraph(points);
		expect(graph).toHaveLength(N_POINTS);
		graph.forEach((nbs, i) => {
			expect(nbs).not.toContain(i);
			for (const j of nbs) expect(graph[j]).toContain(i);
		});
	});

	it('visits fewer points than brute force at the smallest ef', () => {
		const index = getDemoIndex();
		const entry = entryPoint(index.points);
		const r = graphSearch(
			index.points,
			index.graph,
			index.queries[0] ?? { x: 0, y: 0 },
			EF_VALUES[0] ?? K,
			entry,
		);
		expect(r.cost).toBeLessThan(N_POINTS);
		expect(r.ids).toHaveLength(K);
	});

	it('raises recall and cost as ef grows (benchmark curve)', () => {
		const { curveHnsw } = getDemoIndex();
		const first = curveHnsw[0];
		const last = curveHnsw[curveHnsw.length - 1];
		expect(last?.recall).toBeGreaterThan(first?.recall ?? 1);
		expect(last?.cost).toBeGreaterThan(first?.cost ?? Infinity);
		expect(last?.recall).toBeGreaterThan(0.9);
	});
});

describe('IVF search', () => {
	it('splits the points into N_LISTS cells that cover every point once', () => {
		const points = makePoints();
		const ivf = buildIvf(points);
		expect(ivf.lists).toHaveLength(N_LISTS);
		const all = ivf.lists.flat().sort((a, b) => a - b);
		expect(all).toEqual(points.map((_, i) => i));
	});

	it('scans only the probed cells: nprobe = all cells gives recall 1', () => {
		const index = getDemoIndex();
		const q = index.queries[3] ?? { x: 0.5, y: 0.5 };
		const all = ivfSearch(index.points, index.ivf, q, N_LISTS);
		expect(recallAt(all.ids, exactKnn(index.points, q).ids)).toBe(1);
		const one = ivfSearch(index.points, index.ivf, q, 1);
		expect(one.cells).toHaveLength(1);
		expect(one.visited.length).toBeLessThan(N_POINTS);
	});

	it('raises recall and cost as nprobe grows (benchmark curve)', () => {
		const { curveIvf } = getDemoIndex();
		const first = curveIvf[0];
		const last = curveIvf[curveIvf.length - 1];
		expect(last?.recall).toBe(1);
		expect(last?.cost).toBeGreaterThan(first?.cost ?? Infinity);
	});
});

describe('demo index', () => {
	it('is built once and reproduces the same numbers on every call', () => {
		const a = getDemoIndex();
		const b = getDemoIndex();
		expect(a).toBe(b);
		const r1 = reportQuery(a, 'hnsw', 24, { x: 0.42, y: 0.58 });
		const r2 = reportQuery(b, 'hnsw', 24, { x: 0.42, y: 0.58 });
		expect(r1.result.ids).toEqual(r2.result.ids);
		expect(r1.result.cost).toBe(r2.result.cost);
	});

	it('reports recall and cost of one query for both methods', () => {
		const index = getDemoIndex();
		const q = { x: 0.42, y: 0.58 };
		const g = reportQuery(index, 'hnsw', 16, q);
		const c = reportQuery(index, 'ivf', 2, q);
		for (const r of [g, c]) {
			expect(r.exact).toHaveLength(K);
			expect(r.recall).toBeGreaterThanOrEqual(0);
			expect(r.recall).toBeLessThanOrEqual(1);
		}
	});
});
