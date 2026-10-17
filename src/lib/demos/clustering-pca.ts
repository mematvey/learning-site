/**
 * Math of the clustering and PCA demo: k-means (Lloyd steps) and PCA of a 2-D point cloud.
 * The cloud and the start are fixed by seeds, so every page load shows the same picture.
 * Pure functions only: no DOM, no Svelte.
 */

import { mulberry32 } from './attention';

export type Point = readonly [number, number];

export const K_MIN = 2;
export const K_MAX = 5;
export const DEFAULT_K = 3;
export const COMPONENTS_MIN = 1;
export const COMPONENTS_MAX = 2;
export const DEFAULT_COMPONENTS = 1;
/** Seed of the point cloud. */
export const CLOUD_SEED = 20240920;
/** Seed of the first k-means start. "Другой старт" in the demo increments it. */
export const START_SEED = 7;
export const N_PER_CLUSTER = 30;
/** Cluster centres of the cloud (elongated clusters along one diagonal). */
export const CENTRES: readonly Point[] = [
	[-2.4, -1.4],
	[0.2, 1.8],
	[2.5, -0.6],
];

export interface ClusteringPcaDemoState {
	/** Number of clusters k. */
	k: number;
	/** Number of principal components kept (1 or 2). */
	components: number;
}

export function snapK(k: number): number {
	if (!Number.isFinite(k)) return DEFAULT_K;
	return Math.min(K_MAX, Math.max(K_MIN, Math.round(k)));
}

export function snapComponents(m: number): number {
	if (!Number.isFinite(m)) return DEFAULT_COMPONENTS;
	return Math.min(COMPONENTS_MAX, Math.max(COMPONENTS_MIN, Math.round(m)));
}

