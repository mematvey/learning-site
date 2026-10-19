import { describe, expect, it } from 'vitest';
import {
	BTREE_KEYS,
	BLOOM_BITS,
	PRESET_KEYS,
	bloomBuild,
	bloomCheck,
	buildBTree,
	emptyLsm,
	getKey,
	layoutBTree,
	putKey,
	searchBTree,
	type LsmState,
} from './databases-indexes';

function fill(keys: readonly number[], start: LsmState = emptyLsm()): LsmState {
	return keys.reduce((s, k) => putKey(s, k), start);
}

describe('bloom filter', () => {
	it('never rejects a key that was added', () => {
		const keys = Array.from({ length: 40 }, (_, i) => i * 7 + 3);
		const bits = bloomBuild(keys);
		expect(bits).toHaveLength(BLOOM_BITS);
		for (const k of keys) {
			expect(bloomCheck(bits, k).maybe).toBe(true);
		}
	});

	it('reports a zero bit for a key that is surely absent', () => {
		const bits = bloomBuild([1, 2, 3]);
		const res = bloomCheck(bits, 100);
		if (!res.maybe) {
			expect(bits[res.zeroBit]).toBe(false);
		}
	});
});

describe('LSM writes', () => {
	it('flushes a full memtable to an SSTable', () => {
		const s = fill([10, 20, 30, 40]);
		expect(s.memtable).toEqual([]);
		expect(s.sstables).toHaveLength(1);
		expect(s.sstables[0]?.keys).toEqual([10, 20, 30, 40]);
	});

	it('keeps the memtable sorted', () => {
		const s = fill([30, 10]);
		expect(s.memtable).toEqual([10, 30]);
	});

	it('preset: two SSTables and a partly filled memtable', () => {
		const s = fill(PRESET_KEYS);
		expect(s.sstables.map((t) => t.keys)).toEqual([
			[8, 17, 42, 99],
			[5, 23, 61, 77],
		]);
		expect(s.memtable).toEqual([34, 50]);
	});

	it('compacts four SSTables into one', () => {
		const s = fill(Array.from({ length: 16 }, (_, i) => 16 - i));
		expect(s.sstables).toHaveLength(1);
		expect(s.sstables[0]?.keys).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
		expect(s.log.some((line) => line.startsWith('Компакция'))).toBe(true);
	});
});

describe('LSM reads', () => {
	it('finds a key in the memtable without reading files', () => {
		const r = getKey(fill(PRESET_KEYS), 50);
		expect(r.found).toBe(true);
		expect(r.filesRead).toBe(0);
	});

	it('finds a key in an older SSTable', () => {
		const r = getKey(fill(PRESET_KEYS), 8);
		expect(r.found).toBe(true);
		expect(r.steps.at(-1)).toEqual({ kind: 'read', tableId: 1, found: true });
	});

	it('absent key: the Bloom filter skips files, so fewer files are read', () => {
		const r = getKey(fill(PRESET_KEYS), 7);
		expect(r.found).toBe(false);
		expect(r.filesSkipped + r.filesRead).toBe(2);
		expect(r.filesSkipped).toBe(2);
		expect(r.filesRead).toBe(0);
	});
});

describe('B-tree', () => {
	const tree = buildBTree(BTREE_KEYS);

	it('has 27 keys in nine leaves and three levels', () => {
		expect(tree.height).toBe(3);
		expect(tree.nodes.filter((n) => n.level === 0)).toHaveLength(9);
	});

	it('every search goes from root to leaf along one path of three nodes', () => {
		for (const key of [5, 7, 50, 135, 0, 200]) {
			const r = searchBTree(tree, key);
			expect(r.path).toHaveLength(3);
			expect(r.path[0]).toBe(tree.rootId);
			expect(tree.nodes[r.path[2] ?? -1]?.children).toEqual([]);
		}
	});

	it('finds present keys and not absent ones', () => {
		expect(searchBTree(tree, 50).found).toBe(true);
		expect(searchBTree(tree, 7).found).toBe(false);
	});

	it('keeps all boxes inside the drawing area', () => {
		const boxes = layoutBTree(tree, 340, 200, 30, 26);
		for (const b of boxes) {
			expect(b.x).toBeGreaterThanOrEqual(0);
			expect(b.x + b.w).toBeLessThanOrEqual(340 + 1e-9);
			expect(b.y).toBeGreaterThanOrEqual(0);
			expect(b.y + b.h).toBeLessThanOrEqual(200 + 1e-9);
		}
	});
});
