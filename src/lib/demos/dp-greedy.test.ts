import { describe, expect, it } from 'vitest';
import {
	type KnapItem,
	editDp,
	editTable,
	greedyCoins,
	knapDp,
	minCoinsDp,
	restoreEditPath,
} from './dp-greedy';

const ITEMS: KnapItem[] = [
	{ value: 60, weight: 10 },
	{ value: 100, weight: 20 },
	{ value: 120, weight: 30 },
];

describe('editTable', () => {
	it('matches the table from the chapter for кот and кит', () => {
		expect(editTable('кот', 'кит')).toEqual([
			[0, 1, 2, 3],
			[1, 0, 1, 2],
			[2, 1, 1, 2],
			[3, 2, 2, 1],
		]);
	});

	it('gives the chapter distances: kitten/sitting = 3, кот/кит = 1', () => {
		expect(editDp('kitten', 'sitting').answer).toBe(3);
		expect(editDp('кот', 'кит').answer).toBe(1);
	});

	it('handles empty strings', () => {
		expect(editTable('', 'abc')[0]).toEqual([0, 1, 2, 3]);
		expect(editDp('', '').answer).toBe(0);
	});
});

describe('editDp', () => {
	it('fills one fill step per cell, row by row', () => {
		const run = editDp('кот', 'кит');
		const fills = run.steps.filter((s) => s.phase === 'fill');
		expect(fills).toHaveLength(9);
		expect(fills[0]?.cell).toEqual({ i: 1, j: 1 });
		expect(fills[8]?.cell).toEqual({ i: 3, j: 3 });
		expect(run.fillOrder[1]).toEqual({ i: 1, j: 2 });
	});

	it('restores a path with exactly answer edit operations', () => {
		const a = 'kitten';
		const b = 'sitting';
		const run = editDp(a, b);
		const ops = run.path.filter((p) => p.label !== 'start' && p.label !== 'match');
		expect(ops).toHaveLength(run.answer);
		expect(run.path[0]).toEqual({ i: 0, j: 0, label: 'start' });
		expect(run.path[run.path.length - 1]).toMatchObject({ i: 6, j: 7 });
	});

	it('restored path for кот/кит has one replace', () => {
		const table = editTable('кот', 'кит');
		const path = restoreEditPath(table, 'кот', 'кит');
		expect(path.filter((p) => p.label === 'replace')).toHaveLength(1);
		expect(path.filter((p) => p.label === 'insert' || p.label === 'delete')).toHaveLength(0);
	});
});

describe('knapDp', () => {
	it('gives 220 for the chapter instance with capacity 50', () => {
		expect(knapDp(ITEMS, 50).answer).toBe(220);
	});

	it('restores rows 2 and 3 (items 2 and 3), which weigh 50 in total', () => {
		const run = knapDp(ITEMS, 50);
		const taken = run.path.filter((p) => p.label === 'take').map((p) => p.i);
		expect(taken.sort()).toEqual([2, 3]);
		const weight = taken.reduce((s, k) => s + (ITEMS[k - 1]?.weight ?? 0), 0);
		expect(weight).toBeLessThanOrEqual(50);
	});

	it('uses n + 1 rows and W + 1 columns', () => {
		const run = knapDp(ITEMS, 50);
		expect(run.table).toHaveLength(4);
		expect(run.table[0]).toHaveLength(51);
		expect(run.fillOrder).toHaveLength(3 * 51);
	});
});

describe('greedy against dynamic programming', () => {
	it('greedy takes 3 coins for sum 6 with {1, 3, 4}', () => {
		expect(greedyCoins([1, 3, 4], 6)).toEqual([4, 1, 1]);
	});

	it('dynamic programming finds 2 coins (3 + 3) for the same input', () => {
		const coins = minCoinsDp([1, 3, 4], 6);
		expect(coins).toHaveLength(2);
		expect(coins?.reduce((s, c) => s + c, 0)).toBe(6);
	});

	it('greedy returns null when the sum cannot be reached', () => {
		expect(greedyCoins([2], 3)).toBeNull();
		expect(minCoinsDp([2], 3)).toBeNull();
	});
});
