import { describe, expect, it } from 'vitest';
import {
	ADV_SCALE_MAX,
	G,
	advantages,
	barPercent,
	clampCount,
	countCorrect,
	describeGroup,
	explainGroup,
	formatAdv,
	formatNum,
	groupStats,
	makeRewards,
	toggleReward,
} from './rl-reasoning';

describe('group advantages (chapter numbers, G = 8)', () => {
	it('k = 2 gives +1.73 for correct answers and -0.58 for wrong ones', () => {
		const adv = advantages(makeRewards(2));
		expect(adv[0] ?? NaN).toBeCloseTo(1.732, 3);
		expect(adv[7] ?? NaN).toBeCloseTo(-0.577, 3);
		expect(formatAdv(adv[0] ?? NaN)).toBe('+1,73');
		expect(formatAdv(adv[7] ?? NaN)).toBe('−0,58');
	});

	it('k = 1 gives about 2.646 and -0.378', () => {
		const s = groupStats(makeRewards(1));
		expect(s.posAdv).toBeCloseTo(2.6458, 3);
		expect(s.negAdv).toBeCloseTo(-0.378, 3);
	});

	it('closed form for every k: sqrt((G-k)/k) and -sqrt(k/(G-k))', () => {
		for (let k = 1; k < G; k++) {
			const s = groupStats(makeRewards(k));
			expect(s.posAdv).toBeCloseTo(Math.sqrt((G - k) / k), 10);
			expect(s.negAdv).toBeCloseTo(-Math.sqrt(k / (G - k)), 10);
		}
	});

	it('advantages sum to zero for every k', () => {
		for (let k = 0; k <= G; k++) {
			expect(groupStats(makeRewards(k)).sum).toBe(0);
		}
	});

	it('all equal rewards give zero advantages and no NaN', () => {
		for (const k of [0, G]) {
			const adv = advantages(makeRewards(k));
			expect(adv.every((a) => a === 0)).toBe(true);
			expect(groupStats(makeRewards(k)).posAdv).toBe(0);
		}
	});

	it('ADV_SCALE_MAX is the largest possible advantage', () => {
		expect(ADV_SCALE_MAX).toBeCloseTo(Math.sqrt(7), 10);
		expect(barPercent(ADV_SCALE_MAX)).toBe(100);
	});
});

describe('group state', () => {
	it('makeRewards puts k correct answers first and clamps k', () => {
		expect(makeRewards(3)).toEqual([1, 1, 1, 0, 0, 0, 0, 0]);
		expect(makeRewards(-4)).toEqual(Array(G).fill(0));
		expect(makeRewards(99)).toEqual(Array(G).fill(1));
		expect(clampCount(Number.NaN)).toBe(0);
	});

	it('toggleReward flips one answer and returns a new array', () => {
		const before = makeRewards(2);
		const after = toggleReward(before, 5);
		expect(countCorrect(after)).toBe(3);
		expect(countCorrect(before)).toBe(2);
		expect(toggleReward(after, 5)).toEqual(before);
		expect(toggleReward(before, 42)).toEqual(before);
	});
});

describe('text helpers', () => {
	it('formatNum uses a decimal comma and a true minus sign', () => {
		expect(formatNum(0.25, 2)).toBe('0,25');
		expect(formatNum(-0.5, 1)).toBe('−0,5');
		expect(formatNum(0, 2)).toBe('0,00');
	});

	it('explainGroup names the cause when all answers agree', () => {
		expect(explainGroup(makeRewards(G))).toContain('Все ответы верные');
		expect(explainGroup(makeRewards(0))).toContain('нулевые');
		expect(explainGroup(makeRewards(2))).toContain('Верных 2 из 8');
	});

	it('describeGroup gives the numbers for aria-live', () => {
		const text = describeGroup(makeRewards(2));
		expect(text).toContain('p = 0,25');
		expect(text).toContain('+1,73');
		expect(text).toContain('−0,58');
	});
});
