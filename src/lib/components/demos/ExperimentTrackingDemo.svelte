<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		AXES,
		MAX_COMPARE,
		MIN_ACC_MAX,
		MIN_ACC_MIN,
		MIN_ACC_STEP,
		type AxisKey,
		type ExperimentTrackingState,
		type Run,
		type SortKey,
		allDomains,
		axesValues,
		bestRun,
		describeRuns,
		filterRuns,
		formatAxis,
		formatCell,
		makeRuns,
		sanitizeState,
		snapMinAcc,
		sortRuns,
		toggleSelected,
	} from '$lib/demos/experiment-tracking';

	/** Experiment tracker demo: a table of runs, sorting, a threshold and a parallel-coordinates plot. Registers itself as demo `experiment-tracking`. */
	let { initial }: { initial?: Partial<ExperimentTrackingState> } = $props();

	/* Fixed simulated runs: identical on every page load. */
	const RUNS = makeRuns();
	const DOMAINS = allDomains(RUNS);
	const AXIS_LABEL: Record<AxisKey, string> = {
		lr: 'lr',
		batch: 'batch',
		layers: 'слоёв',
		dropout: 'dropout',
		valAcc: 'val_acc',
	};
	const COLUMNS: { key: SortKey; label: string; opt: boolean }[] = [
		{ key: 'id', label: 'Запуск', opt: false },
		{ key: 'lr', label: 'lr', opt: false },
		{ key: 'batch', label: 'batch', opt: true },
		{ key: 'layers', label: 'слоёв', opt: false },
		{ key: 'dropout', label: 'dropout', opt: true },
		{ key: 'valAcc', label: 'val_acc', opt: false },
		{ key: 'valLoss', label: 'val_loss', opt: true },
		{ key: 'minutes', label: 'мин', opt: true },
	];
	/** Parallel-coordinates geometry: plot height and the vertical band for the axes. */
	const PC_H = 230;
	const PC_TOP = 44;
	const PC_BOTTOM = 196;
	const PC_PAD_X = 40;

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const start = sanitizeState(initial);

	/* The props only seed the initial state: the demo owns it afterwards. */
	let sortKey = $state<SortKey>(start.sortKey);
	let sortDesc = $state(start.sortDesc);
	let selected = $state<number[]>([...start.selected]);
	let minAcc = $state(start.minAcc);
	/** Real width of the plot in px; the SVG is drawn at this width (no viewBox scaling). */
	let plotW = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const visible = $derived(filterRuns(RUNS, minAcc));
	const rows = $derived(sortRuns(visible, sortKey, sortDesc));
	const best = $derived(bestRun(visible, 'valAcc'));
	const bestId = $derived(best?.id ?? -1);
	const compared = $derived(
		selected.map((id) => RUNS.find((r) => r.id === id)).filter((r): r is Run => r !== undefined),
	);
	const others = $derived(RUNS.filter((r) => !selected.includes(r.id)));
	const note = $derived(describeRuns(RUNS, minAcc, selected));

	const plotWidth = $derived(plotW >= 200 ? plotW : 480);
	const axisX = $derived(
		(i: number) => PC_PAD_X + (i * (plotWidth - 2 * PC_PAD_X)) / (AXES.length - 1),
	);
	const yOf = (t: number) => PC_BOTTOM - t * (PC_BOTTOM - PC_TOP);
	const pathOf = $derived((r: Run) =>
		axesValues(r, DOMAINS)
			.map((t, i) => `${i === 0 ? 'M' : 'L'}${axisX(i).toFixed(1)} ${yOf(t).toFixed(1)}`)
			.join(''),
	);
	const descPc = $derived(
		`Линии запусков через оси lr, batch, слоёв, dropout и val_acc; отмечено запусков: ${compared.length}.`,
	);

	function setSort(key: SortKey): void {
		if (key === sortKey) {
			sortDesc = !sortDesc;
		} else {
			sortKey = key;
			sortDesc = key === 'valAcc';
		}
	}

	function toggle(id: number): void {
		selected = toggleSelected(selected, id);
	}

	function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
		if (sortKey !== key) return 'none';
		return sortDesc ? 'descending' : 'ascending';
	}

	function apply(patch: Partial<ExperimentTrackingState>): void {
		const next = sanitizeState({
			sortKey,
			sortDesc,
			selected,
			minAcc,
			...patch,
		});
		sortKey = next.sortKey;
		sortDesc = next.sortDesc;
		selected = next.selected;
		minAcc = next.minAcc;
	}

	function reset(): void {
		sortKey = start.sortKey;
		sortDesc = start.sortDesc;
		selected = [...start.selected];
		minAcc = start.minAcc;
	}

	onMount(() =>
		demos?.register('experiment-tracking', {
			set: (patch) => apply(patch as Partial<ExperimentTrackingState>),
		}),
	);
