/**
 * Math of the evaluation demo: two model versions measured on one evaluation set.
 * Normal-approximation intervals for an accuracy, and paired vs unpaired intervals for the difference.
 * The default state is the expected composition of the set (no randomness), so the numbers match the chapter.
 * Other sets are drawn with a seeded PRNG: the same seed always gives the same set.
 * Pure functions only: no DOM, no Svelte.
 */

export const N_MIN = 100;
export const N_MAX = 1000;
export const N_STEP = 50;
export const N_DEFAULT = 100;

/** Two-sided 95 % normal quantile. */
export const Z95 = 1.96;

/**
 * Population of requests: the share of examples that both models solve, only A solves, only B solves.
 * The rest (neither solves) is 1 minus the sum. Gives accuracy 0.80 for A and 0.76 for B.
 */
export const POP_BOTH = 0.73;
export const POP_ONLY_A = 0.07;
export const POP_ONLY_B = 0.03;

export const ACC_DOMAIN: readonly [number, number] = [0.5, 1];
export const DIFF_DOMAIN: readonly [number, number] = [-0.3, 0.3];

export interface EvaluationDemoState {
	/** Size of the evaluation set. */
	n: number;
	/** null: the expected composition of the set; a number: a set drawn with this seed. */
	seed: number | null;
}

/** Outcome of the two models on each example of the set. */
export interface EvalCounts {
	n: number;
	/** Both models are right. */
	both: number;
	/** Only model A is right (b in the chapter). */
	onlyA: number;
	/** Only model B is right (c in the chapter). */
	onlyB: number;
	/** Both are wrong. */
	neither: number;
}

export interface EvalSummary {
	accA: number;
	accB: number;
	/** accA − accB, equal to (onlyA − onlyB) / n. */
	diff: number;
	seA: number;
	seB: number;
	/** Standard error of the difference when the examples are paired. */
	pairedSe: number;
	/** Standard error of the difference when the two sets are treated as independent. */
	unpairedSe: number;
	ciA: [number, number];
	ciB: [number, number];
	pairedCi: [number, number];
	unpairedCi: [number, number];
	/** |diff| / pairedSe. */
	ratio: number;
}

export type Verdict = 'includesZero' | 'aBetter' | 'bBetter';

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to the nearest step of N_STEP inside [N_MIN, N_MAX]. Non-finite input gives N_DEFAULT. */
export function snapN(n: number): number {
	if (!Number.isFinite(n)) return N_DEFAULT;
	return clamp(Math.round(n / N_STEP) * N_STEP, N_MIN, N_MAX);
}

/** Seeds are non-negative integers. null stays null (the expected set). */
export function snapSeed(seed: number | null): number | null {
	if (seed === null || !Number.isFinite(seed)) return null;
	return Math.max(0, Math.floor(seed));
}

/** mulberry32: a small seeded PRNG that returns floats in [0, 1). */
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

/** The expected composition of a set of size n for the population above. */
export function expectedCounts(n: number): EvalCounts {
	const both = Math.round(POP_BOTH * n);
	const onlyA = Math.round(POP_ONLY_A * n);
	const onlyB = Math.round(POP_ONLY_B * n);
	return { n, both, onlyA, onlyB, neither: n - both - onlyA - onlyB };
}

/** Draws a set of size n from the population with a seeded PRNG. Deterministic for a given seed. */
export function sampleCounts(n: number, seed: number): EvalCounts {
	const rnd = mulberry32(seed);
	let both = 0;
	let onlyA = 0;
	let onlyB = 0;
	let neither = 0;
	for (let i = 0; i < n; i++) {
		const u = rnd();
		if (u < POP_BOTH) both++;
		else if (u < POP_BOTH + POP_ONLY_A) onlyA++;
		else if (u < POP_BOTH + POP_ONLY_A + POP_ONLY_B) onlyB++;
		else neither++;
	}
	return { n, both, onlyA, onlyB, neither };
}

/** Standard error of an accuracy p on n examples: sqrt(p (1 − p) / n). */
export function accuracySe(p: number, n: number): number {
	return Math.sqrt((p * (1 - p)) / n);
}

