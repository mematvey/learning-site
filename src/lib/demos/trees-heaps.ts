/**
 * Math of the tree and heap demo: BST insertion step by step, the drawing of a tree and of a heap,
 * and top-k with a min-heap (heappush / heappop) step by step.
 * Pure functions only: no DOM, no Svelte.
 */

export const KEY_MIN = 1;
export const KEY_MAX = 99;
export const MAX_KEYS = 12;
export const K_MIN = 1;
export const K_MAX = 5;

/** Keys inserted in ascending order: the BST degenerates into a chain of 7 levels. */
export const SORTED_KEYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];
/** The same keys in a balanced order: the BST has 3 levels. */
export const BALANCED_KEYS: readonly number[] = [4, 2, 6, 1, 3, 5, 7];

/** Width of the drawing box in SVG units; the SVG is scaled to the container width. */
export const DRAW_W = 360;
const PAD_X = 22;
const PAD_Y = 22;

export interface ParsedKeys {
	keys: number[];
	error: string | null;
}

/** Parses user input: integers separated by spaces, commas or semicolons. Keys must be unique. */
export function parseKeys(text: string): ParsedKeys {
	const tokens = text.split(/[\s,;]+/).filter((t) => t.length > 0);
	if (tokens.length === 0) return { keys: [], error: 'Введите хотя бы один ключ.' };
	if (tokens.length > MAX_KEYS) return { keys: [], error: `Не больше ${MAX_KEYS} ключей.` };
	const keys: number[] = [];
	for (const t of tokens) {
		if (!/^\d+$/.test(t)) return { keys: [], error: `«${t}» не целое число.` };
		const v = Number(t);
		if (v < KEY_MIN || v > KEY_MAX) {
			return { keys: [], error: `Ключ ${v} вне диапазона ${KEY_MIN}–${KEY_MAX}.` };
		}
		if (keys.includes(v)) return { keys: [], error: `Ключ ${v} повторяется: ключи уникальны.` };
		keys.push(v);
	}
	return { keys, error: null };
}

export interface BstNode {
	key: number;
	left: BstNode | null;
	right: BstNode | null;
}

/** Number of levels (nodes on the longest root-to-leaf path). An empty tree has 0 levels. */
export function treeLevels(root: BstNode | null): number {
	if (root === null) return 0;
	return 1 + Math.max(treeLevels(root.left), treeLevels(root.right));
}

/**
 * Inserts a key into a BST. Returns the root and the path: the keys compared on the way down,
 * then the new key. The tree is changed in place.
 */
export function bstInsert(root: BstNode | null, key: number): { root: BstNode; path: number[] } {
	const leaf: BstNode = { key, left: null, right: null };
	if (root === null) return { root: leaf, path: [key] };
	const path: number[] = [];
	let cur = root;
	for (;;) {
		path.push(cur.key);
		if (key < cur.key) {
			if (cur.left === null) {
				cur.left = leaf;
				break;
			}
			cur = cur.left;
		} else {
			if (cur.right === null) {
				cur.right = leaf;
				break;
			}
			cur = cur.right;
		}
	}
	path.push(key);
	return { root, path };
}

export interface BstStep {
	/** Tree after the first `inserted` keys. */
	root: BstNode | null;
	/** Keys visited by the last insertion (ancestors, then the new key). Empty for step 0. */
	path: number[];
	levels: number;
	/** The key inserted at this step, null for step 0. */
	inserted: number | null;
}

/**
 * Snapshots of the BST: step s holds the tree after the first s insertions.
 * Every snapshot is built from scratch, so the steps do not share nodes.
 */
export function bstSteps(keys: readonly number[]): BstStep[] {
	const steps: BstStep[] = [{ root: null, path: [], levels: 0, inserted: null }];
	for (let i = 1; i <= keys.length; i++) {
		let root: BstNode | null = null;
		let path: number[] = [];
		for (const key of keys.slice(0, i)) {
			const r = bstInsert(root, key);
			root = r.root;
			path = r.path;
		}
		steps.push({ root, path, levels: treeLevels(root), inserted: keys[i - 1] as number });
	}
	return steps;
}

export interface DrawNode {
	id: number;
	label: number;
	x: number;
	y: number;
	/** The node lies on the path of the last step (or is the new heap element). */
	highlight: boolean;
	/** The node was created or changed by the last step. */
	isNew: boolean;
}

