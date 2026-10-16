import { describe, expect, it } from 'vitest';
import type { PrereqGraphData } from '$lib/contracts/registry';
import { chain, chapterEdges, layoutSitemap, wrapTitle } from './sitemap-layout';

const node = (id: string, topic: string, kind: 'chapter' | 'concept' = 'chapter') => ({
	id,
	kind,
	title: id,
	topic,
});

const graph = {
	nodes: [
		node('dl/a', 'dl'),
		node('dl/b', 'dl'),
		node('dl/c', 'dl'),
		node('cs/x', 'cs'),
		node('cs/y', 'cs'),
		node('term', 'dl', 'concept'),
	],
	edges: [
		{ from: 'dl/a', to: 'dl/b', kind: 'prereq' },
		{ from: 'dl/b', to: 'dl/c', kind: 'prereq' },
		{ from: 'cs/x', to: 'dl/c', kind: 'prereq' },
		{ from: 'dl/a', to: 'term', kind: 'introduces' },
		{ from: 'term', to: 'cs/y', kind: 'requires' },
	],
} as PrereqGraphData;

const topics = [
	{ id: 'dl', title: 'DL', chapterIds: ['dl/a', 'dl/b', 'dl/c'] },
	{ id: 'cs', title: 'CS', chapterIds: ['cs/x', 'cs/y'] },
];

describe('layoutSitemap', () => {
	const l = layoutSitemap(graph, topics);
	const n = (id: string) => l.nodes.find((x) => x.id === id)!;

	it('puts a chapter one column right of its prerequisite', () => {
		expect(n('dl/b').layer).toBe(n('dl/a').layer + 1);
		expect(n('dl/c').layer).toBe(2);
		expect(n('dl/b').x).toBeGreaterThan(n('dl/a').x);
	});

	it('keeps nodes inside their cluster and clusters inside the canvas', () => {
		for (const nd of l.nodes) {
			const c = l.clusters.find((k) => k.topic === nd.topic)!;
			expect(nd.x).toBeGreaterThanOrEqual(c.x);
			expect(nd.x + nd.w).toBeLessThanOrEqual(c.x + c.w);
			expect(nd.y + nd.h).toBeLessThanOrEqual(c.y + c.h);
		}
		for (const c of l.clusters) expect(c.x + c.w).toBeLessThanOrEqual(l.width);
	});

	it('wraps clusters into rows without overlap', () => {
		const narrow = layoutSitemap(graph, topics, { maxRowWidth: 200 });
		const [a, b] = narrow.clusters;
		expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.h);
	});

	it('marks cross-topic edges and derives uses edges', () => {
		expect(l.edges.find((e) => e.from === 'cs/x' && e.to === 'dl/c')?.cross).toBe(true);
		const uses = l.edges.find((e) => e.kind === 'uses');
		expect(uses).toMatchObject({ from: 'dl/a', to: 'cs/y', cross: true });
	});

	it('is deterministic', () => {
		expect(layoutSitemap(graph, topics)).toEqual(l);
	});
});

describe('helpers', () => {
	it('chapterEdges drops unknown ids', () => {
		const edges = chapterEdges(graph, new Set(['dl/a', 'dl/b']));
		expect(edges).toEqual([{ from: 'dl/a', to: 'dl/b', kind: 'prereq' }]);
	});

	it('chain returns ancestors and descendants', () => {
		const edges = chapterEdges(graph, new Set(graph.nodes.map((x) => x.id)));
		const c = chain(edges, 'dl/b');
		expect([...c.ancestors]).toEqual(['dl/a']);
		expect([...c.descendants]).toEqual(['dl/c']);
	});

	it('wrapTitle cuts long titles with an ellipsis', () => {
		const lines = wrapTitle('word '.repeat(20), 22, 2);
		expect(lines).toHaveLength(2);
		expect(lines[1]!.endsWith('…')).toBe(true);
	});
});
