/**
 * Math and sample data of the agent evaluation demo: pass@k and pass^k for one per-run success
 * probability p, and one fixed series of agent runs checked by binary path criteria.
 * Run i succeeds when its fixed draw is below p, so raising p only turns failures into successes.
 * Pure functions only: no DOM, no Svelte.
 */

export const K_MIN = 1;
export const K_MAX = 10;
export const K_DEFAULT = 3;
export const P_MIN = 0.5;
export const P_MAX = 0.99;
export const P_STEP = 0.01;
export const P_DEFAULT = 0.8;
/** Other probabilities drawn faintly in the chart next to the current one. */
export const P_PRESETS: readonly number[] = [0.5, 0.7, 0.9];
/** Runs in the fixed series. */
export const N_RUNS = 10;
/** Fixed draws of the series: run i succeeds when RUN_DRAWS[i] < p. */
export const RUN_DRAWS: readonly number[] = [
	0.62, 0.35, 0.91, 0.18, 0.74, 0.44, 0.07, 0.86, 0.29, 0.66,
];
/** Order id that the task needs. */
export const TRUE_ORDER = 'A-1047';

export type Metric = 'pass-at-k' | 'pass-hat-k';
export type Criterion = 'args' | 'order' | 'grounded';

export interface AgentEvalDemoState {
	/** Metric that the demo emphasises. */
	metric: Metric;
	/** Success probability of one run. */
	p: number;
	/** Number of runs. */
	k: number;
}

export function isMetric(v: unknown): v is Metric {
	return v === 'pass-at-k' || v === 'pass-hat-k';
}

/** Rounds to two decimals and clamps to the p slider range. Non-finite input gives the default. */
export function snapP(p: number): number {
	if (!Number.isFinite(p)) return P_DEFAULT;
	const c = Math.min(P_MAX, Math.max(P_MIN, p));
	return Math.round(c * 100) / 100;
}

/** Rounds to an integer and clamps to the k slider range. Non-finite input gives the default. */
export function snapK(k: number): number {
	if (!Number.isFinite(k)) return K_DEFAULT;
	return Math.min(K_MAX, Math.max(K_MIN, Math.round(k)));
}

/** Formats a number with a decimal comma, as in the chapter text. */
export function formatNum(v: number, digits = 3): string {
	return v.toFixed(digits).replace('.', ',');
}

/** pass@k = 1 - (1 - p)^k: at least one of k independent runs succeeds. */
export function passAtK(p: number, k: number): number {
	return 1 - (1 - p) ** k;
}

/** pass^k = p^k: all of k independent runs succeed. */
export function passHatK(p: number, k: number): number {
	return p ** k;
}

export function metricValue(metric: Metric, p: number, k: number): number {
	return metric === 'pass-at-k' ? passAtK(p, k) : passHatK(p, k);
}

/** Binomial coefficient C(n, k) for small integers; 0 when k is outside 0..n. */
export function binom(n: number, k: number): number {
	if (k < 0 || k > n) return 0;
	let r = 1;
	for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
	return r;
}

/**
 * Unbiased estimate of pass^k from n runs of one task with s successes:
 * the share of k-subsets of runs that all succeed, C(s, k) / C(n, k).
 */
export function passHatKEstimate(successes: number, runs: number, k: number): number {
	if (!Number.isInteger(runs) || runs < 1) throw new RangeError('runs must be a positive integer');
	if (!Number.isInteger(successes) || successes < 0 || successes > runs) {
		throw new RangeError('successes must be between 0 and runs');
	}
	if (!Number.isInteger(k) || k < 1 || k > runs)
		throw new RangeError('k must be between 1 and runs');
	return binom(successes, k) / binom(runs, k);
}

/** Points of one metric curve over k = K_MIN..K_MAX at a fixed p. */
export function curve(p: number, metric: Metric): { k: number; value: number }[] {
	const out: { k: number; value: number }[] = [];
	for (let k = K_MIN; k <= K_MAX; k++) out.push({ k, value: metricValue(metric, p, k) });
	return out;
}

/** One step of a trajectory: a tool call (or `answer`) and what came back. */
export interface Step {
	tool: string;
	args: Record<string, string>;
	observation: string;
}

export interface Trajectory {
	steps: Step[];
	answer: string;
	/** Facts the final answer relies on; each must appear in some observation. */
	claims: string[];
}

export interface Verdict {
	/** Result of each binary criterion. */
	checks: Record<Criterion, boolean>;
	/** True when all criteria pass. */
	success: boolean;
	/** Index of the earliest step that breaks a criterion, or null for a successful run. */
	issueStep: number | null;
	/** Consequence of the earliest failure, or null for a successful run. */
	reason: string | null;
}

export const CRITERION_LABEL: Record<Criterion, string> = {
	args: 'Аргументы инструмента верны',
	order: 'Порядок шагов верен',
	grounded: 'Ответ опирается на наблюдения',
};

const REASON: Record<Criterion, string> = {
	args: 'Неверный аргумент инструмента. Ответ может совпасть случайно, но путь уже не проверить.',
	order: 'Порядок нарушен: политику проверили раньше, чем нашли заказ.',
	grounded: 'В ответе есть факт, которого не было в наблюдениях инструментов.',
};

