/**
 * Math of the PDP / ICE / permutation-importance demo on correlated features.
 *
 * Data: a latent z ~ U(0, 1); x1 = z + s·e1 and x2 = z + s·e2 with unit-variance noise e.
 * Then corr(x1, x2) = Var(z) / (Var(z) + s²) = rho, so the correlation slider sets s.
 * The "model" is a fixed known function (nothing is fitted), so the picture is the same on every load.
 * Pure functions only: no DOM, no Svelte.
 */

export const RHO_MIN = 0.1;
export const RHO_MAX = 0.95;
export const RHO_STEP = 0.05;
export const DEFAULT_RHO = 0.2;

export const GRID_MIN = -1.5;
export const GRID_MAX = 2.5;
export const GRID_STEP = 0.1;
export const DEFAULT_V = 0.5;

/** Horizontal and vertical domain of the scatter plot (x1 and x2 share it). */
export const X_MIN = -1.6;
export const X_MAX = 2.6;

export const N_POINTS = 200;
export const SEED = 7;
export const REPEATS = 10;
/** Half-width of the window of data points used for the conditional average at v. */
export const COND_HALF_WIDTH = 0.15;
/**
 * A synthetic point (v, x2) is "outside the cloud" when |v - x2| exceeds this many standard
 * deviations of x1 - x2 in the data. The data cloud is a band around the diagonal, and its width
 * is set by the correlation.
 */
export const OFF_BAND_K = 2.5;

const VAR_Z = 1 / 12;
const SQRT3 = Math.sqrt(3);

