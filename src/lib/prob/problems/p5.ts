/** Задача 5: партия деталей, проверяют n штук без возврата. */
import { nCr } from '../comb';
import { hypergeomPmf } from '../hypergeom';
import { mul, rat, sub } from '../rational';
import { sampleWithoutReplacement } from '../rng';
import type { ParamSpec, ProblemDef, Rational, SolutionStep } from '../types';
import { isInt, pct, step, texFrac } from './util';

export type P5Params = { N: number; good: number; n: number };

const params: ParamSpec[] = [
	{ key: 'N', label: 'Деталей в партии', min: 3, max: 40, step: 1 },
	{ key: 'good', label: 'Стандартных', min: 1, max: 39, step: 1 },
	{ key: 'n', label: 'Проверяют', min: 2, max: 10, step: 1, control: 'slider' },
];

function validate(p: P5Params): string[] {
	const errs: string[] = [];
	if (!isInt(p.N) || p.N < 3 || p.N > 40) errs.push('Деталей в партии — от 3 до 40.');
	if (!isInt(p.good) || p.good < 1 || p.good >= p.N) {
		errs.push('Стандартных деталей — от 1 до N − 1 (бракованная хотя бы одна).');
	}
	if (!isInt(p.n) || p.n < 2 || p.n > p.N) {
		errs.push('Проверяют от 2 до N деталей (вопрос б требует n ≥ 2).');
	}
	return errs;
}

/**
 * Probability of an ordered outcome pattern (true = standard) when drawing without replacement.
 * Each factor is (remaining count of that kind) / (remaining total).
 */
function patternProb(N: number, good: number, pattern: boolean[]): Rational {
	let g = good;
	let b = N - good;
	let total = N;
	let prob = rat(1);
	for (const isGood of pattern) {
		const count = isGood ? g : b;
		if (count <= 0 || total <= 0) return rat(0);
		prob = mul(prob, rat(count, total));
		if (isGood) g--;
		else b--;
		total--;
	}
	return prob;
}

/** Pattern for question б: standard, bad, then standard for the rest. */
function onlySecondBadPattern(n: number): boolean[] {
	return [true, false, ...Array.from({ length: n - 2 }, () => true)];
}

function exact(p: P5Params): Record<string, Rational> {
	const bad = p.N - p.good;
	return {
		a: hypergeomPmf(p.N, bad, p.n, 0),
		b: patternProb(p.N, p.good, onlySecondBadPattern(p.n)),
		c: hypergeomPmf(p.N, bad, p.n, 1),
	};
}

function trial(p: P5Params, rng: () => number): Record<string, boolean> {
	// Indices below `good` are standard, the rest are defective.
	const drawn = sampleWithoutReplacement(p.N, p.n, rng);
	const isGood = drawn.map((i) => i < p.good);
	const pattern = onlySecondBadPattern(p.n);
	return {
		a: isGood.every(Boolean),
		b: isGood.every((g, i) => g === pattern[i]),
		c: isGood.filter((g) => !g).length === 1,
	};
}

