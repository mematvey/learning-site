/**
 * Logic of the LSM and B-tree demo: a tiny log-structured store (memtable, SSTables with Bloom
 * filters, compaction) and a static three-level B-tree with a root-to-leaf search path.
 * Pure functions only: no DOM, no Svelte. Every operation returns a new state.
 */

/** Keys that fit into the memtable before it is flushed to an SSTable. */
export const MEMTABLE_LIMIT = 4;
/** When this many SSTables exist, compaction merges them into one. */
export const COMPACT_AT = 4;
/** Bits in each SSTable's Bloom filter. */
export const BLOOM_BITS = 64;
/** Hash functions per Bloom filter. */
export const BLOOM_HASHES = 3;
/** Fanout of the demo B-tree: keys per node. */
export const BTREE_FANOUT = 3;

export interface SSTable {
	id: number;
	/** Sorted, unique keys. */
	keys: number[];
	/** Bloom filter bits, length BLOOM_BITS. */
	bloom: boolean[];
}

export interface LsmState {
	/** Sorted keys waiting in memory. */
	memtable: number[];
	/** Oldest first, newest last. */
	sstables: SSTable[];
	nextId: number;
	/** Human-readable events of the last operations, newest last. */
	log: string[];
}

export type LookupStep =
	| { kind: 'memtable'; found: boolean }
	| { kind: 'skip'; tableId: number; bit: number }
	| { kind: 'read'; tableId: number; found: boolean };

export interface LsmLookup {
	key: number;
	found: boolean;
	steps: LookupStep[];
	filesRead: number;
	filesSkipped: number;
}

export interface BNode {
	id: number;
	/** 0 for leaves. */
	level: number;
	/** Leaf: its data keys. Internal node: the smallest key of each child. */
	keys: number[];
	/** Child node ids; empty for leaves. */
	children: number[];
}

export interface BTree {
	nodes: BNode[];
	rootId: number;
	height: number;
}

export interface BTreeLookup {
	key: number;
	/** Node ids from the root down to the leaf. */
	path: number[];
	found: boolean;
}

export function emptyLsm(): LsmState {
	return { memtable: [], sstables: [], nextId: 1, log: [] };
}

/** Integer hash with a seed (32-bit mix). */
function hashInt(key: number, seed: number): number {
	let h = Math.imul(key ^ Math.imul(seed, 0x27d4eb2d), 0x9e3779b1);
	h ^= h >>> 15;
	h = Math.imul(h, 0x85ebca77);
	h ^= h >>> 13;
	return h >>> 0;
}

/** Bit positions a key sets in a Bloom filter of `m` bits, by double hashing. */
export function bloomPositions(
	key: number,
	m: number = BLOOM_BITS,
	k: number = BLOOM_HASHES,
): number[] {
	const a = hashInt(key, 1);
	const b = hashInt(key, 2) | 1;
	const out: number[] = [];
	for (let i = 0; i < k; i++) {
		out.push((a + i * b) % m);
	}
	return out;
}

export function bloomBuild(keys: readonly number[], m: number = BLOOM_BITS): boolean[] {
	const bits: boolean[] = new Array<boolean>(m).fill(false);
	for (const key of keys) {
		for (const p of bloomPositions(key, m)) bits[p] = true;
	}
	return bits;
}

/** Bit set at a position: 'maybe' only if all positions are set; otherwise the key is surely absent. */
export function bloomCheck(
	bits: readonly boolean[],
	key: number,
): { maybe: boolean; zeroBit: number } {
	const pos = bloomPositions(key, bits.length);
	const zero = pos.find((p) => !bits[p]);
	return { maybe: zero === undefined, zeroBit: zero ?? -1 };
}

function insertSorted(xs: readonly number[], key: number): number[] {
	const out = xs.filter((x) => x !== key);
	let i = out.length;
	while (i > 0 && (out[i - 1] ?? 0) > key) i--;
	out.splice(i, 0, key);
	return out;
}

function makeTable(id: number, keys: readonly number[]): SSTable {
	const unique = [...new Set(keys)].sort((a, b) => a - b);
	return { id, keys: unique, bloom: bloomBuild(unique) };
}

/**
 * Writes a key: it goes to the memtable. A full memtable is flushed to a new SSTable.
 * Four SSTables are merged by compaction into one.
 */
export function putKey(state: LsmState, key: number): LsmState {
	let { memtable, sstables, nextId } = state;
	const log = [...state.log];
	memtable = insertSorted(memtable, key);
	log.push(`Записан ключ ${key} в memtable (${memtable.length} из ${MEMTABLE_LIMIT})`);

	if (memtable.length >= MEMTABLE_LIMIT) {
		const table = makeTable(nextId, memtable);
		nextId++;
		sstables = [...sstables, table];
		log.push(`Memtable заполнена: сброс на диск в SSTable #${table.id}`);
		memtable = [];
	}

	if (sstables.length >= COMPACT_AT) {
		const merged = makeTable(
			nextId,
			sstables.flatMap((t) => t.keys),
		);
		nextId++;
		log.push(
			`Компакция: ${sstables.length} файлов слиты в один, SSTable #${merged.id} (${merged.keys.length} ключей)`,
		);
		sstables = [merged];
	}

	return { memtable, sstables, nextId, log };
}

