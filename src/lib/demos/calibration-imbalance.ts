/**
 * Math of the calibration demo: a synthetic classifier with a controllable overconfidence,
 * reliability bins, expected calibration error (ECE), Platt scaling, isotonic regression and
 * a decision threshold from a cost matrix. Everything is seeded, so every page load shows the
 * same picture. Pure functions only: no DOM, no Svelte.
 */

export const N = 2000;
export const SEED = 7;
export const BINS = 10;
/** Spread of the true logit around the base rate. */
const SPREAD = 1.5;

export const PREV_MIN = 0.02;
export const PREV_MAX = 0.5;
export const PREV_STEP = 0.01;
export const DEFAULT_PREV = 0.2;

export const OVER_MIN = 0;
export const OVER_MAX = 1;
export const OVER_STEP = 0.05;
export const DEFAULT_OVER = 0.5;

/** Cost of a missed positive, in units of the false-alarm cost (which is fixed at 1). */
export const COST_MIN = 1;
export const COST_MAX = 100;
export const COST_STEP = 1;
export const DEFAULT_COST = 50;

export type CalMethod = 'none' | 'platt' | 'isotonic';

export interface CalibrationDemoState {
	/** Base rate of positives: the centre of the true logit distribution. */
	prevalence: number;
	/** 0 gives a calibrated raw score; 1 pushes the raw score towards the edges. */
	overconfidence: number;
	/** Cost of a missed positive (false negative); a false alarm costs 1. */
	costFn: number;
	/** Which calibration is applied before the threshold is chosen. */
	method: CalMethod;
}

export const DEFAULT_STATE: CalibrationDemoState = {
	prevalence: DEFAULT_PREV,
	overconfidence: DEFAULT_OVER,
	costFn: DEFAULT_COST,
	method: 'platt',
};

