import { formatRational, toNumber } from '$lib/prob/rational';
import type { Rational } from '$lib/prob/types';

/** Exact fraction «a/b» or an integer, e.g. «1/34». */
export function formatFraction(r: Rational): string {
	return formatRational(r);
}

/** Decimal with `digits` significant digits, trailing zeros dropped: 12/17 → «0.7059». */
export function formatDecimal(r: Rational, digits = 4): string {
	const x = toNumber(r);
	if (!Number.isFinite(x)) return '—';
	if (x === 0) return '0';
	return String(Number(x.toPrecision(digits)));
}

/** Clamps a typed trial count to the allowed range; non-finite input falls back to `min`. */
export function clampTrials(value: number, min = 100, max = 1_000_000): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, Math.round(value)));
}
