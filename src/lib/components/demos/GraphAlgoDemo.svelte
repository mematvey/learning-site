<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		DEFAULT_ALGO,
		DEFAULT_PRESET,
		DEFAULT_START,
		NEG_WEIGHT_MIN,
		WEIGHT_MAX,
		WEIGHT_MIN,
		applyPatch,
		clampWeight,
		hasNegative,
		name,
		presetGraph,
		traverse,
		type AlgoKind,
		type Graph,
		type GraphDemoState,
		type Preset,
	} from '$lib/demos/graphs-algorithms';

	/** Graph traversal demo: BFS, DFS, Dijkstra and Bellman-Ford step by step. Registers itself as demo `graph-algo`. */
	let { initial }: { initial?: Partial<GraphDemoState> } = $props();

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const START: GraphDemoState = applyPatch(
		{ algo: DEFAULT_ALGO, start: DEFAULT_START, preset: DEFAULT_PRESET },
		initial ?? {},
	);
	const weightsOf = (p: Preset): number[] => presetGraph(p).edges.map((e) => e.w);

	/* The props only seed the initial state: the demo owns it afterwards. */
	let st = $state<GraphDemoState>({ ...START });
	let weights = $state<number[]>(weightsOf(START.preset));
	/** Index of the recorded step on show. */
	let idx = $state(0);

	const CW = 360;
	const CH = 260;
	const PAD = 26;
	const R = 14;
	const ALGOS: AlgoKind[] = ['bfs', 'dfs', 'dijkstra', 'bellman'];
	const LABELS: Record<AlgoKind, string> = {
		bfs: 'BFS (в ширину)',
		dfs: 'DFS (в глубину)',
		dijkstra: 'Дейкстра',
		bellman: 'Беллман–Форд',
	};
	const PRESETS: { id: Preset; label: string }[] = [
		{ id: 'plain', label: 'Обычный граф' },
		{ id: 'negative', label: 'Отрицательное ребро' },
	];

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const base = $derived(presetGraph(st.preset));
	const graph = $derived<Graph>({
		vertices: base.vertices,
		directed: base.directed,
		edges: base.edges.map((e, i) => ({ ...e, w: weights[i] ?? e.w })),
	});
	const steps = $derived(traverse(graph, st.start, st.algo));
	const last = $derived(steps.length - 1);
	const cur = $derived(steps[Math.min(idx, last)] ?? steps[0]);
	const weighted = $derived(st.algo === 'dijkstra' || st.algo === 'bellman');
	const showDist = $derived(st.algo !== 'dfs');
	const negative = $derived(hasNegative(graph));
	const wMin = $derived(graph.directed ? NEG_WEIGHT_MIN : WEIGHT_MIN);

	/** Layout of vertices in SVG units. */
	const pos = (i: number) => {
		const v = graph.vertices[i];
		return {
			x: PAD + (v?.x ?? 0) * (CW - 2 * PAD),
			y: PAD + (v?.y ?? 0) * (CH - 2 * PAD),
		};
	};

	function status(i: number): 'cur' | 'done' | 'front' | 'free' {
		if (!cur) return 'free';
		if (cur.current === i) return 'cur';
		if (cur.order.includes(i)) return 'done';
		if (cur.frontier.includes(i)) return 'front';
		return 'free';
	}

	const STATUS_TEXT: Record<ReturnType<typeof status>, string> = {
		cur: 'извлечена сейчас',
		done: 'завершена',
		front: 'ждёт',
		free: 'не найдена',
	};

	function isTree(a: number, b: number): boolean {
		return cur?.parent[b] === a || cur?.parent[a] === b;
	}

	function isHot(a: number, b: number): boolean {
		if (!cur || cur.current === null) return false;
		return (
			(cur.current === a && cur.touched.includes(b)) ||
			(cur.current === b && cur.touched.includes(a))
		);
	}

	const frontierText = $derived(
		!cur || cur.frontier.length === 0
			? 'пусто'
			: cur.frontier.map((v) => name(graph, v)).join(', '),
	);
	const frontierLabel = $derived(
		st.algo === 'bfs'
			? 'Очередь (первый выходит первым)'
			: st.algo === 'dfs'
				? 'Стек (последний выходит первым)'
				: st.algo === 'bellman'
					? 'Очередь не нужна: проходим все рёбра'
					: 'Ожидают (ближайший первым)',
	);
	const desc = $derived(
		`Граф из ${graph.vertices.length} вершин, обход ${LABELS[st.algo]} из вершины ${name(graph, st.start)}. ${cur?.text ?? ''}`,
	);

	function apply(patch: Partial<GraphDemoState>): void {
		const next = applyPatch(st, patch, base.vertices.length);
		if (next.preset !== st.preset) weights = weightsOf(next.preset);
		st = next;
		idx = 0;
	}

	function setWeight(i: number, value: number): void {
		weights = weights.map((w, j) => (j === i ? clampWeight(value, wMin) : w));
		idx = 0;
	}

	function reset(): void {
		st = { ...START };
		weights = weightsOf(START.preset);
		idx = 0;
	}

	function prev(): void {
		idx = Math.max(0, idx - 1);
	}

	function next(): void {
		idx = Math.min(last, idx + 1);
	}

	onMount(() =>
		demos?.register('graph-algo', {
			set: (patch) => apply(patch as Partial<GraphDemoState>),
		}),
	);
