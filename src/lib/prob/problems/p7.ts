/** Задача 7: карточки с цифрами, ребёнок выкладывает число. */
import { factorial, nPr } from '../comb';
import { mul, rat } from '../rational';
import { sampleWithoutReplacement } from '../rng';
import type { ParamSpec, ProblemDef, Rational, SolutionStep } from '../types';
import { isInt, step, texFrac } from './util';

export type P7Params = { cards: number; len: number };

const params: ParamSpec[] = [
	{ key: 'cards', label: 'Карточек (1…N)', min: 2, max: 9, step: 1 },
	{ key: 'len', label: 'Длина числа', min: 1, max: 9, step: 1 },
];

/** Russian numeral stems for «…-значное», indexed by digit count. */
const DIGIT_STEMS = [
	'',
	'одно',
	'двух',
	'трёх',
	'четырёх',
	'пяти',
	'шести',
	'семи',
	'восьми',
	'девяти',
];

function digitsAdjective(n: number): string {
	const stem = DIGIT_STEMS[n];
	return stem === undefined || stem === '' ? `${n}-значное` : `${stem}значное`;
}

function validate(p: P7Params): string[] {
	const errs: string[] = [];
	if (!isInt(p.cards) || p.cards < 2 || p.cards > 9) errs.push('Карточек — от 2 до 9.');
	if (!isInt(p.len) || p.len < 1 || p.len > p.cards) {
		errs.push('Длина числа — от 1 до числа карточек.');
	}
	return errs;
}

/** Digits 1, 2, …, n written as one number, e.g. 123. */
function sequence(n: number): string {
	return Array.from({ length: n }, (_, i) => String(i + 1)).join('');
}

/** Part a: the target number of `len` digits. */
function target(p: P7Params): string {
	return sequence(p.len);
}

/** Part b: all `cards` cards in a row, e.g. 123456. */
function targetAll(p: P7Params): string {
	return sequence(p.cards);
}

function exact(p: P7Params): Record<string, Rational> {
	// a: each ordered selection of len cards is equally likely; one of them is 1 2 … len.
	// b: all cards in a row; one of the N! orders is 1 2 … N.
	return {
		a: rat(1, nPr(p.cards, p.len)),
		b: rat(1, factorial(p.cards)),
	};
}

function trial(p: P7Params, rng: () => number): Record<string, boolean> {
	// Card value is index + 1. Hit: the first drawn cards are 1, 2, …, k in order.
	const drawnA = sampleWithoutReplacement(p.cards, p.len, rng);
	const drawnB = sampleWithoutReplacement(p.cards, p.cards, rng);
	return {
		a: drawnA.every((v, i) => v === i),
		b: drawnB.every((v, i) => v === i),
	};
}

function steps(p: P7Params): Record<string, SolutionStep[]> {
	const total = nPr(p.cards, p.len);
	const all = factorial(p.cards);
	return {
		a: [
			step(
				`Идея: каждая выкладка из ${p.len} карточек равновозможна, и нужная среди них ровно одна. Значит, ответ равен единице, делённой на число всех выкладок.`,
			),
			step(
				`Считаем выкладки. На первое место можно поставить любую из ${p.cards} карточек, на второе любую из оставшихся ${p.cards - 1}, и так ${p.len} раз. Здесь порядок важен (12 и 21 разные числа), а берём не все карточки, поэтому это размещения A(${p.cards}, ${p.len}) = ${p.cards}!/${p.cards - p.len}!.`,
				`A(${p.cards},${p.len})=${total}`,
			),
			step(`Нужное число «${target(p)}» одно: один благоприятный исход.`),
			step(
				'Вероятность — единица поделить на число всех выкладок.',
				`P=\\frac{1}{${total}}=${texFrac(exact(p).a as Rational)}`,
			),
			step(
				`Что получилось: из ${total} равновозможных чисел угадать нужное можно один раз. Чем длиннее число и больше карточек, тем быстрее растёт знаменатель и падает вероятность.`,
			),
		],
		b: [
			step(
				`Идея та же, только выкладываются все ${p.cards} карточек, поэтому выкладки это перестановки.`,
			),
			step(
				`На первое место ${p.cards} вариантов, на второе ${p.cards - 1}, и так до одного: ${p.cards}! способов расставить все карточки.`,
				`P_{${p.cards}}=${p.cards}!=${all}`,
			),
			step(`Нужное число «${targetAll(p)}» одно: один благоприятный исход.`),
			step(
				'Вероятность — единица поделить на число всех порядков.',
				`P=\\frac{1}{${all}}=${texFrac(exact(p).b as Rational)}`,
			),
			step(
				`Что получилось: ${p.cards}! растёт очень быстро, поэтому вероятность случайно получить именно возрастающий порядок уже при небольшом числе карточек становится крошечной.`,
			),
		],
	};
}

function altSteps(p: P7Params): Record<string, SolutionStep[]> {
	// a: each position takes one specific card out of the cards not yet used.
	const factorsA = Array.from({ length: p.len }, (_, i) => `\\frac{1}{${p.cards - i}}`);
	let probA: Rational = rat(1);
	for (let i = 0; i < p.len; i++) probA = mul(probA, rat(1, p.cards - i));
	// b: the same argument over all cards: 1/N · 1/(N-1) · … · 1.
	const factorsB = Array.from({ length: p.cards }, (_, i) => `\\frac{1}{${p.cards - i}}`);
	let probB: Rational = rat(1);
	for (let i = 0; i < p.cards; i++) probB = mul(probB, rat(1, p.cards - i));
	return {
		a: [
			step(
				'Последовательно: на i-е место нужна одна конкретная карточка из ещё не взятых. На первом месте шанс 1 из N, на втором 1 из N − 1, и так далее. Шаги идут друг за другом, поэтому шансы перемножаем, а произведение равно 1/A(N, len).',
				`${factorsA.join('\\cdot ')}=${texFrac(probA)}`,
			),
		],
		b: [
			step(
				'Последовательно по всем местам: на каждое место нужна одна конкретная карточка из оставшихся. Произведение 1/N · 1/(N − 1) · … · 1 равно 1/N!.',
				`${factorsB.join('\\cdot ')}=${texFrac(probB)}`,
			),
		],
	};
}

export const p7: ProblemDef<P7Params> = {
	id: 'p7',
	title: 'Число из карточек',
	defaults: { cards: 6, len: 3 },
	params,
	questions: [
		{ key: 'a', label: 'получилось число 1 2 … len' },
		{ key: 'b', label: 'все карточки выложены в ряд: 1 2 … N' },
	],
	validate,
	exact,
	trial,
	hint: 'Всего различных выкладок из карточек — размещения (а) или перестановки (б). Из них одна нужная.',
	steps,
	altSteps,
	condition(p) {
		return `На карточках написаны цифры от 1 до ${p.cards}, по одной на карточку. Ребёнок составляет числа: а) ${digitsAdjective(p.len)} из ${p.len} карточек, вытянутых по одной и выложенных в ряд; б) ${digitsAdjective(p.cards)} из всех ${p.cards} карточек. Какова вероятность получить число: а) ${target(p)}; б) ${targetAll(p)}?`;
	},
};
