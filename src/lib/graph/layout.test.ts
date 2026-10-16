import { describe, expect, it } from 'vitest';
import type { PrereqGraphData } from '$lib/contracts/registry';
import {
	NODE_W,
	fitScale,
	layoutGraph,
	neighbor,
	relatives,
	revealRect,
	statusOf,
	wrapText,
	zoomAt,
} from './layout';

const ch = (id: string, topic: 'dl' | 'cs' = 'dl') => ({
	id,
	kind: 'chapter' as const,
	title: id.toUpperCase(),
	topic,
});
const pre = (from: string, to: string) => ({ from, to, kind: 'prereq' as const });

const chain: PrereqGraphData = {
	nodes: [ch('dl/a'), ch('dl/b'), ch('dl/c'), ch('dl/d'), ch('cs/x', 'cs')],
	edges: [pre('dl/a', 'dl/b'), pre('dl/b', 'dl/c'), pre('dl/c', 'dl/d'), pre('cs/x', 'dl/d')],
};

describe('layoutGraph', () => {
	it('puts a chain in strictly increasing columns', () => {
		const l = layoutGraph(chain, { topic: 'dl' });
		const xs = ['dl/a', 'dl/b', 'dl/c', 'dl/d'].map((id) => l.nodes.find((n) => n.id === id)!.x);
		expect(new Set(xs).size).toBe(4);
		expect(xs).toEqual([...xs].sort((p, q) => p - q));
	});

	it('stacks independent chapters of one layer in different rows', () => {
		const l = layoutGraph({ nodes: [ch('dl/a'), ch('dl/b')], edges: [] });
		expect(l.nodes[0]!.x).toBe(l.nodes[1]!.x);
		expect(l.nodes[0]!.y).not.toBe(l.nodes[1]!.y);
	});

	it('throws on a cycle', () => {
		const g = {
			nodes: [ch('dl/a'), ch('dl/b')],
			edges: [pre('dl/a', 'dl/b'), pre('dl/b', 'dl/a')],
		};
		expect(() => layoutGraph(g)).toThrow(/cycle/);
	});

	it('filters by topic and drops foreign edges', () => {
		const l = layoutGraph(chain, { topic: 'dl' });
		expect(l.nodes.map((n) => n.id).sort()).toEqual(['dl/a', 'dl/b', 'dl/c', 'dl/d']);
		expect(l.edges.some((e) => e.from === 'cs/x')).toBe(false);
	});

	it('keeps only the neighbourhood within depth, across topics', () => {
		const l = layoutGraph(chain, { focus: 'dl/c', depth: 1 });
		expect(l.nodes.map((n) => n.id).sort()).toEqual(['dl/b', 'dl/c', 'dl/d']);
		const wide = layoutGraph(chain, { focus: 'dl/d', depth: 2 });
		expect(wide.nodes.map((n) => n.id).sort()).toEqual(['cs/x', 'dl/b', 'dl/c', 'dl/d']);
	});

	it('starts edges at the right side of the source and fits the canvas', () => {
		const l = layoutGraph(chain, { topic: 'dl' });
		const a = l.nodes.find((n) => n.id === 'dl/a')!;
		const e = l.edges.find((x) => x.from === 'dl/a')!;
		expect(e.d.startsWith(`M${a.x + NODE_W} ${a.y + a.h / 2} `)).toBe(true);
		for (const n of l.nodes) {
			expect(n.x + n.w).toBeLessThanOrEqual(l.width);
			expect(n.y + n.h).toBeLessThanOrEqual(l.height);
		}
	});

	it('is empty for a topic without chapters', () => {
		expect(layoutGraph(chain, { topic: 'mlops' }).nodes).toEqual([]);
	});
});

describe('relatives and neighbor', () => {
	const edges = chain.edges;
	it('finds ancestors and descendants', () => {
		const r = relatives(edges, 'dl/b');
		expect([...r.ancestors]).toEqual(['dl/a']);
		expect([...r.descendants].sort()).toEqual(['dl/c', 'dl/d']);
	});

	it('moves along edges with arrow keys', () => {
		const l = layoutGraph(chain, { topic: 'dl' });
		expect(neighbor(l, 'dl/b', 'left')).toBe('dl/a');
		expect(neighbor(l, 'dl/b', 'right')).toBe('dl/c');
		expect(neighbor(l, 'dl/a', 'left')).toBeUndefined();
	});
});

describe('statusOf', () => {
	it('prefers done over in-progress', () => {
		expect(statusOf('a', new Set(['a']), new Set(['a']))).toBe('done');
		expect(statusOf('a', new Set(), new Set(['a']))).toBe('progress');
		expect(statusOf('a', new Set(), new Set())).toBe('new');
	});
});

describe('viewport', () => {
	it('fits wide layouts but not below the floor', () => {
		expect(fitScale(1000, 500)).toBe(0.6);
		expect(fitScale(400, 500)).toBe(1);
		expect(fitScale(800, 600)).toBeCloseTo(0.75);
	});

	it('keeps the zoom anchor fixed', () => {
		const v = zoomAt({ scale: 1, x: 10, y: 20 }, 2, 100, 100);
		expect(v.scale).toBe(2);
		expect(100 - (100 - v.x) / 2).toBeCloseTo(100 - (100 - 10) / 1);
	});

	it('pans a hidden rect into view', () => {
		const v = revealRect({ scale: 1, x: 0, y: 0 }, { x: 500, y: 0, w: 100, h: 30 }, 300, 200);
		expect(500 + v.x).toBeLessThan(300);
	});
});

describe('wrapText', () => {
	it('wraps on words', () => {
		expect(wrapText('Масштабированное скалярное произведение', 20, 3)).toEqual([
			'Масштабированное',
			'скалярное',
			'произведение',
		]);
	});
	it('cuts with an ellipsis', () => {
		const lines = wrapText('один два три четыре пять шесть семь', 10, 2);
		expect(lines).toHaveLength(2);
		expect(lines[1]!.endsWith('…')).toBe(true);
	});
});
