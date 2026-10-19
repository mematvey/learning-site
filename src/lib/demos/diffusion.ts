/**
 * Math of the diffusion demo: linear noise schedule, forward process in closed form,
 * and a reverse (DDPM) sampler. The noise predictor is exact for a known two-cluster
 * Gaussian mixture, so the demo shows the process, not a trained network.
 * Pure functions only: no DOM, no Svelte.
 */

export type Point = readonly [number, number];

/** Number of diffusion steps, as in the chapter. */
export const T = 1000;
/** Schedule endpoints for beta_t (linear schedule, as in Ho et al. 2020). */
export const BETA_MIN = 1e-4;
export const BETA_MAX = 0.02;

/** Two cluster centres of the toy data and the std of each cluster (equal weights). */
export const DATA_CENTERS: readonly [Point, Point] = [
	[-1.2, 0.5],
	[1.1, -0.6],
];
export const DATA_STD = 0.25;

export const N_POINTS = 60;
export const DATA_SEED = 7;
export const NOISE_SEED = 11;
export const SAMPLE_SEED = 23;

function makeBetas(): number[] {
	const out: number[] = [];
	for (let i = 0; i < T; i++) out.push(BETA_MIN + ((BETA_MAX - BETA_MIN) * i) / (T - 1));
	return out;
}

/** BETAS[t - 1] = beta_t for t = 1..T. */
export const BETAS: readonly number[] = makeBetas();

/** ALPHA_BARS[t - 1] = alpha_bar_t = prod over s <= t of (1 - beta_s). */
const ALPHA_BARS: readonly number[] = (() => {
	const out: number[] = [];
	let p = 1;
	for (const b of BETAS) {
		p *= 1 - b;
		out.push(p);
	}
	return out;
})();

/** Clamps a step index to 0..T and rounds it. Non-finite input gives 0. */
export function clampStep(t: number): number {
	if (!Number.isFinite(t)) return 0;
	return Math.min(T, Math.max(0, Math.round(t)));
}

/** beta_t for a step t in 1..T. */
export function beta(t: number): number {
	return BETAS[t - 1];
}

/** alpha_bar_t; equals 1 at t = 0 (no noise yet). */
export function alphaBar(t: number): number {
	return t <= 0 ? 1 : ALPHA_BARS[t - 1];
}

/** Share of the signal in x_t: sqrt(alpha_bar_t). */
export function signalShare(t: number): number {
	return Math.sqrt(alphaBar(t));
}

/** Share of the noise in x_t: sqrt(1 - alpha_bar_t). */
export function noiseShare(t: number): number {
	return Math.sqrt(1 - alphaBar(t));
}

/** Formats a number with a decimal comma, as the chapter writes it. */
export function formatNumber(v: number, digits: number): string {
	return v.toFixed(digits).replace('.', ',');
}

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

