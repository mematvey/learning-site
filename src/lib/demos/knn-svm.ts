/**
 * Math of the kNN / SVM demo: a fixed two-class dataset on the plane, k-nearest-neighbour
 * voting, and a soft-margin SVM (linear or RBF kernel) trained with a simplified SMO.
 * The dataset is generated from a fixed seed, so every page load shows the same picture.
 * Pure functions only: no DOM, no Svelte.
 */

export type ModelKind = 'knn' | 'svm';
export type KernelKind = 'linear' | 'rbf';

export interface KnnSvmDemoState {
	/** Which classifier is shown. */
	model: ModelKind;
	/** Number of neighbours (kNN only). */
	k: number;
	/** Soft-margin penalty C (SVM only). */
	C: number;
	/** Kernel (SVM only). */
	kernel: KernelKind;
	/** RBF width: K(x, z) = exp(-gamma·|x - z|²) (SVM with RBF only). */
	gamma: number;
}

export interface Point {
	x: number;
	y: number;
	/** Class 0 or class 1. */
	label: 0 | 1;
}

/** The plane shown by the demo is [-DOMAIN, DOMAIN]². */
export const DOMAIN = 1.6;
export const DATA_SEED = 2026;
export const K_MIN = 1;
export const K_MAX = 15;
/** Allowed values of C, shown as a discrete slider. */
export const C_VALUES = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50] as const;
export const GAMMA_MIN = 0.5;
export const GAMMA_MAX = 8;
export const GAMMA_STEP = 0.5;

/** Above this α the point counts as a support vector. */
const SUPPORT_EPS = 1e-6;

export function isModelKind(v: unknown): v is ModelKind {
	return v === 'knn' || v === 'svm';
}