/** Array element with a 0 fallback (the project uses noUncheckedIndexedAccess). */
function at(a: readonly number[], i: number): number {
	return a[i] ?? 0;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

function round(v: number, digits: number): number {
	const k = 10 ** digits;
	return Math.round(v * k) / k;
}

/** Rounds rho to the slider step and clamps it to the slider range. Non-finite input gives the default. */
export function snapRho(r: number): number {
	if (!Number.isFinite(r)) return DEFAULT_RHO;
	return round(
		clamp(Math.round(clamp(r, RHO_MIN, RHO_MAX) / RHO_STEP) * RHO_STEP, RHO_MIN, RHO_MAX),
		2,
	);
}

/** Rounds v to the grid step and clamps it to the slider range. Non-finite input gives the default. */
export function snapV(v: number): number {
	if (!Number.isFinite(v)) return DEFAULT_V;
	const k = Math.round((clamp(v, GRID_MIN, GRID_MAX) - GRID_MIN) / GRID_STEP);
	return round(GRID_MIN + k * GRID_STEP, 1);
}

/** Grid of x1 values at which the PDP and ICE curves are evaluated. */
export const GRID: number[] = Array.from(
	{ length: Math.round((GRID_MAX - GRID_MIN) / GRID_STEP) + 1 },
	(_, k) => round(GRID_MIN + k * GRID_STEP, 1),
);

/** Seeded PRNG (mulberry32): the same seed gives the same sequence in [0, 1). */
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

/** Standard deviation of the shared noise s that gives correlation rho between x1 and x2. */
export function noiseScale(rho: number): number {
	const r = clamp(rho, RHO_MIN, RHO_MAX);
	return Math.sqrt(VAR_Z * (1 / r - 1));
}

export function mean(xs: readonly number[]): number {
	if (xs.length === 0) return 0;
	return xs.reduce((s, v) => s + v, 0) / xs.length;
}

export function pearson(xs: readonly number[], ys: readonly number[]): number {
	const mx = mean(xs);
	const my = mean(ys);
	let sxy = 0;
	let sxx = 0;
	let syy = 0;
	for (let i = 0; i < xs.length; i++) {
		const dx = at(xs, i) - mx;
		const dy = at(ys, i) - my;
		sxy += dx * dy;
		sxx += dx * dx;
		syy += dy * dy;
	}
	return sxy / Math.sqrt(sxx * syy);
}

export interface Sample {
	/** Latent variable that drives both features and the target. */
	z: number[];
	x1: number[];
	x2: number[];
	/** Target: close to z with a little noise. */
	y: number[];
}

/** Fixed sample for a given correlation. Deterministic for a given (rho, n, seed). */
export function makeSample(rho: number, n: number = N_POINTS, seed: number = SEED): Sample {
	const rng = mulberry32(seed);
	const s = noiseScale(rho);
	const out: Sample = { z: [], x1: [], x2: [], y: [] };
	for (let i = 0; i < n; i++) {
		const zi = rng();
		const e1 = (2 * rng() - 1) * SQRT3;
		const e2 = (2 * rng() - 1) * SQRT3;
		const e3 = (2 * rng() - 1) * SQRT3;
		out.z.push(zi);
		out.x1.push(zi + s * e1);
		out.x2.push(zi + s * e2);
		out.y.push(zi + 0.05 * e3);
	}
	return out;
}

/**
 * The fixed "model" f(x1, x2). The average part is additive; the sine term is an interaction that
 * is small where x1 and x2 agree (the data cloud) and large where they do not.
 */
export function predict(x1: number, x2: number): number {
	return (x1 + x2) / 2 + 1.5 * Math.sin(4 * (x1 - x2));
}

/** ICE: one curve per data object. Curve i is f(v, x2_i) for every v in the grid. */
export function iceCurves(sample: Sample, grid: readonly number[] = GRID): number[][] {
	return sample.x2.map((b) => grid.map((v) => predict(v, b)));
}

/** PDP: the average of the ICE curves over the objects, for each v. */
export function pdpCurve(ice: readonly (readonly number[])[]): number[] {
	if (ice.length === 0) return [];
	const width = ice[0]?.length ?? 0;
	const out: number[] = [];
	for (let j = 0; j < width; j++) {
		let s = 0;
		for (const row of ice) s += at(row, j);
		out.push(s / ice.length);
	}
	return out;
}

/**
 * Conditional average on the data: the mean of f over objects whose x1 is within `halfWidth` of v.
 * Entries are null where there are no such objects (the sparse region).
 */
export function conditionalCurve(
	sample: Sample,
	grid: readonly number[] = GRID,
	halfWidth: number = COND_HALF_WIDTH,
): (number | null)[] {
	return grid.map((v) => {
		let s = 0;
		let k = 0;
		for (let i = 0; i < sample.x1.length; i++) {
			if (Math.abs(at(sample.x1, i) - v) <= halfWidth) {
				s += predict(at(sample.x1, i), at(sample.x2, i));
				k++;
			}
		}
		return k === 0 ? null : s / k;
	});
}

/**
 * For x1 = v, the PDP uses the points (v, x2_i) for every object i. Flags which of them lie
 * outside the data band: |v - x2_i| > k · sd(x1 - x2) in the data.
 */
export function offCloudFlags(sample: Sample, v: number, k: number = OFF_BAND_K): boolean[] {
	const diff = sample.x1.map((a, i) => a - at(sample.x2, i));
	const m = mean(diff);
	const sd = Math.sqrt(mean(diff.map((d) => (d - m) ** 2)));
	const limit = k * sd;
	return sample.x2.map((b) => Math.abs(v - b) > limit);
}

export function countTrue(flags: readonly boolean[]): number {
	let k = 0;
	for (const f of flags) if (f) k++;
	return k;
}

/** Number of data objects with x1 within `halfWidth` of v (support of the conditional average). */
export function nearCount(sample: Sample, v: number, halfWidth: number = COND_HALF_WIDTH): number {
	let k = 0;
	for (const x of sample.x1) if (Math.abs(x - v) <= halfWidth) k++;
	return k;
}

/** Symmetric-padded vertical domain for a set of curves. */
export function curveDomain(curves: readonly (readonly number[])[]): [number, number] {
	let lo = Infinity;
	let hi = -Infinity;
	for (const row of curves) {
		for (const v of row) {
			if (v < lo) lo = v;
			if (v > hi) hi = v;
		}
	}
	if (!Number.isFinite(lo)) return [-1, 1];
	const pad = Math.max(0.2, (hi - lo) * 0.08);
	return [lo - pad, hi + pad];
}

/** Linear map from a data domain [d0, d1] to a pixel range [r0, r1]. */
export function linScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
	const k = (r1 - r0) / (d1 - d0);
	return (v: number) => r0 + (v - d0) * k;
}

