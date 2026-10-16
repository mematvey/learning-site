import { describe, expect, it } from 'vitest';
import {
	INITIAL_SIZE,
	KEYS,
	N_MAX,
	bucketOf,
	buildTable,
	describeTable,
	lookup,
	makeKeys,
	nextPrime,
	snapCount,
	theoryProbes,
	type HashTableDemoState,
} from './hash-tables';

function state(over: Partial<HashTableDemoState> = {}): HashTableDemoState {
	return { strategy: 'chain', hash: 'division', count: 0, ...over };
}

describe('keys', () => {
	it('are deterministic, distinct and in range', () => {
		expect(makeKeys()).toEqual(KEYS);
		expect(KEYS.length).toBe(N_MAX);
		expect(new Set(KEYS).size).toBe(N_MAX);
		for (const k of KEYS) {
			expect(k).toBeGreaterThanOrEqual(1);
			expect(k).toBeLessThanOrEqual(999);
		}
	});

	it('snapCount clamps, rounds and falls back to the default', () => {
		expect(snapCount(-3)).toBe(0);
		expect(snapCount(1000)).toBe(N_MAX);
		expect(snapCount(4.6)).toBe(5);
		expect(snapCount(Number.NaN)).toBe(12);
	});
});

describe('hash functions and sizes', () => {
	it('nextPrime returns the smallest prime >= x', () => {
		expect(nextPrime(14)).toBe(17);
		expect(nextPrime(34)).toBe(37);
		expect(nextPrime(74)).toBe(79);
		expect(nextPrime(2)).toBe(2);
	});

	it('bucketOf stays in [0, m) for both hash functions', () => {
		for (const k of KEYS) {
			for (const m of [7, 17, 79]) {
				const d = bucketOf(k, m, 'division');
				const u = bucketOf(k, m, 'multiplicative');
				expect(d).toBeGreaterThanOrEqual(0);
				expect(d).toBeLessThan(m);
				expect(u).toBeGreaterThanOrEqual(0);
				expect(u).toBeLessThan(m);
			}
		}
	});

	it('division hash is k mod m', () => {
		expect(bucketOf(23, 7, 'division')).toBe(2);
	});
});

describe('buildTable', () => {
	it('empty table has no keys and zero statistics', () => {
		const t = buildTable(state({ count: 0 }));
		expect(t.size).toBe(INITIAL_SIZE);
		expect(t.count).toBe(0);
		expect(t.load).toBe(0);
		expect(t.avgProbes).toBe(0);
		expect(t.lastKey).toBeNull();
		expect(t.lastIndex).toBe(-1);
	});

	it('chain lookup: the second key of a bucket costs 2 comparisons', () => {
		// 7 and 14 both have remainder 0 modulo 7, so they share bucket 0.
		const cells: number[][] = [[7, 14], [], [], [], [], [], []];
		expect(lookup(cells, 14, 'division', 'chain')).toEqual({ index: 0, cost: 2 });
		expect(lookup(cells, 21, 'division', 'chain')).toBeNull();
	});

	it('linear probing lookup walks past occupied slots', () => {
		// 8 and 15 have home bucket 1 (mod 7); 15 sits in slot 2 after the probe.
		const cells: number[][] = [[], [8], [15], [], [], [], []];
		expect(lookup(cells, 15, 'division', 'probe')).toEqual({ index: 2, cost: 2 });
		expect(lookup(cells, 99, 'division', 'probe')).toBeNull();
	});

	it('rehashes when the load factor exceeds 0.75', () => {
		// After 5 keys the load is 5/7 (no growth); the 6th key gives 6/7 > 0.75 -> size 17.
		expect(buildTable(state({ count: 5 })).size).toBe(7);
		const six = buildTable(state({ count: 6 }));
		expect(six.size).toBe(17);
		expect(six.rehashes).toBe(1);
		// 12 keys give 12/17 <= 0.75; the 13th gives 13/17 > 0.75 -> size 37.
		expect(buildTable(state({ count: 12 })).size).toBe(17);
		const thirteen = buildTable(state({ count: 13 }));
		expect(thirteen.size).toBe(37);
		expect(thirteen.rehashes).toBe(2);
	});

	it('stores every inserted key exactly once in both strategies', () => {
		for (const strategy of ['chain', 'probe'] as const) {
			for (const hash of ['division', 'multiplicative'] as const) {
				const t = buildTable({ strategy, hash, count: N_MAX });
				const stored = t.cells.flat();
				expect(stored.length).toBe(N_MAX);
				expect(new Set(stored)).toEqual(new Set(KEYS));
				for (const k of KEYS) {
					expect(lookup(t.cells, k, hash, strategy)).not.toBeNull();
				}
				expect(t.load).toBeLessThanOrEqual(0.75);
			}
		}
	});

	it('is deterministic for the same state', () => {
		const a = buildTable(state({ strategy: 'probe', hash: 'multiplicative', count: 25 }));
		const b = buildTable(state({ strategy: 'probe', hash: 'multiplicative', count: 25 }));
		expect(a).toEqual(b);
	});

	it('average successful search equals the mean of per-key costs', () => {
		const t = buildTable(state({ strategy: 'probe', count: 10 }));
		let sum = 0;
		for (const k of KEYS.slice(0, 10)) {
			sum += lookup(t.cells, k, 'division', 'probe')?.cost ?? 0;
		}
		expect(t.avgProbes).toBeCloseTo(sum / 10, 10);
	});

	it('last inserted key is located in its cell', () => {
		const t = buildTable(state({ count: 8 }));
		expect(t.lastKey).toBe(KEYS[7]);
		expect(t.cells[t.lastIndex]).toContain(KEYS[7]);
	});
});

describe('theory and text', () => {
	it('theoretical successful search costs at zero load', () => {
		expect(theoryProbes('chain', 0)).toBe(1);
		expect(theoryProbes('probe', 0)).toBe(1);
		expect(theoryProbes('probe', 0.5)).toBeCloseTo(1.5, 10);
		expect(theoryProbes('chain', 0.5)).toBeCloseTo(1.25, 10);
	});

	it('describes an empty and a filled table', () => {
		const s = state({ count: 0 });
		expect(describeTable(s, buildTable(s))).toContain('пуста');
		const f = state({ count: 6, strategy: 'probe' });
		expect(describeTable(f, buildTable(f))).toContain('перестраивалась 1 раз');
	});
});
