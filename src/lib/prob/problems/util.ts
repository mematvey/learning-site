/** Shared helpers for problem definitions. */
import { add, rat, toNumber } from '../rational';
import type { Rational, SolutionStep } from '../types';

export function isInt(x: number): boolean {
	return Number.isInteger(x);
}

export function sumRationals(list: Rational[]): Rational {
	return list.reduce((acc, r) => add(acc, r), rat(0));
}

/** TeX fraction, or a plain integer when the denominator is 1. */
export function texFrac(r: Rational): string {
	return r.den === 1n ? `${r.num}` : `\\frac{${r.num}}{${r.den}}`;
}

/** Decimal with a Russian comma, e.g. `0,5200`. */
export function formatDecimal(r: Rational, digits = 4): string {
	return toNumber(r).toFixed(digits).replace('.', ',');
}

export function step(text: string, tex?: string): SolutionStep {
	return tex === undefined ? { text } : { text, tex };
}

export function uniq(values: number[]): number[] {
	return [...new Set(values)];
}
