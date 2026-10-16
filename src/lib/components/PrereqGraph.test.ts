import { describe, expect, it } from 'vitest';
import { layoutPrereq, NODE_W, wrapText } from './PrereqGraph.svelte';
import type { PrereqGraphData } from '$lib/contracts/registry';

const chain: PrereqGraphData = {
	nodes: [
		{ id: 'dl/a', kind: 'chapter', title: 'A', topic: 'dl' },
		{ id: 'dl/b', kind: 'chapter', title: 'B', topic: 'dl' },
		{ id: 'dl/c', kind: 'chapter', title: 'C', topic: 'dl' },
		{ id: 'dl/d', kind: 'chapter', title: 'D', topic: 'dl' },
		{ id: 'cs/x', kind: 'chapter', title: 'X', topic: 'cs' },
	],
	edges: [
		{ from: 'dl/a', to: 'dl/b', kind: 'prereq' },
		{ from: 'dl/b', to: 'dl/c', kind: 'prereq' },
		{ from: 'dl/c', to: 'dl/d', kind: 'prereq' },
		{ from: 'cs/x', to: 'dl/d', kind: 'prereq' },
	],
};

describe('layoutPrereq', () => {
	it('lays a chain of four chapters out in four columns', () => {
		const layout = layoutPrereq(chain, 'dl');
		const xs = ['dl/a', 'dl/b', 'dl/c', 'dl/d'].map(
			(id) => layout.nodes.find((n) => n.id === id)?.x,
		);
		expect(new Set(xs).size).toBe(4);
		expect(xs).toEqual([...xs].sort((p, q) => (p ?? 0) - (q ?? 0)));
	});

	it('puts two independent chapters in the same column, in different rows', () => {
		const layout = layoutPrereq({
			nodes: [
				{ id: 'dl/a', kind: 'chapter', title: 'A', topic: 'dl' },
				{ id: 'dl/b', kind: 'chapter', title: 'B', topic: 'dl' },
			],
			edges: [],
		});
		const [a, b] = [layout.nodes[0]!, layout.nodes[1]!];
		expect(a.x).toBe(b.x);
		expect(a.y).not.toBe(b.y);
	});

	it('throws on a cycle', () => {
		const cyclic: PrereqGraphData = {
			nodes: [
				{ id: 'dl/a', kind: 'chapter', title: 'A', topic: 'dl' },
				{ id: 'dl/b', kind: 'chapter', title: 'B', topic: 'dl' },
			],
			edges: [
				{ from: 'dl/a', to: 'dl/b', kind: 'prereq' },
				{ from: 'dl/b', to: 'dl/a', kind: 'prereq' },
			],
		};
		expect(() => layoutPrereq(cyclic)).toThrow(/cycle/);
	});

	it('filters by topic and drops edges to other topics', () => {
		const layout = layoutPrereq(chain, 'dl');
		expect(layout.nodes.map((n) => n.id).sort()).toEqual(['dl/a', 'dl/b', 'dl/c', 'dl/d']);
		expect(layout.edges.every((e) => !e.from.startsWith('cs/'))).toBe(true);
	});

	it('draws edges from the right side of the source to the left side of the target', () => {
		const layout = layoutPrereq(chain, 'dl');
		const a = layout.nodes.find((n) => n.id === 'dl/a');
		const edge = layout.edges.find((e) => e.from === 'dl/a' && e.to === 'dl/b');
		expect(a).toBeDefined();
		expect(edge?.d.startsWith(`M${a!.x + NODE_W} ${a!.y + a!.h / 2} `)).toBe(true);
	});

	it('fits the canvas around the nodes', () => {
		const layout = layoutPrereq(chain);
		for (const n of layout.nodes) {
			expect(n.x + n.w).toBeLessThanOrEqual(layout.width);
			expect(n.y + n.h).toBeLessThanOrEqual(layout.height);
		}
	});

	it('shows concepts of the expanded chapter as chips, not as graph nodes', () => {
		const graph: PrereqGraphData = {
			nodes: [
				{ id: 'dl/a', kind: 'chapter', title: 'A', topic: 'dl' },
				{ id: 'softmax', kind: 'concept', title: 'Softmax', topic: 'dl' },
				{ id: 'key', kind: 'concept', title: 'Ключ', topic: 'dl' },
			],
			edges: [
				{ from: 'dl/a', to: 'softmax', kind: 'introduces' },
				{ from: 'dl/a', to: 'key', kind: 'introduces' },
			],
		};
		const plain = layoutPrereq(graph, 'dl');
		expect(plain.nodes).toHaveLength(1);
		expect(plain.nodes[0]!.chips).toHaveLength(0);
		const open = layoutPrereq(graph, 'dl', 'dl/a');
		expect(open.nodes[0]!.chips.map((c) => c.lines.join(' '))).toEqual(['Softmax', 'Ключ']);
		expect(open.nodes[0]!.h).toBe(plain.nodes[0]!.h);
		expect(open.height).toBeGreaterThan(plain.height);
	});

	it('returns an empty layout for a topic without chapters', () => {
		const layout = layoutPrereq(chain, 'mlops');
		expect(layout.nodes).toEqual([]);
		expect(layout.edges).toEqual([]);
	});
});

describe('wrapText', () => {
	it('wraps on words and keeps every word', () => {
		const lines = wrapText('Масштабированное скалярное произведение', 20, 3);
		expect(lines).toEqual(['Масштабированное', 'скалярное', 'произведение']);
	});

	it('cuts text beyond the line limit with an ellipsis', () => {
		const lines = wrapText('один два три четыре пять шесть семь', 10, 2);
		expect(lines).toHaveLength(2);
		expect(lines[1]!.endsWith('…')).toBe(true);
		expect(lines.every((l) => l.length <= 10)).toBe(true);
	});
});
