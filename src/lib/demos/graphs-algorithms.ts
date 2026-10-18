/**
 * Math of the graph demo: a fixed graph on seven vertices and four traversals (BFS, DFS,
 * Dijkstra, Bellman-Ford). The `plain` preset is undirected with positive weights; the
 * `negative` preset is directed and has one negative edge. Each traversal is recorded as a
 * list of steps, so the view can move forward and back through it. Pure functions only:
 * no DOM, no Svelte.
 */

export type AlgoKind = 'bfs' | 'dfs' | 'dijkstra' | 'bellman';

/** `plain`: undirected, weights 1..9. `negative`: directed, weights -9..9, one negative edge. */
export type Preset = 'plain' | 'negative';

export interface GraphDemoState {
	/** Which traversal is shown. */
	algo: AlgoKind;
	/** Index of the start vertex. */
	start: number;
	/** Which graph is shown. */
	preset: Preset;
}

/** A vertex with its position on the drawing, both coordinates in [0, 1]. */
export interface Vertex {
	id: string;
	x: number;
	y: number;
}

/** An edge between vertex indices `a` and `b` with weight `w`. In a directed graph it goes a -> b. */
export interface Edge {
	a: number;
	b: number;
	w: number;
}

export interface Graph {
	vertices: Vertex[];
	edges: Edge[];
	/** When false, each edge can be walked from either end. */
	directed: boolean;
}

/** One recorded moment of a traversal. */
export interface AlgoStep {
	/** Vertex taken out of the queue / stack / priority set in this step; null for the first and last step. */
	current: number | null;
	/** Vertices finished so far, in finishing order. */
	order: number[];
	/** Vertices waiting to be taken: queue or stack in container order, or unfinished vertices by distance. */
	frontier: number[];
	/** Hops (BFS) or tentative weighted distance (Dijkstra) per vertex; null for DFS and unreached vertices. */
	dist: (number | null)[];
	/** Parent of each vertex in the traversal tree. */
	parent: (number | null)[];
	/** Vertices reached or improved in this step. */
	touched: number[];
	/** Human-readable description of the step (Russian). */
	text: string;
}

export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 9;
/** Lower bound of the weight range in the `negative` preset. */
export const NEG_WEIGHT_MIN = -9;
export const DEFAULT_ALGO: AlgoKind = 'bfs';
export const DEFAULT_START = 0;
export const DEFAULT_PRESET: Preset = 'plain';

/** Vertex positions are for drawing only. */
const VERTICES: Vertex[] = [
	{ id: 'A', x: 0.08, y: 0.5 },
	{ id: 'B', x: 0.3, y: 0.12 },
	{ id: 'C', x: 0.3, y: 0.88 },
	{ id: 'D', x: 0.55, y: 0.3 },
	{ id: 'E', x: 0.55, y: 0.72 },
	{ id: 'F', x: 0.82, y: 0.15 },
	{ id: 'G', x: 0.84, y: 0.85 },
];

/** The `plain` preset: undirected, positive weights. */
export const DEMO_GRAPH: Graph = {
	vertices: VERTICES,
	directed: false,
	edges: [
		{ a: 0, b: 1, w: 4 },
		{ a: 0, b: 2, w: 2 },
		{ a: 1, b: 3, w: 5 },
		{ a: 2, b: 3, w: 8 },
		{ a: 2, b: 4, w: 1 },
		{ a: 3, b: 4, w: 3 },
		{ a: 3, b: 5, w: 2 },
		{ a: 4, b: 6, w: 4 },
		{ a: 5, b: 6, w: 6 },
	],
};

/**
 * The `negative` preset: the directed example from the chapter (A -> B 1, A -> C 2, C -> B -2)
 * on the same vertices. Dijkstra closes B at distance 1 and misses the path through C (0).
 */
export const DEMO_NEG_GRAPH: Graph = {
	vertices: VERTICES,
	directed: true,
	edges: [
		{ a: 0, b: 1, w: 1 },
		{ a: 0, b: 2, w: 2 },
		{ a: 2, b: 1, w: -2 },
		{ a: 1, b: 3, w: 5 },
		{ a: 2, b: 3, w: 8 },
		{ a: 2, b: 4, w: 1 },
		{ a: 3, b: 4, w: 3 },
		{ a: 3, b: 5, w: 2 },
		{ a: 4, b: 6, w: 4 },
		{ a: 5, b: 6, w: 6 },
	],
};

