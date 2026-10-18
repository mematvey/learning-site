/**
 * Math of the compute-optimal scaling demo: budget C, optimal parameters N and tokens D,
 * and a predicted loss. This is a model, not a measurement: nothing here is trained.
 * Pure functions only: no DOM, no Svelte.
 *
 * Sources:
 * - C ≈ 6·N·D: rule of thumb for a transformer, see Kaplan et al. 2020 (arXiv:2001.08361).
 * - D = 20·N and N_opt = sqrt(C / 120): the "twenty tokens per parameter" heuristic from
 *   Hoffmann et al. 2022 (arXiv:2203.15556), which the chapter treats as a rough guide.
 * - Loss L(N, D) = E + A/N^α + B/D^β: the parametric fit of Hoffmann et al. 2022
 *   (approach 3, Eq. 10). The constants are the paper's fitted values, and the fit is disputed
 *   (Besiroglu et al. 2024, arXiv:2404.10102).
 */

/** FLOPs per parameter per token in C ≈ 6·N·D. */
export const FLOPS_PER_PARAM_TOKEN = 6;
/** Heuristic tokens-per-parameter ratio D / N. */
export const TOKENS_PER_PARAM = 20;

/** Budget slider in log10 units (C from 1e18 to 1e24 FLOP). */
export const LOG_C_MIN = 18;
export const LOG_C_MAX = 24;
export const LOG_C_STEP = 0.01;
/** Start value: the chapter's example C = 1.2e20 (log10 rounded to the slider step). */
export const LOG_C_DEFAULT = 20.08;

/** Fitted constants of the loss L = E + A/N^α + B/D^β (Hoffmann et al. 2022, Eq. 10). */
export const LOSS_FIT = { E: 1.69, A: 406.4, B: 410.7, alpha: 0.34, beta: 0.28 } as const;

export interface ScalingLawsDemoState {
	/** Budget as log10 of C in FLOP. */
	logC: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to the slider step and clamps to the budget range. Non-finite input gives the default. */
export function snapLogC(v: number): number {
	if (!Number.isFinite(v)) return LOG_C_DEFAULT;
	return Math.round(clamp(v, LOG_C_MIN, LOG_C_MAX) / LOG_C_STEP) * LOG_C_STEP;
}

/** Training compute C ≈ 6·N·D in FLOP. */
export function computeBudget(nParams: number, nTokens: number): number {
	return FLOPS_PER_PARAM_TOKEN * nParams * nTokens;
}

/**
 * Compute-optimal parameter count for budget c under D = ratio·N:
 * C = 6·N·(ratio·N) gives N = sqrt(C / (6·ratio)).
 */
export function optimalParams(c: number, ratio: number = TOKENS_PER_PARAM): number {
	return Math.sqrt(c / (FLOPS_PER_PARAM_TOKEN * ratio));
}

/** Compute-optimal token count for budget c: D = ratio·N_opt. */
export function optimalTokens(c: number, ratio: number = TOKENS_PER_PARAM): number {
	return ratio * optimalParams(c, ratio);
}

/** Predicted loss (nats per token) for N parameters trained on D tokens. Model, not a measurement. */
export function predictedLoss(nParams: number, nTokens: number): number {
	const { E, A, B, alpha, beta } = LOSS_FIT;
	return E + A / nParams ** alpha + B / nTokens ** beta;
}

export interface ScalingPoint {
	/** Budget in FLOP. */
	c: number;
	/** Optimal parameters. */
	n: number;
	/** Optimal tokens. */
	d: number;
	/** Predicted loss at the optimum. */
	loss: number;
}

/** The compute-optimal point for a budget given as log10 C. */
export function scalingPoint(logC: number): ScalingPoint {
	const c = 10 ** snapLogC(logC);
	const n = optimalParams(c);
	const d = optimalTokens(c);
	return { c, n, d, loss: predictedLoss(n, d) };
}

/** Samples the optimal-path loss curve over the whole budget range, evenly in log10 C. */
export function lossCurve(points = 121): ScalingPoint[] {
	const out: ScalingPoint[] = [];
	for (let i = 0; i < points; i++) {
		const t = points === 1 ? 0 : i / (points - 1);
		out.push(scalingPoint(LOG_C_MIN + t * (LOG_C_MAX - LOG_C_MIN)));
	}
	return out;
}

const SUPERSCRIPT: Record<string, string> = {
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹',
	'-': '⁻',
};

/** Scientific notation with a superscript exponent, e.g. 1.2e20 -> "1.20·10²⁰". */
export function formatSci(x: number): string {
	if (!Number.isFinite(x) || x <= 0) return '—';
	let exp = Math.floor(Math.log10(x));
	let mant = x / 10 ** exp;
	// Rounding can push the mantissa to 10.00; move one power of ten up.
	if (Number(mant.toFixed(2)) >= 10) {
		exp += 1;
		mant = x / 10 ** exp;
	}
	const sup = String(exp)
		.split('')
		.map((ch) => SUPERSCRIPT[ch] ?? ch)
		.join('');
	return `${mant.toFixed(2)}·10${sup}`;
}

/** Plain-text description of the state for aria-live. Numbers are computed, not typed. */
export function describeScaling(p: ScalingPoint): string {
	return (
		`Бюджет C = ${formatSci(p.c)} FLOP. Оптимум по модели: ` +
		`${formatSci(p.n)} параметров и ${formatSci(p.d)} токенов (отношение D/N = ${TOKENS_PER_PARAM}). ` +
		`Ожидаемая потеря ≈ ${p.loss.toFixed(2)}. Это расчёт по модели, а не результат обучения.`
	);
}
