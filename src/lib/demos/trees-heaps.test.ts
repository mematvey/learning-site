import { describe, expect, it } from 'vitest';
import {
	BALANCED_KEYS,
	SORTED_KEYS,
	bstSteps,
	heapGeometry,
	heapPop,
	heapPush,
	layoutTree,
	parseKeys,
	topKOf,
	topKSteps,
	treeLevels,
} from './trees-heaps';

/** Element at index i; the tests only index inside the array. */
function at<T>(xs: readonly T[], i: number): T {
	const v = xs[i];
	if (v === undefined) throw new Error(`index ${i} out of range`);
	return v;
}

describe('parseKeys', () => {
	it('accepts spaces, commas and semicolons', () => {
		expect(parseKeys('4, 2;6 1')).toEqual({ keys: [4, 2, 6, 1], error: null });
	});

	it('rejects empty input, duplicates, non-integers and out-of-range keys', () => {
		expect(parseKeys('   ').error).not.toBeNull();
		expect(parseKeys('1, 2, 2').error).not.toBeNull();
		expect(parseKeys('1, a').error).not.toBeNull();
		expect(parseKeys('0').error).not.toBeNull();
		expect(parseKeys('100').error).not.toBeNull();
	});

	it('rejects more keys than the demo allows', () => {
		const text = Array.from({ length: 13 }, (_, i) => String(i + 1)).join(' ');
		expect(parseKeys(text).error).not.toBeNull();
	});
});

describe('BST insertion', () => {
	it('ascending order gives a chain of 7 levels', () => {
		const steps = bstSteps(SORTED_KEYS);
		expect(at(steps, steps.length - 1).levels).toBe(7);
	});

	it('balanced order of the same keys gives 3 levels', () => {
		const steps = bstSteps(BALANCED_KEYS);
		expect(at(steps, steps.length - 1).levels).toBe(3);
	});

	it('step 0 is empty and step s holds s keys', () => {
		const steps = bstSteps(BALANCED_KEYS);
		expect(at(steps, 0).levels).toBe(0);
		expect(steps.length).toBe(BALANCED_KEYS.length + 1);
		expect(treeLevels(at(steps, 4).root)).toBe(at(steps, 4).levels);
	});

	it('the path of the last insertion ends with the new key', () => {
		const steps = bstSteps(BALANCED_KEYS);
		// after 4, 2, 6, 1 the key 1 is inserted: 4 -> 2 -> 1
		expect(at(steps, 4).path).toEqual([4, 2, 1]);
		expect(at(steps, 4).inserted).toBe(1);
	});

	it('in-order layout lists the keys in sorted order', () => {
		const steps = bstSteps(BALANCED_KEYS);
		const tree = layoutTree(at(steps, steps.length - 1).root);
		const sorted = [...tree.nodes].sort((a, b) => a.x - b.x).map((n) => n.label);
		expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(tree.edges.length).toBe(6);
	});
});

describe('heap primitives', () => {
	it('heapPush and heapPop return values in ascending order', () => {
		const heap: number[] = [];
		for (const v of [5, 1, 9, 3, 7, 2]) heapPush(heap, v);
		const out: number[] = [];
		let v = heapPop(heap);
		while (v !== undefined) {
			out.push(v);
			v = heapPop(heap);
		}
		expect(out).toEqual([1, 2, 3, 5, 7, 9]);
	});

	it('the heap property holds after each push', () => {
		const heap: number[] = [];
		for (const v of [8, 3, 6, 1, 9, 2, 7]) {
			heapPush(heap, v);
			for (let i = 1; i < heap.length; i++) {
				expect(at(heap, (i - 1) >> 1)).toBeLessThanOrEqual(at(heap, i));
			}
		}
	});

	it('pop on an empty heap is undefined', () => {
		expect(heapPop([])).toBeUndefined();
	});
});

describe('top-k', () => {
	it('matches sorting the whole stream', () => {
		const values = [17, 3, 42, 8, 25, 99, 1, 64, 12, 50];
		for (let k = 1; k <= 5; k++) {
			const expected = [...values].sort((a, b) => b - a).slice(0, k);
			expect(topKOf(values, k)).toEqual(expected);
		}
	});

	it('fills the heap first, then replaces only values larger than the minimum', () => {
		const steps = topKSteps([5, 2, 7, 1, 6], 3);
		expect(steps.map((s) => s.action)).toEqual(['fill', 'fill', 'fill', 'skip', 'replace']);
		expect(at(steps, 2).kth).toBe(2);
		expect(at(steps, 4).evicted).toBe(2);
		expect(at(steps, 4).kth).toBe(5);
	});

	it('reports no k-th value while the heap is not full', () => {
		const steps = topKSteps([4, 9], 3);
		expect(at(steps, 1).kth).toBeNull();
	});
});

describe('heapGeometry', () => {
	it('places a heap of 5 nodes on 3 levels with parent links', () => {
		const tree = heapGeometry([1, 3, 2, 7, 4], null);
		expect(tree.nodes.length).toBe(5);
		expect(tree.edges.length).toBe(4);
		const depths = tree.nodes.map((n) => n.y);
		expect(new Set(depths).size).toBe(3);
	});

	it('is empty for an empty heap', () => {
		expect(heapGeometry([], null)).toEqual({ nodes: [], edges: [], height: 44 });
	});
});
