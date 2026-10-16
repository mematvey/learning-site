/** Задача 7: карточки с цифрами, ребёнок выкладывает число. */
import { nPr } from '../comb';
import { mul, rat } from '../rational';
import { sampleWithoutReplacement } from '../rng';
import type { ParamSpec, ProblemDef, Rational, SolutionStep } from '../types';
import { isInt, step, texFrac } from './util';

export type P7Params = { cards: number; len: number };

const params: ParamSpec[] = [
	{ key: 'cards', label: 'Карточек (1…N)', min: 2, max: 9, step: 1 },
	{ key: 'len', label: 'Длина числа', min: 1, max: 9, step: 1 },
];

function validate(p: P7Params): string[] {
	const errs: string[] = [];
	if (!isInt(p.cards) || p.cards < 2 || p.cards > 9) errs.push('Карточек — от 2 до 9.');
	if (!isInt(p.len) || p.len < 1 || p.len > p.cards) {
		errs.push('Длина числа — от 1 до числа карточек.');
	}
	return errs;
}

/** The target number: digits 1, 2, …, len. */
function target(p: P7Params): string {
	return Array.from({ length: p.len }, (_, i) => String(i + 1)).join('');
}

function exact(p: P7Params): Record<string, Rational> {
	// Each ordered selection of len cards is equally likely; one of them is 1 2 … len.
	return { a: rat(1, nPr(p.cards, p.len)) };
}

function trial(p: P7Params, rng: () => number): Record<string, boolean> {
	// Card value is index + 1. Hit: the first len cards are 1, 2, …, len in order.
	const drawn = sampleWithoutReplacement(p.cards, p.len, rng);
	return { a: drawn.every((v, i) => v === i) };
}

function steps(p: P7Params): Record<string, SolutionStep[]> {
	const total = nPr(p.cards, p.len);
	return {
		a: [
			step(
				`Всего различных чисел из ${p.len} карточек из ${p.cards}: размещения A(${p.cards}, ${p.len}).`,
				`A(${p.cards},${p.len})=${total}`,
			),
			step(`Нужное число «${target(p)}» одно: один благоприятный исход.`),
			step(
				'Вероятность — единица поделить на число всех выкладок.',
				`P=\\frac{1}{${total}}=${texFrac(exact(p).a as Rational)}`,
			),
		],
	};
}

function altSteps(p: P7Params): Record<string, SolutionStep[]> {
	// Each position: one specific card out of the cards not yet used.
	const factors = Array.from({ length: p.len }, (_, i) => `\\frac{1}{${p.cards - i}}`);
	let prob: Rational = rat(1);
	for (let i = 0; i < p.len; i++) prob = mul(prob, rat(1, p.cards - i));
	return {
		a: [
			step(
				'Последовательно: на i-е место нужна одна конкретная карточка из ещё не взятых.',
				`${factors.join('\\cdot ')}=${texFrac(prob)}`,
			),
		],
	};
}

export const p7: ProblemDef<P7Params> = {
	id: 'p7',
	title: 'Число из карточек',
	defaults: { cards: 6, len: 3 },
	params,
	questions: [{ key: 'a', label: 'получилось число 1 2 … len' }],
	validate,
	exact,
	trial,
	hint: 'Всего различных выкладок из карточек — размещения. Из них одна нужная.',
	steps,
	altSteps,
	condition(p) {
		return `На карточках написаны цифры от 1 до ${p.cards} (по одной на карточку). Ребёнок вытягивает ${p.len} карточки по одной и выкладывает число в порядке вытягивания. Какова вероятность, что получилось число ${target(p)}?`;
	},
};
