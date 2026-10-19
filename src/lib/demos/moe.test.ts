import { describe, expect, it } from 'vitest';
import {
	BATCH_T,
	balanceStep,
	capacity,
	clampK,
	dropped,
	expertCounts,
	expertShares,
	formatShare,
	imbalance,
	moveToken,
	paramCounts,
	uniformRouting,
} from './moe';

describe('paramCounts', () => {
	it('matches the chapter example for N = 8, k = 2', () => {
		const p = paramCounts(8, 2);
		expect(p.total).toBe(68);
		expect(p.active).toBe(20);
		expect(p.share).toBeCloseTo((20 / 68) * 100, 6);
		expect(formatShare(p.share)).toBe('29');
	});

	it('matches the chapter example for N = 64, k = 2', () => {
		const p = paramCounts(64, 2);
		expect(p.total).toBe(516);
		expect(formatShare(p.share)).toBe('3,9');
	});
});

describe('capacity', () => {
	it('gives C = 160 for T = 1024, N = 8, cf = 1.25', () => {
		expect(capacity(8, 1024, 1.25)).toBe(160);
	});
});

describe('clampK', () => {
	it('keeps k between 1 and min(N, 8)', () => {
		expect(clampK(5, 2)).toBe(2);
		expect(clampK(0, 8)).toBe(1);
		expect(clampK(20, 64)).toBe(8);
	});
});

describe('uniform routing', () => {
	it('gives every expert k/N of the batch for N = 8, k = 2', () => {
		const a = uniformRouting(8, 2, BATCH_T);
		const shares = expertShares(a, 8);
		for (const s of shares) expect(s).toBeCloseTo(0.25, 10);
		expect(imbalance(a, 8)).toBeCloseTo(1, 10);
	});

	it('is perfectly even with k = 2 for every N on the slider, and drops nothing', () => {
		for (const n of [2, 4, 8, 16, 32, 64]) {
			const a = uniformRouting(n, 2, BATCH_T);
			expect(imbalance(a, n)).toBeCloseTo(1, 10);
			expect(dropped(a, n, capacity(n, BATCH_T)).some(Boolean)).toBe(false);
		}
	});

	it('uses k distinct experts per token', () => {
		for (const n of [2, 4, 8, 16, 32, 64]) {
			for (const row of uniformRouting(n, Math.min(n, 8), BATCH_T)) {
				expect(new Set(row).size).toBe(row.length);
			}
		}
	});
});

describe('moveToken and balanceStep', () => {
	it('moves a token to a new expert and keeps k experts', () => {
		const a = uniformRouting(8, 2, BATCH_T);
		const b = moveToken(a, 0, 7);
		expect(b[0]?.[0]).toBe(7);
		expect(b[0]).toHaveLength(2);
		expect(a[0]?.[0]).toBe(0); // input is not mutated
	});

	it('swaps positions when the expert is already chosen', () => {
		const a = uniformRouting(8, 2, BATCH_T); // token 0: [0, 4]
		const b = moveToken(a, 0, 4);
		expect(b[0]).toEqual([4, 0]);
	});

	it('raises imbalance when tokens are piled onto one expert, and balancing reduces it', () => {
		let a = uniformRouting(8, 2, BATCH_T);
		for (let t = 0; t < 10; t++) a = moveToken(a, t, 3);
		expect(imbalance(a, 8)).toBeGreaterThan(1.5);
		let b = a;
		for (let i = 0; i < 40; i++) b = balanceStep(b, 8);
		expect(imbalance(b, 8)).toBeLessThan(imbalance(a, 8));
	});

	it('does nothing when loads are already even', () => {
		const a = uniformRouting(8, 2, BATCH_T);
		expect(balanceStep(a, 8)).toEqual(a);
	});
});

describe('dropped', () => {
	it('drops nothing under uniform routing', () => {
		const a = uniformRouting(8, 2, BATCH_T);
		const cap = capacity(8, BATCH_T);
		expect(dropped(a, 8, cap).some(Boolean)).toBe(false);
	});

	it('drops tokens above capacity on an overloaded expert', () => {
		let a = uniformRouting(8, 2, BATCH_T);
		for (let t = 0; t < BATCH_T; t++) a = moveToken(a, t, 0);
		const cap = capacity(8, BATCH_T);
		const d = dropped(a, 8, cap);
		expect(d.filter(Boolean).length).toBe(BATCH_T - cap);
		expect(expertCounts(a, 8)[0]).toBe(BATCH_T);
	});
});
