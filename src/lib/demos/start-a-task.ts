/**
 * Planner for a new ML task: answers about the task go in, an ordered work plan comes out.
 * The order of steps is fixed by the chapter text: metric, split, baseline, model, checks.
 * Answers only change the content of the steps, never their order.
 */

export type DataKind = 'tabular' | 'timeseries';
export type TaskKind = 'classification' | 'regression';
export type TimeBudget = 'days' | 'weeks' | 'months';
export type DataSize = 'small' | 'medium' | 'large';

export interface StartTaskAnswers {
	data: DataKind;
	task: TaskKind;
	/** Cost of a false alarm (predicted positive, actually negative). Positive integer. */
	costFP: number;
	/** Cost of a miss (predicted negative, actually positive). Positive integer. */
	costFN: number;
	time: TimeBudget;
	size: DataSize;
}

export type StepId = 'metric' | 'split' | 'baseline' | 'model' | 'checks';

export interface PlanStep {
	id: StepId;
	title: string;
	text: string;
	/** Chapter ids of the Classic ML course to read for this step. */
	refs: string[];
	/** True when the step decides the outcome more than the model does. */
	main: boolean;
}

export interface StartTaskPlan {
	steps: PlanStep[];
	/** Decision threshold p > costFP / (costFP + costFN) for classification, null for regression. */
	threshold: number | null;
	/** True when one error costs at least three times more than the other. */
	asymmetric: boolean;
}

export const STEP_ORDER: readonly StepId[] = ['metric', 'split', 'baseline', 'model', 'checks'];

export const COST_MIN = 1;
export const COST_MAX = 1000;

export const DEFAULT_ANSWERS: StartTaskAnswers = {
	data: 'tabular',
	task: 'classification',
	costFP: 1,
	costFN: 1,
	time: 'weeks',
	size: 'medium',
};

/** Ratio of the larger cost to the smaller one from which errors count as asymmetric. */
const ASYMMETRY_RATIO = 3;

const DATA_KINDS: readonly DataKind[] = ['tabular', 'timeseries'];
const TASK_KINDS: readonly TaskKind[] = ['classification', 'regression'];
const TIME_BUDGETS: readonly TimeBudget[] = ['days', 'weeks', 'months'];
const DATA_SIZES: readonly DataSize[] = ['small', 'medium', 'large'];

/** Clamps a cost to an integer in [COST_MIN, COST_MAX]; non-numbers fall back to 1. */
export function clampCost(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return COST_MIN;
	return Math.min(COST_MAX, Math.max(COST_MIN, Math.round(value)));
}

/** Keeps only known enum values and clamps costs, so any input produces a valid plan. */
export function sanitizeAnswers(input: Partial<StartTaskAnswers> | undefined): StartTaskAnswers {
	const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
		allowed.includes(value as T) ? (value as T) : fallback;
	return {
		data: pick(input?.data, DATA_KINDS, DEFAULT_ANSWERS.data),
		task: pick(input?.task, TASK_KINDS, DEFAULT_ANSWERS.task),
		costFP: clampCost(input?.costFP ?? DEFAULT_ANSWERS.costFP),
		costFN: clampCost(input?.costFN ?? DEFAULT_ANSWERS.costFN),
		time: pick(input?.time, TIME_BUDGETS, DEFAULT_ANSWERS.time),
		size: pick(input?.size, DATA_SIZES, DEFAULT_ANSWERS.size),
	};
}

/** Decision threshold from the chapter: the object is positive when p > cFP / (cFP + cFN). */
export function decisionThreshold(costFP: number, costFN: number): number {
	return costFP / (costFP + costFN);
}

/** True when the larger cost is at least ASYMMETRY_RATIO times the smaller one. */
export function isAsymmetric(costFP: number, costFN: number): boolean {
	const hi = Math.max(costFP, costFN);
	const lo = Math.min(costFP, costFN);
	return hi >= lo * ASYMMETRY_RATIO;
}

/** Formats a threshold as a percentage with one decimal place, using a comma as in Russian text. */
export function formatPercent(p: number): string {
	return `${(p * 100).toFixed(1).replace('.', ',')}%`;
}