export function isCalMethod(v: unknown): v is CalMethod {
	return v === 'none' || v === 'platt' || v === 'isotonic';
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

function snapStep(v: number, lo: number, hi: number, step: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	const snapped = Math.round(clamp(v, lo, hi) / step) * step;
	return Math.round(snapped * 1000) / 1000;
}

export function snapPrevalence(v: number): number {
	return snapStep(v, PREV_MIN, PREV_MAX, PREV_STEP, DEFAULT_PREV);
}

export function snapOverconfidence(v: number): number {
	return snapStep(v, OVER_MIN, OVER_MAX, OVER_STEP, DEFAULT_OVER);
}

export function snapCost(v: number): number {
	return snapStep(v, COST_MIN, COST_MAX, COST_STEP, DEFAULT_COST);
}

export function sigmoid(z: number): number {
	return 1 / (1 + Math.exp(-z));
}

/** Logit with the input clamped away from 0 and 1, so the result is finite. */
export function logit(p: number): number {
	const q = clamp(p, 1e-6, 1 - 1e-6);
	return Math.log(q / (1 - q));
}

/** Mulberry32: a small seeded PRNG returning numbers in [0, 1). */
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

export interface Noise {
	/** Standard normal draws: the latent position of each object. */
	z: number[];
	/** Uniform draws: the label is positive when u is below the true probability. */
	u: number[];
}

/** Fixed noise shared by all slider positions, so moving a slider changes the transform, not the draw. */
export function makeNoise(seed: number = SEED, n: number = N): Noise {
	const rng = mulberry32(seed);
	const z: number[] = [];
	const u: number[] = [];
	for (let i = 0; i < n; i++) {
		const u1 = Math.max(rng(), 1e-12);
		const u2 = rng();
		z.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
		u.push(rng());
	}
	return { z, u };
}

const NOISE = makeNoise();

export interface Sample {
	/** Raw model score in (0, 1). */
	raw: number[];
	/** True label, 0 or 1. */
	y: number[];
}

/**
 * True probability is sigmoid(l) with l = logit(prevalence) + SPREAD * z. The raw score is
 * sigmoid(k * l) with k = 1 + 2 * overconfidence: k = 1 gives a calibrated model, larger k
 * pushes the score towards 0 and 1 without changing the labels.
 */
export function makeSample(
	state: Pick<CalibrationDemoState, 'prevalence' | 'overconfidence'>,
	noise: Noise = NOISE,
): Sample {
	const a = logit(state.prevalence);
	const k = 1 + 2 * state.overconfidence;
	const raw: number[] = [];
	const y: number[] = [];
	for (let i = 0; i < noise.z.length; i++) {
		const l = a + SPREAD * (noise.z[i] ?? 0);
		const q = sigmoid(l);
		y.push((noise.u[i] ?? 0) < q ? 1 : 0);
		raw.push(sigmoid(k * l));
	}
	return { raw, y };
}

/** Platt scaling: p = sigmoid(a * logit(s) + b), fitted by Newton's method on log-loss. */
export interface Platt {
	a: number;
	b: number;
}

export function fitPlatt(xs: readonly number[], ys: readonly number[], iters = 50): Platt {
	const loss = (a: number, b: number): number => {
		let s = 0;
		for (let i = 0; i < xs.length; i++) {
			const x = xs[i] ?? 0;
			const y = ys[i] ?? 0;
			const p = clamp(sigmoid(a * x + b), 1e-12, 1 - 1e-12);
			s -= y * Math.log(p) + (1 - y) * Math.log(1 - p);
		}
		return s;
	};
	let a = 1;
	let b = 0;
	for (let it = 0; it < iters; it++) {
		let ga = 0;
		let gb = 0;
		let haa = 1e-9;
		let hab = 0;
		let hbb = 1e-9;
		for (let i = 0; i < xs.length; i++) {
			const x = xs[i] ?? 0;
			const y = ys[i] ?? 0;
			const p = sigmoid(a * x + b);
			const g = p - y;
			const w = p * (1 - p);
			ga += g * x;
			gb += g;
			haa += w * x * x;
			hab += w * x;
			hbb += w;
		}
		const det = haa * hbb - hab * hab;
		if (!(det > 1e-12)) break;
		const da = (hbb * ga - hab * gb) / det;
		const db = (haa * gb - hab * ga) / det;
		// Backtracking: halve the Newton step until the log-loss goes down.
		const current = loss(a, b);
		let step = 1;
		let moved = false;
		for (let k = 0; k < 30; k++) {
			const na = a - step * da;
			const nb = b - step * db;
			if (loss(na, nb) <= current) {
				a = na;
				b = nb;
				moved = true;
				break;
			}
			step /= 2;
		}
		if (!moved) break;
	}
	return { a, b };
}

export function plattPredict(p: Platt, s: number): number {
	return sigmoid(p.a * logit(s) + p.b);
}

/** Isotonic regression as a step function: knots are the left ends of the pooled blocks. */
export interface Isotonic {
	knots: number[];
	values: number[];
}

/** Pool adjacent violators: the least-squares non-decreasing fit to the labels. */
export function fitIsotonic(xs: readonly number[], ys: readonly number[]): Isotonic {
	const order = xs.map((_, i) => i).sort((i, j) => (xs[i] ?? 0) - (xs[j] ?? 0));
	const blocks: { sum: number; w: number; start: number }[] = [];
	for (const i of order) {
		blocks.push({ sum: ys[i] ?? 0, w: 1, start: xs[i] ?? 0 });
		while (blocks.length > 1) {
			const last = blocks[blocks.length - 1];
			const prev = blocks[blocks.length - 2];
			if (!last || !prev) break;
			if (prev.sum / prev.w <= last.sum / last.w) break;
			blocks.pop();
			prev.sum += last.sum;
			prev.w += last.w;
		}
	}
	return {
		knots: blocks.map((b) => b.start),
		values: blocks.map((b) => b.sum / b.w),
	};
}

export function isotonicPredict(iso: Isotonic, s: number): number {
	const { knots, values } = iso;
	const first = knots[0];
	if (first === undefined) return s;
	if (s < first) return values[0] ?? s;
	let lo = 0;
	let hi = knots.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if ((knots[mid] ?? Infinity) <= s) lo = mid;
		else hi = mid - 1;
	}
	return values[lo] ?? s;
}

/** A group of objects: how many there are, their mean predicted probability and the share of positives. */
export interface Group {
	count: number;
	/** Mean predicted probability (confidence). */
	conf: number;
	/** Share of positives (accuracy in the binary case). */
	acc: number;
}

/** Splits predictions into equal-width bins on [0, 1] and returns the non-empty ones. */
export function binGroups(pred: readonly number[], y: readonly number[], bins = BINS): Group[] {
	const sums = Array.from({ length: bins }, () => ({ n: 0, p: 0, pos: 0 }));
	for (let i = 0; i < pred.length; i++) {
		const p = pred[i] ?? 0;
		const cell = sums[Math.min(bins - 1, Math.max(0, Math.floor(p * bins)))];
		if (!cell) continue;
		cell.n += 1;
		cell.p += p;
		cell.pos += y[i] ?? 0;
	}
	const out: Group[] = [];
	for (const s of sums) {
		if (s.n === 0) continue;
		out.push({ count: s.n, conf: s.p / s.n, acc: s.pos / s.n });
	}
	return out;
}