export interface DrawEdge {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface DrawTree {
	nodes: DrawNode[];
	edges: DrawEdge[];
	/** Height of the drawing box in SVG units. */
	height: number;
}

interface Placed {
	id: number;
	label: number;
	/** Horizontal position as a fraction in (0, 1). */
	frac: number;
	depth: number;
	parentId: number | null;
	highlight: boolean;
	isNew: boolean;
}

function toDrawTree(placed: Placed[], levels: number, maxGap: number): DrawTree {
	const gap = levels > 1 ? Math.max(30, Math.min(maxGap, Math.floor(300 / (levels - 1)))) : maxGap;
	const height = PAD_Y * 2 + Math.max(0, levels - 1) * gap;
	const pos = new Map<number, { x: number; y: number }>();
	const nodes: DrawNode[] = placed.map((p) => {
		const x = PAD_X + p.frac * (DRAW_W - 2 * PAD_X);
		const y = PAD_Y + p.depth * gap;
		pos.set(p.id, { x, y });
		return {
			id: p.id,
			label: p.label,
			x,
			y,
			highlight: p.highlight,
			isNew: p.isNew,
		};
	});
	const edges: DrawEdge[] = [];
	for (const p of placed) {
		if (p.parentId === null) continue;
		const from = pos.get(p.parentId);
		const to = pos.get(p.id);
		if (from && to) edges.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
	}
	return { nodes, edges, height };
}

/**
 * Drawing of a BST. Nodes are placed in in-order, so the keys read left to right.
 * `path` and `inserted` come from the BST step.
 */
export function layoutTree(
	root: BstNode | null,
	path: readonly number[] = [],
	inserted: number | null = null,
): DrawTree {
	const placed: Placed[] = [];
	const walk = (node: BstNode | null, depth: number, parentId: number | null): void => {
		if (node === null) return;
		walk(node.left, depth + 1, node.key);
		placed.push({
			id: node.key,
			label: node.key,
			frac: 0,
			depth,
			parentId,
			highlight: path.includes(node.key),
			isNew: node.key === inserted,
		});
		walk(node.right, depth + 1, node.key);
	};
	walk(root, 0, null);
	const n = placed.length;
	placed.forEach((p, i) => {
		p.frac = (i + 1) / (n + 1);
	});
	return toDrawTree(placed, treeLevels(root), 56);
}

/** Pushes a value into a min-heap stored in a plain array (sift up). */
export function heapPush(heap: number[], value: number): void {
	heap.push(value);
	let i = heap.length - 1;
	while (i > 0) {
		const parent = (i - 1) >> 1;
		if ((heap[parent] as number) <= (heap[i] as number)) break;
		[heap[parent], heap[i]] = [heap[i] as number, heap[parent] as number];
		i = parent;
	}
}

/** Removes and returns the smallest value of a min-heap (sift down). Undefined if empty. */
export function heapPop(heap: number[]): number | undefined {
	if (heap.length === 0) return undefined;
	const top = heap[0] as number;
	const last = heap.pop() as number;
	if (heap.length > 0) {
		heap[0] = last;
		let i = 0;
		for (;;) {
			const l = 2 * i + 1;
			const r = l + 1;
			let m = i;
			if (l < heap.length && (heap[l] as number) < (heap[m] as number)) m = l;
			if (r < heap.length && (heap[r] as number) < (heap[m] as number)) m = r;
			if (m === i) break;
			[heap[m], heap[i]] = [heap[i] as number, heap[m] as number];
			i = m;
		}
	}
	return top;
}

export type TopKAction = 'fill' | 'replace' | 'skip';

export interface TopKStep {
	/** The value read at this step. */
	value: number;
	/** `fill`: heap not full yet; `replace`: value beats the heap minimum; `skip`: it does not. */
	action: TopKAction;
	/** The value removed from the heap by `replace`, otherwise null. */
	evicted: number | null;
	/** The heap after the step. */
	heap: number[];
	/** The k-th largest value seen so far (the heap minimum), or null while the heap is not full. */
	kth: number | null;
}

/** Top-k over a stream: a min-heap of the k largest values seen so far. */
export function topKSteps(values: readonly number[], k: number): TopKStep[] {
	const heap: number[] = [];
	const steps: TopKStep[] = [];
	for (const value of values) {
		let action: TopKAction = 'skip';
		let evicted: number | null = null;
		if (heap.length < k) {
			heapPush(heap, value);
			action = 'fill';
		} else if (value > (heap[0] as number)) {
			evicted = heapPop(heap) ?? null;
			heapPush(heap, value);
			action = 'replace';
		}
		steps.push({
			value,
			action,
			evicted,
			heap: [...heap],
			kth: heap.length === k ? (heap[0] as number) : null,
		});
	}
	return steps;
}

/** The k largest values, sorted in descending order. */
export function topKOf(values: readonly number[], k: number): number[] {
	const steps = topKSteps(values, k);
	const last = steps.at(-1);
	return last ? [...last.heap].sort((a, b) => b - a) : [];
}

/**
 * Drawing of a heap as a complete binary tree: index i has parent (i - 1) >> 1.
 * `fresh` is the value touched by the last step; it is highlighted together with the root.
 */
export function heapGeometry(heap: readonly number[], fresh: number | null): DrawTree {
	const n = heap.length;
	let levels = 0;
	while (1 << levels <= n) levels++;
	const placed: Placed[] = [];
	for (let i = 0; i < n; i++) {
		let depth = 0;
		while (1 << (depth + 1) <= i + 1) depth++;
		const j = i + 1 - (1 << depth);
		const width = 1 << depth;
		placed.push({
			id: i,
			label: heap[i] as number,
			frac: (j + 0.5) / width,
			depth,
			parentId: i === 0 ? null : (i - 1) >> 1,
			highlight: i === 0,
			isNew: heap[i] === fresh,
		});
	}
	return toDrawTree(placed, levels, 56);
}
