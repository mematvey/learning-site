/**
 * Math of the LLM cost demo: cost per successful task under model routing and prefix caching.
 * Teaching prices in conventional units (у.е.) per million tokens, not a real price list.
 * Pure functions only: no DOM, no Svelte.
 */

/** Calls per task (an agent or chain step count). */
export const CALLS_PER_TASK = 3;
/** Input tokens per call. */
export const IN_TOKENS = 2000;
/** Output tokens per call. */
export const OUT_TOKENS = 500;
/** Price per million tokens of the expensive route. */
export const PRICE_HIGH = { input: 3, output: 15 } as const;
/** Price per million tokens of the cheap route. */
export const PRICE_LOW = { input: 0.6, output: 3 } as const;
/** Cost of a cached input token relative to a normal one (kappa). */
export const CACHE_FACTOR = 0.1;

export const ROUTE_STEP = 5;
export const CACHE_STEP = 5;
export const SUCCESS_MIN = 30;
export const SUCCESS_MAX = 100;
export const SUCCESS_STEP = 1;

export interface LlmCostDemoState {
	/** Share of tasks sent to the cheap route, percent. */
	routeShare: number;
	/** Share of input tokens served from the prefix cache, percent. */
	cacheShare: number;
	/** Success rate of the cheap route, percent. */
	successLow: number;
	/** Success rate of the expensive route, percent. */
	successHigh: number;
}

export const DEFAULT_STATE: LlmCostDemoState = {
	routeShare: 60,
	cacheShare: 0,
	successLow: 70,
	successHigh: 90,
};

export interface Price {
	input: number;
	output: number;
}

export interface CallCost {
	input: number;
	output: number;
	total: number;
}

export interface RouteCost {
	/** One call. */
	call: CallCost;
	/** One task: CALLS_PER_TASK calls, all attempts counted. */
	task: CallCost;
	/** Success rate, 0..1. */
	success: number;
}