</script>

<figure
	class="et"
	id="demo-experiment-tracking"
	data-demo="experiment-tracking"
	class:hl-q={hl === 'q'}
	class:hl-v={hl === 'v'}
>
	<div class="et-controls">
		<label class="et-ctl">
			<span class="et-label">Порог val_acc</span>
			<input
				class="et-range"
				type="range"
				min={MIN_ACC_MIN}
				max={MIN_ACC_MAX}
				step={MIN_ACC_STEP}
				value={minAcc}
				oninput={(e) => (minAcc = snapMinAcc(Number(e.currentTarget.value)))}
			/>
			<output class="et-val">{minAcc.toFixed(2)}</output>
		</label>

		<button type="button" class="et-btn" onclick={() => (selected = [])}>Снять отметки</button>
		<button type="button" class="et-btn" onclick={reset}>Сбросить</button>
	</div>

	<div class="et-table-wrap">
		<table class="et-table">
			<thead>
				<tr>
					{#each COLUMNS as col (col.key)}
						<th scope="col" class:et-opt={col.opt} aria-sort={ariaSort(col.key)}>
							<button type="button" class="et-sort" onclick={() => setSort(col.key)}>
								{col.label}{sortKey === col.key ? (sortDesc ? ' ↓' : ' ↑') : ''}
							</button>
						</th>
					{/each}
					<th scope="col" class="et-check-col">сравн.</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.id)}
					<tr class:et-best={r.id === bestId}>
						{#each COLUMNS as col (col.key)}
							<td class:et-opt={col.opt} class:et-num={col.key !== 'id'}>
								{formatCell(r, col.key)}{#if col.key === 'id' && r.id === bestId}
									<span class="et-badge">лучший</span>
								{/if}
							</td>
						{/each}
						<td class="et-check-col">
							<input
								type="checkbox"
								checked={selected.includes(r.id)}
								onchange={() => toggle(r.id)}
								aria-label="Сравнить {r.name}"
							/>
						</td>
					</tr>
				{:else}
					<tr>
						<td class="et-empty" colspan={COLUMNS.length + 1}>
							Ни один запуск не прошёл порог. Уменьшите порог val_acc.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="et-plot" bind:clientWidth={plotW}>
		<p class="et-panel-t">Параллельные координаты <span class="et-muted">запуски по осям</span></p>
		<svg
			class="et-svg"
			viewBox="0 0 {plotWidth} {PC_H}"
			role="img"
			aria-labelledby="et-pc-title et-pc-desc"
		>
			<title id="et-pc-title">Параллельные координаты запусков</title>
			<desc id="et-pc-desc">{descPc}</desc>
			{#each AXES as axis, i (axis)}
				<line class="et-axis" x1={axisX(i)} x2={axisX(i)} y1={PC_TOP} y2={PC_BOTTOM} />
				<text class="et-axis-name" x={axisX(i)} y={16}>{AXIS_LABEL[axis]}</text>
				<text class="et-tick" x={axisX(i)} y={PC_TOP - 8}>{formatAxis(axis, DOMAINS[axis][1])}</text
				>
				<text class="et-tick" x={axisX(i)} y={PC_BOTTOM + 18}
					>{formatAxis(axis, DOMAINS[axis][0])}</text
				>
			{/each}
			{#each others as r (r.id)}
				<path class="et-bg" d={pathOf(r)}>
					<title>{r.name}</title>
				</path>
			{/each}
			{#each compared as r, i (r.id)}
				<path class="et-sel et-s{i}" d={pathOf(r)}>
					<title>{r.name}</title>
				</path>
			{/each}
		</svg>
	</div>

	<dl class="et-stats">
		<dt>Величина</dt>
		<dd class="et-h">значение</dd>
		<dt>Лучший по val_acc (среди показанных)</dt>
		<dd>{best ? `${best.name}: ${best.valAcc.toFixed(3)}` : '—'}</dd>
		<dt>Показано запусков</dt>
		<dd>{visible.length} из {RUNS.length}</dd>
		<dt>Отмечено для сравнения</dt>
		<dd>{compared.length} из {MAX_COMPARE}</dd>
	</dl>

	<p class="et-note" aria-live="polite">{note}</p>

	<div class="et-notice">
		<p class="et-h2">Что заметить</p>
		<ul>
			<li>
				Числа здесь смоделированы (простая функция отклика плюс шум), это не реальные измерения.
				Разница в третьем знаке val_acc часто лежит внутри шума, и один запуск мало что доказывает.
			</li>
			<li>
				Сортировка по одному столбцу не показывает связей между параметрами. Отметьте запуски и
				посмотрите, через какие значения lr и слоёв проходят лучшие линии.
			</li>
			<li>
				Строка таблицы с lr, batch, числом слоёв и dropout это минимальный журнал: без параметров
				результат нельзя повторить.
			</li>
			<li>
				Порог val_acc отсекает слабые запуски, но не объясняет, почему они слабые. Для этого нужны
				сравнение и графики по параметрам.
			</li>
		</ul>
	</div>
</figure>

<style>
	.et {
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
	.et :global(*),
	.et :global(*::before),
	.et :global(*::after) {
		box-sizing: border-box;
	}
	.et dl,
	.et dd,
	.et dt,
	.et p,
	.et ul {
		margin: 0;
	}
	.et ul {
		padding-left: var(--space-4);
	}
	.et button {
		font: inherit;
	}
	.et-muted {
		color: var(--text-muted);
	}

	/* Controls */
	.et-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.et-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.et-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.et-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.et-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.et-btn {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--dur) var(--ease);
	}
	.et-btn:hover {
		border-color: var(--topic);
	}
	.et-btn:focus-visible,
	.et-sort:focus-visible,
	.et-range:focus-visible,
	.et-table input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Table */
	.et-table-wrap {
		margin-top: var(--space-4);
	}
	.et-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.et-table th,
	.et-table td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: left;
		white-space: nowrap;
	}
	.et-table th {
		color: var(--text-muted);
		font-weight: 400;
	}
	.et-table td {
		color: var(--text);
	}
	.et-num {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.et-sort {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.et-table th[aria-sort='ascending'],
	.et-table th[aria-sort='descending'] {
		color: var(--text);
	}
	.et-best {
		background: var(--topic-soft);
	}
	.et-badge {
		margin-left: var(--space-2);
		padding: 0 var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--topic);
		color: var(--surface);
		font-size: 11px;
	}
	.et-check-col {
		width: 1%;
		text-align: center;
	}
	.et-check-col input {
		accent-color: var(--topic);
		cursor: pointer;
	}
	.et-empty {
		color: var(--text-muted);
		white-space: normal;
	}

	/* Parallel coordinates */
	.et-plot {
		margin-top: var(--space-6);
	}
	.et-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.et-svg {
		display: block;
		width: 100%;
		height: 230px;
		overflow: visible;
	}
	.et-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.et-axis-name {
		fill: var(--text);
		font-size: 12px;
		text-anchor: middle;
	}
	.et-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
		text-anchor: middle;
	}
	.et-bg {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.3;
	}
	.et-sel {
		fill: none;
		stroke-width: 2.5;
		stroke-linejoin: round;
	}
	.et-s0 {
		stroke: var(--cat-1);
	}
	.et-s1 {
		stroke: var(--cat-2);
	}
	.et-s2 {
		stroke: var(--cat-3);
	}

	/* Statistics */
	.et-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.et-stats dt {
		color: var(--text-muted);
	}
	.et-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.et-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* What to notice */
	.et-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.et-h2 {
		margin-bottom: var(--space-1);
		font-family: var(--font-serif);
		font-weight: 600;
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.et.hl-q .et-stats {
		opacity: 0.45;
	}
	.et.hl-v .et-plot {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
		border-radius: var(--radius);
	}

	@media (prefers-reduced-motion: reduce) {
		.et *,
		.et *::before,
		.et *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.et {
			padding: var(--space-4);
		}
		.et-opt {
			display: none;
		}
		.et-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.et-ctl {
			flex-wrap: wrap;
		}
		.et-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.et-table {
			table-layout: fixed;
		}
		.et-table th,
		.et-table td {
			padding: var(--space-1);
			white-space: normal;
			overflow-wrap: anywhere;
		}
		.et-badge {
			display: block;
			margin: 2px 0 0;
			width: fit-content;
		}
	}
</style>