/** Standard normal sample (Box-Muller). */
export function gaussian(rng: () => number): number {
	let u = 0;
	while (u === 0) u = rng();
	const v = rng();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Two independent standard normal values. */
export function gaussPoint(rng: () => number): Point {
	return [gaussian(rng), gaussian(rng)];
}

/** Clean data: points of the two clusters, alternating, with fixed seed. */
export function makeData(n: number = N_POINTS, seed: number = DATA_SEED): Point[] {
	const rng = mulberry32(seed);
	const out: Point[] = [];
	for (let i = 0; i < n; i++) {
		const c = DATA_CENTERS[i % 2];
		const g = gaussPoint(rng);
		out.push([c[0] + DATA_STD * g[0], c[1] + DATA_STD * g[1]]);
	}
	return out;
}

/** Fixed noise per point, so moving the slider changes the cloud smoothly. */
export function makeNoise(n: number = N_POINTS, seed: number = NOISE_SEED): Point[] {
	const rng = mulberry32(seed);
	const out: Point[] = [];
	for (let i = 0; i < n; i++) out.push(gaussPoint(rng));
	return out;
}

/** Forward process in one step: x_t = sqrt(alpha_bar_t) x_0 + sqrt(1 - alpha_bar_t) eps. */
export function qSample(x0: Point, t: number, eps: Point): Point {
	const ab = alphaBar(t);
	const a = Math.sqrt(ab);
	const s = Math.sqrt(1 - ab);
	return [a * x0[0] + s * eps[0], a * x0[1] + s * eps[1]];
}

/** Forward cloud at step t for all points. */
export function forwardPoints(data: readonly Point[], noise: readonly Point[], t: number): Point[] {
	return data.map((x0, i) => qSample(x0, t, noise[i]));
}

/**
 * Exact noise prediction eps(x_t, t) for the mixture of DATA_CENTERS (equal weights, std DATA_STD).
 * Marginal of x_t given cluster k is N(sqrt(ab) c_k, v) with v = ab s^2 + (1 - ab), the same for
 * both clusters. The posterior mean of x_0 is a weighted sum over clusters, and eps follows from
 * x_t = sqrt(ab) x_0 + sqrt(1 - ab) eps.
 */
export function predictNoise(x: Point, t: number): Point {
	const ab = alphaBar(t);
	const a = Math.sqrt(ab);
	const sNoise = Math.sqrt(1 - ab);
	const s2 = DATA_STD * DATA_STD;
	const v = ab * s2 + (1 - ab);

	const logits = DATA_CENTERS.map((c) => {
		const dx = x[0] - a * c[0];
		const dy = x[1] - a * c[1];
		return -(dx * dx + dy * dy) / (2 * v);
	});
	const top = Math.max(...logits);
	const weights = logits.map((l) => Math.exp(l - top));
	const total = weights.reduce((s, w) => s + w, 0);

	let ex = 0;
	let ey = 0;
	DATA_CENTERS.forEach((c, k) => {
		const r = weights[k] / total;
		const gx = c[0] + ((a * s2) / v) * (x[0] - a * c[0]);
		const gy = c[1] + ((a * s2) / v) * (x[1] - a * c[1]);
		ex += r * gx;
		ey += r * gy;
	});
	return [(x[0] - a * ex) / sNoise, (x[1] - a * ey) / sNoise];
}

/**
 * One reverse (DDPM) step from x_t to x_{t-1}. `z` is a standard normal draw used for the
 * posterior noise; it is not used at t = 1, where the last step is deterministic.
 */
export function reverseStep(x: Point, t: number, z: Point): Point {
	const b = beta(t);
	const alpha = 1 - b;
	const ab = alphaBar(t);
	const abPrev = alphaBar(t - 1);
	const eps = predictNoise(x, t);
	const coef = b / Math.sqrt(1 - ab);
	const mx = (x[0] - coef * eps[0]) / Math.sqrt(alpha);
	const my = (x[1] - coef * eps[1]) / Math.sqrt(alpha);
	if (t <= 1) return [mx, my];
	const sd = Math.sqrt((b * (1 - abPrev)) / (1 - ab));
	return [mx + sd * z[0], my + sd * z[1]];
}

/** Standard normal start x_T for n points. */
export function initialNoise(n: number, rng: () => number): Point[] {
	const out: Point[] = [];
	for (let i = 0; i < n; i++) out.push(gaussPoint(rng));
	return out;
}

/** One reverse step for a whole cloud, drawing noise from rng in point order. */
export function reverseStepAll(xs: readonly Point[], t: number, rng: () => number): Point[] {
	return xs.map((p) => reverseStep(p, t, gaussPoint(rng)));
}

/** Full reverse chain from x_T to x_0 with a fixed seed. */
export function runReverse(n: number = N_POINTS, seed: number = SAMPLE_SEED): Point[] {
	const rng = mulberry32(seed);
	let xs = initialNoise(n, rng);
	for (let t = T; t >= 1; t--) xs = reverseStepAll(xs, t, rng);
	return xs;
}

/** SVG path of fn(t) over t in 0..T; values 0..1 map to the height (1 at the top). */
export function curvePath(
	fn: (t: number) => number,
	width: number,
	height: number,
	samples = 200,
): string {
	let d = '';
	for (let i = 0; i <= samples; i++) {
		const t = (T * i) / samples;
		const x = (t / T) * width;
		const y = (1 - fn(t)) * height;
		d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
	}
	return d;
}

/** Horizontal position of step t on a chart of the given width. */
export function plotX(t: number, width: number): number {
	return (t / T) * width;
}

/** Status line for screen readers in the forward mode. */
export function describeForward(t: number): string {
	const head = `Прямой процесс, шаг t = ${t}. Доля сигнала ${formatNumber(signalShare(t), 2)}, доля шума ${formatNumber(noiseShare(t), 2)}.`;
	return t === 0 ? `${head} Исходные данные без шума.` : head;
}

/** Status line for screen readers in the reverse mode. */
export function describeReverse(rt: number): string {
	if (rt <= 0) return 'Обратный процесс завершён: получены образцы на шаге t = 0.';
	return `Обратный процесс, шаг t = ${rt}. Осталось шагов: ${rt}.`;
}
