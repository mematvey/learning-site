/**
 * Math of the LLM apps demo: recall@k of a fixed retrieval ranking, input size as a function
 * of k, and the chooser between prompt, RAG, workflow and agent.
 * The ranking is fixed (deterministic), so every page load shows the same picture.
 * Pure functions only: no DOM, no Svelte.
 */

export const K_MIN = 1;
export const K_MAX = 20;
export const K_STEP = 1;
export const K_DEFAULT = 5;
/** Tokens of one retrieved fragment (t_f in the chapter). */
export const TOKENS_PER_CHUNK = 300;
/** Tokens of the prompt without fragments (t_p in the chapter). */
export const PROMPT_TOKENS = 500;
/** Number of relevant fragments for the demo question (|G| in the chapter). */
export const RELEVANT_TOTAL = 10;

/** Ranks (1-based) of the relevant fragments in the demo ranking. Two of them are never found in the top K_MAX. */
const RELEVANT_RANKS: readonly number[] = [1, 2, 4, 7, 9, 10, 12, 15];

/** `RANKING[i]` is true if the fragment at rank i + 1 is relevant. */
export const RANKING: readonly boolean[] = Array.from({ length: K_MAX }, (_, i) =>
	RELEVANT_RANKS.includes(i + 1),
);

/** Clamps k to [K_MIN, K_MAX] and rounds it. Non-finite input gives K_DEFAULT. */
export function snapK(k: number): number {
	if (!Number.isFinite(k)) return K_DEFAULT;
	return Math.min(K_MAX, Math.max(K_MIN, Math.round(k)));
}

/** Number of relevant fragments among the first k ranks. */
export function relevantInTopK(k: number): number {
	const kk = snapK(k);
	let found = 0;
	for (let i = 0; i < kk; i++) if (RANKING[i]) found++;
	return found;
}

/** Recall@k = |R_k ∩ G| / |G|, a value from 0 to 1. */
export function recallAtK(k: number): number {
	return relevantInTopK(k) / RELEVANT_TOTAL;
}

/** Recall@k for every k from K_MIN to K_MAX (index 0 is k = 1). */
export function recallCurve(): number[] {
	const out: number[] = [];
	for (let k = K_MIN; k <= K_MAX; k++) out.push(recallAtK(k));
	return out;
}

/** Input size in tokens: k · t_f + t_p. */
export function inputTokens(
	k: number,
	tokensPerChunk: number = TOKENS_PER_CHUNK,
	promptTokens: number = PROMPT_TOKENS,
): number {
	return snapK(k) * tokensPerChunk + promptTokens;
}

/** Recall as a string with a decimal comma, as in the chapter text (0,30). */
export function formatRecall(r: number): string {
	return r.toFixed(2).replace('.', ',');
}

/** Text of the status line under the controls. Numbers are computed, not typed. */
export function describeK(k: number): string {
	const kk = snapK(k);
	const found = relevantInTopK(kk);
	const missed = RELEVANT_TOTAL - found;
	const tail =
		kk >= K_MAX && missed > 0
			? ` В первых ${K_MAX} фрагментах нет ${missed} из ${RELEVANT_TOTAL} релевантных.`
			: '';
	return (
		`При k = ${kk} найдено ${found} из ${RELEVANT_TOTAL} релевантных фрагментов: ` +
		`recall@${kk} = ${formatRecall(recallAtK(kk))}. ` +
		`Вход ≈ ${inputTokens(kk)} токенов.` +
		tail
	);
}

/* Approach chooser */

export type Approach = 'prompt' | 'rag' | 'workflow' | 'agent';

export interface ChooserAnswers {
	/** The answer depends on facts outside the model that change often (documents, data). */
	externalFacts: boolean;
	/** The order of steps is known in advance (extract, check, answer). */
	stepsFixed: boolean;
	/** The model must pick the next step and tool itself, and the number of steps is not known. */
	modelPicksSteps: boolean;
	/** A wrong action cannot be undone (sending a message, a payment, a deletion). */
	irreversible: boolean;
}

export const NO_ANSWERS: ChooserAnswers = {
	externalFacts: false,
	stepsFixed: false,
	modelPicksSteps: false,
	irreversible: false,
};

export interface Choice {
	approach: Approach;
	title: string;
	/** Why this approach, one or two sentences. */
	reason: string;
	/** Extra warning, or null. */
	warning: string | null;
}

export const APPROACH_TITLE: Record<Approach, string> = {
	prompt: 'Промпт',
	rag: 'RAG',
	workflow: 'Workflow',
	agent: 'Агент',
};

/**
 * Picks the simplest approach that fits the answers. The model's freedom to choose steps
 * is checked first, because it is the expensive and hard-to-verify option.
 */
export function chooseApproach(a: ChooserAnswers): Choice {
	if (a.modelPicksSteps) {
		return {
			approach: 'agent',
			title: APPROACH_TITLE.agent,
			reason:
				'Модель сама выбирает шаги и инструменты. Цена, задержка и сложность проверки растут с каждым шагом.',
			warning: a.irreversible
				? 'Необратимые действия агент может выполнять только с подтверждением человека, даже если на тестах он работает.'
				: null,
		};
	}
	if (a.stepsFixed) {
		return {
			approach: 'workflow',
			title: APPROACH_TITLE.workflow,
			reason: a.externalFacts
				? 'Порядок шагов задан кодом. Поиск по документам можно поставить одним из шагов workflow.'
				: 'Порядок шагов задан кодом, модель участвует только в отдельных шагах.',
			warning: null,
		};
	}
	if (a.externalFacts) {
		return {
			approach: 'rag',
			title: APPROACH_TITLE.rag,
			reason:
				'Ответ опирается на факты вне модели, которые меняются чаще, чем её переобучают. Сначала измерьте recall@k поиска.',
			warning: null,
		};
	}
	return {
		approach: 'prompt',
		title: APPROACH_TITLE.prompt,
		reason:
			'Знаний модели и порядка действий достаточно: нужна инструкция и один вызов. Начните с промпта.',
		warning: null,
	};
}