export function presetGraph(preset: Preset): Graph {
	return preset === 'negative' ? DEMO_NEG_GRAPH : DEMO_GRAPH;
}

export function isAlgoKind(v: unknown): v is AlgoKind {
	return v === 'bfs' || v === 'dfs' || v === 'dijkstra' || v === 'bellman';
}

export function isPreset(v: unknown): v is Preset {
	return v === 'plain' || v === 'negative';
}

/** True when some edge has a negative weight. */
export function hasNegative(graph: Graph): boolean {
	return graph.edges.some((e) => e.w < 0);
}

/** Rounds to an integer weight inside [lo, hi]. Non-finite input gives WEIGHT_MIN. */
export function clampWeight(w: number, lo: number = WEIGHT_MIN, hi: number = WEIGHT_MAX): number {
	if (!Number.isFinite(w)) return WEIGHT_MIN;
	return Math.min(hi, Math.max(lo, Math.round(w)));
}

/** Rounds to a valid vertex index. Non-finite input gives DEFAULT_START. */
export function snapStart(i: number, vertexCount: number): number {
	if (!Number.isFinite(i)) return DEFAULT_START;
	return Math.min(vertexCount - 1, Math.max(0, Math.round(i)));
}

/** Returns a new state with the valid fields of `patch` applied. Invalid fields are ignored. */
export function applyPatch(
	state: GraphDemoState,
	patch: Partial<GraphDemoState>,
	vertexCount: number = DEMO_GRAPH.vertices.length,
): GraphDemoState {
	return {
		algo: isAlgoKind(patch.algo) ? patch.algo : state.algo,
		start: typeof patch.start === 'number' ? snapStart(patch.start, vertexCount) : state.start,
		preset: isPreset(patch.preset) ? patch.preset : state.preset,
	};
}

/**
 * Returns a new graph where edge `index` has weight `w`, clamped to the range of the graph's preset.
 * The input graph is not changed.
 */
export function setEdgeWeight(graph: Graph, index: number, w: number): Graph {
	const lo = graph.directed ? NEG_WEIGHT_MIN : WEIGHT_MIN;
	return {
		vertices: graph.vertices,
		directed: graph.directed,
		edges: graph.edges.map((e, i) => (i === index ? { ...e, w: clampWeight(w, lo) } : e)),
	};
}

/** Adjacency lists, neighbours sorted by vertex index, so every traversal is deterministic. */
export function neighbours(graph: Graph): { to: number; w: number }[][] {
	const adj: { to: number; w: number }[][] = graph.vertices.map(() => []);
	for (const e of graph.edges) {
		adj[e.a]?.push({ to: e.b, w: e.w });
		if (!graph.directed) adj[e.b]?.push({ to: e.a, w: e.w });
	}
	for (const list of adj) list.sort((p, q) => p.to - q.to);
	return adj;
}

/** Runs the chosen traversal and returns all its steps: the first is the start, the last is the finish. */
export function traverse(graph: Graph, start: number, algo: AlgoKind): AlgoStep[] {
	if (algo === 'bfs') return bfsSteps(graph, start);
	if (algo === 'dfs') return dfsSteps(graph, start);
	if (algo === 'bellman') return bellmanFordSteps(graph, start);
	return dijkstraSteps(graph, start);
}

/** Vertex label, or '?' for an index outside the graph. */
export function name(graph: Graph, i: number): string {
	return graph.vertices[i]?.id ?? '?';
}

function snapshot(
	graph: Graph,
	current: number | null,
	touched: number[],
	text: string,
	order: number[],
	frontier: number[],
	dist: (number | null)[],
	parent: (number | null)[],
): AlgoStep {
	return {
		current,
		order: [...order],
		frontier: [...frontier],
		dist: [...dist],
		parent: [...parent],
		touched: [...touched],
		text: text.replace(/\{(\d+)\}/g, (_, i: string) => name(graph, Number(i))),
	};
}

function emptyArray(n: number): (number | null)[] {
	return Array.from({ length: n }, () => null);
}

function finishText(graph: Graph, order: number[], reached: boolean[]): string {
	const unreached = graph.vertices
		.map((_, i) => i)
		.filter((i) => !reached[i])
		.map((i) => name(graph, i));
	const base = `Обход закончен: посещено ${order.length} из ${graph.vertices.length} вершин.`;
	return unreached.length ? `${base} Недостижимы: ${unreached.join(', ')}.` : base;
}

