/**
 * Math of the approximate nearest neighbour demo: a 2D point cloud, a greedy graph search
 * (HNSW-like, one layer, no upper levels) and an IVF index (k-means cells with nprobe).
 * Cost is counted as the number of distance computations, not seconds, so the numbers do not
 * depend on the machine. Everything is seeded: each page load gives the same points, graph and benchmark.
 * Pure functions only: no DOM, no Svelte.
 */

export const DEMO_SEED = 7;
export const N_POINTS = 800;
export const K = 10;
export const N_QUERIES = 30;
export const N_LISTS = 32;
/** Links per vertex from the nearest neighbours (before symmetrisation). */
export const GRAPH_DEGREE = 3;
/** Random long links per vertex: they let the greedy walk jump between clusters. */
export const LONG_LINKS = 0;
/** Search widths ef for the graph. Each is at least K, otherwise recall@K cannot reach 1. */
export const EF_VALUES: readonly number[] = [10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128];
export const NPROBE_MIN = 1;
export const NPROBE_MAX = N_LISTS;

export type Point = { x: number; y: number };
export type Method = 'hnsw' | 'ivf';

export interface SearchResult {
	/** Ids of the returned neighbours, nearest first. */
	ids: number[];
	/** Ids whose distance was computed (graph: visited vertices; IVF: points in probed cells). */
	visited: number[];
	/** IVF cells that were scanned (empty for the graph). */
	cells: number[];
	/** Number of distance computations, including centroid comparisons for IVF. */
	cost: number;
}

export interface CurvePoint {
	/** Setting: ef for the graph, nprobe for IVF. */
	setting: number;
	/** Mean recall@K over the benchmark queries. */
	recall: number;
	/** Mean cost (distance computations) over the benchmark queries. */
	cost: number;
}

export interface DemoIndex {
	points: Point[];
	graph: number[][];
	ivf: IvfIndex;
	queries: Point[];
	truths: number[][];
	curveHnsw: CurvePoint[];
	curveIvf: CurvePoint[];
}

export interface IvfIndex {
	centroids: Point[];
	lists: number[][];
}

/** Deterministic PRNG (mulberry32): same seed, same sequence in [0, 1). */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function clamp01(v: number): number {
	return Math.min(1, Math.max(0, v));
}

/** Squared Euclidean distance. The square keeps the order of neighbours and avoids sqrt. */
export function sqDist(p: Point, q: Point): number {
	const dx = p.x - q.x;
	const dy = p.y - q.y;
	return dx * dx + dy * dy;
}

/** Clamps a point to the unit square. */
export function clampPoint(p: Point): Point {
	return { x: clamp01(p.x), y: clamp01(p.y) };
}

/** Compares {i, d} pairs by distance, then by id, so ties are resolved the same way everywhere. */
function byDist(a: { i: number; d: number }, b: { i: number; d: number }): number {
	return a.d - b.d || a.i - b.i;
}

/** Six Gaussian clusters in the unit square, with equal numbers of points each. */
export function makePoints(n: number = N_POINTS, seed: number = DEMO_SEED): Point[] {
	const rnd = mulberry32(seed);
	const centers: Point[] = [];
	for (let c = 0; c < 6; c++) {
		centers.push({ x: 0.15 + 0.7 * rnd(), y: 0.15 + 0.7 * rnd() });
	}
	const points: Point[] = [];
	for (let i = 0; i < n; i++) {
		const c = centers[i % centers.length] ?? { x: 0.5, y: 0.5 };
		// Box-Muller: radius from a normal distribution, angle uniform.
		const u1 = Math.max(rnd(), 1e-9);
		const u2 = rnd();
		const r = Math.sqrt(-2 * Math.log(u1)) * 0.11;
		const angle = 2 * Math.PI * u2;
		points.push({
			x: clamp01(c.x + r * Math.cos(angle)),
			y: clamp01(c.y + r * Math.sin(angle)),
		});
	}
	return points;
}

/** Uniform queries in the unit square. Queries between clusters are the hard cases for IVF. */
export function makeQueries(n: number = N_QUERIES, seed: number = DEMO_SEED + 1): Point[] {
	const rnd = mulberry32(seed);
	const out: Point[] = [];
	for (let i = 0; i < n; i++) out.push({ x: rnd(), y: rnd() });
	return out;
}

