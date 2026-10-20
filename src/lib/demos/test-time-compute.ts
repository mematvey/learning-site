/**
 * Math of the test-time compute demo: accuracy of majority voting and of best-of-N selection
 * as the number of samples N grows. Samples are assumed independent (see the chapter).
 * Pure functions only: no DOM, no Svelte.
 */

export const N_MAX = 64;
/** Accuracy of one sample for the voting curve, in percent. */
export const P_VOTE_DEFAULT = 60;
/** Accuracy of one sample for the best-of-N curve, in percent. */
export const P_BEST_DEFAULT = 10;
/** Verifier quality in percent: chance that the verifier picks a correct candidate when one exists. */
export const VERIFIER_DEFAULT = 100;
export const N_DEFAULT = 31;

export const PERCENT_MIN = 5;
export const PERCENT_MAX = 95;
export const VERIFIER_MIN = 50;

export type StepMode = 'one' | 'double';

export interface TtcDemoState {
	/** Number of samples per query, 1..64. */
	n: number;
	/** Per-sample accuracy for majority voting, percent. */
	pVote: number;
	/** Per-sample accuracy for best-of-N, percent. */
	pBest: number;
	/** Verifier quality for best-of-N, percent. 100 is the ideal verifier. */
	verifier: number;
	/** Slider step: every N, or only powers of two (doubling). */
	step: StepMode;
}

export const DEFAULT_STATE: TtcDemoState = {
	n: N_DEFAULT,
	pVote: P_VOTE_DEFAULT,
	pBest: P_BEST_DEFAULT,
	verifier: VERIFIER_DEFAULT,
	step: 'one',
};

export function isStepMode(v: unknown): v is StepMode {
	return v === 'one' || v === 'double';
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an integer and clamps; non-finite input gives `fallback`. */
function intIn(v: unknown, lo: number, hi: number, fallback: number): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
	return clamp(Math.round(v), lo, hi);
}

/** Values allowed on the N slider for the given step mode. */
export function allowedN(step: StepMode): number[] {
	const out: number[] = [];
	if (step === 'one') {
		for (let n = 1; n <= N_MAX; n++) out.push(n);
		return out;
	}
	for (let n = 1; n <= N_MAX; n *= 2) out.push(n);
	return out;
}

/** Nearest allowed N for the step mode (ties go to the smaller value). */
export function snapN(n: number, step: StepMode): number {
	const list = allowedN(step);
	let best = list[0] ?? 1;
	for (const candidate of list) {
		if (Math.abs(candidate - n) < Math.abs(best - n)) best = candidate;
	}
	return best;
}

/**
 * Builds a valid state from an arbitrary patch. Missing or invalid fields keep `base`.
 * The N value is snapped to the allowed values of the step mode.
 */
export function sanitize(
	patch: Partial<TtcDemoState> | undefined,
	base: TtcDemoState = DEFAULT_STATE,
): TtcDemoState {
	const p = patch ?? {};
	const step = isStepMode(p.step) ? p.step : base.step;
	const rawN = intIn(p.n, 1, N_MAX, base.n);
	return {
		step,
		n: snapN(rawN, step),
		pVote: intIn(p.pVote, PERCENT_MIN, PERCENT_MAX, base.pVote),
		pBest: intIn(p.pBest, PERCENT_MIN, PERCENT_MAX, base.pBest),
		verifier: intIn(p.verifier, VERIFIER_MIN, 100, base.verifier),
	};
}

/**
 * Probability that majority voting over n independent samples is correct, for a binary-like
 * answer: the vote is correct when more than half of the samples are correct.
 * For even n a tie counts as wrong (conservative; the chapter states the same rule).
 */
export function majorityAccuracy(n: number, p: number): number {
	let sum = 0;
	for (let k = Math.floor(n / 2) + 1; k <= n; k++) {
		sum += binomial(n, k) * p ** k * (1 - p) ** (n - k);
	}
	return clamp(sum, 0, 1);
}

/** C(n, k) for small n (n up to 64), computed multiplicatively to stay accurate. */
export function binomial(n: number, k: number): number {
	let r = 1;
	for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
	return r;
}

/**
 * Best-of-N with a verifier. With an ideal verifier (quality 1) the answer is correct when at
 * least one sample is correct: 1 - (1 - p)^n. A verifier of quality v picks a correct
 * candidate with probability v when one exists, so the result is v * (1 - (1 - p)^n).
 * This is a simplified model: it ignores correlated errors and verifier bias.
 */
export function bestOfNAccuracy(n: number, p: number, verifier = 1): number {
	return clamp(verifier * (1 - (1 - p) ** n), 0, 1);
}

