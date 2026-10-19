/**
 * Rules of the model chooser demo for tabular tasks (chapter classic-ml/tabular-vs-neural).
 * These are orientation rules, not laws: they follow the observations in the chapter
 * and do not replace a comparison on the user's own data.
 * Pure functions only: no DOM, no Svelte.
 */

/** Row counts the rows slider can take. 2 000 is the default, 200 000 switches the answer to boosting. */
export const ROW_STEPS = [
	300, 1000, 2000, 5000, 10000, 30000, 100000, 200000, 500000, 1000000,
] as const;
export const DEFAULT_ROW_INDEX = 2;

/** Upper bound of the row range from the Nature paper on TabPFN (about 10 thousand rows). */
export const SMALL_ROWS = 10000;
/** Upper bound of the row range claimed in the TabPFN-2.5 report. Above it, boosting is the default. */
export const LARGE_ROWS = 100000;

/** Share of uninformative features (percent) at which trees are preferred: "half of the columns mean nothing". */
export const NOISE_THRESHOLD = 50;
export const NOISE_MIN = 0;
export const NOISE_MAX = 90;
export const NOISE_STEP = 10;

/** Latency levels: 0 = any (the answer can wait), 1 = seconds, 2 = milliseconds (strict). */
export const LATENCY_LABELS = [
	'любая: ответ можно ждать',
	'секунды',
	'миллисекунды: жёсткая задержка',
] as const;

export interface ChooserState {
	/** Index into ROW_STEPS. */
	rowIndex: number;
	/** true: the input is raw text or images, not a table. */
	raw: boolean;
	/** true: every decision of the model must be explained. */
	interpret: boolean;
	/** Index into LATENCY_LABELS. */
	latency: 0 | 1 | 2;
	/** Share of uninformative features in percent (NOISE_MIN..NOISE_MAX, step NOISE_STEP). */
	noise: number;
}

export const DEFAULT_STATE: ChooserState = {
	rowIndex: DEFAULT_ROW_INDEX,
	raw: false,
	interpret: false,
	latency: 0,
	noise: 0,
};

export type RecommendationKind = 'nn-pretrained' | 'explainable' | 'boosting' | 'tabpfn';

export interface Recommendation {
	kind: RecommendationKind;
	title: string;
	/** Reasons in the order they were checked, most important first. */
	reasons: string[];
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

function finiteOr(v: unknown, fallback: number): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Number of rows for a slider index. Out-of-range or non-finite indices are clamped to the default. */
export function rowsOf(index: number): number {
	const i = Number.isFinite(index) ? Math.round(index) : DEFAULT_ROW_INDEX;
	return ROW_STEPS[clamp(i, 0, ROW_STEPS.length - 1)] ?? ROW_STEPS[DEFAULT_ROW_INDEX];
}

/** Clamps every field to its allowed range; missing or invalid fields take the default value. */
export function normalizeState(input: Partial<ChooserState> = {}): ChooserState {
	const rowIndex = clamp(
		Math.round(finiteOr(input.rowIndex, DEFAULT_ROW_INDEX)),
		0,
		ROW_STEPS.length - 1,
	);
	const latencyRaw = Math.round(finiteOr(input.latency, 0));
	const latency = clamp(latencyRaw, 0, 2) as 0 | 1 | 2;
	const noiseRaw = Math.round(finiteOr(input.noise, 0) / NOISE_STEP) * NOISE_STEP;
	return {
		rowIndex,
		raw: input.raw === true,
		interpret: input.interpret === true,
		latency,
		noise: clamp(noiseRaw, NOISE_MIN, NOISE_MAX),
	};
}

/**
 * Chooses an approach. Checks run in this order:
 * 1. raw text or images: a table model is not the question, a pretrained neural network is.
 * 2. the decisions must be explained: a linear model or a tree, boosting with explanations.
 * 3. many uninformative features: trees.
 * 4. more than 100 thousand rows: boosting, the report's range is exceeded.
 * 5. up to 10 thousand rows and no strict latency: a tabular foundation model as a candidate.
 * 6. otherwise (10 to 100 thousand rows, or strict latency): boosting.
 */
export function recommend(input: Partial<ChooserState> = {}): Recommendation {
	const s = normalizeState(input);
	const rows = rowsOf(s.rowIndex);
	const strict = s.latency === 2;

	if (s.raw) {
		return {
			kind: 'nn-pretrained',
			title: 'Нейросеть с предобучением',
			reasons: [
				'Вход это сырой текст или изображения, а не таблица признаков.',
				'На таких данных нейросети с предобучением обычно выигрывают у моделей над признаками.',
				'Бустинг по признакам, извлечённым из текста или картинки, остаётся простым базовым вариантом для сравнения.',
			],
		};
	}

	if (s.interpret) {
		return {
			kind: 'explainable',
			title: 'Линейная модель или бустинг с объяснениями',
			reasons: [
				'Нужно объяснить каждое решение модели.',
				'Начните с линейной модели или дерева ограниченной глубины: их решения легко читать.',
				'Затем проверьте бустинг с объяснениями по важности признаков. Табличную foundation-модель стоит проверить на качество, но её решения сложнее объяснить.',
			],
		};
	}

	if (s.noise >= NOISE_THRESHOLD) {
		return {
			kind: 'boosting',
			title: 'Градиентный бустинг',
			reasons: [
				`Около ${s.noise}% признаков ничего не значат.`,
				'Нейросеть тратит ёмкость и обучение на нерелевантные столбцы, а деревья выбирают признаки сами.',
				'Резкие пороги в данных тоже лучше передают деревья.',
			],
		};
	}

	if (rows > LARGE_ROWS) {
		return {
			kind: 'boosting',
			title: 'Градиентный бустинг',
			reasons: [
				`Строк ${formatRows(rows)}: это выше границы в 100 тысяч из отчёта TabPFN-2.5.`,
				'Для таких выборок бустинг остаётся надёжным выбором по умолчанию. Нейросеть можно проверить, если она даёт выигрыш на ваших данных.',
			],
		};
	}

	if (rows <= SMALL_ROWS && !strict) {
		return {
			kind: 'tabpfn',
			title: 'Табличная foundation-модель как кандидат',
			reasons: [
				`Строк ${formatRows(rows)}: это в пределах около 10 тысяч строк, на которых оценивали TabPFN в статье Nature.`,
				'Сравните её с настроенным бустингом на тех же фолдах: результаты на чужих данных не гарантированы.',
				'Время и память предсказания растут с размером обучающей выборки: их нужно измерить на своём оборудовании.',
			],
		};
	}

	const reasons: string[] = [];
	if (strict) {
		reasons.push(
			'Нужна миллисекундная задержка: предсказание табличной foundation-модели растёт с размером обучающей выборки.',
		);
	}
	if (rows > SMALL_ROWS) {
		reasons.push(
			`Строк ${formatRows(rows)}: больше 10 тысяч, на которых оценивали TabPFN в статье Nature.`,
		);
	}
	reasons.push('Бустинг надёжен на таких таблицах и быстр в обучении на одной машине.');
	return { kind: 'boosting', title: 'Градиентный бустинг', reasons };
}

/** Formats a row count with spaces as thousands separators, for example 200 000. */
export function formatRows(n: number): string {
	return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Short text for the live region: the result and the answers it depends on. */
export function describeChoice(input: Partial<ChooserState> = {}): string {
	const s = normalizeState(input);
	const rec = recommend(s);
	return `Рекомендация: ${rec.title}. Строк: ${formatRows(rowsOf(s.rowIndex))}.`;
}