/** Breadth-first search: the queue takes vertices level by level. `dist` is the number of edges. */
export function bfsSteps(graph: Graph, start: number): AlgoStep[] {
	const n = graph.vertices.length;
	const adj = neighbours(graph);
	const seen = Array.from({ length: n }, () => false);
	const dist = emptyArray(n);
	const parent = emptyArray(n);
	const order: number[] = [];
	const queue: number[] = [start];
	const steps: AlgoStep[] = [];

	seen[start] = true;
	dist[start] = 0;
	steps.push(
		snapshot(
			graph,
			null,
			[],
			`Старт: вершина {${start}} в очереди. Остальные вершины пока не найдены.`,
			order,
			queue,
			dist,
			parent,
		),
	);

	for (;;) {
		const u = queue.shift();
		if (u === undefined) break;
		order.push(u);
		const added: number[] = [];
		for (const { to } of adj[u] ?? []) {
			if (seen[to]) continue;
			seen[to] = true;
			dist[to] = (dist[u] ?? 0) + 1;
			parent[to] = u;
			queue.push(to);
			added.push(to);
		}
		const text = added.length
			? `Извлекаем {${u}}. Новые соседи: ${added.map((v) => `{${v}}`).join(', ')}. Они встают в конец очереди.`
			: `Извлекаем {${u}}. Новых соседей нет.`;
		steps.push(snapshot(graph, u, added, text, order, queue, dist, parent));
	}

	steps.push(snapshot(graph, null, [], finishText(graph, order, seen), order, queue, dist, parent));
	return steps;
}

/**
 * Depth-first search with an explicit stack. A vertex is marked when it is taken from the stack;
 * a copy taken again later is skipped. Neighbours are pushed in reverse, so the smallest index is taken first.
 */
export function dfsSteps(graph: Graph, start: number): AlgoStep[] {
	const n = graph.vertices.length;
	const adj = neighbours(graph);
	const seen = Array.from({ length: n }, () => false);
	const dist = emptyArray(n);
	const parent = emptyArray(n);
	const order: number[] = [];
	const stack: { v: number; from: number | null }[] = [{ v: start, from: null }];
	const steps: AlgoStep[] = [];
	const stackView = () => stack.map((s) => s.v);

	steps.push(
		snapshot(
			graph,
			null,
			[],
			`Старт: вершина {${start}} в стеке. Остальные вершины пока не найдены.`,
			order,
			stackView(),
			dist,
			parent,
		),
	);

	for (;;) {
		const item = stack.pop();
		if (!item) break;
		const u = item.v;
		if (seen[u]) {
			steps.push(
				snapshot(
					graph,
					u,
					[],
					`Извлекаем {${u}}, но она уже посещена: пропускаем.`,
					order,
					stackView(),
					dist,
					parent,
				),
			);
			continue;
		}
		seen[u] = true;
		parent[u] = item.from;
		order.push(u);
		const next = (adj[u] ?? []).map((e) => e.to).filter((v) => !seen[v]);
		for (let i = next.length - 1; i >= 0; i--) {
			stack.push({ v: next[i] as number, from: u });
		}
		const text = next.length
			? `Посещаем {${u}}. В стек кладём соседей: ${next.map((v) => `{${v}}`).join(', ')}. Следующей возьмём {${next[0]}}.`
			: `Посещаем {${u}}. Непосещённых соседей нет: возвращаемся по стеку.`;
		steps.push(snapshot(graph, u, next, text, order, stackView(), dist, parent));
	}

	steps.push(
		snapshot(graph, null, [], finishText(graph, order, seen), order, stackView(), dist, parent),
	);
	return steps;
}

/**
 * Dijkstra's algorithm: repeatedly finalise the unfinished vertex with the smallest tentative
 * distance (ties by index) and relax its edges. Weights must be non-negative.
 */
