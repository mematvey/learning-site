/**
 * Agent loop simulator for the `mlops/agents-runtime` chapter.
 * The loop mirrors the chapter's `run_agent` sketch: model call, budget check, answer or tool call,
 * observation, and a step limit as the last exit. The model is a fixed script, so every run is
 * deterministic. Pure functions only: no DOM, no Svelte.
 */

export const MAX_STEPS_MIN = 1;
export const MAX_STEPS_MAX = 6;
export const DEFAULT_MAX_STEPS = 5;

export const BUDGET_MIN = 300;
export const BUDGET_MAX = 2000;
export const BUDGET_STEP = 100;
export const DEFAULT_BUDGET = 2000;

export type Decision = 'none' | 'approve' | 'reject';

export interface ScriptStep {
	/** Tool name, or null for the final answer. */
	tool: string | null;
	/** Tokens of the model reply on this step. Only reply tokens count toward the budget, as in the chapter. */
	tokens: number;
	/** Irreversible actions wait for a human decision when confirmation is on. */
	irreversible: boolean;
	/** Observation text returned by the tool. */
	result: string;
}

/** Scripted model replies for the task "delivery status and refund". */
export const SCRIPT: readonly ScriptStep[] = [
	{
		tool: 'track_order',
		tokens: 450,
		irreversible: false,
		result: 'заказ в пути, доставка завтра',
	},
	{
		tool: 'check_policy',
		tokens: 520,
		irreversible: false,
		result: 'возврат возможен в течение 14 дней',
	},
	{ tool: 'refund', tokens: 610, irreversible: true, result: 'возврат 1 200 ₽ оформлен' },
	{ tool: null, tokens: 380, irreversible: false, result: '' },
];

export const ANSWER_DONE = 'Возврат оформлен, деньги придут в течение 5 дней.';
export const ANSWER_REJECTED = 'Возврат не оформлен: человек отклонил действие.';

export interface LoopOptions {
	maxSteps: number;
	budget: number;
	/** Pause before irreversible actions and wait for a human decision. */
	confirm: boolean;
	/** Human decision for the pending irreversible action. Used only when `confirm` is on. */
	decision: Decision;
}

export type LoopEvent =
	| {
			kind: 'model';
			step: number;
			tokens: number;
			/** Tokens counted so far, including this reply. */
			used: number;
			action: 'tool' | 'answer';
			tool: string | null;
	  }
	| { kind: 'approval'; step: number; tool: string }
	| { kind: 'tool'; step: number; tool: string; result: string; executed: boolean }
	| { kind: 'answer'; step: number; text: string }
	| { kind: 'stop'; step: number; reason: 'budget' | 'max_steps' };

export type StopReason = 'answer' | 'budget' | 'max_steps' | 'approval';

export interface LoopTrace {
	events: LoopEvent[];
	reason: StopReason;
	/** Model tokens used in total. */
	used: number;
	/** Model calls made. */
	steps: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an integer step count within the slider range. Non-finite input gives the default. */
export function snapMaxSteps(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_MAX_STEPS;
	return clamp(Math.round(n), MAX_STEPS_MIN, MAX_STEPS_MAX);
}

/** Snaps the budget to the slider grid. Non-finite input gives the default. */
export function snapBudget(b: number): number {
	if (!Number.isFinite(b)) return DEFAULT_BUDGET;
	return clamp(Math.round(b / BUDGET_STEP) * BUDGET_STEP, BUDGET_MIN, BUDGET_MAX);
}

export function isDecision(v: unknown): v is Decision {
	return v === 'none' || v === 'approve' || v === 'reject';
}

/** Runs the loop over the scripted replies and returns every event in order. */
export function simulate(opts: LoopOptions): LoopTrace {
	const maxSteps = snapMaxSteps(opts.maxSteps);
	const budget = snapBudget(opts.budget);
	const events: LoopEvent[] = [];
	let used = 0;
	let steps = 0;
	let refundRejected = false;

	const finish = (reason: StopReason): LoopTrace => ({ events, reason, used, steps });

	for (let i = 0; i < maxSteps; i++) {
		const script = SCRIPT[i];
		if (!script) break;
		const step = i + 1;
		steps = step;
		used += script.tokens;
		events.push({
			kind: 'model',
			step,
			tokens: script.tokens,
			used,
			action: script.tool === null ? 'answer' : 'tool',
			tool: script.tool,
		});

		// Budget check comes before the action, as in the chapter's sketch.
		if (used > budget) {
			events.push({ kind: 'stop', step, reason: 'budget' });
			return finish('budget');
		}

		if (script.tool === null) {
			events.push({
				kind: 'answer',
				step,
				text: refundRejected ? ANSWER_REJECTED : ANSWER_DONE,
			});
			return finish('answer');
		}

		if (script.irreversible && opts.confirm) {
			if (opts.decision === 'none') {
				events.push({ kind: 'approval', step, tool: script.tool });
				return finish('approval');
			}
			if (opts.decision === 'reject') {
				refundRejected = true;
				events.push({
					kind: 'tool',
					step,
					tool: script.tool,
					result: 'не выполнен: отклонено человеком',
					executed: false,
				});
				continue;
			}
		}

		events.push({
			kind: 'tool',
			step,
			tool: script.tool,
			result: script.result,
			executed: true,
		});
	}

	events.push({ kind: 'stop', step: maxSteps, reason: 'max_steps' });
	return finish('max_steps');
}

/** Russian text for one event: used for the status line and the log. */
export function describeEvent(ev: LoopEvent): string {
	switch (ev.kind) {
		case 'model':
			return ev.action === 'answer'
				? `Шаг ${ev.step}: модель пишет ответ (${ev.tokens} токенов). Всего ${ev.used}.`
				: `Шаг ${ev.step}: модель выбирает инструмент ${ev.tool} (${ev.tokens} токенов). Всего ${ev.used}.`;
		case 'approval':
			return `Шаг ${ev.step}: действие ${ev.tool} необратимо. Агент ждёт решения человека.`;
		case 'tool':
			return ev.executed
				? `Шаг ${ev.step}: инструмент ${ev.tool} выполнен, наблюдение: ${ev.result}.`
				: `Шаг ${ev.step}: инструмент ${ev.tool} ${ev.result}.`;
		case 'answer':
			return `Шаг ${ev.step}: ответ. ${ev.text}`;
		case 'stop':
			return ev.reason === 'budget'
				? `Остановка на шаге ${ev.step}: бюджет токенов исчерпан, ответа нет.`
				: `Остановка на шаге ${ev.step}: лимит шагов исчерпан, ответа нет.`;
	}
}

/** Which box of the loop an event lights up. */
export function stageOf(ev: LoopEvent): 'model' | 'tool' | 'human' | 'end' {
	switch (ev.kind) {
		case 'model':
			return 'model';
		case 'approval':
			return 'human';
		case 'tool':
			return 'tool';
		case 'answer':
		case 'stop':
			return 'end';
	}
}