</script>

<figure class="gr" id="demo-graph-algo" data-demo="graph-algo" class:hl-q={hl === 'q'}>
	<div class="gr-controls">
		<div class="gr-group" role="group" aria-label="Алгоритм">
			{#each ALGOS as algo (algo)}
				<button
					type="button"
					class="gr-seg"
					aria-pressed={st.algo === algo}
					onclick={() => apply({ algo })}>{LABELS[algo]}</button
				>
			{/each}
		</div>

		<div class="gr-group" role="group" aria-label="Граф">
			{#each PRESETS as p (p.id)}
				<button
					type="button"
					class="gr-seg"
					aria-pressed={st.preset === p.id}
					onclick={() => apply({ preset: p.id })}>{p.label}</button
				>
			{/each}
		</div>

		<label class="gr-ctl">
			<span class="gr-label">Старт</span>
			<select
				class="gr-select"
				value={st.start}
				onchange={(e) => apply({ start: Number(e.currentTarget.value) })}
			>
				{#each graph.vertices as v, i (v.id)}
					<option value={i}>{v.id}</option>
				{/each}
			</select>
		</label>

		<button type="button" class="gr-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="gr-steps">
		<button type="button" class="gr-step" onclick={prev} disabled={idx === 0}>← Назад</button>
		<output class="gr-count" aria-live="off">Шаг {idx} из {last}</output>
		<button type="button" class="gr-step" onclick={next} disabled={idx >= last}>Вперёд →</button>
	</div>

	<div class="gr-plot">
		<svg class="gr-svg" viewBox="0 0 {CW} {CH}" role="img" aria-labelledby="gr-title gr-desc">
			<title id="gr-title">Граф из семи вершин с весами рёбер</title>
			<desc id="gr-desc">{desc}</desc>
			<defs>
				<marker
					id="gr-arrow"
					viewBox="0 0 10 10"
					refX="10"
					refY="5"
					markerWidth="6"
					markerHeight="6"
					orient="auto"
				>
					<path d="M0,0 L10,5 L0,10 z" class="gr-arrowhead" />
				</marker>
			</defs>

			{#each graph.edges as e, i (i)}
				{@const p = pos(e.a)}
				{@const q = pos(e.b)}
				<line
					class="gr-edge"
					class:gr-edge-tree={isTree(e.a, e.b)}
					class:gr-edge-hot={isHot(e.a, e.b)}
					marker-end={graph.directed ? 'url(#gr-arrow)' : undefined}
					x1={p.x.toFixed(1)}
					y1={p.y.toFixed(1)}
					x2={q.x.toFixed(1)}
					y2={q.y.toFixed(1)}
				/>
				<text class="gr-w" x={((p.x + q.x) / 2).toFixed(1)} y={((p.y + q.y) / 2 - 4).toFixed(1)}>
					{weighted ? e.w : ''}
				</text>
			{/each}

			{#each graph.vertices as v, i (v.id)}
				{@const p = pos(i)}
				{@const s = status(i)}
				<g class="gr-v gr-v-{s}" class:gr-v-start={st.start === i}>
					<circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={R} />
					<text class="gr-id" x={p.x.toFixed(1)} y={(p.y + 4).toFixed(1)}>{v.id}</text>
					{#if showDist && cur?.dist[i] !== null && cur?.dist[i] !== undefined}
						<text class="gr-d" x={p.x.toFixed(1)} y={(p.y - R - 6).toFixed(1)}>{cur?.dist[i]}</text>
					{/if}
				</g>
			{/each}
		</svg>
	</div>

	<p class="gr-frontier">
		<span class="gr-label">{frontierLabel}:</span>
		<span class="gr-mono">{frontierText}</span>
	</p>

	<p class="gr-note" aria-live="polite">{cur?.text ?? ''}</p>

	<div class="gr-table-wrap">
		<table class="gr-table">
			<caption class="gr-cap">Состояние вершин на шаге {idx}</caption>
			<thead>
				<tr>
					<th scope="col">Вершина</th>
					{#if showDist}
						<th scope="col">{weighted ? 'd (вес)' : 'd (рёбра)'}</th>
					{/if}
					<th scope="col">Предок</th>
					<th scope="col">Статус</th>
				</tr>
			</thead>
			<tbody>
				{#each graph.vertices as v, i (v.id)}
					<tr>
						<th scope="row">{v.id}</th>
						{#if showDist}
							<td class="gr-mono">{cur?.dist[i] ?? '∞'}</td>
						{/if}
						<td class="gr-mono"
							>{cur?.parent[i] !== null && cur?.parent[i] !== undefined
								? name(graph, cur.parent[i] as number)
								: '—'}</td
						>
						<td>{STATUS_TEXT[status(i)]}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if st.algo === 'dijkstra' && negative}
		<p class="gr-warn" role="status">
			Есть отрицательное ребро: Дейкстра здесь может дать неверный ответ. Выберите Беллмана–Форда.
		</p>
	{/if}

	<fieldset class="gr-weights">
		<legend class="gr-label"
			>Веса рёбер ({wMin}–{WEIGHT_MAX}){graph.directed
				? ', рёбра направленные (a → b)'
				: ''}</legend
		>
		<div class="gr-weight-grid">
			{#each graph.edges as e, i (i)}
				<label class="gr-wctl">
					<span class="gr-mono"
						>{name(graph, e.a)}{graph.directed ? '→' : '–'}{name(graph, e.b)}</span
					>
					<input
						class="gr-num"
						type="number"
						min={wMin}
						max={WEIGHT_MAX}
						step="1"
						value={e.w}
						oninput={(ev) => setWeight(i, Number(ev.currentTarget.value))}
					/>
				</label>
			{/each}
		</div>
	</fieldset>

	<div class="gr-notice">
		<p class="gr-h2">Что заметить</p>
		<ul>
			<li>
				BFS берёт вершины из очереди: сначала все соседи текущего уровня. Его d считает рёбра и не
				учитывает веса.
			</li>
			<li>
				DFS берёт из стека: уходит вглубь по одной ветке и возвращается назад. Порядок посещения
				другой, но множество достижимых вершин то же.
			</li>
			<li>
				Дейкстра всегда закрывает ближайшую ожидающую вершину. Пока веса неотрицательны, её
				расстояние уже окончательное. Попробуйте поменять вес рёбер: кратчайший путь перестроится.
			</li>
			<li>
				В пресете «Отрицательное ребро» C → B имеет вес −2. Дейкстра закрывает B с расстоянием 1 и
				не видит путь через C (0). Беллман–Форд проходит все рёбра и находит 0.
			</li>
		</ul>
	</div>
</figure>

<style>
	.gr {
		margin: 0;
		padding: var(--space-6) var(--space-8) var(--space-8);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
		text-align: left;
		letter-spacing: normal;
		text-transform: none;
	}
	.gr :global(*),
	.gr :global(*::before),
	.gr :global(*::after) {
		box-sizing: border-box;
	}
	.gr p,
	.gr ul {
		margin: 0;
	}
	.gr ul {
		padding-left: var(--space-4);
	}
	.gr button,
	.gr select,
	.gr input {
		font: inherit;
	}
	.gr-label {
		color: var(--text-muted);
	}
	.gr-mono {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Controls */
	.gr-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.gr-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.gr-seg,
	.gr-reset,
	.gr-step {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.gr-seg {
		border-color: transparent;
		color: var(--text-muted);
	}
	.gr-seg[aria-pressed='true'] {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.gr-step:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.gr-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.gr-select,
	.gr-num {
		height: 32px;
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-mono);
	}
	.gr-num {
		width: 64px;
	}
	.gr button:focus-visible,
	.gr select:focus-visible,
	.gr input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Step controls */
	.gr-steps {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.gr-count {
		min-width: 14ch;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
	}

	/* Graph */
	.gr-plot {
		margin-top: var(--space-4);
	}
	.gr-svg {
		display: block;
		width: 100%;
		max-width: 520px;
		margin: 0 auto;
		height: auto;
		overflow: visible;
	}
	.gr-edge {
		stroke: var(--border);
		stroke-width: 2;
	}
	.gr-edge-tree {
		stroke: var(--topic);
		stroke-width: 3.5;
	}
	.gr-edge-hot {
		stroke: var(--cat-3);
		stroke-width: 3.5;
		stroke-dasharray: 5 3;
	}
	.gr-w {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		text-anchor: middle;
	}
	.gr-v circle {
		fill: var(--surface);
		stroke: var(--text-muted);
		stroke-width: 2;
	}
	.gr-v-done circle {
		fill: var(--topic-soft);
		stroke: var(--topic);
	}
	.gr-v-front circle {
		stroke: var(--cat-2);
		stroke-width: 3;
	}
	.gr-v-cur circle {
		fill: var(--topic);
		stroke: var(--topic);
	}
	.gr-v-start circle {
		stroke-dasharray: 3 2;
	}
	.gr-id {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 600;
		text-anchor: middle;
	}
	.gr-v-cur .gr-id {
		fill: var(--surface);
	}
	.gr-d {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
		text-anchor: middle;
	}

	.gr-frontier {
		margin-top: var(--space-3);
		font-size: 13px;
	}

	.gr-note {
		margin-top: var(--space-3);
		color: var(--text);
	}

	/* Table */
	.gr-table-wrap {
		margin-top: var(--space-4);
		overflow-x: auto;
	}
	.gr-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.gr-cap {
		caption-side: top;
		margin-bottom: var(--space-2);
		text-align: left;
		color: var(--text-muted);
	}
	.gr-table th,
	.gr-table td {
		padding: var(--space-1) var(--space-3);
		border-bottom: 1px solid var(--border);
		text-align: left;
	}
	.gr-table thead th {
		color: var(--text-muted);
		font-weight: 500;
	}
	.gr-table td.gr-mono {
		font-variant-numeric: tabular-nums;
	}

	/* Weights */
	.gr-weights {
		margin: var(--space-4) 0 0;
		padding: 0;
		border: 0;
	}
	.gr-weights legend {
		margin-bottom: var(--space-2);
		padding: 0;
	}
	.gr-weight-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: var(--space-2) var(--space-3);
	}
	.gr-wctl {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	/* What to notice */
	.gr-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.gr-h2 {
		margin-bottom: var(--space-1);
		font-family: var(--font-serif);
		font-weight: 600;
	}

	.gr-warn {
		margin-top: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--cat-3);
		color: var(--text);
	}
	.gr-arrowhead {
		fill: var(--text-muted);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.gr.hl-q .gr-table-wrap {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.gr *,
		.gr *::before,
		.gr *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.gr {
			padding: var(--space-4);
		}
		.gr-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.gr-ctl {
			justify-content: space-between;
		}
		.gr-select {
			flex: 1 1 auto;
		}
	}
</style>