function steps(p: P5Params): Record<string, SolutionStep[]> {
	const { N, n } = p;
	const good = p.good;
	const bad = N - good;
	const all = nCr(N, n);
	const favA = nCr(good, n);
	const favC = nCr(bad, 1) * nCr(good, n - 1);
	const pattern = onlySecondBadPattern(n);
	const factors = pattern.map((isGood, i) => {
		// Count of the needed kind before the i-th draw, and the remaining total.
		const goodBefore = pattern.slice(0, i).filter(Boolean).length;
		const badBefore = i - goodBefore;
		const count = isGood ? good - goodBefore : bad - badBefore;
		return `\\frac{${count}}{${N - i}}`;
	});
	return {
		a: [
			step(
				`Идея: проверяют набор из ${n} деталей, все наборы равновозможны, порядок не важен. Всего наборов C(${N}, ${n}) = ${all}.`,
			),
			step(
				`Подходят наборы, где все детали стандартные: их выбирают только из ${good} стандартных, C(${good}, ${n}) = ${favA}.`,
				`\\frac{\\binom{${good}}{${n}}}{\\binom{${N}}{${n}}}=\\frac{${favA}}{${all}}=${texFrac(exact(p).a as Rational)}`,
			),
			step(
				`Что получилось: все проверенные детали окажутся стандартными с шансом около ${pct(exact(p).a as Rational)}. Значит, брак замечают примерно в ${pct(sub(rat(1), exact(p).a as Rational))} проверок.`,
			),
		],
		b: [
			step(
				`Здесь важна позиция, поэтому считаем по шагам, как цепочку: первая деталь стандартная, вторая бракованная, остальные ${n - 2} стандартные. На каждом шаге вероятность равна доле нужного вида среди оставшихся деталей, а после шага состав партии меняется.`,
			),
			step(
				`Числитель каждой дроби уменьшается только для того вида, который мы вынули, знаменатель уменьшается всегда на 1. Цепочку перемножаем.`,
				`${factors.join('\\cdot ')}=${texFrac(exact(p).b as Rational)}`,
			),
			step(
				`Что получилось: около ${pct(exact(p).b as Rational)}. Это вероятность одного конкретного расположения брака, поэтому она составляет лишь часть ответа пункта в, где бракованная деталь может быть на любом месте.`,
			),
		],
		c: [
			step(`Порядок не важен, считаем наборы. Всего их C(${N}, ${n}) = ${all}.`),
			step(
				`Подходящий набор состоит из одной бракованной детали и ${n - 1} стандартных. Бракованную выбираем из ${bad}: C(${bad}, 1) = ${bad}. Стандартные выбираем из ${good}: C(${good}, ${n - 1}). Выборы независимы, поэтому множим: ${favC}.`,
				`\\frac{${favC}}{${all}}=${texFrac(exact(p).c as Rational)}`,
			),
			step(
				`Что получилось: около ${pct(exact(p).c as Rational)}. Это гипергеометрическое распределение: вероятность, что ровно одна из ${n} проверенных деталей относится к группе «бракованные».`,
			),
		],
	};
}

function altSteps(p: P5Params): Record<string, SolutionStep[]> {
	return {
		a: [
			step(
				'Через цепочку: каждая следующая деталь тоже стандартная. Вероятность на каждом шаге равна (оставшихся стандартных) / (оставшихся деталей), цепочку перемножаем. Ответ тот же, что через сочетания.',
				texFrac(
					patternProb(
						p.N,
						p.good,
						Array.from({ length: p.n }, () => true),
					),
				),
			),
		],
		c: [
			step(
				`Через порядок: бракованная деталь может стоять на любом из ${p.n} мест. Для каждого места вероятность цепочки одна и та же (в числителях те же числа, порядок которых меняется), а варианты несовместны, поэтому вероятность одного места умножаем на ${p.n}.`,
				`${p.n}\\cdot${texFrac(patternProb(p.N, p.good, [true, ...Array.from({ length: p.n - 2 }, () => true), false]))}`,
			),
		],
	};
}

export const p5: ProblemDef<P5Params> = {
	id: 'p5',
	title: 'Партия деталей',
	defaults: { N: 25, good: 20, n: 3 },
	params,
	questions: [
		{ key: 'a', label: 'все проверенные детали стандартные' },
		{ key: 'b', label: 'только вторая проверенная деталь бракованная' },
		{ key: 'c', label: 'ровно одна проверенная деталь бракованная' },
	],
	validate,
	exact,
	trial,
	hint: 'Выбираем без возврата. Для «ровно одна» считайте, сколько наборов содержат бракованную деталь.',
	steps,
	altSteps,
	condition(p) {
		return `В партии ${p.N} деталей, из них ${p.good} стандартных. Наугад проверяют ${p.n} деталей без возврата. а) Какова вероятность, что все проверенные стандартные? б) Какова вероятность, что только вторая проверенная деталь бракованная? в) Какова вероятность, что ровно одна проверенная деталь бракованная?`;
	},
};