export interface CostBreakdown {
	low: RouteCost;
	high: RouteCost;
	/** Success rate of the mix, 0..1. */
	success: number;
	/** Average cost of one task over all tasks (mixed by route share). */
	avg: CallCost;
	/** Cost per successful task. */
	perSuccess: CallCost;
	/** Spend on failed tasks, per successful task: perSuccess.total - avg.total. */
	failed: number;
	/** Reference: every task on the expensive route, same cache share. */
	reference: number;
	/** Saving against the reference, 0..1 (negative means more expensive). */
	saving: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

function snapTo(v: number, lo: number, hi: number, step: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	return clamp(Math.round(clamp(v, lo, hi) / step) * step, lo, hi);
}

/** Snaps the state to the slider grid. Missing or non-finite fields take the base value. */
export function normalizeState(
	patch: Partial<LlmCostDemoState>,
	base: LlmCostDemoState = DEFAULT_STATE,
): LlmCostDemoState {
	return {
		routeShare: snapTo(patch.routeShare ?? base.routeShare, 0, 100, ROUTE_STEP, base.routeShare),
		cacheShare: snapTo(patch.cacheShare ?? base.cacheShare, 0, 100, CACHE_STEP, base.cacheShare),
		successLow: snapTo(
			patch.successLow ?? base.successLow,
			SUCCESS_MIN,
			SUCCESS_MAX,
			SUCCESS_STEP,
			base.successLow,
		),
		successHigh: snapTo(
			patch.successHigh ?? base.successHigh,
			SUCCESS_MIN,
			SUCCESS_MAX,
			SUCCESS_STEP,
			base.successHigh,
		),
	};
}

/**
 * Cost of one call. Cached input tokens cost CACHE_FACTOR of the normal price;
 * output tokens are never cached. `cacheShare` is 0..1.
 */
export function callCost(price: Price, cacheShare: number): CallCost {
	const effectiveIn = IN_TOKENS * (1 - (1 - CACHE_FACTOR) * cacheShare);
	const input = (effectiveIn * price.input) / 1_000_000;
	const output = (OUT_TOKENS * price.output) / 1_000_000;
	return { input, output, total: input + output };
}

function routeCost(price: Price, cacheShare: number, success: number): RouteCost {
	const call = callCost(price, cacheShare);
	const task: CallCost = {
		input: CALLS_PER_TASK * call.input,
		output: CALLS_PER_TASK * call.output,
		total: CALLS_PER_TASK * call.total,
	};
	return { call, task, success };
}

/** Full cost model for the state: per route, mix, and cost per successful task. */
export function computeBreakdown(state: LlmCostDemoState): CostBreakdown {
	const q = state.routeShare / 100;
	const h = state.cacheShare / 100;
	const sLow = state.successLow / 100;
	const sHigh = state.successHigh / 100;

	const low = routeCost(PRICE_LOW, h, sLow);
	const high = routeCost(PRICE_HIGH, h, sHigh);

	const success = q * sLow + (1 - q) * sHigh;
	const avgInput = q * low.task.input + (1 - q) * high.task.input;
	const avgOutput = q * low.task.output + (1 - q) * high.task.output;
	const avg: CallCost = { input: avgInput, output: avgOutput, total: avgInput + avgOutput };

	const perSuccess: CallCost = {
		input: avgInput / success,
		output: avgOutput / success,
		total: avg.total / success,
	};
	const reference = high.task.total / sHigh;

	return {
		low,
		high,
		success,
		avg,
		perSuccess,
		failed: perSuccess.total - avg.total,
		reference,
		saving: 1 - perSuccess.total / reference,
	};
}

/** Money with 4 decimals, at least 3, comma as decimal separator: 0,027 and 0,0216. */
export function formatUnits(x: number): string {
	const [int, frac = ''] = x.toFixed(4).split('.');
	let f = frac.replace(/0+$/, '');
	while (f.length < 3) f += '0';
	return `${int},${f}`;
}

/** Ratio with 2 decimals and comma: 1,28. */
export function formatRatio(x: number): string {
	return x.toFixed(2).replace('.', ',');
}

/** Fraction 0..1 as a whole percent: 0.4 -> "40". */
export function percent(x: number): string {
	return String(Math.round(x * 100));
}

/**
 * Cause-and-effect lines for the current state. Each line names the input and what it does
 * to the result.
 */
export function describeBreakdown(state: LlmCostDemoState, b: CostBreakdown): string[] {
	const lines: string[] = [];
	const q = state.routeShare / 100;

	if (q === 0) {
		lines.push('Дешёвый маршрут не используется: все задачи идут в дорогую модель.');
	} else if (q === 1) {
		lines.push(
			`Все задачи идут в дешёвую модель: успешность ${state.successLow}% определяет цену результата.`,
		);
	} else {
		lines.push(
			`Доля дешёвого маршрута ${state.routeShare}%: средняя стоимость задачи ${formatUnits(b.avg.total)} у.е.`,
		);
	}

	lines.push(
		`Успешность ${percent(b.success)}%: на каждую успешную задачу оплачено ${formatRatio(1 / b.success)} задачи.`,
	);

	lines.push(
		`Кэш ${state.cacheShare}% входных токенов: вызов дорогой модели стоит ${formatUnits(b.high.call.total)} у.е. ` +
			`(без кэша ${formatUnits(callCost(PRICE_HIGH, 0).total)}). Выходные токены кэш не сокращает.`,
	);

	lines.push(
		`Неудачные задачи дают ${formatUnits(b.failed)} у.е. на каждую успешную: они оплачены, но результата не дали.`,
	);

	const label = b.saving >= 0 ? 'Экономия' : 'Перерасход';
	lines.push(
		`${label} относительно дорогой модели без маршрутизации (та же доля кэша): ${percent(Math.abs(b.saving))}%.`,
	);

	return lines;
}

/** One-sentence result for the live region. */
export function summarize(b: CostBreakdown): string {
	const label = b.saving >= 0 ? 'экономия' : 'перерасход';
	return (
		`Цена за успешную задачу ${formatUnits(b.perSuccess.total)} у.е. ` +
		`Дорогая модель без маршрутизации: ${formatUnits(b.reference)} у.е., ${label} ${percent(Math.abs(b.saving))}%.`
	);
}
