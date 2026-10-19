/**
 * Math of the anomaly-detection demo: a 2-D cloud, a distance score in units of spread,
 * a threshold chosen by the share of flagged points (contamination), confusion counts,
 * and the precision-recall curve. The cloud is fixed (seeded), so every page load shows
 * the same picture. Pure functions only: no DOM, no Svelte.
 */

export const N_NORMAL = 990;
export const N_ANOMALY = 10;
/** Half-width of the plotted square: coordinates live in [-DOMAIN, DOMAIN] on both axes. */
export const DOMAIN = 5.5;

export const GAMMA_MIN = 0.01;
export const GAMMA_MAX = 0.2;
export const GAMMA_STEP = 0.01;
export const GAMMA_DEFAULT = 0.01;

/** Keyboard step for moving an anomaly, in data units; with Shift the step is NUDGE_FAST. */
export const NUDGE = 0.1;
export const NUDGE_FAST = 0.5;

const SEED = 20240501;

export interface Point {
	x: number;
	y: number;
	/** Ground truth: true for an anomaly. It stays with the point when the point is moved. */
	anomaly: boolean;
}

export interface AnomalyDemoState {
	/** Share of points that the detector flags, in [GAMMA_MIN, GAMMA_MAX]. */
	gamma: number;
}

/** Small seeded PRNG (mulberry32): the same seed gives the same sequence on every platform. */
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

