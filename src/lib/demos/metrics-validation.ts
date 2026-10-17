/**
 * Math of the metrics demo: fixed model scores for an imbalanced binary task, a classification
 * threshold, the confusion matrix, and the ROC and PR curves that sweep over all thresholds.
 * The scores are a fixed pseudo-random sample (seeded PRNG), so every page load shows the same points.
 * Pure functions only: no DOM, no Svelte.
 */
import { mulberry32 } from './attention';

export type Label = 0 | 1;

export interface Sample {
	/** Model score: estimated probability of the positive class, in (0, 1). */
	score: number;
	label: Label;
}

/** State of the demo: only the threshold is interactive. */
export interface MetricsDemoState {
	/** Predict positive when score >= threshold. */
	threshold: number;
	/** Target share of positives, from PREVALENCE_MIN to PREVALENCE_MAX. */
	prevalence: number;
}

export interface Confusion {
	tp: number;
	fp: number;
	tn: number;
	fn: number;
}

export interface Metrics {
	accuracy: number;
	precision: number;
	recall: number;
	f1: number;
	/** False positive rate: fp / (fp + tn). Also the x axis of the ROC curve. */
	fpr: number;
}

export interface CurvePoint {
	x: number;
	y: number;
}

export const SEED = 20241108;
/** 20% positives: a class imbalance, so accuracy alone misleads. */
export const N_POS = 40;
export const N_NEG = 160;
/** Centres of the score distributions in logit space, and their spread. */
const MU_POS = 1;
const MU_NEG = -1;
const SIGMA = 1.1;

export const THRESHOLD_MIN = 0.05;
export const THRESHOLD_MAX = 0.95;
export const THRESHOLD_STEP = 0.05;
export const DEFAULT_THRESHOLD = 0.5;

/** Share of positives the slider can set. The default sample has 20% (N_POS of N_POS + N_NEG). */
export const PREVALENCE_MIN = 0.01;
export const PREVALENCE_MAX = 0.2;
export const PREVALENCE_STEP = 0.01;
export const DEFAULT_PREVALENCE = 0.2;