/** ECE = sum over groups of (n_m / n) * |acc - conf|. */
export function expectedCalibrationError(groups: readonly Group[]): number {
	const n = groups.reduce((s, g) => s + g.count, 0);
	if (n === 0) return 0;
	return groups.reduce((s, g) => s + (g.count / n) * Math.abs(g.acc - g.conf), 0);
}

/** Threshold that minimises the expected cost for calibrated probabilities: cFP / (cFP + cFN). */
export function costThreshold(costFp: number, costFn: number): number {
	return costFp / (costFp + costFn);
}

/** Probability after giving the positive class weight w: w p / (w p + 1 - p). */
export function weightedProbability(p: number, w: number): number {
	return (w * p) / (w * p + 1 - p);
}

export interface Decision {
	/** Objects answered "positive". */
	flagged: number;
	/** Positives answered "positive". */
	caught: number;
	/** Positives answered "negative". */
	missed: number;
	/** Negatives answered "positive". */
	falseAlarms: number;
	/** Total cost: falseAlarms * 1 + missed * costFn. */
	cost: number;
}

/** Answers "positive" when the probability is above the threshold and sums the cost. */
export function decide(
	probs: readonly number[],
	y: readonly number[],
	t: number,
	costFn: number,
): Decision {
	const d: Decision = { flagged: 0, caught: 0, missed: 0, falseAlarms: 0, cost: 0 };
	for (let i = 0; i < probs.length; i++) {
		const pos = (probs[i] ?? 0) > t;
		const label = y[i] ?? 0;
		if (pos) d.flagged += 1;
		if (pos && label === 1) d.caught += 1;
		if (!pos && label === 1) d.missed += 1;
		if (pos && label === 0) d.falseAlarms += 1;
	}
	d.cost = d.falseAlarms + d.missed * costFn;
	return d;
}

export interface DemoResult {
	/** Share of positives in the evaluation half. */
	positiveShare: number;
	platt: Platt;
	/** Reliability groups of the raw scores on the evaluation half. */
	before: Group[];
	/** Reliability groups after the chosen calibration; null when calibration is off. */
	after: Group[] | null;
	eceBefore: number;
	eceAfter: number | null;
	/** Threshold cFP / (cFP + cFN). */
	threshold: number;
	/** Decisions at the cost threshold, with the probabilities that the chosen method gives. */
	atThreshold: Decision;
	/** Decisions at the usual threshold 0.5. */
	atHalf: Decision;
	/** Number of objects in the evaluation half. */
	evalSize: number;
}

/**
 * Full demo computation. Even indices fit the calibrators, odd indices are the evaluation half,
 * so the calibrator never sees the data it is judged on.
 */
export function computeDemo(state: CalibrationDemoState, noise: Noise = NOISE): DemoResult {
	const { raw, y } = makeSample(state, noise);
	const fitRaw: number[] = [];
	const fitY: number[] = [];
	const evalRaw: number[] = [];
	const evalY: number[] = [];
	for (let i = 0; i < raw.length; i++) {
		const s = raw[i] ?? 0;
		const label = y[i] ?? 0;
		if (i % 2 === 0) {
			fitRaw.push(s);
			fitY.push(label);
		} else {
			evalRaw.push(s);
			evalY.push(label);
		}
	}

	const platt = fitPlatt(fitRaw.map(logit), fitY);
	const iso = fitIsotonic(fitRaw, fitY);

	const before = binGroups(evalRaw, evalY);
	const eceBefore = expectedCalibrationError(before);

	let probs = evalRaw;
	let after: Group[] | null = null;
	let eceAfter: number | null = null;
	if (state.method === 'platt') {
		probs = evalRaw.map((s) => plattPredict(platt, s));
	} else if (state.method === 'isotonic') {
		probs = evalRaw.map((s) => isotonicPredict(iso, s));
	}
	if (state.method !== 'none') {
		after = binGroups(probs, evalY);
		eceAfter = expectedCalibrationError(after);
	}

	const threshold = costThreshold(1, state.costFn);
	const positives = evalY.reduce((s, v) => s + v, 0);
	return {
		positiveShare: positives / evalY.length,
		platt,
		before,
		after,
		eceBefore,
		eceAfter,
		threshold,
		atThreshold: decide(probs, evalY, threshold, state.costFn),
		atHalf: decide(probs, evalY, 0.5, state.costFn),
		evalSize: evalY.length,
	};
}