/** Brute force: compares the query with every point. This is the reference answer. */
export function exactKnn(points: readonly Point[], q: Point, k: number = K): SearchResult {
	const order = points.map((p, i) => ({ i, d: sqDist(p, q) })).sort(byDist);
	return {
		ids: order.slice(0, k).map((o) => o.i),
		visited: points.map((_, i) => i),
		cells: [],
		cost: points.length,
	};
}

/** Index of the point nearest to the centre of the square: the entry vertex of the graph. */
export function entryPoint(points: readonly Point[]): number {
	const centre = { x: 0.5, y: 0.5 };
	const order = points.map((p, i) => ({ i, d: sqDist(p, centre) })).sort(byDist);
	return order[0]?.i ?? 0;
}

/**
 * Undirected graph: each vertex links to its nearest neighbours and to a few random vertices.
 * The random links are what makes the greedy walk reach other clusters.
 */
export function buildGraph(
	points: readonly Point[],
	degree: number = GRAPH_DEGREE,
	longLinks: number = LONG_LINKS,
	seed: number = DEMO_SEED + 2,
): number[][] {
	const n = points.length;
	const rnd = mulberry32(seed);
	const adj: Set<number>[] = points.map(() => new Set<number>());
	const link = (a: number, b: number) => {
		if (a === b) return;
		adj[a]?.add(b);
		adj[b]?.add(a);
	};
	points.forEach((p, i) => {
		const near = points
			.map((q, j) => ({ i: j, d: j === i ? Infinity : sqDist(p, q) }))
			.sort(byDist)
			.slice(0, degree);
		for (const o of near) link(i, o.i);
		for (let l = 0; l < longLinks; l++) link(i, Math.floor(rnd() * n));
	});
	return adj.map((s) => Array.from(s).sort((a, b) => a - b));
}

/**
 * Greedy search on the graph with a candidate list of width ef (as in HNSW's lower layer).
 * Pop the nearest unexpanded candidate; stop when it is farther than the worst kept result.
 */
export function graphSearch(
	points: readonly Point[],
	graph: readonly (readonly number[])[],
	q: Point,
	ef: number,
	entry: number,
	k: number = K,
): SearchResult {
	const width = Math.max(ef, k);
	const seen = new Uint8Array(points.length);
	const visited: number[] = [];
	const visit = (i: number): { i: number; d: number } => {
		seen[i] = 1;
		visited.push(i);
		return { i, d: sqDist(points[i] ?? q, q) };
	};
	const insert = (arr: { i: number; d: number }[], item: { i: number; d: number }) => {
		let at = arr.length;
		for (let t = 0; t < arr.length; t++) {
			if (byDist(item, arr[t] ?? item) < 0) {
				at = t;
				break;
			}
		}
		arr.splice(at, 0, item);
	};

	const first = visit(entry);
	const candidates = [first];
	const results = [first];
	while (candidates.length > 0) {
		const c = candidates.shift();
		if (!c) break;
		const worst = results[results.length - 1];
		if (results.length >= width && worst && c.d > worst.d) break;
		for (const nb of graph[c.i] ?? []) {
			if (seen[nb]) continue;
			const item = visit(nb);
			const last = results[results.length - 1];
			if (results.length < width || (last && item.d < last.d)) {
				insert(candidates, item);
				insert(results, item);
				if (results.length > width) results.pop();
			}
		}
	}
	return {
		ids: results.slice(0, k).map((o) => o.i),
		visited,
		cells: [],
		cost: visited.length,
	};
}

/** IVF: k-means cells (fixed number of iterations, seeded start) and the points of each cell. */
export function buildIvf(
	points: readonly Point[],
	lists: number = N_LISTS,
	iters: number = 12,
	seed: number = DEMO_SEED + 3,
): IvfIndex {
	const rnd = mulberry32(seed);
	const order = points.map((_, i) => i);
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		const tmp = order[i] ?? 0;
		order[i] = order[j] ?? 0;
		order[j] = tmp;
	}
	const centroids: Point[] = [];
	for (let c = 0; c < lists; c++) {
		const p = points[order[c] ?? 0] ?? { x: 0.5, y: 0.5 };
		centroids.push({ x: p.x, y: p.y });
	}

	const assign = (): number[] =>
		points.map((p) => {
			let best = 0;
			let bestD = Infinity;
			centroids.forEach((c, j) => {
				const d = sqDist(p, c);
				if (d < bestD) {
					bestD = d;
					best = j;
				}
			});
			return best;
		});

	for (let it = 0; it < iters; it++) {
		const a = assign();
		const sx = new Array<number>(lists).fill(0);
		const sy = new Array<number>(lists).fill(0);
		const cnt = new Array<number>(lists).fill(0);
		a.forEach((j, i) => {
			const p = points[i] ?? { x: 0, y: 0 };
			sx[j] = (sx[j] ?? 0) + p.x;
			sy[j] = (sy[j] ?? 0) + p.y;
			cnt[j] = (cnt[j] ?? 0) + 1;
		});
		// An empty cell keeps its previous centroid.
		for (let j = 0; j < lists; j++) {
			const c = cnt[j] ?? 0;
			if (c > 0 && centroids[j]) {
				centroids[j] = { x: (sx[j] ?? 0) / c, y: (sy[j] ?? 0) / c };
			}
		}
	}

	const cells: number[][] = Array.from({ length: lists }, () => []);
	assign().forEach((j, i) => cells[j]?.push(i));
	return { centroids, lists: cells };
}