/** Standard normal sample by Box-Muller; `rand` returns floats in [0, 1). */
export function gaussian(rand: () => number): number {
	let u = rand();
	while (u === 0) u = rand();
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Elongated Gaussian clusters around CENTRES, stretched along the direction (1, 0.7). */
export function makeCloud(seed: number = CLOUD_SEED, perCluster: number = N_PER_CLUSTER): Point[] {
	const rand = mulberry32(seed);
	const len = Math.hypot(1, 0.7);
	const ux = 1 / len;
	const uy = 0.7 / len;
	const wx = -uy;
	const wy = ux;
	const points: Point[] = [];
	for (const [cx, cy] of CENTRES) {
		for (let i = 0; i < perCluster; i++) {
			const a = 1.1 * gaussian(rand);
			const b = 0.35 * gaussian(rand);
			points.push([cx + a * ux + b * wx, cy + a * uy + b * wy]);
		}
	}
	return points;
}

export function dist2(a: Point, b: Point): number {
	const dx = a[0] - b[0];
	const dy = a[1] - b[1];
	return dx * dx + dy * dy;
}

/** Index of the nearest centre; ties go to the lowest index. */
export function nearest(p: Point, centers: readonly Point[]): number {
	let best = 0;
	let bestD = Infinity;
	centers.forEach((c, j) => {
		const d = dist2(p, c);
		if (d < bestD) {
			bestD = d;
			best = j;
		}
	});
	return best;
}

/** Assignment step: label of every point. */
export function assign(points: readonly Point[], centers: readonly Point[]): number[] {
	return points.map((p) => nearest(p, centers));
}

/**
 * Update step: mean of every cluster. A cluster that lost all its points keeps its previous centre.
 */
export function centroids(
	points: readonly Point[],
	labels: readonly number[],
	prev: readonly Point[],
): Point[] {
	const sums = prev.map(() => [0, 0] as [number, number]);
	const counts = prev.map(() => 0);
	points.forEach((p, i) => {
		const j = labels[i] ?? 0;
		const s = sums[j];
		if (!s) return;
		s[0] += p[0];
		s[1] += p[1];
		counts[j] = (counts[j] ?? 0) + 1;
	});
	return prev.map((c, j) => {
		const n = counts[j] ?? 0;
		const s = sums[j];
		if (n === 0 || !s) return c;
		return [s[0] / n, s[1] / n] as const;
	});
}

/** Sum of squared distances from every point to the centre of its label (k-means objective J). */
export function inertia(
	points: readonly Point[],
	centers: readonly Point[],
	labels: readonly number[],
): number {
	let total = 0;
	points.forEach((p, i) => {
		const c = centers[labels[i] ?? 0];
		if (c) total += dist2(p, c);
	});
	return total;
}

/** k-means++ start: the first centre is a random point, the others are drawn with probability ~ D². */
export function initPlusPlus(points: readonly Point[], k: number, seed: number): Point[] {
	const rand = mulberry32(seed);
	const n = points.length;
	const kk = snapK(k);
	if (n === 0) return [];
	const first = points[Math.floor(rand() * n)] ?? points[0];
	if (!first) return [];
	const centers: Point[] = [first];
	while (centers.length < kk) {
		const d = points.map((p) => Math.min(...centers.map((c) => dist2(p, c))));
		const total = d.reduce((s, v) => s + v, 0);
		if (total <= 0) {
			centers.push(points[centers.length % n] ?? first);
			continue;
		}
		let r = rand() * total;
		let pick = n - 1;
		for (let i = 0; i < n; i++) {
			r -= d[i] ?? 0;
			if (r <= 0) {
				pick = i;
				break;
			}
		}
		centers.push(points[pick] ?? first);
	}
	return centers;
}

export interface KmeansState {
	centers: Point[];
	/** Labels from the last assignment step; null before the first step. */
	labels: number[] | null;
	/** Completed steps. */
	iter: number;
	/** True when a step left every label unchanged. */
	converged: boolean;
}

export function initState(points: readonly Point[], k: number, seed: number): KmeansState {
	return {
		centers: initPlusPlus(points, k, seed),
		labels: null,
		iter: 0,
		converged: false,
	};
}

/** One Lloyd step: assign points to the current centres, then move the centres to the means. */
export function kmeansStep(points: readonly Point[], s: KmeansState): KmeansState {
	if (s.converged || s.centers.length === 0) return s;
	const labels = assign(points, s.centers);
	const centers = centroids(points, labels, s.centers);
	const converged = s.labels !== null && labels.every((l, i) => l === s.labels?.[i]);
	return { centers, labels, iter: s.iter + 1, converged };
}

/** Steps until convergence or `maxIter` steps. */
export function runKmeans(
	points: readonly Point[],
	s: KmeansState,
	maxIter: number = 100,
): KmeansState {
	let cur = s;
	for (let i = 0; i < maxIter && !cur.converged; i++) cur = kmeansStep(points, cur);
	return cur;
}

export interface ElbowPoint {
	k: number;
	/** Smallest inertia over `starts` k-means++ starts. */
	j: number;
}

/** Inertia J of the converged k-means for every k from K_MIN to K_MAX: the data of the elbow plot. */
export function elbowCurve(points: readonly Point[], starts: number = 6): ElbowPoint[] {
	const out: ElbowPoint[] = [];
	for (let k = K_MIN; k <= K_MAX; k++) {
		let best = Infinity;
		for (let t = 0; t < starts; t++) {
			const s = runKmeans(points, initState(points, k, START_SEED + t));
			const labels = s.labels ?? assign(points, s.centers);
			best = Math.min(best, inertia(points, s.centers, labels));
		}
		out.push({ k, j: best });
	}
	return out;
}

export interface Pca2 {
	/** Mean of the cloud. */
	mean: [number, number];
	/** Unit principal axes, the first has the largest variance. */
	axes: [Point, Point];
	/** Eigenvalues of the population covariance, λ1 ≥ λ2. */
	variances: [number, number];
	/** Share of the total variance on each axis; sums to 1. */
	ratio: [number, number];
}

/** PCA of 2-D points through the closed-form eigen decomposition of the 2×2 covariance matrix. */
export function pca2(points: readonly Point[]): Pca2 {
	const n = points.length || 1;
	let mx = 0;
	let my = 0;
	for (const p of points) {
		mx += p[0];
		my += p[1];
	}
	mx /= n;
	my /= n;
	let a = 0;
	let b = 0;
	let d = 0;
	for (const p of points) {
		const dx = p[0] - mx;
		const dy = p[1] - my;
		a += dx * dx;
		b += dx * dy;
		d += dy * dy;
	}
	a /= n;
	b /= n;
	d /= n;

	const tr = a + d;
	const det = a * d - b * b;
	const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
	const l1 = tr / 2 + disc;
	const l2 = Math.max(0, tr / 2 - disc);

	let v1: [number, number];
	if (Math.abs(b) > 1e-12) v1 = [b, l1 - a];
	else v1 = a >= d ? [1, 0] : [0, 1];
	const len = Math.hypot(v1[0], v1[1]) || 1;
	v1 = [v1[0] / len, v1[1] / len];
	const v2: [number, number] = [-v1[1], v1[0]];

	const total = l1 + l2;
	const ratio: [number, number] = total > 0 ? [l1 / total, l2 / total] : [1, 0];
	return {
		mean: [mx, my],
		axes: [v1, v2],
		variances: [l1, l2],
		ratio,
	};
}

/**
 * Reconstruction of every point from the first `m` principal components:
 * x̂ = mean + Σ_{j<m} ((x − mean)·v_j) v_j.
 */
export function reconstruct(points: readonly Point[], pca: Pca2, m: number): Point[] {
	const [mx, my] = pca.mean;
	const count = Math.min(2, Math.max(1, Math.round(m)));
	return points.map((p) => {
		const dx = p[0] - mx;
		const dy = p[1] - my;
		let x = mx;
		let y = my;
		for (let j = 0; j < count; j++) {
			const v = pca.axes[j];
			if (!v) continue;
			const t = dx * v[0] + dy * v[1];
			x += t * v[0];
			y += t * v[1];
		}
		return [x, y] as const;
	});
}

/** Mean squared distance between the points and their reconstruction from `m` components. */
export function reconstructionError(points: readonly Point[], pca: Pca2, m: number): number {
	const rec = reconstruct(points, pca, m);
	if (points.length === 0) return 0;
	let total = 0;
	points.forEach((p, i) => {
		const r = rec[i];
		if (r) total += dist2(p, r);
	});
	return total / points.length;
}

/** Text of the k-means status line. Numbers come from the state, not typed. */
export function describeKmeans(s: KmeansState, j: number): string {
	if (s.iter === 0) return `Старт k-means++: центры стоят в случайных точках. J = ${j.toFixed(1)}.`;
	if (s.converged) {
		return `Шаг ${s.iter}: назначения не изменились, алгоритм сошёлся. J = ${j.toFixed(1)}.`;
	}
	return `Шаг ${s.iter}: точки назначены ближайшим центрам, центры переставлены в средние. J = ${j.toFixed(1)}.`;
}

/** Text of the PCA status line. */
export function describePca(pca: Pca2, m: number): string {
	const [r1, r2] = pca.ratio;
	const kept = m === 1 ? r1 : 1;
	const lost = 1 - kept;
	const share = (kept * 100).toFixed(0);
	if (m === 1) {
		return (
			`PC1 объясняет ${(r1 * 100).toFixed(0)}% дисперсии, PC2 — ${(r2 * 100).toFixed(0)}%. ` +
			`Одна компонента сохраняет ${share}%, теряется ${(lost * 100).toFixed(0)}%.`
		);
	}
	return `Обе компоненты сохранены: 100% дисперсии, восстановление точное.`;
}
