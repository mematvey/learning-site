/** Задача 3: студент знает часть вопросов, экзаменатор задаёт несколько. */
import { nCr } from '../comb';
import { hypergeomPmf } from '../hypergeom';
import { mul, rat } from '../rational';
import { sampleWithoutReplacement } from '../rng';
import type { ParamSpec, ProblemDef, Rational, SolutionStep } from '../types';
import { isInt, step, texFrac } from './util';

export type P3Params = { N: number; K: number; n: number };

const params: ParamSpec[] = [
	{ key: 'N', label: 'Вопросов всего', min: 2, max: 40, step: 1 },
	{ key: 'K', label: 'Вопросов, которые знает студент', min: 1, max: 39, step: 1 },
	{ key: 'n', label: 'Задают вопросов', min: 1, max: 10, step: 1, control: 'slider' },
];

function validate(p: P3Params): string[] {
	const errs: string[] = [];
	if (!isInt(p.N) || p.N < 2 || p.N > 40) errs.push('Вопросов всего должно быть от 2 до 40.');
	if (!isInt(p.K) || p.K < 1 || p.K >= p.N) {
		errs.push('Знает студент должен быть от 1 до N − 1 (если знает все, ответ очевиден).');
	}
	if (!isInt(p.n) || p.n < 1 || p.n > p.N) errs.push('Задают от 1 до N вопросов.');
	if (isInt(p.K) && isInt(p.n) && p.n > p.K) {
		errs.push('Задают больше вопросов, чем знает студент: вероятность равна 0.');
	}
	return errs;
}

function exact(p: P3Params): Record<string, Rational> {
	// P(знает все n) = C(K, n) / C(N, n)
	return { a: hypergeomPmf(p.N, p.K, p.n, p.n) };
}

function trial(p: P3Params, rng: () => number): Record<string, boolean> {
	const drawn = sampleWithoutReplacement(p.N, p.n, rng);
	return { a: drawn.every((q) => q < p.K) };
}

function steps(p: P3Params): Record<string, SolutionStep[]> {
	const { N, K, n } = p;
	const favourable = nCr(K, n);
	const all = nCr(N, n);
	return {
		a: [
			step(
				`Всего способов выбрать ${n} вопроса из ${N}: C(${N}, ${n}) = ${all}.`,
				`\\binom{${N}}{${n}}=${all}`,
			),
			step(
				`Благоприятных: все ${n} вопроса из ${K} известных: C(${K}, ${n}) = ${favourable}.`,
				`\\binom{${K}}{${n}}=${favourable}`,
			),
			step(
				'Делим благоприятные на все.',
				`\\frac{${favourable}}{${all}}=${texFrac(exact(p).a as Rational)}`,
			),
		],
	};
}

function altSteps(p: P3Params): Record<string, SolutionStep[]> {
	// Sequential: the i-th question is known given that the previous ones were.
	let prob: Rational = rat(1);
	const factors: string[] = [];
	for (let i = 0; i < p.n; i++) {
		prob = mul(prob, rat(p.K - i, p.N - i));
		factors.push(`\\frac{${p.K - i}}{${p.N - i}}`);
	}
	return {
		a: [
			step('Последовательно: каждый следующий вопрос из оставшихся должен быть известен.'),
			step('Перемножаем вероятности шагов.', `${factors.join('\\cdot ')}=${texFrac(prob)}`),
		],
	};
}

export const p3: ProblemDef<P3Params> = {
	id: 'p3',
	title: 'Экзамен по билетам',
	defaults: { N: 25, K: 20, n: 2 },
	params,
	questions: [{ key: 'a', label: 'студент знает все заданные вопросы' }],
	validate,
	exact,
	trial,
	hint: 'Сначала посчитайте, сколько есть наборов из n вопросов вообще, и сколько из них состоят только из известных.',
	steps,
	altSteps,
	condition(p) {
		return `В экзамене ${p.N} вопросов, студент знает ${p.K} из них. Экзаменатор наугад выбирает ${p.n} вопрос(ов) из всех. а) Какова вероятность, что студент знает все заданные вопросы?`;
	},
};
