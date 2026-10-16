/** Задача 1: абитуриенты делятся на два факультета по полам. */
import { nCr } from '../comb';
import { hypergeomPmf } from '../hypergeom';
import { mul, rat } from '../rational';
import { sampleWithoutReplacement } from '../rng';
import type { ParamSpec, ProblemDef, Rational, SolutionStep } from '../types';
import { isInt, step, sumRationals, texFrac, uniq } from './util';

export type P1Params = { total: number; medalists: number; k: number };

const params: ParamSpec[] = [
	{ key: 'total', label: 'Абитуриентов', min: 2, max: 40, step: 2 },
	{ key: 'medalists', label: 'Медалистов', min: 1, max: 40, step: 1 },
	{ key: 'k', label: 'k (на одном факультете)', min: 0, max: 40, step: 1 },
];

function validate(p: P1Params): string[] {
	const errs: string[] = [];
	if (!isInt(p.total) || p.total < 2 || p.total > 40 || p.total % 2 !== 0) {
		errs.push('Абитуриентов должно быть чётное число от 2 до 40.');
	}
	if (!isInt(p.medalists) || p.medalists < 1 || p.medalists > p.total) {
		errs.push('Медалистов должно быть от 1 до числа абитуриентов.');
	}
	if (!isInt(p.k) || p.k < 0 || p.k > p.medalists) {
		errs.push('k должно быть от 0 до числа медалистов.');
	}
	return errs;
}

/** P(в первом факультете ровно j медалистов). */
function pj(p: P1Params, j: number): Rational {
	return hypergeomPmf(p.total, p.medalists, p.total / 2, j);
}

function exact(p: P1Params): Record<string, Rational> {
	// a) все медалисты на одном факультете: j = 0 или j = m.
	// b) на одном k, на другом m − k: j ∈ {k, m − k}.
	return {
		a: sumRationals(uniq([0, p.medalists]).map((j) => pj(p, j))),
		b: sumRationals(uniq([p.k, p.medalists - p.k]).map((j) => pj(p, j))),
	};
}

function trial(p: P1Params, rng: () => number): Record<string, boolean> {
	const chosen = sampleWithoutReplacement(p.total, p.total / 2, rng);
	let j = 0;
	for (const i of chosen) if (i < p.medalists) j++;
	return {
		a: j === 0 || j === p.medalists,
		b: j === p.k || j === p.medalists - p.k,
	};
}

/** Favourable count for «все медалисты на одном»: C(N−m, h−m) + C(N−m, h). */
function favourableAll(p: P1Params): bigint {
	const half = p.total / 2;
	return nCr(p.total - p.medalists, half - p.medalists) + nCr(p.total - p.medalists, half);
}

function steps(p: P1Params): Record<string, SolutionStep[]> {
	const { total: N, medalists: m, k } = p;
	const half = N / 2;
	const all = nCr(N, half);
	const favA = favourableAll(p);
	const exactA = exact(p).a as Rational;
	const other = uniq([k, m - k]);
	const terms = other.map((j) => ({ j, n: nCr(m, j) * nCr(N - m, half - j) }));
	const favB = terms.reduce((s, t) => s + t.n, 0n);
	return {
		a: [
			step(
				`Всего способов разделить ${N} человек на два факультета по ${half}: C(${N}, ${half}).`,
				`\\binom{${N}}{${half}}=${all}`,
			),
			step(
				`Благоприятно, если все ${m} медалистов на одном факультете. Если на первом, то ${half - m} мест добираются из ${N - m} остальных, если на втором, то все ${half} мест из остальных.`,
				`C(${N - m},${half - m})+C(${N - m},${half})=${favA}`,
			),
			step('Делим благоприятные исходы на все.', `\\frac{${favA}}{${all}}=${texFrac(exactA)}`),
		],
		b: [
			step(
				`Всего способов: C(${N}, ${half}) = ${all}. Медалистов на первом факультете может быть ${other.join(' или ')}.`,
			),
			...terms.map((t) =>
				step(
					`Если на первом ${t.j} медалистов: C(${m},${t.j})·C(${N - m},${half - t.j}) = ${t.n}.`,
				),
			),
			step(
				`Сумма ${favB} делится на ${all}.`,
				`\\frac{${favB}}{${all}}=${texFrac(exact(p).b as Rational)}`,
			),
		],
	};
}

function altSteps(p: P1Params): Record<string, SolutionStep[]> {
	// Sequential: the first medalist is on some faculty; each next one must join it.
	const N = p.total;
	const half = N / 2;
	let prob: Rational = rat(1);
	const factors: string[] = [];
	for (let i = 1; i < p.medalists; i++) {
		prob = mul(prob, rat(half - i, N - i));
		factors.push(`\\frac{${half - i}}{${N - i}}`);
	}
	return {
		a: [
			step(
				'Первый медалист попадает на какой-то факультет (вероятность 1). Каждый следующий должен попасть на тот же: на факультет, где уже есть предыдущие, остаётся (h − i) мест из (N − i) свободных.',
			),
			step(
				`Произведение по i = 1…${p.medalists - 1}`,
				factors.length === 0 ? '1' : `${factors.join('\\cdot ')}=${texFrac(prob)}`,
			),
		],
	};
}

export const p1: ProblemDef<P1Params> = {
	id: 'p1',
	title: 'Два факультета и медалисты',
	defaults: { total: 18, medalists: 5, k: 2 },
	params,
	questions: [
		{ key: 'a', label: 'все медалисты на одном факультете' },
		{ key: 'b', label: 'на одном факультете k медалистов, на другом m − k' },
	],
	validate,
	exact,
	trial,
	hint: 'Всего способов разделить людей на два факультета — сочетания. Посчитайте благоприятные разбиения.',
	steps,
	altSteps,
	condition(p) {
		return `Среди ${p.total} абитуриентов ${p.medalists} медалистов. Их случайно распределяют на два факультета по ${p.total / 2} человек. а) Какова вероятность, что все медалисты окажутся на одном факультете? б) Какова вероятность, что на одном факультете окажутся ${p.k} медалистов, а на другом ${p.medalists - p.k}?`;
	},
};