/**
 * SVG path through (xs[i], values[i]). A null value breaks the line, so the conditional average
 * shows a gap where there is no data.
 */
export function linePath(
	xs: readonly number[],
	values: readonly (number | null)[],
	sx: (v: number) => number,
	sy: (v: number) => number,
): string {
	let d = '';
	let pen = false;
	for (let i = 0; i < xs.length; i++) {
		const y = values[i];
		const x = xs[i];
		if (x === undefined || y === null || y === undefined || !Number.isFinite(y)) {
			pen = false;
			continue;
		}
		d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`;
		pen = true;
	}
	return d;
}

function shuffled(n: number, rng: () => number): number[] {
	const idx = Array.from({ length: n }, (_, i) => i);
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = at(idx, i);
		idx[i] = at(idx, j);
		idx[j] = tmp;
	}
	return idx;
}

export interface Importance {
	/** Mean squared error of the model on the sample, without permutation. */
	base: number;
	/** Growth of the error when only x1 is permuted. */
	x1: number;
	/** Growth of the error when only x2 is permuted. */
	x2: number;
	/** Growth of the error when the pair (x1, x2) is permuted together, as one group. */
	group: number;
}

/**
 * Model used for permutation importance: the average of the two correlated features. It leans on
 * both features equally, which is the redundant case the text describes. No interaction term,
 * so the numbers show the effect of permutation and not extrapolation.
 */
export function predictAverage(x1: number, x2: number): number {
	return (x1 + x2) / 2;
}

/**
 * Permutation importance on the sample: the mean growth of the squared error over `repeats`
 * random permutations. Single features are permuted separately; the group keeps the pair together.
 */
export function permutationImportance(
	sample: Sample,
	repeats: number = REPEATS,
	seed: number = SEED + 1,
): Importance {
	const n = sample.y.length;
	const rng = mulberry32(seed);
	const mse = (pred: readonly number[]): number => {
		let s = 0;
		for (let i = 0; i < n; i++) s += (at(pred, i) - at(sample.y, i)) ** 2;
		return s / n;
	};
	const base = mse(sample.x1.map((a, i) => predictAverage(a, at(sample.x2, i))));
	let sum1 = 0;
	let sum2 = 0;
	let sumG = 0;
	for (let r = 0; r < repeats; r++) {
		const p1 = shuffled(n, rng);
		const p2 = shuffled(n, rng);
		const pg = shuffled(n, rng);
		sum1 +=
			mse(sample.x1.map((_, i) => predictAverage(at(sample.x1, at(p1, i)), at(sample.x2, i)))) -
			base;
		sum2 += mse(sample.x1.map((a, i) => predictAverage(a, at(sample.x2, at(p2, i))))) - base;
		sumG +=
			mse(
				sample.x1.map((_, i) => predictAverage(at(sample.x1, at(pg, i)), at(sample.x2, at(pg, i)))),
			) - base;
	}
	return { base, x1: sum1 / repeats, x2: sum2 / repeats, group: sumG / repeats };
}

/** One-line reading of the current state for the live text under the plots. */
export function describeState(sample: Sample, v: number, rho: number): string {
	const off = countTrue(offCloudFlags(sample, v));
	const near = nearCount(sample, v);
	const where =
		near === 0
			? `рядом с x₁ = ${v.toFixed(1)} нет ни одного объекта`
			: `рядом с x₁ = ${v.toFixed(1)} объектов: ${near}`;
	return (
		`При ρ = ${rho.toFixed(2)} ${where}. ` +
		`Из ${sample.x2.length} точек, по которым усредняет PDP, ${off} лежат вне облака данных.`
	);
}
