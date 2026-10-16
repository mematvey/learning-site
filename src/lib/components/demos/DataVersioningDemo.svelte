<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		CODE_COMMITS,
		DATA_COMMITS,
		DEFAULT_STATE,
		JOURNAL,
		SEED_MAX,
		SEED_MIN,
		applyPatch,
		codeHash,
		dataHashOf,
		describeState,
		summarize,
		type CodeId,
		type DataId,
		type DataVersioningDemoState,
	} from '$lib/demos/data-versioning';

	/** Data and code versioning demo: commit graph, fingerprint of an experiment, journal lookup. Registers as `data-versioning`. */
	let { initial }: { initial?: Partial<DataVersioningDemoState> } = $props();

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const start = applyPatch(DEFAULT_STATE, initial ?? {});
	let state = $state<DataVersioningDemoState>({ ...start });

	const s = $derived(summarize(state));
	const note = $derived(describeState(state, s));

	/* Graph layout: two lanes, the working copy sits after the selected data commit. */
	const W = 400;
	const H = 170;
	const NODE_X = [90, 190, 290];
	const WORK_X = 375;
	const CODE_Y = 40;
	const DATA_Y = 118;
	const R = 15;

	const codeNodes = CODE_COMMITS.map((c, i) => ({
		id: c.id,
		x: NODE_X[i] ?? 0,
		hash: codeHash(c),
		label: c.message,
	}));
	const dataNodes = DATA_COMMITS.map((d, i) => ({
		id: d.id,
		x: NODE_X[i] ?? 0,
		hash: dataHashOf(d.id),
		label: d.message,
	}));
	const codeEdges = codeNodes.slice(1).map((n, i) => ({ x1: codeNodes[i]?.x ?? 0, x2: n.x }));
	const dataEdges = dataNodes.slice(1).map((n, i) => ({ x1: dataNodes[i]?.x ?? 0, x2: n.x }));
	const dataIndex = $derived(DATA_COMMITS.findIndex((d) => d.id === state.data));
	const selectedDataX = $derived(NODE_X[dataIndex] ?? 0);

	const desc = $derived(
		`Код ${state.code}, данные ${state.data}, seed ${state.seed}. ${s.dataMatchesCommit ? 'Рабочая копия совпадает с коммитом.' : 'Рабочая копия с правкой без коммита.'}`,
	);

	function selectCode(id: CodeId): void {
		state.code = id;
	}

	function selectData(id: DataId): void {
		state.data = id;
	}

	function reset(): void {
		state = { ...start };
	}

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	onMount(() =>
		demos?.register('data-versioning', {
			set: (patch) => {
				state = applyPatch(state, patch as Partial<DataVersioningDemoState>);
			},
		}),
	);

	function onNodeKey(e: KeyboardEvent, select: () => void): void {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			select();
		}
	}
</script>