function metricStep(a: StartTaskAnswers, asym: boolean): PlanStep {
	if (a.task === 'regression') {
		const text = asym
			? 'Ошибки разной цены: метрика должна отражать большие промахи, например RMSE, и смотреть на знак ошибки.'
			: 'Ошибки примерно одной цены: MAE проще объяснить, RMSE сильнее реагирует на большие промахи.';
		return {
			id: 'metric',
			title: 'Метрика по цене ошибки',
			text,
			refs: ['classic-ml/metrics-validation'],
			main: asym,
		};
	}
	if (asym) {
		const threshold = decisionThreshold(a.costFP, a.costFN);
		const missIsCostlier = a.costFN > a.costFP;
		const focus = missIsCostlier
			? 'Пропуск дороже: смотрите на полноту (recall).'
			: 'Ложная тревога дороже: смотрите на точность (precision).';
		return {
			id: 'metric',
			title: 'Метрика и порог по цене ошибки',
			text: `${focus} Порог решения ставится на p = ${formatPercent(threshold)}, а не на 50%. Accuracy здесь не подходит как главная метрика.`,
			refs: ['classic-ml/metrics-validation', 'classic-ml/calibration-imbalance'],
			main: true,
		};
	}
	return {
		id: 'metric',
		title: 'Метрика по цене ошибки',
		text: 'Ошибки одинаково дороги: порог 50% и сбалансированная метрика, например F1 или accuracy, если классы примерно равны по размеру.',
		refs: ['classic-ml/metrics-validation'],
		main: false,
	};
}

function splitStep(a: StartTaskAnswers): PlanStep {
	if (a.data === 'timeseries') {
		return {
			id: 'split',
			title: 'Разбиение по времени',
			text: 'Обучение на прошлом, тест на более позднем периоде. Случайное разбиение пустит будущее в обучение. Разбиение делается до любой обработки.',
			refs: ['classic-ml/time-series-validation', 'classic-ml/data-preparation'],
			main: false,
		};
	}
	const sizeNote =
		a.size === 'small'
			? ' Данных мало: тестовая часть будет небольшой, оценка шумная, поэтому сравнивайте модели с запасом на разброс.'
			: '';
	return {
		id: 'split',
		title: 'Разбиение до обработки',
		text: `Случайное разбиение, для классификации со стратификацией по классам. Тестовая часть откладывается до масштабирования и заполнения пропусков.${sizeNote}`,
		refs: ['classic-ml/data-preparation', 'classic-ml/metrics-validation'],
		main: false,
	};
}

function baselineStep(a: StartTaskAnswers): PlanStep {
	const text =
		a.task === 'classification'
			? 'Константный прогноз: самый частый класс из обучения. На редком классе его полнота равна 0, а точность может быть высокой. Модель должна побить baseline по полноте редкого класса на той же тестовой части.'
			: 'Константный прогноз: среднее или медиана из обучения. Для любой константы R² на тестовой части не выше нуля, поэтому модель должна дать больший R² и побить baseline по выбранной метрике на той же тестовой части.';
	return {
		id: 'baseline',
		title: 'Baseline',
		text,
		refs: ['classic-ml/metrics-validation', 'classic-ml/linear-regression'],
		main: false,
	};
}

function modelStep(a: StartTaskAnswers): PlanStep {
	const first = a.task === 'classification' ? 'логистическая регрессия' : 'линейная регрессия';
	const timeNote =
		a.time === 'days'
			? ' Времени мало: остановитесь на первой линейной модели, если она побивает baseline.'
			: a.time === 'weeks'
				? ' Времени хватит на одно-два семейства моделей, например деревья и бустинг.'
				: ' Времени достаточно, чтобы сравнить несколько семейств моделей.';
	return {
		id: 'model',
		title: 'Модель',
		text: `Начните с простой модели: ${first}. Препроцессинг храните в Pipeline, чтобы он учился только на обучающей части.${timeNote}`,
		refs: [
			a.task === 'classification'
				? 'classic-ml/logistic-regression'
				: 'classic-ml/linear-regression',
			'classic-ml/tabular-vs-neural',
		],
		main: false,
	};
}

function checksStep(a: StartTaskAnswers): PlanStep {
	const reuse =
		'Тестовую часть не используйте для выбора моделей: многократные сравнения на ней завышают оценку.';
	const timeNote =
		a.data === 'timeseries'
			? ' Проверьте, что признаки строятся только по прошлому.'
			: ' Проверьте, что ни один признак не вычислен по всей выборке.';
	return {
		id: 'checks',
		title: 'Проверки',
		text: `${reuse}${timeNote} После обучения проверьте разброс оценки и калибровку вероятностей.`,
		refs: [
			'classic-ml/bias-variance',
			'classic-ml/calibration-imbalance',
			'classic-ml/interpretability',
		],
		main: false,
	};
}

/** Builds the plan for given answers. Steps are always returned in STEP_ORDER. */
export function buildPlan(input: Partial<StartTaskAnswers> | undefined): StartTaskPlan {
	const a = sanitizeAnswers(input);
	const asym = isAsymmetric(a.costFP, a.costFN);
	const steps: PlanStep[] = [
		metricStep(a, asym),
		splitStep(a),
		baselineStep(a),
		modelStep(a),
		checksStep(a),
	];
	return {
		steps,
		threshold: a.task === 'classification' ? decisionThreshold(a.costFP, a.costFN) : null,
		asymmetric: asym,
	};
}
