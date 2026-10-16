/** Задача 8: карточки с повторяющимися цифрами, случайная выкладка. */
import { multinomial } from '../comb';
import { mul, rat } from '../rational';
import { shuffle } from '../rng';
import type { ParamSpec, ProblemDef, Rational, SolutionStep } from '../types';
import { isInt, step, texFrac } from './util';

export type P8Params = { ones: number; twos: number; threes: number };

const params: ParamSpec[] = [
	{ key: 'ones', label: 'Карточек с 1', min: 1, max: 6, step: 1, control: 'slider' },
	{ key: 'twos', label: 'Карточек с 2', min: 1, max: 6, step: 1, control: 'slider' },
	{ key: 'threes', label: 'Карточек с 3', min: 1, max: 6, step: 1, control: 'slider' },
];

function validate(p: P8Params): string[] {
	const errs: string[] = [];
	const ok = (x: number) => isInt(x) && x >= 1 && x <= 6;
	if (!ok(p.ones) || !ok(p.twos) || !ok(p.threes)) {
		errs.push('Карточек каждой цифры — от 1 до 6.');
	} else if (p.ones + p.twos + p.threes > 12) {
		errs.push('Карточек всего не больше 12.');
	}
	return errs;
}

/** Target arrangement: 1…1 2…2 3…3 in ascending order. */
function target(p: P8Params): string {
	return '1'.repeat(p.ones) + '2'.repeat(p.twos) + '3'.repeat(p.threes);
}

function exact(p: P8Params): Record<string, Rational> {
	// Distinct arrangements: n! / (ones! · twos! · threes!). Exactly one of them is the target.
	return { a: rat(1, multinomial([p.ones, p.twos, p.threes])) };
}

function trial(p: P8Params, rng: () => number): Record<string, boolean> {
	const deck: string[] = [
		...Array.from({ length: p.ones }, () => '1'),
		...Array.from({ length: p.twos }, () => '2'),
		...Array.from({ length: p.threes }, () => '3'),
	];
	shuffle(deck, rng);
	return { a: deck.join('') === target(p) };
}

function steps(p: P8Params): Record<string, SolutionStep[]> {
	const n = p.ones + p.twos + p.threes;
	const arrangements = multinomial([p.ones, p.twos, p.threes]);
	return {
		a: [
			step(
				`Идея: карточки с одной цифрой на вид одинаковы, поэтому важен не порядок «карточек», а порядок «цифр». Считаем различные выкладки и берём вероятность одной нужной.`,
			),
			step(
				`Если бы все ${n} карточек были разными, выкладок было бы ${n}!. Но перестановка одинаковых карточек между собой не создаёт новой выкладки: единицы можно переставить ${p.ones}! способами, двойки ${p.twos}!, тройки ${p.threes}!. Каждую настоящую выкладку мы посчитали ${p.ones}!·${p.twos}!·${p.threes}! раз, поэтому делим.`,
				`\\frac{${n}!}{${p.ones}!\\,${p.twos}!\\,${p.threes}!}=${arrangements}`,
			),
			step(`Нужна одна выкладка «${target(p)}».`),
			step(
				'Выкладки равновозможны, поэтому вероятность равна единице, делённой на число различных выкладок.',
				`P=\\frac{1}{${arrangements}}=${texFrac(exact(p).a as Rational)}`,
			),
			step(
				`Что получилось: из ${arrangements} различных выкладок нужна одна. Равновозможность здесь честная: каждая выкладка получается ровно ${p.ones}!·${p.twos}!·${p.threes}! порядками карточек, одинаковым числом для всех.`,
			),
		],
	};
}

function altSteps(p: P8Params): Record<string, SolutionStep[]> {
	// Walk along the target: at each position, the chance to draw that digit among the rest.
	const seq = target(p).split('');
	const left = new Map<string, number>([
		['1', p.ones],
		['2', p.twos],
		['3', p.threes],
	]);
	const n = seq.length;
	let prob: Rational = rat(1);
	const factors: string[] = [];
	seq.forEach((digit, i) => {
		const count = left.get(digit) ?? 0;
		factors.push(`\\frac{${count}}{${n - i}}`);
		prob = mul(prob, rat(count, n - i));
		left.set(digit, count - 1);
	});
	return {
		a: [
			step(
				'Идём по нужной выкладке слева направо. На каждом месте вероятность равна (сколько карточек нужной цифры ещё осталось) / (сколько карточек осталось вообще). Шаги перемножаем. Ответ совпадает с подсчётом через число различных выкладок.',
				`${factors.join('\\cdot ')}=${texFrac(prob)}`,
			),
		],
	};
}

export const p8: ProblemDef<P8Params> = {
	id: 'p8',
	title: 'Карточки с повторами',
	defaults: { ones: 3, twos: 2, threes: 1 },
	params,
	questions: [{ key: 'a', label: 'карточки легли по возрастанию цифр' }],
	validate,
	exact,
	trial,
	hint: 'Одинаковые карточки не различаются. Считайте выкладки как перестановки с повторениями.',
	steps,
	altSteps,
	condition(p) {
		return `Есть карточки с цифрами: ${p.ones} с единицей, ${p.twos} с двойкой и ${p.threes} с тройкой. Карточки случайно перемешивают и кладут в ряд. Какова вероятность, что получилась выкладка ${target(p)}?`;
	},
};
