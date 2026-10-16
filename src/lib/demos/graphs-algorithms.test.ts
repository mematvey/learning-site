import { describe, expect, it } from 'vitest';
import {
	DEMO_GRAPH,
	WEIGHT_MAX,
	WEIGHT_MIN,
	applyPatch,
	bfsSteps,
	clampWeight,
	dfsSteps,
	dijkstraSteps,
	setEdgeWeight,
	snapStart,
	traverse,
	type AlgoStep,
	type Graph,
} from './graphs-algorithms';

/** Visit order of the last step, as vertex indices. */
function finalOrder(steps: AlgoStep[]): number[] {
	return steps[steps.length - 1]?.order ?? [];
}

describe('bfsSteps', () => {
	it('visits level by level from A', () => {
		const steps = bfsSteps(DEMO_GRAPH, 0);
		expect(finalOrder(steps)).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	it('counts edges, not weights, for the distance', () => {
		const last = bfsSteps(DEMO_GRAPH, 0).at(-1);
		// A -> C -> E -> G is three edges, although the weight is 7.
		expect(last?.dist[6]).toBe(3);
	});

	it('leaves unreachable vertices out and names them at the end', () => {
		const g: Graph = {
			vertices: [
				{ id: 'X', x: 0, y: 0 },
				{ id: 'Y', x: 1, y: 0 },
				{ id: 'Z', x: 0.5, y: 1 },
			],
			edges: [{ a: 0, b: 1, w: 1 }],
		};
		const steps = bfsSteps(g, 0);
		expect(finalOrder(steps)).toEqual([0, 1]);
		expect(steps.at(-1)?.text).toContain('Недостижимы: Z');
		expect(steps.at(-1)?.dist[2]).toBeNull();
	});
});

describe('dfsSteps', () => {
	it('goes deep first with the smallest neighbour taken first', () => {
		expect(finalOrder(dfsSteps(DEMO_GRAPH, 0))).toEqual([0, 1, 3, 2, 4, 6, 5]);
	});

	it('records the parent of each vertex in the tree', () => {
		const last = dfsSteps(DEMO_GRAPH, 0).at(-1);
		expect(last?.parent[0]).toBeNull();
		expect(last?.parent[1]).toBe(0);
		expect(last?.parent[3]).toBe(1);
	});
});

describe('dijkstraSteps', () => {
	it('gives the weighted shortest distances from A', () => {
		const last = dijkstraSteps(DEMO_GRAPH, 0).at(-1);
		// A B C D E F G
		expect(last?.dist).toEqual([0, 4, 2, 6, 3, 8, 7]);
	});

	it('finalises vertices by nondecreasing distance', () => {
		const steps = dijkstraSteps(DEMO_GRAPH, 0);
		const taken = steps.slice(1, -1).map((s) => s.current as number);
		const dists = taken.map((v) => steps.find((s) => s.current === v)?.dist[v] ?? -1);
		expect(taken).toEqual([0, 2, 4, 1, 3, 6, 5]);
		expect(dists).toEqual([...dists].sort((p, q) => p - q));
	});

	it('gives the parent that realises the best distance', () => {
		const last = dijkstraSteps(DEMO_GRAPH, 0).at(-1);
		// D is reached through E (3 + 3 = 6), not through B (4 + 5 = 9) or C (2 + 8 = 10).
		expect(last?.parent[3]).toBe(4);
	});
});

describe('traverse', () => {
	it('is deterministic for the same input', () => {
		expect(traverse(DEMO_GRAPH, 2, 'dijkstra')).toEqual(traverse(DEMO_GRAPH, 2, 'dijkstra'));
	});

	it('starts with the start vertex and ends with no current vertex', () => {
		for (const algo of ['bfs', 'dfs', 'dijkstra'] as const) {
			const steps = traverse(DEMO_GRAPH, 4, algo);
			expect(steps[0]?.current).toBeNull();
			expect(steps.at(-1)?.current).toBeNull();
			expect(finalOrder(steps)).toHaveLength(DEMO_GRAPH.vertices.length);
		}
	});
});

describe('clampWeight and setEdgeWeight', () => {
	it('clamps and rounds weights', () => {
		expect(clampWeight(0)).toBe(WEIGHT_MIN);
		expect(clampWeight(99)).toBe(WEIGHT_MAX);
		expect(clampWeight(3.6)).toBe(4);
		expect(clampWeight(Number.NaN)).toBe(WEIGHT_MIN);
	});

	it('returns a new graph and leaves the old one unchanged', () => {
		const next = setEdgeWeight(DEMO_GRAPH, 0, 7);
		expect(next.edges[0]?.w).toBe(7);
		expect(DEMO_GRAPH.edges[0]?.w).toBe(4);
	});
});

describe('applyPatch and snapStart', () => {
	it('ignores invalid fields and snaps the start vertex', () => {
		const base = { algo: 'bfs' as const, start: 0 };
		expect(applyPatch(base, { algo: 'nope' as never, start: 3 })).toEqual({
			algo: 'bfs',
			start: 3,
		});
		expect(applyPatch(base, { start: 100 }, 7).start).toBe(6);
		expect(snapStart(Number.NaN, 7)).toBe(0);
	});
});
