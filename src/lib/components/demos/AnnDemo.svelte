<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		EF_VALUES,
		K,
		N_LISTS,
		N_POINTS,
		N_QUERIES,
		NPROBE_MAX,
		NPROBE_MIN,
		clampPoint,
		getDemoIndex,
		reportQuery,
		type Method,
		type Point,
	} from '$lib/demos/vector-search';

	/**
	 * Approximate nearest neighbour demo: 2D point cloud, HNSW-like graph search (ef)
	 * and IVF cells (nprobe). Registers itself as demo `ann`.
	 */
	let { initial }: { initial?: { method?: Method; ef?: number; nprobe?: number } } = $props();

	const index = getDemoIndex();
	const SIZE = 400;
	const PAD = 14;
	const DEFAULT_QUERY: Point = { x: 0.42, y: 0.58 };
	const DEFAULT_EF_IDX = 4;
	const DEFAULT_NPROBE = 3;
	const EF_MAX_IDX = EF_VALUES.length - 1;
	const CHART_W = 320;
	const CHART_H = 200;
	const CM = { l: 44, r: 12, t: 12, b: 36 };

	// Props only seed the state; the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let method = $state<Method>(initial?.method === 'ivf' ? 'ivf' : 'hnsw');
	/* svelte-ignore state_referenced_locally */
	let efIdx = $state(
		initial?.ef !== undefined && EF_VALUES.includes(initial.ef)
			? EF_VALUES.indexOf(initial.ef)
			: DEFAULT_EF_IDX,
	);
	/* svelte-ignore state_referenced_locally */
	let nprobe = $state(
		initial?.nprobe !== undefined
			? Math.min(NPROBE_MAX, Math.max(NPROBE_MIN, Math.round(initial.nprobe)))
			: DEFAULT_NPROBE,
	);
	let query = $state<Point>({ ...DEFAULT_QUERY });
	let svgEl = $state<SVGSVGElement | undefined>(undefined);
	let dragging = false;

	const efValue = $derived(EF_VALUES[efIdx] ?? EF_VALUES[DEFAULT_EF_IDX] ?? K);
	const setting = $derived(method === 'hnsw' ? efValue : nprobe);
	const report = $derived(reportQuery(index, method, setting, query));
	const curve = $derived(method === 'hnsw' ? index.curveHnsw : index.curveIvf);
	const avg = $derived(curve.find((p) => p.setting === setting) ?? curve[0]);
	const hits = $derived(new Set(report.result.ids));
	const visitedSet = $derived(new Set(report.result.visited));
	const cellSet = $derived(new Set(report.result.cells));
	const missed = $derived(report.exact.filter((i) => !hits.has(i)).length);

	/** Graph edges between visited vertices: they show the region the walk explored. */
	const edges = $derived.by(() => {
		if (method !== 'hnsw') return [] as [number, number][];
		const out: [number, number][] = [];
		for (const i of visitedSet) {
			for (const j of index.graph[i] ?? []) {
				if (j > i && visitedSet.has(j)) out.push([i, j]);
			}
		}
		return out;
	});

	const xMax = Math.max(N_POINTS, ...curve.map((p) => p.cost)) * 1.02;
	const plotW = CHART_W - CM.l - CM.r;
	const plotH = CHART_H - CM.t - CM.b;
	const cx = (cost: number) => CM.l + (cost / xMax) * plotW;
	const cy = (recall: number) => CM.t + (1 - recall) * plotH;
	const curvePath = $derived(
		curve
			.map((p, t) => `${t === 0 ? 'M' : 'L'}${cx(p.cost).toFixed(1)} ${cy(p.recall).toFixed(1)}`)
			.join(' '),
	);

	/** Scene: data coordinates in [0, 1] to SVG units. */
	const sx = (v: number) => PAD + v * (SIZE - 2 * PAD);
	const sy = (v: number) => PAD + (1 - v) * (SIZE - 2 * PAD);
	const cells = index.ivf.centroids;

	const description = $derived.by(() => {
		const cost = report.result.cost;
		const base = `Найдено ${hits.size} из ${K} истинных соседей, полнота ${(report.recall * 100).toFixed(0)}%. Посчитано расстояний: ${cost} из ${N_POINTS}; точный перебор считает ${N_POINTS}.`;
		const mean = avg
			? ` Средняя полнота по ${N_QUERIES} запросам при этой настройке: ${(avg.recall * 100).toFixed(0)}%, в среднем ${avg.cost.toFixed(0)} расстояний.`
			: '';
		return base + mean;
	});

	const notice = $derived(
		missed === 0
			? 'Все истинные соседи найдены: поиск посмотрел нужные точки.'
			: `Пропущено соседей: ${missed}. Поиск не посмотрел точки, где они лежат; увеличьте ${method === 'hnsw' ? 'ef' : 'nprobe'}.`,
	);

	function reset(): void {
		method = 'hnsw';
		efIdx = DEFAULT_EF_IDX;
		nprobe = DEFAULT_NPROBE;
		query = { ...DEFAULT_QUERY };
	}

	function toData(e: PointerEvent): Point {
		const r = svgEl?.getBoundingClientRect();
		if (!r || r.width === 0) return query;
		const svgX = ((e.clientX - r.left) / r.width) * SIZE;
		const svgY = ((e.clientY - r.top) / r.height) * SIZE;
		return clampPoint({
			x: (svgX - PAD) / (SIZE - 2 * PAD),
			y: 1 - (svgY - PAD) / (SIZE - 2 * PAD),
		});
	}

	function onPointerDown(e: PointerEvent): void {
		dragging = true;
		svgEl?.setPointerCapture(e.pointerId);
		query = toData(e);
	}

	function onPointerMove(e: PointerEvent): void {
		if (dragging) query = toData(e);
	}

	function onPointerUp(): void {
		dragging = false;
	}

	/** Arrow keys move the query; Shift makes a larger step. */
	function onKey(e: KeyboardEvent): void {
		const step = e.shiftKey ? 0.1 : 0.02;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, step],
			ArrowDown: [0, -step],
		};
		const m = moves[e.key];
		if (!m) return;
		e.preventDefault();
		query = clampPoint({ x: query.x + m[0], y: query.y + m[1] });
	}

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	onMount(() => {
		return demos?.register('ann', {
			set: (patch) => {
				const p = patch as { method?: Method; ef?: number; nprobe?: number };
				if (p.method === 'hnsw' || p.method === 'ivf') method = p.method;
				if (typeof p.ef === 'number' && EF_VALUES.includes(p.ef)) efIdx = EF_VALUES.indexOf(p.ef);
				if (typeof p.nprobe === 'number')
					nprobe = Math.min(NPROBE_MAX, Math.max(NPROBE_MIN, Math.round(p.nprobe)));
			},
		});
	});