/** Square chart side and inner padding, in px (the SVG viewBox). */
export const CHART_SIZE = 260;
export const CHART_PAD = 34;

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Standard normal N(0, 1) via Box-Muller on the given generator. */
function gauss(rand: () => number): number {
	let u = 0;
	while (u === 0) u = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Stable sigmoid: never computes exp of a large positive number. */
function sigmoid(z: number): number {
	if (z >= 0) return 1 / (1 + Math.exp(-z));
	const e = Math.exp(z);
	return e / (1 + e);
}

/** Division that gives 0 for an empty denominator (no predictions, no positives, and so on). */
function ratio(num: number, den: number): number {
	return den > 0 ? num / den : 0;
}

/** Rounds to the threshold slider step and clamps to its range. Non-finite input gives the default. */
export function snapThreshold(t: number): number {
	if (!Number.isFinite(t)) return DEFAULT_THRESHOLD;
	return Math.round(clamp(t, THRESHOLD_MIN, THRESHOLD_MAX) / THRESHOLD_STEP) * THRESHOLD_STEP;
}

/** Rounds to the prevalence slider step and clamps to its range. Non-finite input gives the default. */
export function snapPrevalence(p: number): number {
	if (!Number.isFinite(p)) return DEFAULT_PREVALENCE;
	const snapped = Math.round(clamp(p, PREVALENCE_MIN, PREVALENCE_MAX) / PREVALENCE_STEP);
	return Number((snapped * PREVALENCE_STEP).toFixed(2));
}

/**
 * Keeps all negatives and the first k positives so that the share of positives is close to `target`.
 * The score distributions do not change, so the ROC curve stays the same up to sampling noise,
 * while the PR curve moves down as the positive class gets rarer.
 */
export function withPrevalence(samples: readonly Sample[], target: number): Sample[] {
	const neg = samples.filter((s) => s.label === 0);
	const pos = samples.filter((s) => s.label === 1);
	const p = clamp(target, PREVALENCE_MIN, 0.99);
	const k = clamp(Math.round((p * neg.length) / (1 - p)), 1, pos.length);
	return [...pos.slice(0, k), ...neg];
}

/** Fixed sample of N_POS positives and N_NEG negatives with overlapping score distributions. */
export function makeSamples(seed: number = SEED): Sample[] {
	const rand = mulberry32(seed);
	const samples: Sample[] = [];
	for (let i = 0; i < N_POS; i++) {
		samples.push({ score: sigmoid(MU_POS + SIGMA * gauss(rand)), label: 1 });
	}
	for (let i = 0; i < N_NEG; i++) {
		samples.push({ score: sigmoid(MU_NEG + SIGMA * gauss(rand)), label: 0 });
	}
	return samples;
}

/** Share of positives in the sample. A model that always says negative has accuracy 1 - prevalence. */
export function prevalence(samples: readonly Sample[]): number {
	return ratio(samples.filter((s) => s.label === 1).length, samples.length);
}

/** Confusion matrix at one threshold: a sample is predicted positive when score >= threshold. */
export function confusion(samples: readonly Sample[], threshold: number): Confusion {
	const c: Confusion = { tp: 0, fp: 0, tn: 0, fn: 0 };
	for (const s of samples) {
		const predicted = s.score >= threshold;
		if (s.label === 1) {
			if (predicted) c.tp++;
			else c.fn++;
		} else if (predicted) {
			c.fp++;
		} else {
			c.tn++;
		}
	}
	return c;
}

/** Metrics of one confusion matrix. Empty denominators give 0. */
export function metrics(c: Confusion): Metrics {
	const n = c.tp + c.fp + c.tn + c.fn;
	const precision = ratio(c.tp, c.tp + c.fp);
	const recall = ratio(c.tp, c.tp + c.fn);
	return {
		accuracy: ratio(c.tp + c.tn, n),
		precision,
		recall,
		f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0,
		fpr: ratio(c.fp, c.fp + c.tn),
	};
}

/**
 * Confusion matrix for every distinct score, from the highest score down. Each step lowers the
 * threshold to that score, so all samples with it become positive at once (ties stay together).
 */
export function sweep(samples: readonly Sample[]): { threshold: number; c: Confusion }[] {
	const pos = samples.filter((s) => s.label === 1).length;
	const neg = samples.length - pos;
	const sorted = [...samples].sort((a, b) => b.score - a.score);
	const steps: { threshold: number; c: Confusion }[] = [];
	let tp = 0;
	let fp = 0;
	sorted.forEach((s, idx) => {
		if (s.label === 1) tp++;
		else fp++;
		// A step closes after the last sample that has this score (ties stay together).
		const next = sorted[idx + 1];
		if (next === undefined || next.score !== s.score) {
			steps.push({ threshold: s.score, c: { tp, fp, tn: neg - fp, fn: pos - tp } });
		}
	});
	return steps;
}

/** ROC curve (FPR, TPR) over all thresholds. Starts at (0, 0) and ends at (1, 1). */
export function rocCurve(samples: readonly Sample[]): CurvePoint[] {
	const points: CurvePoint[] = [{ x: 0, y: 0 }];
	for (const step of sweep(samples)) {
		const m = metrics(step.c);
		points.push({ x: m.fpr, y: m.recall });
	}
	return points;
}

/** Precision-recall curve (recall, precision) over all thresholds, from the highest score down. */
export function prCurve(samples: readonly Sample[]): CurvePoint[] {
	return sweep(samples).map((step) => {
		const m = metrics(step.c);
		return { x: m.recall, y: m.precision };
	});
}

/** ROC AUC by the trapezoid rule over the ROC curve. Independent of the threshold. */
export function rocAuc(samples: readonly Sample[]): number {
	const pts = rocCurve(samples);
	let area = 0;
	for (let i = 1; i < pts.length; i++) {
		const prev = pts[i - 1];
		const cur = pts[i];
		if (prev && cur) area += ((cur.x - prev.x) * (cur.y + prev.y)) / 2;
	}
	return area;
}

/** Pixel position of a curve point in the square chart. The y axis points up. */
export function toPixel(
	p: CurvePoint,
	size: number = CHART_SIZE,
	pad: number = CHART_PAD,
): { px: number; py: number } {
	const span = size - 2 * pad;
	return { px: pad + p.x * span, py: size - pad - p.y * span };
}

/** SVG path data for a polyline through the points. */
export function curvePath(
	points: readonly CurvePoint[],
	size: number = CHART_SIZE,
	pad: number = CHART_PAD,
): string {
	return points
		.map((p, i) => {
			const { px, py } = toPixel(p, size, pad);
			return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`;
		})
		.join(' ');
}

/** Plain-text summary of the state for screen readers (aria-live). */
export function describeState(c: Confusion, m: Metrics, threshold: number): string {
	const predictedPos = c.tp + c.fp;
	const positives = c.tp + c.fn;
	return (
		`Порог ${threshold.toFixed(2)}: помечено положительными ${predictedPos} из ${c.tp + c.fp + c.tn + c.fn}. ` +
		`Найдено ${c.tp} из ${positives} положительных, ложных срабатываний ${c.fp}. ` +
		`Точность ${m.precision.toFixed(2)}, полнота ${m.recall.toFixed(2)}, F1 ${m.f1.toFixed(2)}.`
	);
}