/**
 * IVF search: compare the query with all centroids, take the nprobe nearest cells,
 * and compare the query with every point in those cells only.
 */
export function ivfSearch(
	points: readonly Point[],
	index: IvfIndex,
	q: Point,
	nprobe: number,
	k: number = K,
): SearchResult {
	const probe = Math.min(Math.max(1, Math.round(nprobe)), index.centroids.length);
	const order = index.centroids.map((c, j) => ({ i: j, d: sqDist(c, q) })).sort(byDist);
	const cells = order.slice(0, probe).map((o) => o.i);
	const visited: number[] = [];
	const cand: { i: number; d: number }[] = [];
	for (const j of cells) {
		for (const i of index.lists[j] ?? []) {
			visited.push(i);
			cand.push({ i, d: sqDist(points[i] ?? q, q) });
		}
	}
	cand.sort(byDist);
	return {
		ids: cand.slice(0, k).map((o) => o.i),
		visited,
		cells,
		cost: index.centroids.length + visited.length,
	};
}

/** recall@K: share of the true neighbours that the approximate answer contains. */
export function recallAt(ids: readonly number[], truth: readonly number[]): number {
	if (truth.length === 0) return 1;
	const set = new Set(truth);
	let hit = 0;
	for (const id of ids) if (set.has(id)) hit++;
	return hit / truth.length;
}

/** Averages recall and cost over the queries for each setting of the curve. */
function averageOver(
	queries: readonly Point[],
	truths: readonly (readonly number[])[],
	settings: readonly number[],
	run: (q: Point, setting: number) => SearchResult,
): CurvePoint[] {
	return settings.map((setting) => {
		let rec = 0;
		let cost = 0;
		queries.forEach((q, t) => {
			const r = run(q, setting);
			rec += recallAt(r.ids, truths[t] ?? []);
			cost += r.cost;
		});
		const m = Math.max(1, queries.length);
		return { setting, recall: rec / m, cost: cost / m };
	});
}

let cache: DemoIndex | null = null;

/** Builds the points, the graph, the IVF index, the benchmark and its curves once per page. */
export function getDemoIndex(): DemoIndex {
	if (cache) return cache;
	const points = makePoints();
	const graph = buildGraph(points);
	const ivf = buildIvf(points);
	const queries = makeQueries();
	const truths = queries.map((q) => exactKnn(points, q).ids);
	const entry = entryPoint(points);
	const curveHnsw = averageOver(queries, truths, [...EF_VALUES], (q, ef) =>
		graphSearch(points, graph, q, ef, entry),
	);
	const probes: number[] = [];
	for (let p = NPROBE_MIN; p <= NPROBE_MAX; p++) probes.push(p);
	const curveIvf = averageOver(queries, truths, probes, (q, np) => ivfSearch(points, ivf, q, np));
	cache = { points, graph, ivf, queries, truths, curveHnsw, curveIvf };
	return cache;
}

/** Entry vertex used by the demo (the same as in the benchmark). */
export function demoEntry(points: readonly Point[]): number {
	return entryPoint(points);
}

/** Result of one query at the current settings, with the exact answer for comparison. */
export interface QueryReport {
	result: SearchResult;
	exact: number[];
	recall: number;
}

export function reportQuery(
	index: DemoIndex,
	method: Method,
	setting: number,
	q: Point,
): QueryReport {
	const exact = exactKnn(index.points, q).ids;
	const result =
		method === 'hnsw'
			? graphSearch(index.points, index.graph, q, setting, demoEntry(index.points))
			: ivfSearch(index.points, index.ivf, q, setting);
	return { result, exact, recall: recallAt(result.ids, exact) };
}
