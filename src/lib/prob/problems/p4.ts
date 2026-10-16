/** Задача 4: ваза с фруктами, три вынимания без возврата. */
import { nCr, nPr } from '../comb';
import { div, mul, rat } from '../rational';
import { sampleWithoutReplacement } from '../rng';
import type { ParamSpec, ProblemDef, Rational, SolutionStep } from '../types';
import { isInt, step, texFrac } from './util';

export type P4Params = { mandarins: number; oranges: number; lemons: number };

const params: ParamSpec[] = [
	{ key: 'mandarins', label: 'Мандаринов', min: 1, max: 30, step: 1 },
	{ key: 'oranges', label: 'Апельсинов', min: 1, max: 30, step: 1 },
	{ key: 'lemons', label: 'Лимонов', min: 1, max: 30, step: 1 },
];

function validate(p: P4Params): string[] {
	const errs: string[] = [];
	const ok = (x: number) => isInt(x) && x >= 1 && x <= 30;
	if (!ok(p.mandarins) || !ok(p.oranges) || !ok(p.lemons)) {
		errs.push('Фруктов каждого вида — от 1 до 30.');
	}
	return errs;
}

function exact(p: P4Params): Record<string, Rational> {
	const { mandarins: M, oranges: O, lemons: L } = p;
	const T = M + O + L;
	const perOrder = rat(L * O * M, T * (T - 1) * (T - 2));
	return {
		// лимон, апельсин, мандарин в этом порядке
		a: rat(L * O * M, T * (T - 1) * (T - 2)),
		// три разных фрукта: 3! порядков видов
		b: mul(rat(6), perOrder),
	};
}

function trial(p: P4Params, rng: () => number): Record<string, boolean> {
	const T = p.mandarins + p.oranges + p.lemons;
	const drawn = sampleWithoutReplacement(T, 3, rng).map((i) => {
		if (i < p.mandarins) return 'm';
		if (i < p.mandarins + p.oranges) return 'o';
		return 'l';
	});
	return {
		a: drawn[0] === 'l' && drawn[1] === 'o' && drawn[2] === 'm',
		b: new Set(drawn).size === 3,
	};
}

function steps(p: P4Params): Record<string, SolutionStep[]> {
	const { mandarins: M, oranges: O, lemons: L } = p;
	const T = M + O + L;
	const pl = rat(L, T);
	const po = rat(O, T - 1);
	const pm = rat(M, T - 2);
	const exactB = exact(p).b as Rational;
	return {
		a: [
			step(`Первым вынут лимон: ${L} из ${T}.`, `P_1=\\frac{${L}}{${T}}`),
			step(`Вторым апельсин: ${O} из оставшихся ${T - 1}.`, `P_2=\\frac{${O}}{${T - 1}}`),
			step(`Третьим мандарин: ${M} из ${T - 2}.`, `P_3=\\frac{${M}}{${T - 2}}`),
			step(
				'Вероятность всей цепочки — произведение.',
				`${texFrac(pl)}\\cdot${texFrac(po)}\\cdot${texFrac(pm)}=${texFrac(exact(p).a as Rational)}`,
			),
		],
		b: [
			step(
				`Порядков трёх видов 3! = 6. Для каждого порядка вероятность одинакова и равна произведению количеств, делённому на ${T}·${T - 1}·${T - 2}.`,
			),
			step(
				'Сумма по всем порядкам.',
				`6\\cdot\\frac{${L * O * M}}{${T * (T - 1) * (T - 2)}}=${texFrac(exactB)}`,
			),
		],
	};
}

function altSteps(p: P4Params): Record<string, SolutionStep[]> {
	const { mandarins: M, oranges: O, lemons: L } = p;
	const T = M + O + L;
	const arrangements = nPr(T, 3);
	const combos = nCr(T, 3);
	return {
		a: [
			step(
				'Через размещения: число упорядоченных троек равно A(T, 3). Благоприятна одна тройка типа «лимон, апельсин, мандарин» из L·O·M способов.',
				`\\frac{${L * O * M}}{A(${T},3)}=\\frac{${L * O * M}}{${arrangements}}`,
			),
		],
		b: [
			step(
				'Через сочетания: порядок не важен, выбираем по одному фрукту каждого вида из C(T, 3) троек.',
				`\\frac{${M * O * L}}{C(${T},3)}=\\frac{${M * O * L}}{${combos}}=${texFrac(div(rat(M * O * L), rat(combos)))}`,
			),
		],
	};
}

export const p4: ProblemDef<P4Params> = {
	id: 'p4',
	title: 'Ваза с фруктами',
	defaults: { mandarins: 10, oranges: 5, lemons: 2 },
	params,
	questions: [
		{ key: 'a', label: 'вынуты по порядку лимон, апельсин, мандарин' },
		{ key: 'b', label: 'вынуты три разных фрукта' },
	],
	validate,
	exact,
	trial,
	hint: 'Вынимаем по одному без возврата: вероятность каждого следующего шага зависит от оставшихся фруктов.',
	steps,
	altSteps,
	condition(p) {
		return `В вазе ${p.mandarins} мандаринов, ${p.oranges} апельсинов и ${p.lemons} лимонов. Вынимают три фрукта по одному, не возвращая. а) Какова вероятность, что вынуты лимон, апельсин и мандарин именно в этом порядке? б) Какова вероятность, что вынуты три разных фрукта?`;
	},
};
