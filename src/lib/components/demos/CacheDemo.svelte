<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		CACHE_BYTES_OPTIONS,
		DEFAULTS,
		LINE_BYTES_OPTIONS,
		N_OPTIONS,
		applyPatch,
		cacheLines,
		describeState,
		formatBytes,
		formatPercent,
		formatTime,
		lineOf,
		traversal,
		traversalStats,
		visitPositions,
		type CacheDemoState,
		type Order,
	} from '$lib/demos/memory-cache';

	/** Cache and traversal demo on a square matrix of doubles. Registers itself as demo `memory-cache`. */
	let { initial }: { initial?: Partial<CacheDemoState> } = $props();

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const START = applyPatch(DEFAULTS, initial ?? {});

	/* The props only seed the initial state: the demo owns it afterwards. */
	let st = $state<CacheDemoState>({ ...START });

	/** Chart side in SVG units; the SVG is scaled by CSS. */
	const SIZE = 320;

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const total = $derived(st.n * st.n);
	const seq = $derived(traversal(st.n, st.order));
	const pos = $derived(visitPositions(st.n, st.order));
	const rowStats = $derived(traversalStats(st.n, 'row', st.cacheBytes, st.lineBytes));
	const colStats = $derived(traversalStats(st.n, 'col', st.cacheBytes, st.lineBytes));
	const cur = $derived(st.order === 'row' ? rowStats : colStats);
	const desc = $derived(describeState(st, rowStats, colStats));
	const cell = $derived(SIZE / st.n);
	/** Element index of the last shown access (-1 when nothing is shown). */
	const current = $derived(st.step > 0 ? (seq[st.step - 1] ?? -1) : -1);
	/** Cache line of the last shown access: its elements are outlined in the grid. */
	const currentLine = $derived(current >= 0 ? lineOf(current, st.lineBytes) : -1);
	const lines = $derived(cacheLines(st.cacheBytes, st.lineBytes));

	const cells = $derived.by(() => {
		const out: { e: number; x: number; y: number; cls: string }[] = [];
		for (let e = 0; e < total; e++) {
			const p = pos[e] ?? 0;
			const visited = p < st.step;
			const hit = visited && (cur.hits[p] ?? false);
			const inLine = currentLine >= 0 && lineOf(e, st.lineBytes) === currentLine;
			const cls = [
				'cm-cell',
				visited ? (hit ? 'cm-hit' : 'cm-miss') : 'cm-idle',
				inLine ? 'cm-line' : '',
				e === current ? 'cm-now' : '',
			]
				.filter(Boolean)
				.join(' ');
			const i = Math.floor(e / st.n);
			const j = e % st.n;
			out.push({ e, x: j * cell, y: i * cell, cls });
		}
		return out;
	});

	const nIndex = $derived(N_OPTIONS.indexOf(st.n as (typeof N_OPTIONS)[number]));
	const cacheIndex = $derived(
		CACHE_BYTES_OPTIONS.indexOf(st.cacheBytes as (typeof CACHE_BYTES_OPTIONS)[number]),
	);
	const lineIndex = $derived(
		LINE_BYTES_OPTIONS.indexOf(st.lineBytes as (typeof LINE_BYTES_OPTIONS)[number]),
	);

	const descGrid = $derived(
		`Матрица ${st.n} на ${st.n}, обход ${st.order === 'row' ? 'по строкам' : 'по столбцам'}, ` +
			`показаны первые ${st.step} из ${total} обращений.`,
	);

	/** Applies a patch. When the step was at the end of the pass, it stays at the end of the new pass. */
	function apply(patch: Partial<CacheDemoState>): void {
		const wasFull = st.step >= st.n * st.n;
		const next = patch.n !== undefined && wasFull ? { ...patch, step: Infinity } : patch;
		st = applyPatch(st, next);
	}

	function reset(): void {
		st = { ...START };
	}

	function setOrder(order: Order): void {
		apply({ order });
	}

	onMount(() =>
		demos?.register('memory-cache', {
			set: (patch) => apply(patch as Partial<CacheDemoState>),
		}),
	);
</script>

<figure
	class="cm"
	id="demo-memory-cache"
	data-demo="memory-cache"
	class:hl-q={hl === 'q'}
	class:hl-v={hl === 'v'}