export interface Curves {
	/** N values 1..N_MAX. */
	xs: number[];
	vote: number[];
	best: number[];
}

/** Both curves over the full range of N for the current parameters. */
export function curves(state: TtcDemoState): Curves {
	const xs: number[] = [];
	const vote: number[] = [];
	const best: number[] = [];
	for (let n = 1; n <= N_MAX; n++) {
		xs.push(n);
		vote.push(majorityAccuracy(n, state.pVote / 100));
		best.push(bestOfNAccuracy(n, state.pBest / 100, state.verifier / 100));
	}
	return { xs, vote, best };
}

/** Value of the current accuracy readouts. */
export interface Readouts {
	vote: number;
	best: number;
	/** Gain of both curves when N doubles (null when 2N is above N_MAX). */
	voteGainDouble: number | null;
	bestGainDouble: number | null;
}

export function readouts(state: TtcDemoState): Readouts {
	const n = state.n;
	const pv = state.pVote / 100;
	const pb = state.pBest / 100;
	const v = state.verifier / 100;
	const doubled = n * 2 <= N_MAX ? n * 2 : null;
	return {
		vote: majorityAccuracy(n, pv),
		best: bestOfNAccuracy(n, pb, v),
		voteGainDouble:
			doubled === null ? null : majorityAccuracy(doubled, pv) - majorityAccuracy(n, pv),
		bestGainDouble:
			doubled === null ? null : bestOfNAccuracy(doubled, pb, v) - bestOfNAccuracy(n, pb, v),
	};
}

/** Formats a value in [0, 1] with three decimals and a decimal comma, as in the chapter. */
export function fmt3(v: number): string {
	return v.toFixed(3).replace('.', ',');
}

/** Formats a percent value: 60 -> "60%". */
export function fmtPercent(v: number): string {
	return `${v}%`;
}

export interface Descriptions {
	vote: string;
	best: string;
	/** Cause and effect for the current parameters. */
	notice: string;
}

/**
 * Text under the chart. All numbers are computed from the state, not typed in.
 * The notice explains the cause of the current curve shape.
 */
export function describeState(state: TtcDemoState): Descriptions {
	const r = readouts(state);
	const tie = state.n % 2 === 0 ? ' При чётном N ничья считается ошибкой.' : '';
	const vote =
		`Голосование, p = ${fmtPercent(state.pVote)}: при N = ${state.n} точность ${fmt3(r.vote)}.` +
		tie;
	const best =
		`Выбор лучшего, p = ${fmtPercent(state.pBest)}, проверка ${fmtPercent(state.verifier)}: ` +
		`при N = ${state.n} точность ${fmt3(r.best)}.`;

	const parts: string[] = [];
	if (state.pVote > 50) {
		parts.push('Голосование: верных выборок чаще половины, поэтому точность растёт с N.');
	} else if (state.pVote < 50) {
		parts.push(
			'Голосование: при p < 1/2 верных выборок меньше половины, и с ростом N точность падает.',
		);
	} else {
		parts.push('Голосование при p = 1/2 не меняет точность с ростом N.');
	}
	if (r.bestGainDouble === null) {
		parts.push(`N = ${state.n} уже максимальный на шкале; стоимость растёт линейно по N.`);
	} else {
		parts.push(
			`Удвоение N с ${state.n} до ${state.n * 2} даёт прирост ${fmt3(r.bestGainDouble)} у выбора лучшего ` +
				`и ${fmt3(r.voteGainDouble ?? 0)} у голосования, при удвоении стоимости.`,
		);
	}
	if (state.verifier < 100) {
		parts.push(
			`Проверка верна в ${fmtPercent(state.verifier)} случаев: точность выбора не выше ${fmtPercent(state.verifier)}.`,
		);
	}
	return { vote, best, notice: parts.join(' ') };
}

/** Linear map of N to a pixel x inside [pad, width - pad]. */
export function xPixel(n: number, width: number, pad: number): number {
	const span = Math.max(1, width - 2 * pad);
	return pad + ((n - 1) / (N_MAX - 1)) * span;
}

/** Linear map of an accuracy in [0, 1] to a pixel y (1 at the top). */
export function yPixel(v: number, height: number, pad: number): number {
	const span = Math.max(1, height - 2 * pad);
	return pad + (1 - v) * span;
}

/** Polyline points string for SVG from curve values. */
export function polyline(
	values: readonly number[],
	width: number,
	height: number,
	pad: number,
): string {
	return values
		.map((v, i) => `${xPixel(i + 1, width, pad).toFixed(1)},${yPixel(v, height, pad).toFixed(1)}`)
		.join(' ');
}
