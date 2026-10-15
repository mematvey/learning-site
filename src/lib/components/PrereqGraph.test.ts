import { describe, expect, it } from 'vitest';
import { layoutPrereq, NODE_H, NODE_W } from './PrereqGraph.svelte';
import type { PrereqGraphData } from '$lib/contracts/registry';

const graph: PrereqGraphData = {
	nodes: [
		{ id: 'dl/a', kind: 'chapter', title: 'A', topic: 'dl' },
		{ id: 'dl/b', kind: 'chapter', title: 'B', topic: 'dl' },
		{ id: 'dl/c', kind: 'chapter', title: 'C', topic: 'dl' },
		{ id: 'cs/x', kind: 'chapter', title: 'X', topic: 'cs' },
	],
	edges: [
		{ from: 'dl/a', to: 'dl/b', kind: 'prereq' },
		{ from: 'dl/a', to: 'dl/c', kind: 'prereq' },
		{ from: 'dl/b', to: 'dl/c', kind: 'prereq' },
		{ from: 'cs/x', to: 'dl/c', kind: 'prereq' },
	],
};

describe('layoutPrereq', () => {
	it('puts a node one column right of its deepest prerequisite', () => {
		const layout = layoutPrereq(graph);
		const layerOf = (id: string) => layout.nodes.find((n) => n.id === id)?.layer;
		expect(layerOf('dl/a')).toBe(0);
		expect(layerOf('dl/b')).toBe(1);
		// C depends on B (layer 1), so it sits in layer 2 even though A also points at it.
		expect(layerOf('dl/c')).toBe(2);
	});

	it('keeps nodes of one column in different rows', () => {
		const layout = layoutPrereq(graph);
		const x0 = layout.nodes.filter((n) => n.layer === 0).map((n) => n.y);
		expect(new Set(x0).size).toBe(x0.length);
	});

	it('filters by topic and drops edges to other topics', () => {
		const layout = layoutPrereq(graph, 'dl');
		expect(layout.nodes.map((n) => n.id).sort()).toEqual(['dl/a', 'dl/b', 'dl/c']);
		expect(layout.edges.every((e) => !e.from.startsWith('cs/'))).toBe(true);
	});

	it('draws edges from the right side of the source to the left side of the target', () => {
		const layout = layoutPrereq(graph, 'dl');
		const a = layout.nodes.find((n) => n.id === 'dl/a');
		const edge = layout.edges.find((e) => e.from === 'dl/a' && e.to === 'dl/b');
		expect(a).toBeDefined();
		expect(edge?.d.startsWith(`M${a!.x + NODE_W} ${a!.y + NODE_H / 2} `)).toBe(true);
	});

	it('fits the viewBox around the nodes', () => {
		const layout = layoutPrereq(graph);
		for (const n of layout.nodes) {
			expect(n.x + NODE_W).toBeLessThanOrEqual(layout.width);
			expect(n.y + NODE_H).toBeLessThanOrEqual(layout.height);
		}
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
});
