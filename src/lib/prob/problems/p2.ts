/** Задача 2: два офиса с одинаковыми принтерами, события «тонер кончился». */
import { add, fromDecimal, rat, sub } from '../rational';
import type { ParamSpec, ProblemDef, Rational, SolutionStep } from '../types';
import { formatDecimal, step, texFrac } from './util';

export type P2Params = { pA: number; pB: number; pAB: number };

const params: ParamSpec[] = [
	{
		key: 'pA',
		label: 'P(A): тонер кончился в первом офисе',
		min: 0.01,
		max: 0.99,
		step: 0.01,
		control: 'slider',
	},
	{
		key: 'pB',
		label: 'P(B): тонер кончился во втором офисе',
		min: 0.01,
		max: 0.99,
		step: 0.01,
		control: 'slider',
	},
	{ key: 'pAB', label: 'P(A и B): у обоих', min: 0.01, max: 0.99, step: 0.01, control: 'slider' },
];

function validate(p: P2Params): string[] {
	const errs: string[] = [];
	const inside = (x: number) => Number.isFinite(x) && x > 0 && x < 1;
	if (!inside(p.pA) || !inside(p.pB)) {
		errs.push('Вероятности одиночных событий должны быть строго между 0 и 1.');
	}
	if (!Number.isFinite(p.pAB) || p.pAB <= 0) {
		errs.push('Вероятность одновременного события должна быть больше 0.');
	} else if (p.pAB > Math.min(p.pA, p.pB)) {
		errs.push('P(A и B) не может быть больше каждой из P(A), P(B).');
	} else if (p.pAB < p.pA + p.pB - 1) {
		errs.push('P(A и B) не может быть меньше P(A) + P(B) − 1.');
	}
	return errs;
}

function rationals(p: P2Params) {
	return { A: fromDecimal(p.pA), B: fromDecimal(p.pB), AB: fromDecimal(p.pAB) };
}

function exact(p: P2Params): Record<string, Rational> {
	const { A, B, AB } = rationals(p);
	// P(¬A ∩ ¬B) = 1 − P(A ∪ B) = 1 − (P(A) + P(B) − P(A ∩ B))
	const union = sub(add(A, B), AB);
	return { a: sub(rat(1), union) };
}

function trial(p: P2Params, rng: () => number): Record<string, boolean> {
	// Joint distribution: both / only A / only B / neither, with the given marginals.
	const u = rng();
	const onlyA = p.pA - p.pAB;
	const onlyB = p.pB - p.pAB;
	let a: boolean;
	let b: boolean;
	if (u < p.pAB) {
		a = true;
		b = true;
	} else if (u < p.pAB + onlyA) {
		a = true;
		b = false;
	} else if (u < p.pAB + onlyA + onlyB) {
		a = false;
		b = true;
	} else {
		a = false;
		b = false;
	}
	return { a: !a && !b };
}

function steps(p: P2Params): Record<string, SolutionStep[]> {
	const { A, B, AB } = rationals(p);
	const union = sub(add(A, B), AB);
	const answer = sub(rat(1), union);
	return {
		a: [
			step(
				`P(A) = ${formatDecimal(A, 2)}, P(B) = ${formatDecimal(B, 2)}, P(A и B) = ${formatDecimal(AB, 2)}.`,
			),
			step(
				'Тонер кончится хотя бы у одного: P(A ∪ B) = P(A) + P(B) − P(A ∩ B).',
				`P(A\\cup B)=${texFrac(A)}+${texFrac(B)}-${texFrac(AB)}=${texFrac(union)}`,
			),
			step(
				'Тонер останется в обоих: противоположное событие, ¬A ∩ ¬B.',
				`P(\\bar A\\cap\\bar B)=1-P(A\\cup B)=${texFrac(answer)}`,
			),
		],
	};
}

function altSteps(p: P2Params): Record<string, SolutionStep[]> {
	const { A, B, AB } = rationals(p);
	const onlyA = sub(A, AB);
	const onlyB = sub(B, AB);
	const neither = sub(sub(sub(rat(1), AB), onlyA), onlyB);
	return {
		a: [
			step(
				'Таблица 2×2: заполняем клетки по очереди. P(A ∩ ¬B) = P(A) − P(A ∩ B), P(¬A ∩ B) = P(B) − P(A ∩ B).',
				`P(A\\bar B)=${texFrac(onlyA)},\\quad P(\\bar A B)=${texFrac(onlyB)}`,
			),
			step(
				'Клетка ¬A ∩ ¬B — остаток до единицы.',
				`P(\\bar A\\bar B)=1-${texFrac(AB)}-${texFrac(onlyA)}-${texFrac(onlyB)}=${texFrac(neither)}`,
			),
		],
	};
}

export const p2: ProblemDef<P2Params> = {
	id: 'p2',
	title: 'Два принтера и тонер',
	defaults: { pA: 0.3, pB: 0.3, pAB: 0.12 },
	params,
	questions: [{ key: 'a', label: 'тонер останется в обоих офисах к концу дня' }],
	validate,
	exact,
	trial,
	hint: 'Противоположное событие «тонер кончится хотя бы у одного» проще: сложите вероятности и вычтите пересечение.',
	steps,
	altSteps,
	condition(p) {
		return `В двух одинаковых офисах по принтеру. Вероятность, что тонер кончится у первого, равна ${p.pA}; у второго — ${p.pB}; у обоих сразу — ${p.pAB}. Какова вероятность, что к концу дня тонер останется в обоих офисах?`;
	},
};