/** Normal-approximation interval for an accuracy, clipped to [0, 1]. */
export function accuracyCi(p: number, n: number): [number, number] {
	const h = Z95 * accuracySe(p, n);
	return [clamp(p - h, 0, 1), clamp(p + h, 0, 1)];
}

/**
 * Standard error of the difference of accuracies on paired examples:
 * sqrt((b + c) − (b − c)² / n) / n. Only the discordant pairs (b, c) carry information.
 */
export function pairedSe(onlyA: number, onlyB: number, n: number): number {
	const inside = onlyA + onlyB - ((onlyA - onlyB) * (onlyA - onlyB)) / n;
	return Math.sqrt(Math.max(0, inside)) / n;
}

/** Standard error of the difference when the two accuracies come from independent sets. */
export function unpairedSe(pA: number, pB: number, n: number): number {
	return Math.sqrt((pA * (1 - pA)) / n + (pB * (1 - pB)) / n);
}

/** Full summary of the two models on one set. */
export function summarize(c: EvalCounts): EvalSummary {
	const n = Math.max(1, c.n);
	const accA = (c.both + c.onlyA) / n;
	const accB = (c.both + c.onlyB) / n;
	const diff = accA - accB;
	const pSe = pairedSe(c.onlyA, c.onlyB, n);
	const uSe = unpairedSe(accA, accB, n);
	const hp = Z95 * pSe;
	const hu = Z95 * uSe;
	return {
		accA,
		accB,
		diff,
		seA: accuracySe(accA, n),
		seB: accuracySe(accB, n),
		pairedSe: pSe,
		unpairedSe: uSe,
		ciA: accuracyCi(accA, n),
		ciB: accuracyCi(accB, n),
		pairedCi: [diff - hp, diff + hp],
		unpairedCi: [diff - hu, diff + hu],
		ratio: pSe > 0 ? Math.abs(diff) / pSe : 0,
	};
}

/** Whether the paired interval of the difference contains zero, or lies on one side. */
export function verdictOf(s: EvalSummary): Verdict {
	const [lo, hi] = s.pairedCi;
	if (lo > 0) return 'aBetter';
	if (hi < 0) return 'bBetter';
	return 'includesZero';
}

/** Two intervals overlap when neither lies fully to one side of the other. */
export function intervalsOverlap(
	a: readonly [number, number],
	b: readonly [number, number],
): boolean {
	return a[0] <= b[1] && b[0] <= a[1];
}

/** Linear map of a value from [lo, hi] to pixels [x0, x1], clamped to the domain. */
export function scaleX(
	v: number,
	domain: readonly [number, number],
	x0: number,
	x1: number,
): number {
	const [lo, hi] = domain;
	const t = (clamp(v, lo, hi) - lo) / (hi - lo);
	return x0 + t * (x1 - x0);
}

/** Formats a number with a decimal comma and a true minus sign, as in Russian text. */
export function fmt(v: number, digits = 2): string {
	return v.toFixed(digits).replace('.', ',').replace('-', '−');
}

/** Text of the status line under the charts (aria-live). Numbers are computed, not typed. */
export function describeState(c: EvalCounts, s: EvalSummary): string {
	const [lo, hi] = s.pairedCi;
	const overlap = intervalsOverlap(s.ciA, s.ciB)
		? 'Интервалы точностей перекрываются.'
		: 'Интервалы точностей не перекрываются.';
	const verdict =
		verdictOf(s) === 'includesZero'
			? 'Парный интервал разницы включает ноль: на этом наборе различие не доказано.'
			: verdictOf(s) === 'aBetter'
				? 'Парный интервал разницы лежит выше нуля: модель A лучше на этом наборе.'
				: 'Парный интервал разницы лежит ниже нуля: модель B лучше на этом наборе.';
	return (
		`Набор из ${c.n} примеров. Модель A: точность ${fmt(s.accA)} ` +
		`(95 %: ${fmt(s.ciA[0])}–${fmt(s.ciA[1])}), модель B: ${fmt(s.accB)} ` +
		`(${fmt(s.ciB[0])}–${fmt(s.ciB[1])}). ${overlap} ` +
		`Разница A − B = ${fmt(s.diff)}, парный 95 % интервал от ${fmt(lo)} до ${fmt(hi)}. ${verdict}`
	);
}
