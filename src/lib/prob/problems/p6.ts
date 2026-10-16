/** Задача 6: два кубика, условная вероятность. */
import { rat } from '../rational';
import type { ParamSpec, ProblemDef, Rational, SolutionStep } from '../types';
import { isInt, step, texFrac } from './util';

export type P6Params = { faces: number; target: number };

const params: ParamSpec[] = [
	{ key: 'faces', label: 'Граней на кубике', min: 2, max: 12, step: 1 },
	{ key: 'target', label: 'Грань-условие', min: 1, max: 12, step: 1 },
];

function validate(p: P6Params): string[] {
	const errs: string[] = [];
	if (!isInt(p.faces) || p.faces < 2 || p.faces > 12) errs.push('Граней — от 2 до 12.');
	if (!isInt(p.target) || p.target < 1 || p.target > p.faces) {
		errs.push('Грань-условие должна быть от 1 до числа граней.');
	}
	return errs;
}

/** Counts over ordered pairs: `cond` = at least one `target`, `both` = cond and even sum. */
function counts(p: P6Params): { cond: number; both: number } {
	let cond = 0;
	let both = 0;
	for (let a = 1; a <= p.faces; a++) {
		for (let b = 1; b <= p.faces; b++) {
			if (a !== p.target && b !== p.target) continue;
			cond++;
			if ((a + b) % 2 === 0) both++;
		}
	}
	return { cond, both };
}

function exact(p: P6Params): Record<string, Rational> {
	const { cond, both } = counts(p);
	return { a: rat(both, cond) };
}

function trial(p: P6Params, rng: () => number): Record<string, boolean> {
	// Conditional sampling by rejection: draw until the condition holds.
	let a: number;
	let b: number;
	do {
		a = 1 + Math.floor(rng() * p.faces);
		b = 1 + Math.floor(rng() * p.faces);
	} while (a !== p.target && b !== p.target);
	return { a: (a + b) % 2 === 0 };
}

function steps(p: P6Params): Record<string, SolutionStep[]> {
	const { cond, both } = counts(p);
	const total = p.faces * p.faces;
	return {
		a: [
			step(`Всего исходов двух кубиков: ${p.faces}·${p.faces} = ${total}.`),
			step(
				`Условие «хотя бы на одном кубике выпала ${p.target}»: таких исходов ${cond}.`,
				`${total}-${(p.faces - 1) ** 2}=${cond}`,
			),
			step(
				`Из них сумма чётная: ${both}.`,
				`P=\\frac{${both}}{${cond}}=${texFrac(exact(p).a as Rational)}`,
			),
		],
	};
}

function altSteps(p: P6Params): Record<string, SolutionStep[]> {
	const { cond, both } = counts(p);
	const total = p.faces * p.faces;
	return {
		a: [
			step(
				'Через вероятности: P(условие и чётная) делим на P(условие).',
				`\\frac{${both}/${total}}{${cond}/${total}}=\\frac{${both}}{${cond}}`,
			),
		],
	};
}

export const p6: ProblemDef<P6Params> = {
	id: 'p6',
	title: 'Два кубика и шестёрка',
	defaults: { faces: 6, target: 6 },
	params,
	questions: [
		{
			key: 'a',
			label: 'сумма чётная, при условии что хотя бы на одном кубике выпала целевая грань',
		},
	],
	validate,
	exact,
	trial,
	hint: 'Условие сужает пространство исходов. Посчитайте исходы, где условие выполнено, и среди них — с чётной суммой.',
	steps,
	altSteps,
	condition(p) {
		return `Бросают два игральных кубика с ${p.faces} гранями. Известно, что хотя бы на одном выпала грань ${p.target}. Какова вероятность, что сумма очков чётная?`;
	},
};