/**
 * Looks up a key: memtable first, then SSTables from newest to oldest.
 * A Bloom filter that has a zero bit proves the key is absent, so that file is not read.
 */
export function getKey(state: LsmState, key: number): LsmLookup {
	const steps: LookupStep[] = [];
	const inMemtable = state.memtable.includes(key);
	steps.push({ kind: 'memtable', found: inMemtable });
	if (inMemtable) {
		return { key, found: true, steps, filesRead: 0, filesSkipped: 0 };
	}

	let filesRead = 0;
	let filesSkipped = 0;
	for (let i = state.sstables.length - 1; i >= 0; i--) {
		const table = state.sstables[i];
		if (!table) continue;
		const check = bloomCheck(table.bloom, key);
		if (!check.maybe) {
			filesSkipped++;
			steps.push({ kind: 'skip', tableId: table.id, bit: check.zeroBit });
			continue;
		}
		filesRead++;
		const found = table.keys.includes(key);
		steps.push({ kind: 'read', tableId: table.id, found });
		if (found) {
			return { key, found: true, steps, filesRead, filesSkipped };
		}
	}
	return { key, found: false, steps, filesRead, filesSkipped };
}

/** Preset keys written at the start: 10 keys give two SSTables and a partly filled memtable. */
export const PRESET_KEYS: readonly number[] = [17, 42, 8, 99, 23, 61, 5, 77, 34, 50];

/** Sorted keys of the B-tree index: multiples of 5 from 5 to 135 (27 keys). */
export const BTREE_KEYS: readonly number[] = Array.from({ length: 27 }, (_, i) => (i + 1) * 5);

/** Builds a static B+-tree (leaves hold the data keys) with fixed fanout. */
export function buildBTree(sortedKeys: readonly number[], fanout: number = BTREE_FANOUT): BTree {
	const nodes: BNode[] = [];
	let level: number[] = [];
	for (let i = 0; i < sortedKeys.length; i += fanout) {
		const id = nodes.length;
		nodes.push({ id, level: 0, keys: sortedKeys.slice(i, i + fanout), children: [] });
		level.push(id);
	}
	let height = 1;
	while (level.length > 1) {
		const next: number[] = [];
		for (let i = 0; i < level.length; i += fanout) {
			const children = level.slice(i, i + fanout);
			const id = nodes.length;
			nodes.push({
				id,
				level: height,
				keys: children.map((c) => nodes[c]?.keys[0] ?? 0),
				children,
			});
			next.push(id);
		}
		level = next;
		height++;
	}
	return { nodes, rootId: level[0] ?? 0, height };
}

/** Search from the root to a leaf: one node (one page) per level, always `height` nodes. */
export function searchBTree(tree: BTree, key: number): BTreeLookup {
	const path: number[] = [];
	let node: BNode | undefined = tree.nodes[tree.rootId];
	for (;;) {
		if (!node) throw new Error('B-tree is malformed: missing node');
		path.push(node.id);
		if (node.children.length === 0) {
			return { key, path, found: node.keys.includes(key) };
		}
		let idx = 0;
		for (let i = 0; i < node.keys.length; i++) {
			if ((node.keys[i] ?? Infinity) <= key) idx = i;
		}
		node = tree.nodes[node.children[idx] ?? -1];
	}
}

export interface BNodeBox {
	id: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Positions of nodes in a `width` x `height` box: leaves evenly spaced, parents centred over children. */
export function layoutBTree(
	tree: BTree,
	width: number,
	height: number,
	boxW: number,
	boxH: number,
): BNodeBox[] {
	const leaves = tree.nodes.filter((n) => n.level === 0);
	const slot = width / leaves.length;
	const rowY = (level: number) =>
		(tree.height - 1 - level) * ((height - boxH) / Math.max(1, tree.height - 1));
	const xOf = new Map<number, number>();
	leaves.forEach((leaf, i) => xOf.set(leaf.id, i * slot + (slot - boxW) / 2));
	for (let level = 1; level < tree.height; level++) {
		for (const node of tree.nodes.filter((n) => n.level === level)) {
			const cx = node.children.map((c) => (xOf.get(c) ?? 0) + boxW / 2);
			const mid = (Math.min(...cx) + Math.max(...cx)) / 2;
			xOf.set(node.id, mid - boxW / 2);
		}
	}
	return tree.nodes.map((n) => ({
		id: n.id,
		x: xOf.get(n.id) ?? 0,
		y: rowY(n.level),
		w: boxW,
		h: boxH,
	}));
}

/** Range of a leaf as text: "5–15". */
export function leafRange(node: BNode): string {
	return `${node.keys[0]}–${node.keys[node.keys.length - 1]}`;
}