<figure class="dv" id="demo-data-versioning" data-demo="data-versioning">
	<div class="dv-controls">
		<div class="dv-group" role="group" aria-label="Версия кода">
			<span class="dv-glabel">Код</span>
			{#each CODE_COMMITS as c (c.id)}
				<button
					type="button"
					class="dv-seg"
					aria-pressed={state.code === c.id}
					onclick={() => selectCode(c.id)}>{c.id}</button
				>
			{/each}
		</div>

		<div class="dv-group" role="group" aria-label="Версия данных">
			<span class="dv-glabel">Данные</span>
			{#each DATA_COMMITS as d (d.id)}
				<button
					type="button"
					class="dv-seg"
					aria-pressed={state.data === d.id}
					onclick={() => selectData(d.id)}>{d.id}</button
				>
			{/each}
		</div>

		<div class="dv-group" role="group" aria-label="Seed разбиения">
			<span class="dv-glabel">seed</span>
			{#each Array.from({ length: SEED_MAX - SEED_MIN + 1 }, (_, i) => SEED_MIN + i) as sd (sd)}
				<button
					type="button"
					class="dv-seg"
					aria-pressed={state.seed === sd}
					onclick={() => (state.seed = sd)}>{sd}</button
				>
			{/each}
		</div>

		<button
			type="button"
			class="dv-toggle"
			aria-pressed={state.dirty}
			onclick={() => (state.dirty = !state.dirty)}>Правка без коммита</button
		>

		<button type="button" class="dv-reset" onclick={reset}>Сбросить</button>
	</div>

	<svg
		class="dv-graph"
		viewBox="0 0 {W} {H}"
		role="img"
		aria-labelledby="dv-graph-title dv-graph-desc"
	>
		<title id="dv-graph-title">Граф версий: коды сверху, данные снизу</title>
		<desc id="dv-graph-desc">
			Выбрано: код {state.code}, данные {state.data}. Хеш каждой версии под узлом.
		</desc>

		<text class="dv-lane" x="4" y={CODE_Y + 4}>код</text>
		<text class="dv-lane" x="4" y={DATA_Y + 4}>данные</text>

		{#each codeEdges as e, i (i)}
			<line class="dv-edge" x1={e.x1 + R} x2={e.x2 - R} y1={CODE_Y} y2={CODE_Y} />
		{/each}
		{#each dataEdges as e, i (i)}
			<line class="dv-edge" x1={e.x1 + R} x2={e.x2 - R} y1={DATA_Y} y2={DATA_Y} />
		{/each}

		{#each codeNodes as n (n.id)}
			<g
				class="dv-node"
				role="button"
				tabindex="0"
				aria-pressed={state.code === n.id}
				aria-label="Код {n.id}: {n.label}"
				class:dv-on={state.code === n.id}
				onclick={() => selectCode(n.id)}
				onkeydown={(e) => onNodeKey(e, () => selectCode(n.id))}
			>
				<circle cx={n.x} cy={CODE_Y} r={R} />
				<text class="dv-id" x={n.x} y={CODE_Y + 4}>{n.id}</text>
				<text class="dv-hash" x={n.x} y={CODE_Y + 32}>{n.hash}</text>
			</g>
		{/each}

		{#each dataNodes as n (n.id)}
			<g
				class="dv-node"
				role="button"
				tabindex="0"
				aria-pressed={state.data === n.id}
				aria-label="Данные {n.id}: {n.label}"
				class:dv-on={state.data === n.id}
				onclick={() => selectData(n.id)}
				onkeydown={(e) => onNodeKey(e, () => selectData(n.id))}
			>
				<circle cx={n.x} cy={DATA_Y} r={R} />
				<text class="dv-id" x={n.x} y={DATA_Y + 4}>{n.id}</text>
				<text class="dv-hash" x={n.x} y={DATA_Y + 32}>{n.hash}</text>
			</g>
		{/each}

		{#if state.dirty}
			<line
				class="dv-edge dv-edge-dirty"
				x1={selectedDataX + R}
				x2={WORK_X - R}
				y1={DATA_Y}
				y2={DATA_Y}
			/>
			<g class="dv-work">
				<circle cx={WORK_X} cy={DATA_Y} r={R} />
				<text class="dv-id" x={WORK_X} y={DATA_Y + 4}>*</text>
				<text class="dv-hash" x={WORK_X} y={DATA_Y + 32}>{s.dataHash}</text>
			</g>
		{/if}
	</svg>

	<dl class="dv-stats">
		<dt>Хеш кода</dt>
		<dd>{s.codeHash}</dd>
		<dt>Хеш данных (рабочая копия)</dt>
		<dd class:dv-bad={!s.dataMatchesCommit}>{s.dataHash}</dd>
		<dt>Хеш коммита {state.data}</dt>
		<dd>{s.committedDataHash}</dd>
		<dt>Отпечаток эксперимента</dt>
		<dd class="dv-fp">{s.fingerprint}</dd>
		<dt>Точность на тесте</dt>
		<dd>{s.result.accuracy.toFixed(2)} ({s.result.correct} из {s.result.total})</dd>
		<dt>Строк в обучении</dt>
		<dd>{s.result.trainSize}</dd>
	</dl>

	<p class="dv-desc" aria-live="polite">{desc}</p>
	<p class="dv-note" aria-live="polite">{note}</p>

	<div class="dv-journal">
		<p class="dv-h">Журнал запусков</p>
		<table>
			<thead>
				<tr>
					<th scope="col">код</th>
					<th scope="col">данные</th>
					<th scope="col">seed</th>
					<th scope="col">отпечаток</th>
					<th scope="col">точность</th>
				</tr>
			</thead>
			<tbody>
				{#each JOURNAL as r (r.fingerprint)}
					<tr
						class:dv-row-on={r.fingerprint === s.fingerprint}
						aria-current={r.fingerprint === s.fingerprint ? 'true' : undefined}
					>
						<td>{r.code}</td>
						<td>{r.data}</td>
						<td>{r.seed}</td>
						<td class="dv-mono">{r.fingerprint}</td>
						<td>{r.accuracy.toFixed(2)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="dv-small">Строка подсвечена, если отпечаток текущего запуска совпадает с записью.</p>
	</div>

	<div class="dv-notice">
		<p class="dv-h">Что заметить</p>
		<ul>
			<li>
				Хеш меняется от любой правки: кода, данных или seed. Одинаковый отпечаток означает
				одинаковые входы.
			</li>
			<li>
				Коммит d1 исправляет метки и меняет точность. Изменение видно в хеше данных, а не только в
				памяти ноутбука.
			</li>
			<li>
				Правка без коммита меняет хеш рабочей копии, и запуск не находится в журнале: по коммитам
				его не воспроизвести.
			</li>
			<li>
				Версия c0 не нормирует признаки, и крупный по масштабу признак f2 портит расстояния. c1 это
				исправляет.
			</li>
		</ul>
	</div>
</figure>

<style>
	.dv {
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
	.dv :global(*),
	.dv :global(*::before),
	.dv :global(*::after) {
		box-sizing: border-box;
	}
	.dv dl,
	.dv dd,
	.dv dt,
	.dv p,
	.dv ul {
		margin: 0;
	}
	.dv ul {
		padding-left: var(--space-4);
	}
	.dv button {
		font: inherit;
	}
	.dv-h {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.dv-small {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.dv-mono {
		font-family: var(--font-mono);
		font-size: 12px;
	}

	/* Controls */
	.dv-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.dv-group {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.dv-glabel {
		padding: 0 var(--space-2);
		color: var(--text-muted);
		white-space: nowrap;
	}
	.dv-seg,
	.dv-toggle,
	.dv-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		font-family: var(--font-mono);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.dv-toggle,
	.dv-reset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-sans);
		color: var(--text);
	}
	.dv-toggle[aria-pressed='true'] {
		border-color: var(--cat-2);
		color: var(--cat-2);
		font-weight: 600;
	}
	.dv-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.dv-seg:focus-visible,
	.dv-toggle:focus-visible,
	.dv-reset:focus-visible,
	.dv-node:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Graph */
	.dv-graph {
		display: block;
		width: 100%;
		max-width: 560px;
		height: auto;
		margin-top: var(--space-4);
		overflow: visible;
	}
	.dv-lane {
		fill: var(--text-muted);
		font-family: var(--font-sans);
		font-size: 12px;
	}
	.dv-edge {
		stroke: var(--text-muted);
		stroke-width: 2;
	}
	.dv-edge-dirty {
		stroke: var(--cat-2);
		stroke-dasharray: 4 3;
	}
	.dv-node {
		cursor: pointer;
	}
	.dv-node circle,
	.dv-work circle {
		fill: var(--surface-2);
		stroke: var(--text-muted);
		stroke-width: 1.5;
	}
	.dv-node.dv-on circle {
		fill: var(--topic-soft);
		stroke: var(--topic);
		stroke-width: 2.5;
	}
	.dv-work circle {
		fill: var(--surface);
		stroke: var(--cat-2);
		stroke-dasharray: 3 2;
	}
	.dv-id {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		text-anchor: middle;
	}
	.dv-hash {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
		text-anchor: middle;
	}

	/* Statistics */
	.dv-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.dv-stats dt {
		color: var(--text-muted);
	}
	.dv-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
		overflow-wrap: anywhere;
	}
	.dv-stats dd.dv-fp {
		color: var(--topic);
		font-weight: 600;
	}
	.dv-stats dd.dv-bad {
		color: var(--cat-2);
	}
	.dv-desc {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.dv-note {
		margin-top: var(--space-2);
		color: var(--text);
	}

	/* Journal */
	.dv-journal {
		margin-top: var(--space-4);
	}
	.dv-journal table {
		width: 100%;
		margin-top: var(--space-2);
		border-collapse: collapse;
		font-size: 12px;
	}
	.dv-journal th,
	.dv-journal td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: left;
		font-variant-numeric: tabular-nums;
	}
	.dv-journal th {
		color: var(--text-muted);
		font-weight: 500;
	}
	.dv-journal tr.dv-row-on td {
		background: var(--topic-soft);
		color: var(--text);
	}

	/* What to notice */
	.dv-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.dv-notice .dv-h {
		margin-bottom: var(--space-1);
	}

	@media (prefers-reduced-motion: reduce) {
		.dv *,
		.dv *::before,
		.dv *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.dv {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.dv-controls {
			gap: var(--space-2);
		}
		.dv-group {
			flex-wrap: wrap;
		}
		.dv-stats {
			grid-template-columns: minmax(0, 1fr);
		}
		.dv-stats dd {
			text-align: left;
			margin-bottom: var(--space-2);
		}
		.dv-journal th,
		.dv-journal td {
			padding: var(--space-1);
		}
	}
</style>