>
	<div class="cm-controls">
		<div class="cm-group" role="group" aria-label="Порядок обхода">
			<button
				type="button"
				class="cm-seg"
				aria-pressed={st.order === 'row'}
				onclick={() => setOrder('row')}>по строкам</button
			>
			<button
				type="button"
				class="cm-seg"
				aria-pressed={st.order === 'col'}
				onclick={() => setOrder('col')}>по столбцам</button
			>
		</div>

		<label class="cm-ctl">
			<span class="cm-label"><span class="cm-sym">n</span> (размер матрицы)</span>
			<input
				class="cm-range"
				type="range"
				min="0"
				max={N_OPTIONS.length - 1}
				step="1"
				value={nIndex}
				oninput={(e) => apply({ n: N_OPTIONS[Number(e.currentTarget.value)] })}
			/>
			<output class="cm-val">{st.n}×{st.n}</output>
		</label>

		<label class="cm-ctl">
			<span class="cm-label">кэш</span>
			<input
				class="cm-range"
				type="range"
				min="0"
				max={CACHE_BYTES_OPTIONS.length - 1}
				step="1"
				value={cacheIndex}
				oninput={(e) => apply({ cacheBytes: CACHE_BYTES_OPTIONS[Number(e.currentTarget.value)] })}
			/>
			<output class="cm-val">{formatBytes(st.cacheBytes)}</output>
		</label>

		<label class="cm-ctl">
			<span class="cm-label">линия кэша</span>
			<input
				class="cm-range"
				type="range"
				min="0"
				max={LINE_BYTES_OPTIONS.length - 1}
				step="1"
				value={lineIndex}
				oninput={(e) => apply({ lineBytes: LINE_BYTES_OPTIONS[Number(e.currentTarget.value)] })}
			/>
			<output class="cm-val">{formatBytes(st.lineBytes)}</output>
		</label>

		<label class="cm-ctl">
			<span class="cm-label">шаг обхода</span>
			<input
				class="cm-range"
				type="range"
				min="0"
				max={total}
				step="1"
				value={st.step}
				oninput={(e) => apply({ step: Number(e.currentTarget.value) })}
			/>
			<output class="cm-val">{st.step} из {total}</output>
		</label>

		<button type="button" class="cm-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="cm-formula" aria-hidden="true">
		адрес(i, j) = (i · n + j) · 8 Б; линия = ⌊адрес / {formatBytes(st.lineBytes)}⌋
	</div>

	<div class="cm-plot">
		<svg class="cm-svg" viewBox="0 0 {SIZE} {SIZE}" role="img" aria-labelledby="cm-title cm-desc">
			<title id="cm-title">Сетка элементов матрицы в порядке обхода</title>
			<desc id="cm-desc">{descGrid}</desc>
			{#each cells as c (c.e)}
				<rect
					class={c.cls}
					x={c.x.toFixed(2)}
					y={c.y.toFixed(2)}
					width={(cell - 0.5).toFixed(2)}
					height={(cell - 0.5).toFixed(2)}
				/>
			{/each}
		</svg>

		<ul class="cm-legend" aria-hidden="true">
			<li><span class="cm-sw cm-sw-miss"></span>промах</li>
			<li><span class="cm-sw cm-sw-hit"></span>попадание</li>
			<li><span class="cm-sw cm-sw-idle"></span>ещё не обошли</li>
			<li><span class="cm-sw cm-sw-line"></span>линия текущего элемента</li>
		</ul>
	</div>

	<table class="cm-stats">
		<thead>
			<tr>
				<th scope="col">Величина</th>
				<th scope="col" class:cm-active={st.order === 'row'}>по строкам</th>
				<th scope="col" class:cm-active={st.order === 'col'}>по столбцам</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<th scope="row">Обращений</th>
				<td>{rowStats.accesses}</td>
				<td>{colStats.accesses}</td>
			</tr>
			<tr>
				<th scope="row">Промахов</th>
				<td>{rowStats.misses}</td>
				<td>{colStats.misses}</td>
			</tr>
			<tr>
				<th scope="row">Доля промахов</th>
				<td>{formatPercent(rowStats.missRate)}</td>
				<td>{formatPercent(colStats.missRate)}</td>
			</tr>
			<tr>
				<th scope="row">Оценка времени</th>
				<td>{formatTime(rowStats.timeNs)}</td>
				<td>{formatTime(colStats.timeNs)}</td>
			</tr>
		</tbody>
	</table>

	<p class="cm-note" aria-live="polite">{desc}</p>
	<p class="cm-caption">
		Кэш держит {lines}
		{lines === 1 ? 'линию' : 'линий'}. Модель: полностью ассоциативный LRU-кэш, время условное
		(учебные константы, не измерения): попадание 1 нс, промах 80 нс.
	</p>

	<div class="cm-notice">
		<p class="cm-h2">Что заметить</p>
		<ul>
			<li>
				При обходе по строкам соседние элементы лежат рядом в памяти: одна линия приносит несколько
				значений подряд.
			</li>
			<li>При обходе по столбцам каждый шаг попадает в другую линию: шаг равен n·8 байт.</li>
			<li>
				Если кэш вмещает хотя бы n линий, столбцы переиспользуют их, и промахов становится столько
				же, сколько при обходе по строкам.
			</li>
			<li>
				Промах стоит дороже попадания, поэтому при том же числе операций порядок обхода меняет
				время.
			</li>
		</ul>
	</div>
</figure>

<style>
	.cm {
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
	.cm :global(*),
	.cm :global(*::before),
	.cm :global(*::after) {
		box-sizing: border-box;
	}
	.cm p,
	.cm ul {
		margin: 0;
	}
	.cm ul {
		padding-left: var(--space-4);
	}
	.cm button {
		font: inherit;
	}

	/* Controls */
	.cm-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cm-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.cm-seg,
	.cm-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.cm-reset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.cm-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.cm-seg:focus-visible,
	.cm-reset:focus-visible,
	.cm-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.cm-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.cm-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cm-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}
	.cm-range {
		width: 130px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cm-val {
		min-width: 7ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.cm-formula {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
	}

	/* Grid */
	.cm-plot {
		margin-top: var(--space-4);
		display: grid;
		justify-items: center;
		gap: var(--space-3);
	}
	.cm-svg {
		display: block;
		width: min(100%, 360px);
		height: auto;
		aspect-ratio: 1;
	}
	.cm-cell {
		stroke: none;
		transition: fill var(--dur) var(--ease);
	}
	.cm-idle {
		fill: var(--surface-2);
	}
	.cm-hit {
		fill: var(--topic-soft);
	}
	.cm-miss {
		fill: var(--topic);
	}
	.cm-line {
		stroke: var(--text);
		stroke-width: 1;
		stroke-dasharray: 2 1;
	}
	.cm-now {
		stroke: var(--text);
		stroke-width: 2;
		stroke-dasharray: none;
	}
	.cm-legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-1) var(--space-4);
		padding-left: 0;
		list-style: none;
		color: var(--text-muted);
		font-size: 12px;
	}
	.cm-legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.cm-sw {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 2px;
		border: 1px solid var(--border);
	}
	.cm-sw-miss {
		background: var(--topic);
	}
	.cm-sw-hit {
		background: var(--topic-soft);
	}
	.cm-sw-idle {
		background: var(--surface-2);
	}
	.cm-sw-line {
		background: var(--surface);
		border: 1px dashed var(--text);
	}

	/* Statistics */
	.cm-stats {
		width: 100%;
		margin-top: var(--space-6);
		border-collapse: collapse;
		font-size: 13px;
	}
	.cm-stats th,
	.cm-stats td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border);
		text-align: right;
	}
	.cm-stats th:first-child {
		text-align: left;
		font-weight: 400;
		color: var(--text-muted);
	}
	.cm-stats thead th {
		color: var(--text-muted);
		font-weight: 600;
	}
	.cm-stats td {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.cm-stats .cm-active {
		color: var(--topic);
	}
	.cm-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.cm-caption {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}

	/* What to notice */
	.cm-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.cm-h2 {
		margin-bottom: var(--space-1);
		font-family: var(--font-serif);
		font-weight: 600;
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.cm.hl-q .cm-stats {
		opacity: 0.45;
	}
	.cm.hl-v .cm-plot {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
		border-radius: var(--radius);
	}

	@media (prefers-reduced-motion: reduce) {
		.cm *,
		.cm *::before,
		.cm *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.cm {
			padding: var(--space-4);
		}
		.cm-range {
			width: 110px;
		}
	}

	@media (max-width: 559px) {
		.cm-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.cm-ctl {
			flex-wrap: wrap;
		}
		.cm-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
