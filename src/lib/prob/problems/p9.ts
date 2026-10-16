/** Задача 9: комиссия из отдела, гипергеометрическое распределение. */
import { nCr } from '../comb';
import { hypergeomAtLeast, hypergeomPmf } from '../hypergeom';
import { rat } from '../rational';
import { sampleWithoutReplacement } from '../rng';
import type { ParamSpec, ProblemDef, Rational, SolutionStep } from '../types';
import { isInt, step, texFrac } from './util';

export type P9Params = { N: number; K: number; n: number; k: number };

const params: ParamSpec[] = [
	{ key: 'N', label: 'Сотрудников в отделе', min: 2, max: 40, step: 1 },
	{ key: 'K', label: 'Менеджеров', min: 1, max: 39, step: 1 },
	{ key: 'n', label: 'Размер комиссии', min: 1, max: 40, step: 1 },
	{ key: 'k', label: 'k: менеджеров в комиссии', min: 0, max: 40, step: 1 },
];

function validate(p: P9Params): string[] {
	const errs: string[] = [];
	if (!isInt(p.N) || p.N < 2 || p.N > 40) errs.push('Сотрудников — от 2 до 40.');
	if (!isInt(p.K) || p.K < 1 || p.K >= p.N) errs.push('Менеджеров — от 1 до N − 1.');
	if (!isInt(p.n) || p.n < 1 || p.n > p.N) errs.push('Комиссия — от 1 до N человек.');
	if (!isInt(p.k) || p.k < 0 || p.k > Math.min(p.n, p.K)) {
		errs.push('k — от 0 до min(размер комиссии, число менеджеров).');
	}
	return errs;
}

function exact(p: P9Params): Record<string, Rational> {
	return {
		a: hypergeomPmf(p.N, p.K, p.n, p.k),
		b: hypergeomAtLeast(p.N, p.K, p.n, 1),
	};
}

function trial(p: P9Params, rng: () => number): Record<string, boolean> {
	// Indices below K are managers.
	const drawn = sampleWithoutReplacement(p.N, p.n, rng);
	const managers = drawn.filter((i) => i < p.K).length;
	return { a: managers === p.k, b: managers >= 1 };
}

function steps(p: P9Params): Record<string, SolutionStep[]> {
	const { N, K, n, k } = p;
	const all = nCr(N, n);
	const favA = nCr(K, k) * nCr(N - K, n - k);
	const noneB = nCr(N - K, n);
	return {
		a: [
			step(`Всего комиссий из ${n} человек: C(${N}, ${n}) = ${all}.`, `\\binom{${N}}{${n}}=${all}`),
			step(
				`Благоприятно: ${k} менеджеров из ${K} и ${n - k} остальных из ${N - K}: C(${K}, ${k})·C(${N - K}, ${n - k}) = ${favA}.`,
				`\\binom{${K}}{${k}}\\binom{${N - K}}{${n - k}}=${favA}`,
			),
			step(
				'Делим благоприятные на все.',
				`\\frac{${favA}}{${all}}=${texFrac(exact(p).a as Rational)}`,
			),
		],
		b: [
			step('Удобнее дополнение: в комиссии нет ни одного менеджера.'),
			step(
				`Без менеджеров: C(${N - K}, ${n}) = ${noneB} из ${all}.`,
				`1-\\frac{${noneB}}{${all}}=${texFrac(exact(p).b as Rational)}`,
			),
		],
	};
}

function altSteps(p: P9Params): Record<string, SolutionStep[]> {
	// Sum of the distribution over k = 1…n, shown term by term for the chance of at least one.
	const { N, K, n } = p;
	const all = nCr(N, n);
	const terms = Array.from({ length: Math.min(n, K) }, (_, i) => i + 1).map(
		(j) => `${nCr(K, j) * nCr(N - K, n - j)}`,
	);
	return {
		b: [
			step(
				'Сумма по k = 1…n: вероятности каждого числа менеджеров складываются.',
				`\\frac{${terms.join('+')}}{${all}}=${texFrac(hypergeomAtLeast(N, K, n, 1))}`,
			),
			step(`Проверка: 1 − ${texFrac(rat(nCr(N - K, n), all))} — то же самое.`),
		],
	};
}

export const p9: ProblemDef<P9Params> = {
	id: 'p9',
	title: 'Комиссия из отдела',
	defaults: { N: 30, K: 10, n: 5, k: 2 },
	params,
	questions: [
		{ key: 'a', label: 'в комиссии ровно k менеджеров' },
		{ key: 'b', label: 'в комиссии хотя бы один менеджер' },
	],
	validate,
	exact,
	trial,
	hint: 'Выбор без возврата из двух групп: сочетания. Для «хотя бы один» проще взять дополнение.',
	steps,
	altSteps,
	condition(p) {
		return `(Условие восстановлено.) В отделе ${p.N} сотрудников, из них ${p.K} менеджеров. Случайно выбирают комиссию из ${p.n} человек. а) Какова вероятность, что в комиссии ровно ${p.k} менеджер(ов)? б) Какова вероятность, что в комиссии хотя бы один менеджер?`;
	},
};
