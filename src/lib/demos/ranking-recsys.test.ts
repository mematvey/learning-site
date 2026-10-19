import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ORDER,
	DEFAULT_RATINGS,
	ITEMS,
	dcg,
	dcgTerms,
	formatNum,
	frobenius,
	lowRank,
	moveItem,
	ndcg,
	rankError,
	relInOrder,
	resolveState,
	setRating,
	singularValues,
} from './ranking-recsys';

describe('ndcg', () => {
	it('gives 0,670 for the chapter list 0, 2, 1, 0, 0 and 0,950 after moving the 2 to the top', () => {
		expect(ndcg([0, 2, 1, 0, 0], 5)).toBeCloseTo(0.6697, 4);
		expect(ndcg([2, 0, 1, 0, 0], 5)).toBeCloseTo(0.9502, 4);
	});

	it('is 1 for the ideal order and 0 when nothing is relevant', () => {
		expect(ndcg([2, 1, 0, 0, 0], 5)).toBeCloseTo(1, 12);
		expect(ndcg([0, 0, 0, 0, 0], 5)).toBe(0);
	});

	it('uses the chapter step values: DCG 1,762 and IDCG 2,631 for the first list', () => {
		expect(dcg([0, 2, 1, 0, 0], 5)).toBeCloseTo(1.7619, 4);
		expect(dcg([2, 1, 0, 0, 0], 5)).toBeCloseTo(2.6309, 4);
		expect(dcgTerms([0, 2, 1, 0, 0], 5)[1]!).toBeCloseTo(1.2619, 4);
	});
});

describe('order and relevance', () => {
	it('gives the chapter list 0, 2, 1, 0, 0 in the default order', () => {
		expect(relInOrder(ITEMS, DEFAULT_ORDER)).toEqual([0, 2, 1, 0, 0]);
	});

	it('moves an item and keeps the order a permutation', () => {
		const moved = moveItem(DEFAULT_ORDER, 1, 0);
		expect(moved).toEqual([1, 0, 2, 3, 4]);
		expect([...moved].sort()).toEqual([...DEFAULT_ORDER]);
		expect(moveItem(DEFAULT_ORDER, 0, 9)).toEqual([...DEFAULT_ORDER]);
	});
});

describe('rating matrix and rank', () => {
	it('gives the Frobenius norm 13,3417 and errors 6,7284 (rank 1) and 1,6173 (rank 2)', () => {
		expect(frobenius(DEFAULT_RATINGS)).toBeCloseTo(13.3417, 4);
		expect(rankError(DEFAULT_RATINGS, 1)).toBeCloseTo(6.7284, 4);
		expect(rankError(DEFAULT_RATINGS, 2)).toBeCloseTo(1.6173, 4);
	});

	it('gives singular values whose squares add up to the squared norm', () => {
		const s = singularValues(DEFAULT_RATINGS);
		const sumSq = s.reduce((acc, v) => acc + v * v, 0);
		expect(sumSq).toBeCloseTo(frobenius(DEFAULT_RATINGS) ** 2, 8);
		expect(s).toEqual([...s].sort((a, b) => b - a));
	});

	it('reconstructs the matrix exactly at full rank and the error falls as the rank grows', () => {
		const full = lowRank(DEFAULT_RATINGS, 4);
		DEFAULT_RATINGS.forEach((row, i) =>
			row.forEach((v, j) => expect(full[i]![j]!).toBeCloseTo(v, 8)),
		);
		const errors = [1, 2, 3, 4].map((k) => rankError(DEFAULT_RATINGS, k));
		for (let i = 1; i < errors.length; i++) {
			expect(errors[i]!).toBeLessThanOrEqual(errors[i - 1]!);
		}
	});

	it('at rank 1 the values are close to each other; at rank 2 the two groups separate', () => {
		const r1 = lowRank(DEFAULT_RATINGS, 1).flat();
		expect(Math.max(...r1) - Math.min(...r1)).toBeLessThan(1.5);
		const r2 = lowRank(DEFAULT_RATINGS, 2);
		expect(r2[0]![0]!).toBeGreaterThan(r2[0]![2]! + 2);
		expect(r2[2]![2]!).toBeGreaterThan(r2[2]![0]! + 2);
	});

	it('clamps and rounds an edited rating and does not change the original matrix', () => {
		const edited = setRating(DEFAULT_RATINGS, 0, 2, 9.4);
		expect(edited[0]![2]).toBe(5);
		expect(setRating(DEFAULT_RATINGS, 0, 2, 0)[0]![2]).toBe(1);
		expect(DEFAULT_RATINGS[0]![2]).toBe(1);
	});
});

describe('resolveState', () => {
	it('falls back to the defaults for invalid parts', () => {
		const s = resolveState({ rank: 7, order: [0, 0, 1], ratings: [[1]] });
		expect(s.rank).toBe(4);
		expect(s.order).toEqual([...DEFAULT_ORDER]);
		expect(s.ratings).toEqual(DEFAULT_RATINGS.map((r) => [...r]));
	});

	it('formats numbers with a decimal comma', () => {
		expect(formatNum(0.67, 3)).toBe('0,670');
		expect(formatNum(6.7284, 4)).toBe('6,7284');
	});
});