</script>

<figure class="ann" id="demo-ann" data-demo="ann">
	<div class="ann-controls">
		<div class="ann-group" role="group" aria-label="Метод поиска">
			<button
				type="button"
				class="ann-seg"
				aria-pressed={method === 'hnsw'}
				onclick={() => (method = 'hnsw')}>Граф (ef)</button
			>
			<button
				type="button"
				class="ann-seg"
				aria-pressed={method === 'ivf'}
				onclick={() => (method = 'ivf')}>Ячейки (nprobe)</button
			>
		</div>

		{#if method === 'hnsw'}
			<label class="ann-ctl">
				<span class="ann-label"><span class="ann-sym">ef</span> (ширина поиска)</span>
				<input
					class="ann-range"
					type="range"
					min="0"
					max={EF_MAX_IDX}
					step="1"
					value={efIdx}
					oninput={(e) => (efIdx = Number(e.currentTarget.value))}
				/>
				<output class="ann-val">{efValue}</output>
			</label>
		{:else}
			<label class="ann-ctl">
				<span class="ann-label"><span class="ann-sym">nprobe</span> (ячеек)</span>
				<input
					class="ann-range"
					type="range"
					min={NPROBE_MIN}
					max={NPROBE_MAX}
					step="1"
					value={nprobe}
					oninput={(e) => (nprobe = Number(e.currentTarget.value))}
				/>
				<output class="ann-val">{nprobe} из {N_LISTS}</output>
			</label>
		{/if}

		<button type="button" class="ann-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="ann-scene">
		<svg
			bind:this={svgEl}
			class="ann-svg"
			viewBox="0 0 {SIZE} {SIZE}"
			role="img"
			tabindex="0"
			aria-labelledby="ann-scene-title ann-scene-desc"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onkeydown={onKey}
		>
			<title id="ann-scene-title">Облако точек и запрос</title>
			<desc id="ann-scene-desc">{description}</desc>

			{#each edges as [a, b] (a + '-' + b)}
				<line
					class="ann-edge"
					x1={sx(index.points[a]?.x ?? 0)}
					y1={sy(index.points[a]?.y ?? 0)}
					x2={sx(index.points[b]?.x ?? 0)}
					y2={sy(index.points[b]?.y ?? 0)}
				/>
			{/each}

			{#if method === 'ivf'}
				{#each cells as c, j (j)}
					<g class="ann-cell" class:is-probed={cellSet.has(j)}>
						<line x1={sx(c.x) - 4} y1={sy(c.y) - 4} x2={sx(c.x) + 4} y2={sy(c.y) + 4} />
						<line x1={sx(c.x) + 4} y1={sy(c.y) - 4} x2={sx(c.x) - 4} y2={sy(c.y) + 4} />
					</g>
				{/each}
			{/if}

			{#each index.points as p, i (i)}
				<circle
					class="ann-pt"
					class:is-visited={visitedSet.has(i)}
					class:is-hit={hits.has(i)}
					cx={sx(p.x)}
					cy={sy(p.y)}
					r={hits.has(i) ? 5 : 3}
				/>
			{/each}

			{#each report.exact as i (i)}
				{#if !hits.has(i)}
					{@const p = index.points[i]}
					{#if p}
						<circle class="ann-miss" cx={sx(p.x)} cy={sy(p.y)} r="8" />
					{/if}
				{/if}
			{/each}

			<g class="ann-query" transform="translate({sx(query.x)} {sy(query.y)})">
				<circle r="7" />
				<line x1="-11" x2="11" y1="0" y2="0" />
				<line x1="0" x2="0" y1="-11" y2="11" />
			</g>
		</svg>
	</div>

	<p class="ann-legend">
		<span class="ann-key ann-key-visit"></span> просмотрено
		<span class="ann-key ann-key-hit"></span> найдено
		<span class="ann-key ann-key-miss"></span> пропущено
		<span class="ann-muted">· перетащите или стрелками запрос</span>
	</p>

	<div class="ann-chart">
		<svg
			class="ann-plot"
			viewBox="0 0 {CHART_W} {CHART_H}"
			role="img"
			aria-labelledby="ann-plot-title ann-plot-desc"
		>
			<title id="ann-plot-title">Полнота и число расстояний</title>
			<desc id="ann-plot-desc">
				Кривая: по оси x число вычисленных расстояний, по оси y полнота@{K}. Текущая настройка
				отмечена точкой.
			</desc>
			<line class="ann-axis" x1={CM.l} x2={CM.l} y1={CM.t} y2={CM.t + plotH} />
			<line class="ann-axis" x1={CM.l} x2={CM.l + plotW} y1={CM.t + plotH} y2={CM.t + plotH} />
			{#each [0, 0.5, 1] as v (v)}
				<text class="ann-tick" x={CM.l - 6} y={cy(v) + 3} text-anchor="end">{v}</text>
			{/each}
			<text class="ann-tick" x={CM.l} y={CHART_H - 10}>0</text>
			<text class="ann-tick" x={CM.l + plotW} y={CHART_H - 10} text-anchor="end">
				{Math.round(xMax / 1.02)}
			</text>
			<text class="ann-tick" x={CM.l + plotW / 2} y={CHART_H - 10} text-anchor="middle"
				>расстояний</text
			>
			<text
				class="ann-tick"
				transform="translate(12 {CM.t + plotH / 2}) rotate(-90)"
				text-anchor="middle">полнота@{K}</text
			>
			<path class="ann-curve" d={curvePath} />
			<circle class="ann-exact" cx={cx(N_POINTS)} cy={cy(1)} r="3" />
			{#if avg}
				<circle class="ann-now" cx={cx(avg.cost)} cy={cy(avg.recall)} r="5" />
			{/if}
		</svg>
		<p class="ann-note">
			Точка справа вверху: точный перебор, полнота 1, {N_POINTS} расстояний. Синяя точка: текущая настройка,
			усреднённая по {N_QUERIES} запросам.
		</p>
	</div>

	<dl class="ann-stats">
		<dt>Полнота для запроса</dt>
		<dd>{hits.size} из {K}</dd>
		<dt>Расстояний</dt>
		<dd>{report.result.cost} из {N_POINTS}</dd>
		<dt>Средняя полнота</dt>
		<dd>{avg ? (avg.recall * 100).toFixed(0) : '—'}%</dd>
	</dl>

	<p class="ann-note" aria-live="polite">{notice}</p>
	<p class="ann-sr" aria-live="polite">{description}</p>
</figure>

<style>
	.ann {
		position: relative;
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
	.ann :global(*),
	.ann :global(*::before),
	.ann :global(*::after) {
		box-sizing: border-box;
	}
	.ann dl,
	.ann dd,
	.ann dt,
	.ann p {
		margin: 0;
	}
	.ann button {
		font: inherit;
	}
	.ann-muted {
		color: var(--text-muted);
	}
	.ann-sym {
		font-family: var(--font-serif);
		font-size: 16px;
	}

	.ann-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ann-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.ann-seg,
	.ann-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.ann-reset {
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
	}
	.ann-seg[aria-pressed='true'] {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow);
	}
	.ann-seg:focus-visible,
	.ann-reset:focus-visible,
	.ann-svg:focus-visible,
	.ann-range:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.ann-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: 1 1 260px;
		min-width: 0;
	}
	.ann-label {
		white-space: nowrap;
	}
	.ann-range {
		flex: 1 1 120px;
		min-width: 0;
		accent-color: var(--accent);
	}
	.ann-val {
		min-width: 64px;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.ann-scene {
		margin: var(--space-4) auto 0;
		max-width: 400px;
	}
	.ann-svg {
		display: block;
		width: 100%;
		height: auto;
		background: var(--surface-2);
		border-radius: var(--radius);
		touch-action: none;
		cursor: crosshair;
		user-select: none;
	}
	.ann-edge {
		stroke: var(--cat-1);
		stroke-opacity: 0.35;
		stroke-width: 1;
	}
	.ann-pt {
		fill: var(--text-muted);
		fill-opacity: 0.35;
		stroke: none;
		transition: r var(--dur-fast) var(--ease);
	}
	.ann-pt.is-visited {
		fill: var(--cat-1);
		fill-opacity: 0.7;
	}
	.ann-pt.is-hit {
		fill: var(--cat-2);
		fill-opacity: 1;
		stroke: var(--surface);
		stroke-width: 1.5;
	}
	.ann-miss {
		fill: none;
		stroke: var(--warn);
		stroke-width: 2;
		stroke-dasharray: 3 3;
	}
	.ann-cell line {
		stroke: var(--text-muted);
		stroke-width: 1.5;
		opacity: 0.6;
	}
	.ann-cell.is-probed line {
		stroke: var(--cat-2);
		opacity: 1;
	}
	.ann-query circle {
		fill: var(--surface);
		stroke: var(--text);
		stroke-width: 2;
	}
	.ann-query line {
		stroke: var(--text);
		stroke-width: 2;
	}

	.ann-legend {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
	.ann-key {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin: 0 4px 0 8px;
		border-radius: 50%;
		vertical-align: middle;
	}
	.ann-key-visit {
		background: var(--cat-1);
		opacity: 0.7;
	}
	.ann-key-hit {
		background: var(--cat-2);
	}
	.ann-key-miss {
		background: transparent;
		border: 2px dashed var(--warn);
	}

	.ann-chart {
		margin-top: var(--space-4);
	}
	.ann-plot {
		display: block;
		width: 100%;
		max-width: 420px;
		height: auto;
		margin: 0 auto;
	}
	.ann-axis {
		stroke: var(--border);
	}
	.ann-tick {
		fill: var(--text-muted);
		font-size: 11px;
		font-family: var(--font-sans);
	}
	.ann-curve {
		fill: none;
		stroke: var(--cat-1);
		stroke-width: 2;
	}
	.ann-now {
		fill: var(--cat-2);
		stroke: var(--surface);
		stroke-width: 2;
	}
	.ann-exact {
		fill: var(--text);
	}
	.ann-note {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}

	.ann-stats {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-2) var(--space-6);
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.ann-stats dt {
		color: var(--text-muted);
	}
	.ann-stats dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	/* Visually hidden, read by screen readers on each change. */
	.ann-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.ann-pt {
			transition: none;
		}
	}

	@media (max-width: 420px) {
		.ann {
			padding: var(--space-4);
		}
	}
</style>