const GOOD: Trajectory = {
	steps: [
		{ tool: 'find_order', args: { id: TRUE_ORDER }, observation: 'статус: доставлен, 3 дня назад' },
		{ tool: 'check_policy', args: { order: TRUE_ORDER }, observation: 'срок возврата: 14 дней' },
		{ tool: 'answer', args: {}, observation: 'ответ отправлен' },
	],
	answer: 'Заказ доставлен, возврат возможен: срок 14 дней.',
	claims: ['доставлен', '14 дней'],
};

/** Right answer by luck: two calls with a wrong order id before the right one. */
const BAD_ARGS: Trajectory = {
	steps: [
		{ tool: 'find_order', args: { id: 'A-1074' }, observation: 'заказ не найден' },
		{ tool: 'find_order', args: { id: 'A-7410' }, observation: 'заказ не найден' },
		{ tool: 'find_order', args: { id: TRUE_ORDER }, observation: 'статус: доставлен, 3 дня назад' },
		{ tool: 'check_policy', args: { order: TRUE_ORDER }, observation: 'срок возврата: 14 дней' },
		{ tool: 'answer', args: {}, observation: 'ответ отправлен' },
	],
	answer: 'Заказ доставлен, возврат возможен: срок 14 дней.',
	claims: ['доставлен', '14 дней'],
};

/** Plausible answer with a fact that no tool returned. */
const BAD_CLAIM: Trajectory = {
	steps: GOOD.steps,
	answer: 'Заказ доставлен, возврат возможен: срок 30 дней.',
	claims: ['доставлен', '30 дней'],
};

/** Policy checked before the order was found; the answer then names a term nobody returned. */
const BAD_ORDER: Trajectory = {
	steps: [
		{ tool: 'check_policy', args: { order: '' }, observation: 'нужен номер заказа' },
		{ tool: 'find_order', args: { id: TRUE_ORDER }, observation: 'статус: доставлен, 3 дня назад' },
		{ tool: 'answer', args: {}, observation: 'ответ отправлен' },
	],
	answer: 'Заказ доставлен, возврат возможен: срок 14 дней.',
	claims: ['доставлен', '14 дней'],
};

const BAD: readonly Trajectory[] = [BAD_ARGS, BAD_CLAIM, BAD_ORDER];

/** Trajectory of a run: the good path on success, one of the faulty paths otherwise. */
export function trajectoryFor(success: boolean, index: number): Trajectory {
	if (success) return GOOD;
	return BAD[index % BAD.length] ?? BAD_ARGS;
}

/** Checks a trajectory by binary criteria: arguments, order of steps, and grounding of the answer. */
export function checkTrajectory(t: Trajectory): Verdict {
	const last = t.steps.length - 1;
	const argStep = t.steps.findIndex((s) => s.tool === 'find_order' && s.args.id !== TRUE_ORDER);
	const policyStep = t.steps.findIndex((s) => s.tool === 'check_policy');
	const findStep = t.steps.findIndex((s) => s.tool === 'find_order' && s.args.id === TRUE_ORDER);
	const orderOk = policyStep === -1 || (findStep !== -1 && findStep < policyStep);
	const groundedOk = t.claims.every((c) => t.steps.some((s) => s.observation.includes(c)));

	const checks: Record<Criterion, boolean> = {
		args: argStep === -1,
		order: orderOk,
		grounded: groundedOk,
	};
	const failing: { c: Criterion; step: number }[] = [];
	if (!checks.args) failing.push({ c: 'args', step: argStep });
	if (!checks.order) failing.push({ c: 'order', step: policyStep });
	if (!checks.grounded) failing.push({ c: 'grounded', step: last });

	// The earliest broken step is the cause; the consequence is the verdict.
	const earliest = [...failing].sort((a, b) => a.step - b.step)[0];
	if (earliest === undefined) {
		return { checks, success: true, issueStep: null, reason: null };
	}
	return { checks, success: false, issueStep: earliest.step, reason: REASON[earliest.c] };
}

export interface Run {
	index: number;
	draw: number;
	success: boolean;
	trajectory: Trajectory;
	verdict: Verdict;
}

/** The fixed series at a given p. Success follows the draw; the trajectory and verdict follow success. */
export function makeRuns(p: number, n: number = N_RUNS): Run[] {
	return RUN_DRAWS.slice(0, n).map((draw, index) => {
		const success = draw < p;
		const trajectory = trajectoryFor(success, index);
		return { index, draw, success, trajectory, verdict: checkTrajectory(trajectory) };
	});
}

export interface SampleSummary {
	/** Number of runs in the sample (the first k of the series). */
	k: number;
	successes: number;
	allSucceeded: boolean;
	anySucceeded: boolean;
}

/** Summary of the first k runs: the sample version of pass^k and pass@k for this task. */
export function sampleSummary(runs: readonly Run[], k: number): SampleSummary {
	const first = runs.slice(0, k);
	const successes = first.filter((r) => r.success).length;
	return {
		k: first.length,
		successes,
		allSucceeded: first.length > 0 && successes === first.length,
		anySucceeded: successes > 0,
	};
}