function gauss(rng: () => number): number {
	let u = 0;
	while (u === 0) u = rng();
	const v = rng();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function round2(v: number): number {
	return Math.round(v * 100) / 100;
}

/** Returns the point moved to (x, y), clamped to the plotted square; the label stays. */
export function movedTo(p: Point, x: number, y: number): Point {
	return { ...p, x: clampPoint(x), y: clampPoint(y) };
}

/** Clamps a coordinate to the plotted square. */
export function clampPoint(v: number): number {
	return Math.max(-DOMAIN, Math.min(DOMAIN, v));
}

/**
 * 990 normal points from a standard 2-D Gaussian plus 10 anomalies on a ring of radius
 * about 2.9 to 4.4, spread around the circle. Anomalies sit at the edge of the cloud, and
 * some normal points reach the same distance, so the threshold trades precision for recall.
 */
export function makeCloud(seed: number = SEED): Point[] {
	const rng = mulberry32(seed);
	const pts: Point[] = [];
	for (let i = 0; i < N_NORMAL; i++) {
		pts.push({ x: round2(gauss(rng)), y: round2(gauss(rng)), anomaly: false });
	}
	for (let i = 0; i < N_ANOMALY; i++) {
		const angle = (2 * Math.PI * i) / N_ANOMALY + (rng() - 0.5) * 0.4;
		const r = 2.9 + 1.5 * rng();
		pts.push({
			x: round2(clampPoint(r * Math.cos(angle))),
			y: round2(clampPoint(r * Math.sin(angle))),
			anomaly: true,
		});
	}
	return pts;
}

export interface Spread {
	mx: number;
	my: number;
	/** Standard deviation per axis; floored to avoid division by zero. */
	sx: number;
	sy: number;
}

/** Centre and spread of the current points (all of them, as the detector sees them). */
export function spread(points: readonly Point[]): Spread {
	const n = points.length || 1;
	let sumX = 0;
	let sumY = 0;
	for (const p of points) {
		sumX += p.x;
		sumY += p.y;
	}
	const mx = sumX / n;
	const my = sumY / n;
	let vx = 0;
	let vy = 0;
	for (const p of points) {
		vx += (p.x - mx) * (p.x - mx);
		vy += (p.y - my) * (p.y - my);
	}
	return {
		mx,
		my,
		sx: Math.max(Math.sqrt(vx / n), 1e-9),
		sy: Math.max(Math.sqrt(vy / n), 1e-9),
	};
}

/**
 * Anomaly score: distance from the centre in units of spread, the diagonal Mahalanobis
 * distance. Bigger means more unusual. Points on one ellipse have the same score.
 */
export function scores(points: readonly Point[]): number[] {
	const s = spread(points);
	return points.map((p) => Math.hypot((p.x - s.mx) / s.sx, (p.y - s.my) / s.sy));
}

/** Number of points to flag for a share gamma: at least one, rounded otherwise. */
export function flagCount(n: number, gamma: number): number {
	return Math.min(n, Math.max(1, Math.round(gamma * n)));
}

/** Indices sorted by score, most unusual first; ties keep the original order. */
export function rank(sc: readonly number[]): number[] {
	return sc.map((_, i) => i).sort((a, b) => (sc[b] ?? 0) - (sc[a] ?? 0) || a - b);
}

export interface Flagging {
	/** flags[i] is true when point i is flagged. */
	flags: boolean[];
	/** Score of the last flagged point: the threshold in units of spread. */
	tau: number;
}

/** Flags the k most unusual points. */
export function flagTop(sc: readonly number[], k: number): Flagging {
	const order = rank(sc);
	const flags = sc.map(() => false);
	order.slice(0, k).forEach((i) => {
		flags[i] = true;
	});
	const last = order[Math.min(k, order.length) - 1];
	const tau = last === undefined ? 0 : (sc[last] ?? 0);
	return { flags, tau };
}

export interface Confusion {
	tp: number;
	fp: number;
	fn: number;
	tn: number;
}

export function confusion(points: readonly Point[], flags: readonly boolean[]): Confusion {
	const c: Confusion = { tp: 0, fp: 0, fn: 0, tn: 0 };
	points.forEach((p, i) => {
		if (flags[i]) {
			if (p.anomaly) c.tp++;
			else c.fp++;
		} else if (p.anomaly) c.fn++;
		else c.tn++;
	});
	return c;
}

export interface Quality {
	/** Null when nothing is flagged. */
	precision: number | null;
	/** Null when there are no anomalies. */
	recall: number | null;
	accuracy: number;
	/** Accuracy of the trivial model that never flags anything. */
	baseline: number;
	/** Number of true anomalies. */
	positives: number;
}

export function quality(c: Confusion): Quality {
	const n = c.tp + c.fp + c.fn + c.tn;
	const positives = c.tp + c.fn;
	return {
		precision: c.tp + c.fp > 0 ? c.tp / (c.tp + c.fp) : null,
		recall: positives > 0 ? c.tp / positives : null,
		accuracy: n > 0 ? (c.tp + c.tn) / n : 0,
		baseline: n > 0 ? (n - positives) / n : 0,
		positives,
	};
}

export interface PrPoint {
	/** Number of flagged points at this threshold. */
	k: number;
	precision: number;
	recall: number;
}

/** Precision and recall for every threshold, from the most unusual point down. */
export function prCurve(points: readonly Point[], sc: readonly number[]): PrPoint[] {
	const order = rank(sc);
	const positives = points.reduce((s, p) => s + (p.anomaly ? 1 : 0), 0);
	const out: PrPoint[] = [];
	let tp = 0;
	order.forEach((idx, j) => {
		if (points[idx]?.anomaly) tp++;
		const k = j + 1;
		out.push({ k, precision: tp / k, recall: positives > 0 ? tp / positives : 0 });
	});
	return out;
}

/** Average precision: the sum of precision times the gain in recall. Also called PR AUC here. */
export function averagePrecision(curve: readonly PrPoint[]): number {
	let prevRecall = 0;
	let ap = 0;
	for (const p of curve) {
		ap += (p.recall - prevRecall) * p.precision;
		prevRecall = p.recall;
	}
	return ap;
}

/**
 * Precision from the base rate pi, the recall (TPR) and the false positive rate (FPR):
 * pi·TPR / (pi·TPR + (1 − pi)·FPR).
 */
export function precisionAt(pi: number, tpr: number, fpr: number): number {
	const found = pi * tpr;
	return found / (found + (1 - pi) * fpr);
}

export interface ChapterExample {
	/** 80 found and 495 false alarms among 10 000 objects with 1% anomalies. */
	precision: number;
	recall: number;
	accuracy: number;
	/** The same detector characteristics with 10% anomalies. */
	precisionCommon: number;
}

/** The worked example from the chapter text, computed rather than typed. */
export function chapterExample(): ChapterExample {
	const total = 10000;
	const anomalies = 100;
	const found = 80;
	const falseAlarms = 495;
	const trueNegatives = total - anomalies - falseAlarms;
	return {
		precision: found / (found + falseAlarms),
		recall: found / anomalies,
		accuracy: (found + trueNegatives) / total,
		precisionCommon: precisionAt(0.1, 0.8, 0.05),
	};
}

/** Formats a number with a decimal comma; null or non-finite gives an em dash. */
export function fmt(v: number | null, digits = 2): string {
	if (v === null || !Number.isFinite(v)) return '—';
	return v.toFixed(digits).replace('.', ',');
}

/** Rounds to 0.01 and clamps to the slider range. Non-finite input gives the default. */
export function snapGamma(g: number): number {
	if (!Number.isFinite(g)) return GAMMA_DEFAULT;
	const c = Math.max(GAMMA_MIN, Math.min(GAMMA_MAX, g));
	return Math.round(c * 100) / 100;
}

/** Text for the live region: the numbers of the current threshold. */
export function describeState(c: Confusion, q: Quality, k: number, n: number): string {
	const share = Math.round((k / n) * 100);
	return (
		`Помечено ${k} из ${n} точек (${share}%). Найдено ${c.tp} из ${q.positives} аномалий, ` +
		`ложных срабатываний ${c.fp}. Точность ${fmt(q.precision)}, полнота ${fmt(q.recall)}. ` +
		`Доля верных ответов ${fmt(q.accuracy * 100, 1)}%, у модели «всё норма» ${fmt(q.baseline * 100, 1)}%.`
	);
}