export function dijkstraSteps(graph: Graph, start: number): AlgoStep[] {
	const n = graph.vertices.length;
	const adj = neighbours(graph);
	const done = Array.from({ length: n }, () => false);
	const dist = emptyArray(n);
	const parent = emptyArray(n);
	const order: number[] = [];
	const steps: AlgoStep[] = [];
	dist[start] = 0;

	/** Unfinished vertices with a known distance, nearest first. */
	const frontier = (): number[] =>
		graph.vertices
			.map((_, i) => i)
			.filter((i) => !done[i] && dist[i] !== null && dist[i] !== undefined)
			.sort((p, q) => (dist[p] as number) - (dist[q] as number) || p - q);

	steps.push(
		snapshot(
			graph,
			null,
			[],
			`Старт: расстояние до {${start}} равно 0, остальные ∞.`,
			order,
			frontier(),
			dist,
			parent,
		),
	);

	for (;;) {
		const candidates = frontier();
		const u = candidates[0];
		if (u === undefined) break;
		const du = dist[u] ?? 0;
		done[u] = true;
		order.push(u);
		const updated: number[] = [];
		const parts: string[] = [];
		for (const { to, w } of adj[u] ?? []) {
			if (done[to]) continue;
			const nd = du + w;
			const cur = dist[to];
			if (cur === null || cur === undefined || nd < cur) {
				parts.push(`{${to}}: ${cur === null || cur === undefined ? '∞' : cur} → ${nd}`);
				dist[to] = nd;
				parent[to] = u;
				updated.push(to);
			}
		}
		const text = `Берём {${u}} с расстоянием ${du}. ${
			parts.length ? `Пересчитываем соседей: ${parts.join(', ')}.` : 'Улучшений нет.'
		}`;
		steps.push(snapshot(graph, u, updated, text, order, frontier(), dist, parent));
	}

	steps.push(
		snapshot(graph, null, [], finishText(graph, order, done), order, frontier(), dist, parent),
	);
	return steps;
}

/**
 * Bellman-Ford: relax every arc in passes, at most n - 1 of them, and stop early when a pass
 * changes nothing. Works with negative weights. If an arc can still be relaxed after n - 1 passes,
 * a negative cycle is reachable and no shortest path exists. An undirected edge gives two arcs,
 * so a negative undirected edge is already a negative cycle. Only changing relaxations are steps.
 */
export function bellmanFordSteps(graph: Graph, start: number): AlgoStep[] {
	const n = graph.vertices.length;
	const arcs: { u: number; v: number; w: number }[] = [];
	for (const e of graph.edges) {
		arcs.push({ u: e.a, v: e.b, w: e.w });
		if (!graph.directed) arcs.push({ u: e.b, v: e.a, w: e.w });
	}
	const dist = emptyArray(n);
	const parent = emptyArray(n);
	const steps: AlgoStep[] = [];
	dist[start] = 0;

	steps.push(
		snapshot(
			graph,
			null,
			[],
			`Старт: расстояние до {${start}} равно 0, остальные ∞. Проходим все рёбра, пока оценки меняются.`,
			[],
			[],
			dist,
			parent,
		),
	);

	let changed = true;
	let pass = 0;
	while (changed && pass < n - 1) {
		changed = false;
		pass++;
		for (const { u, v, w } of arcs) {
			const du = dist[u];
			if (du === null || du === undefined) continue;
			const nd = du + w;
			const cur = dist[v];
			if (cur === null || cur === undefined || nd < cur) {
				const was = cur === null || cur === undefined ? '∞' : String(cur);
				dist[v] = nd;
				parent[v] = u;
				changed = true;
				const text = `Проход ${pass}: ребро {${u}} → {${v}} с весом ${w}. Оценка {${v}}: ${was} → ${nd}.`;
				steps.push(snapshot(graph, u, [v], text, [], [], dist, parent));
			}
		}
	}

	const negCycle = arcs.some(({ u, v, w }) => {
		const du = dist[u];
		if (du === null || du === undefined) return false;
		const cur = dist[v];
		return cur === null || cur === undefined || du + w < cur;
	});
	const reachedIdx = graph.vertices.map((_, i) => i).filter((i) => dist[i] !== null);
	const sorted = [...reachedIdx].sort((p, q) => (dist[p] as number) - (dist[q] as number) || p - q);
	const unreached = graph.vertices
		.map((_, i) => i)
		.filter((i) => dist[i] === null)
		.map((i) => name(graph, i));
	const base = negCycle
		? 'Достижим отрицательный цикл: кратчайшего пути нет, оценки продолжают уменьшаться.'
		: `Оценки больше не меняются после ${pass} проход(ов). Расстояния окончательны.`;
	const tail = unreached.length ? ` Недостижимы: ${unreached.join(', ')}.` : '';
	steps.push(snapshot(graph, null, [], base + tail, sorted, [], dist, parent));
	return steps;
}
