/**
 * Math of the Bayes demo: a diagnostic test described by prevalence, sensitivity and specificity.
 * Slider values are percents; the functions take and return the same units unless noted.
 * Counts are per POPULATION people (a 100-person frequency box).
 * Pure functions only: no DOM, no Svelte.
 */

/** Size of the frequency box: the demo shows 100 people. */
export const POPULATION = 100;

export const PREV_MIN = 0.5;
export const PREV_MAX = 50;
export const PREV_STEP = 0.5;
export const PREV_DEFAULT = 1;

export const SENS_MIN = 50;
export const SENS_MAX = 100;
export const SENS_STEP = 1;
export const SENS_DEFAULT = 90;

export const SPEC_MIN = 50;
export const SPEC_MAX = 100;
export const SPEC_STEP = 1;
export const SPEC_DEFAULT = 90;

export interface BayesDemoState {
	/** Share of sick people in the population, in percent (prior P(H) × 100). */
	prevalence: number;
	/** Share of sick people with a positive test, in percent. */
	sensitivity: number;
	/** Share of healthy people with a negative test, in percent. */
	specificity: number;
}

export const DEFAULT_STATE: Readonly<BayesDemoState> = Object.freeze({
	prevalence: PREV_DEFAULT,
	sensitivity: SENS_DEFAULT,
	specificity: SPEC_DEFAULT,
});

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Clamps to [lo, hi], rounds to the step, and returns `fallback` for non-finite input. */
function snapTo(v: number, lo: number, hi: number, step: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	const snapped = Math.round(clamp(v, lo, hi) / step) * step;
	// Round to one decimal to drop float noise such as 0.30000000000000004.
	return Math.round(clamp(snapped, lo, hi) * 10) / 10;
}

export function snapPrevalence(v: number): number {
	return snapTo(v, PREV_MIN, PREV_MAX, PREV_STEP, PREV_DEFAULT);
}

export function snapSensitivity(v: number): number {
	return snapTo(v, SENS_MIN, SENS_MAX, SENS_STEP, SENS_DEFAULT);
}

export function snapSpecificity(v: number): number {
	return snapTo(v, SPEC_MIN, SPEC_MAX, SPEC_STEP, SPEC_DEFAULT);
}

export interface BayesResult {
	/** Prior P(H): share of sick people, in [0, 1]. */
	prior: number;
	/** Total probability of a positive test P(+), in [0, 1]. */
	pPositive: number;
	/** Posterior P(H | +): probability of illness after a positive test. */
	posterior: number;
	/** Posterior P(H | -): probability of illness after a negative test. */
	posteriorNegative: number;
	/**
	 * Posterior after a second independent positive test: the first posterior serves as the prior.
	 * Assumes the two results are independent given the health status.
	 */
	posteriorTwoPositives: number;
	/** Head counts (people out of POPULATION) of the four groups. */
	people: {
		sick: number;
		healthy: number;
		positive: number;
		truePositive: number;
		falseNegative: number;
		falsePositive: number;
		trueNegative: number;
	};
}

/**
 * Bayes' theorem for a binary test: P(H | +) = P(+ | H) P(H) / P(+),
 * where P(+) = P(+ | H) P(H) + P(+ | not H) P(not H) (law of total probability).
 * Returns 0 for a posterior whose denominator is zero, so the function never yields NaN.
 */
export function computeBayes(state: BayesDemoState): BayesResult {
	const prior = state.prevalence / 100;
	const sens = state.sensitivity / 100;
	const spec = state.specificity / 100;

	const truePositive = prior * sens;
	const falseNegative = prior * (1 - sens);
	const falsePositive = (1 - prior) * (1 - spec);
	const trueNegative = (1 - prior) * spec;

	const pPositive = truePositive + falsePositive;
	const pNegative = falseNegative + trueNegative;

	const posterior = pPositive > 0 ? truePositive / pPositive : 0;
	const secondEvidence = posterior * sens + (1 - posterior) * (1 - spec);
	return {
		prior,
		pPositive,
		posterior,
		posteriorTwoPositives: secondEvidence > 0 ? (posterior * sens) / secondEvidence : 0,
		posteriorNegative: pNegative > 0 ? falseNegative / pNegative : 0,
		people: {
			sick: prior * POPULATION,
			healthy: (1 - prior) * POPULATION,
			positive: pPositive * POPULATION,
			truePositive: truePositive * POPULATION,
			falseNegative: falseNegative * POPULATION,
			falsePositive: falsePositive * POPULATION,
			trueNegative: trueNegative * POPULATION,
		},
	};
}

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface MosaicRects {
	truePositive: Rect;
	falseNegative: Rect;
	falsePositive: Rect;
	trueNegative: Rect;
}

/**
 * Frequency box as an area chart: the width of a column is the share of the group
 * (sick on the left, healthy on the right), the height inside it is the share of the test result.
 * The area of each rectangle is proportional to the group's share of the population.
 */
export function mosaicRects(state: BayesDemoState, width: number, height: number): MosaicRects {
	const sickWidth = (state.prevalence / 100) * width;
	const healthyWidth = width - sickWidth;
	const sensHeight = (state.sensitivity / 100) * height;
	const fpHeight = (1 - state.specificity / 100) * height;

	return {
		truePositive: { x: 0, y: 0, width: sickWidth, height: sensHeight },
		falseNegative: { x: 0, y: sensHeight, width: sickWidth, height: height - sensHeight },
		falsePositive: { x: sickWidth, y: 0, width: healthyWidth, height: fpHeight },
		trueNegative: { x: sickWidth, y: fpHeight, width: healthyWidth, height: height - fpHeight },
	};
}

/**
 * Bar of the positive results only: its left part is the sick people with a positive test,
 * its right part is the healthy people with a positive test. Returns the width of the left part.
 */
export function positiveSplitWidth(state: BayesDemoState, width: number): number {
	const r = computeBayes(state);
	return r.posterior * width;
}

export function formatPercent(p: number, digits = 1): string {
	return `${(p * 100).toFixed(digits)}%`;
}

export function formatCount(n: number): string {
	return n.toFixed(1);
}

/** One-sentence description of the state, for the aria-live region. */
export function describeBayes(state: BayesDemoState): string {
	const r = computeBayes(state);
	return (
		`Распространённость ${state.prevalence.toFixed(1)}%, чувствительность ${state.sensitivity.toFixed(0)}%, ` +
		`специфичность ${state.specificity.toFixed(0)}%. Из ${POPULATION} человек больны ${formatCount(r.people.sick)}, ` +
		`тест положителен у ${formatCount(r.people.positive)}, из них больны ${formatCount(r.people.truePositive)}. ` +
		`Вероятность болезни при положительном тесте ${formatPercent(r.posterior)}.`
	);
}
