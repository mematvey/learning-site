/**
 * Math of the RL reasoning demo: one group of G answers to the same prompt, each with a 0/1 reward.
 * Advantages use the group mean as baseline and the population std (divides by G), as in the chapter.
 * Pure functions only: no DOM, no Svelte.
 */

/** Group size: answers to one prompt. */
export const G = 8;
/** Number of correct answers at the first render. */
export const DEFAULT_CORRECT = 2;
/** Largest possible |advantage| (correct answer when exactly one of G is correct): sqrt(G - 1). */
export const ADV_SCALE_MAX = Math.sqrt(G - 1);

/** Rewards of the group: element i is 1 (correct) or 0 (wrong). Length is always G. */
export type Rewards = number[];

export interface RlReasoningDemoState {
	/** Rewards of all G answers. */
	rewards: Rewards;
}

/** Statistics of one group, as used in the formulas of the chapter. */
export interface GroupStats {
	/** Number of correct answers. */
	k: number;
	/** Group size. */
	n: number;
	/** Mean reward p = k / G (equals the baseline). */
	p: number;
	/** Population std sqrt(p (1 - p)). Zero when all rewards are equal. */
	std: number;
	/** Advantage of a correct answer, or 0 when std is zero. */
	posAdv: number;
	/** Advantage of a wrong answer, or 0 when std is zero. */
	negAdv: number;
	/** Sum of all advantages; zero up to rounding. */
	sum: number;
}

/** Rounds a number to an integer count in [0, G]. Non-finite input gives 0. */
export function clampCount(k: number): number {
	if (!Number.isFinite(k)) return 0;
	return Math.min(G, Math.max(0, Math.round(k)));
}

/** Group where the first k answers are correct and the rest are wrong. */
export function makeRewards(k: number): Rewards {
	const count = clampCount(k);
	return Array.from({ length: G }, (_, i) => (i < count ? 1 : 0));
}

/** Copy of the group with answer i flipped. Out-of-range index returns an unchanged copy. */
export function toggleReward(rewards: readonly number[], i: number): Rewards {
	const next = rewards.slice();
	if (Number.isInteger(i) && i >= 0 && i < next.length) {
		next[i] = next[i] === 1 ? 0 : 1;
	}
	return next;
}

/** Number of correct answers (rewards equal to 1). */
export function countCorrect(rewards: readonly number[]): number {
	return rewards.reduce((s, r) => s + (r === 1 ? 1 : 0), 0);
}

/**
 * Group-normalised advantages: (r_i - mean) / std with population std.
 * When all rewards are equal the std is zero and every advantage is zero.
 */
export function advantages(rewards: readonly number[]): number[] {
	const n = rewards.length;
	if (n === 0) return [];
	const mean = rewards.reduce((s, r) => s + r, 0) / n;
	const variance = rewards.reduce((s, r) => s + (r - mean) * (r - mean), 0) / n;
	const std = Math.sqrt(variance);
	if (std < 1e-12) return rewards.map(() => 0);
	return rewards.map((r) => (r - mean) / std);
}

/** Statistics of the group: mean, std and the two advantage values. */
export function groupStats(rewards: readonly number[]): GroupStats {
	const n = rewards.length;
	const k = countCorrect(rewards);
	const p = n === 0 ? 0 : k / n;
	const std = Math.sqrt(p * (1 - p));
	const adv = advantages(rewards);
	const sum = adv.reduce((s, a) => s + a, 0);
	const degenerate = std < 1e-12;
	return {
		k,
		n,
		p,
		std: degenerate ? 0 : std,
		posAdv: degenerate ? 0 : (1 - p) / std,
		negAdv: degenerate ? 0 : -p / std,
		sum: Math.abs(sum) < 1e-12 ? 0 : sum,
	};
}

/** Formats a number with one or more decimals, decimal comma and a true minus sign. */
export function formatNum(x: number, digits = 2): string {
	const fixed = Math.abs(x) < 0.5 * 10 ** -digits ? 0 : x;
	const s = Math.abs(fixed).toFixed(digits).replace('.', ',');
	if (fixed < 0) return `−${s}`;
	return s;
}

/** Signed advantage with decimal comma, e.g. "+1,73" or "−0,58". Zero has no sign. */
export function formatAdv(x: number): string {
	if (Math.abs(x) < 0.005) return '0,00';
	return (x > 0 ? '+' : '') + formatNum(x, 2);
}

/** Height of an advantage bar as a percent of one half of the chart (0 to 100). */
export function barPercent(a: number): number {
	return Math.min(100, (Math.abs(a) / ADV_SCALE_MAX) * 100);
}

/** Short cause-and-effect sentence for the current group. */
export function explainGroup(rewards: readonly number[]): string {
	const s = groupStats(rewards);
	if (s.n === 0) return '';
	if (s.k === 0) {
		return 'Верных ответов нет: все награды 0, std равен 0, преимущества нулевые. Модель не учится на этой задаче.';
	}
	if (s.k === s.n) {
		return 'Все ответы верные: награды одинаковы, std равен 0, преимущества нулевые. Модель не учится на этой задаче.';
	}
	return `Верных ${s.k} из ${s.n}: среднее p = ${formatNum(s.p, 3)} служит базой. Верные получают преимущество ${formatAdv(s.posAdv)}, неверные ${formatAdv(s.negAdv)}.`;
}

/** Text for the aria-live region: the numbers of the current group. */
export function describeGroup(rewards: readonly number[]): string {
	const s = groupStats(rewards);
	if (s.k === 0 || s.k === s.n) {
		return `Верных ${s.k} из ${s.n}. Все преимущества равны нулю.`;
	}
	return `Верных ${s.k} из ${s.n}. Среднее p = ${formatNum(s.p, 2)}, std = ${formatNum(s.std, 3)}. Преимущество верного ответа ${formatAdv(s.posAdv)}, неверного ${formatAdv(s.negAdv)}.`;
}