export function isKernelKind(v: unknown): v is KernelKind {
	return v === 'linear' || v === 'rbf';
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an integer inside the k slider range. Non-finite input gives 5. */
export function snapK(k: number): number {
	if (!Number.isFinite(k)) return 5;
	return clamp(Math.round(k), K_MIN, K_MAX);
}

/** Nearest value of C_VALUES. Non-finite input gives 1. */
export function snapC(c: number): number {
	if (!Number.isFinite(c)) return 1;
	let best: number = C_VALUES[0];
	for (const v of C_VALUES) {
		if (Math.abs(v - c) < Math.abs(best - c)) best = v;
	}
	return best;
}

/** Rounds to the γ step inside the slider range. Non-finite input gives 2. */
export function snapGamma(g: number): number {
	if (!Number.isFinite(g)) return 2;
	const stepped = Math.round(g / GAMMA_STEP) * GAMMA_STEP;
	return Math.round(clamp(stepped, GAMMA_MIN, GAMMA_MAX) * 10) / 10;
}

/**
 * Returns a new state: the patch is applied field by field, every field is sanitised.
 * Unknown values are ignored, so a bad patch never breaks the demo.
 */
export function applyPatch(
	state: KnnSvmDemoState,
	patch: Partial<KnnSvmDemoState>,
): KnnSvmDemoState {
	return {
		model: isModelKind(patch.model) ? patch.model : state.model,
		k: typeof patch.k === 'number' ? snapK(patch.k) : state.k,
		C: typeof patch.C === 'number' ? snapC(patch.C) : state.C,
		kernel: isKernelKind(patch.kernel) ? patch.kernel : state.kernel,
		gamma: typeof patch.gamma === 'number' ? snapGamma(patch.gamma) : state.gamma,
	};
}

/** Small deterministic PRNG (mulberry32): the same seed gives the same sequence. */
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

/** Standard normal sample by Box–Muller from a uniform generator. */
function gaussian(rand: () => number): number {
	const u = Math.max(rand(), 1e-12);
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface Blob {
	label: 0 | 1;
	cx: number;
	cy: number;
	sigma: number;
	n: number;
}

/**
 * Two classes: broad overlapping blobs (a linear boundary almost works) and a small island
 * of class 1 inside class 0's region (only a curved boundary separates it).
 */
const BLOBS: readonly Blob[] = [
	{ label: 0, cx: -0.7, cy: -0.4, sigma: 0.55, n: 20 },
	{ label: 1, cx: 0.6, cy: 0.5, sigma: 0.55, n: 20 },
	{ label: 1, cx: -0.85, cy: 0.9, sigma: 0.16, n: 6 },
];

/** Fixed dataset of the demo. Coordinates are clamped to the plane. */
export function makeDataset(seed: number = DATA_SEED): Point[] {
	const rand = mulberry32(seed);
	const points: Point[] = [];
	for (const blob of BLOBS) {
		for (let i = 0; i < blob.n; i++) {
			const x = clamp(blob.cx + blob.sigma * gaussian(rand), -DOMAIN, DOMAIN);
			const y = clamp(blob.cy + blob.sigma * gaussian(rand), -DOMAIN, DOMAIN);
			points.push({ x, y, label: blob.label });
		}
	}
	return points;
}

/** Majority vote of the k nearest points. A tie of votes goes to the nearest point's class. */
export function knnPredict(points: readonly Point[], x: number, y: number, k: number): 0 | 1 {
	const order = points
		.map((p, i) => ({ i, d: (p.x - x) ** 2 + (p.y - y) ** 2 }))
		.sort((a, b) => a.d - b.d || a.i - b.i);
	const kk = Math.min(Math.max(1, Math.round(k)), points.length);
	const nearest = order.slice(0, kk);
	let votes0 = 0;
	let votes1 = 0;
	for (const r of nearest) {
		if (points[r.i]?.label === 1) votes1++;
		else votes0++;
	}
	if (votes0 !== votes1) return votes1 > votes0 ? 1 : 0;
	return nearest[0] ? (points[nearest[0].i]?.label ?? 0) : 0;
}

/** Kernel value K(a, b): dot product for linear, exp(-gamma·|a-b|²) for RBF. */
export function kernelValue(
	kind: KernelKind,
	gamma: number,
	a: { x: number; y: number },
	b: { x: number; y: number },
): number {
	if (kind === 'linear') return a.x * b.x + a.y * b.y;
	return Math.exp(-gamma * ((a.x - b.x) ** 2 + (a.y - b.y) ** 2));
}

export interface SvmModel {
	/** Training points (copy of the input). */
	points: Point[];
	/** Lagrange multipliers, one per training point, each in [0, C]. */
	alpha: number[];
	/** Labels as ±1. */
	y: number[];
	b: number;
	kernel: KernelKind;
	gamma: number;
	C: number;
	/** Indices of points with α > 0: they define the boundary. */
	support: number[];
}

/**
 * Soft-margin SVM by a simplified SMO: repeatedly takes a point that violates the KKT
 * conditions and pairs it with the point whose error differs most. Deterministic.
 * Stops when a full sweep changes nothing, or after `maxSweeps`.
 */
export function fitSvm(
	points: readonly Point[],
	C: number,
	kernel: KernelKind,
	gamma: number,
	tol = 1e-3,
	maxSweeps = 200,
): SvmModel {
	const n = points.length;
	const y = points.map((p) => (p.label === 1 ? 1 : -1));
	const K = points.map((a) => points.map((b) => kernelValue(kernel, gamma, a, b)));
	const alpha = new Array<number>(n).fill(0);
	let b = 0;

	/** Decision value without the bias for training point i, plus b. */
	const output = (i: number): number => {
		let s = b;
		for (let k = 0; k < n; k++) {
			const ak = alpha[k] ?? 0;
			if (ak !== 0) s += ak * (y[k] ?? 0) * (K[k]?.[i] ?? 0);
		}
		return s;
	};

	for (let sweep = 0; sweep < maxSweeps; sweep++) {
		let changed = 0;
		for (let i = 0; i < n; i++) {
			const yi = y[i] ?? 0;
			const ai = alpha[i] ?? 0;
			const Ei = output(i) - yi;
			const violates = (yi * Ei < -tol && ai < C) || (yi * Ei > tol && ai > 0);
			if (!violates) continue;

			// Second point: largest |Ei - Ej|, ties go to the lower index.
			let j = -1;
			let bestGap = -1;
			let Ej = 0;
			for (let k = 0; k < n; k++) {
				if (k === i) continue;
				const e = output(k) - (y[k] ?? 0);
				const gap = Math.abs(Ei - e);
				if (gap > bestGap) {
					bestGap = gap;
					j = k;
					Ej = e;
				}
			}
			if (j < 0) continue;

			const yj = y[j] ?? 0;
			const aj = alpha[j] ?? 0;
			let L: number;
			let H: number;
			if (yi !== yj) {
				L = Math.max(0, aj - ai);
				H = Math.min(C, C + aj - ai);
			} else {
				L = Math.max(0, ai + aj - C);
				H = Math.min(C, ai + aj);
			}
			if (L >= H) continue;

			const Kii = K[i]?.[i] ?? 0;
			const Kjj = K[j]?.[j] ?? 0;
			const Kij = K[i]?.[j] ?? 0;
			const eta = 2 * Kij - Kii - Kjj;
			if (eta >= 0) continue;

			const ajNew = Math.min(H, Math.max(L, aj - (yj * (Ei - Ej)) / eta));
			if (Math.abs(ajNew - aj) < 1e-5) continue;
			const aiNew = ai + yi * yj * (aj - ajNew);

			const b1 = b - Ei - yi * (aiNew - ai) * Kii - yj * (ajNew - aj) * Kij;
			const b2 = b - Ej - yi * (aiNew - ai) * Kij - yj * (ajNew - aj) * Kjj;
			alpha[i] = aiNew;
			alpha[j] = ajNew;
			if (aiNew > 0 && aiNew < C) b = b1;
			else if (ajNew > 0 && ajNew < C) b = b2;
			else b = (b1 + b2) / 2;
			changed++;
		}
		if (changed === 0) break;
	}

	const support: number[] = [];
	for (let i = 0; i < n; i++) if ((alpha[i] ?? 0) > SUPPORT_EPS) support.push(i);
	return {
		points: points.map((p) => ({ ...p })),
		alpha,
		y,
		b,
		kernel,
		gamma,
		C,
		support,
	};
}

/** Signed decision value f(x, y) of a trained SVM. f >= 0 means class 1. */
export function svmDecision(model: SvmModel, x: number, y: number): number {
	let s = model.b;
	for (const i of model.support) {
		const p = model.points[i];
		if (!p) continue;
		s +=
			(model.alpha[i] ?? 0) *
			(model.y[i] ?? 0) *
			kernelValue(model.kernel, model.gamma, p, { x, y });
	}
	return s;
}

export interface Classifier {
	/** Class of a point of the plane. */
	predict(x: number, y: number): 0 | 1;
	/** Indices of support vectors (empty for kNN). */
	support: number[];
	/** Number of training points the classifier gets wrong. */
	trainErrors: number;
}

/** Trains (SVM) or prepares (kNN) the classifier of the state, and counts training errors. */
export function buildClassifier(state: KnnSvmDemoState, points: readonly Point[]): Classifier {
	let predict: (x: number, y: number) => 0 | 1;
	let support: number[] = [];
	if (state.model === 'knn') {
		const k = state.k;
		predict = (x, y) => knnPredict(points, x, y, k);
	} else {
		const model = fitSvm(points, state.C, state.kernel, state.gamma);
		support = model.support;
		predict = (x, y) => (svmDecision(model, x, y) >= 0 ? 1 : 0);
	}
	let trainErrors = 0;
	for (const p of points) if (predict(p.x, p.y) !== p.label) trainErrors++;
	return { predict, support, trainErrors };
}

/**
 * Class of every cell of an n×n grid over the plane, row 0 at the top (largest y).
 * Each value is the class at the cell centre.
 */
export function classifyGrid(predict: (x: number, y: number) => 0 | 1, n: number): Uint8Array {
	const cells = new Uint8Array(n * n);
	const step = (2 * DOMAIN) / n;
	for (let r = 0; r < n; r++) {
		const y = DOMAIN - (r + 0.5) * step;
		for (let c = 0; c < n; c++) {
			const x = -DOMAIN + (c + 0.5) * step;
			cells[r * n + c] = predict(x, y);
		}
	}
	return cells;
}

/** Plane coordinates to pixels of a square chart of the given size (y grows downwards). */
export function planeToPx(x: number, y: number, size: number): { px: number; py: number } {
	return {
		px: ((x + DOMAIN) / (2 * DOMAIN)) * size,
		py: size - ((y + DOMAIN) / (2 * DOMAIN)) * size,
	};
}

/**
 * SVG path of the cells of one class: one horizontal run per row, filled with the class colour.
 * Coordinates are rounded to 0.1px.
 */
export function regionPath(cells: Uint8Array, n: number, cls: 0 | 1, size: number): string {
	const cell = size / n;
	const parts: string[] = [];
	for (let r = 0; r < n; r++) {
		let c = 0;
		while (c < n) {
			if (cells[r * n + c] !== cls) {
				c++;
				continue;
			}
			const start = c;
			while (c < n && cells[r * n + c] === cls) c++;
			const x0 = (start * cell).toFixed(1);
			const y0 = (r * cell).toFixed(1);
			const w = ((c - start) * cell).toFixed(1);
			parts.push(`M${x0} ${y0}h${w}v${cell.toFixed(1)}h-${w}Z`);
		}
	}
	return parts.join('');
}

/** Text of the description line under the chart. Numbers are computed, not typed. */
export function describeClassifier(state: KnnSvmDemoState, clf: Classifier, total: number): string {
	const errors = `Ошибок на обучающей выборке: ${clf.trainErrors} из ${total}.`;
	if (state.model === 'knn') {
		return `kNN, k = ${state.k}: класс точки определяется голосованием ${state.k} ближайших соседей. ${errors}`;
	}
	const kernelName =
		state.kernel === 'linear' ? 'линейное ядро' : `RBF-ядро, γ = ${state.gamma.toFixed(1)}`;
	return `SVM, ${kernelName}, C = ${state.C}: опорных векторов ${clf.support.length}. ${errors}`;
}
