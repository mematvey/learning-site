<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		CARD_COUNTS,
		DEFAULT_STATE,
		GPU_MEMORY_GB,
		MICRO_MAX,
		MICRO_MIN,
		PARAMS_MAX,
		PARAMS_MIN,
		PARAMS_STEP,
		STAGES_MAX,
		STAGES_MIN,
		type DistributedDemoState,
		bubbleFraction,
		describeBubble,
		describeMemory,
		memoryRows,
		percent,
		pipelineGrid,
		snapCards,
		snapMicro,
		snapParams,
		snapStages,
	} from '$lib/demos/distributed-training';

	/** Memory per GPU by parallelism strategy and pipeline bubble. Registers itself as demo `distributed-training`. */
	let { initial }: { initial?: Partial<DistributedDemoState> } = $props();

	/* The props only seed the initial state: the demo owns it afterwards. */
	/* svelte-ignore state_referenced_locally */
	const start: DistributedDemoState = {
		paramsB: snapParams(initial?.paramsB ?? DEFAULT_STATE.paramsB),
		cards: snapCards(initial?.cards ?? DEFAULT_STATE.cards),
		stages: snapStages(initial?.stages ?? DEFAULT_STATE.stages),
		micro: snapMicro(initial?.micro ?? DEFAULT_STATE.micro),
	};

	let paramsB = $state(start.paramsB);
	let cards = $state(start.cards);
	let stages = $state(start.stages);
	let micro = $state(start.micro);

	const cardIndex = $derived(CARD_COUNTS.indexOf(cards));
	const rows = $derived(memoryRows(paramsB, cards));
	const maxGb = $derived(Math.max(GPU_MEMORY_GB, ...rows.map((r) => r.gb)));
	const limitPct = $derived((GPU_MEMORY_GB / maxGb) * 100);
	const memDesc = $derived(describeMemory(paramsB, cards));

	const grid = $derived(pipelineGrid(stages, micro));
	const idlePct = $derived(percent(bubbleFraction(stages, micro)));
	const bubbleDesc = $derived(describeBubble(stages, micro));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	function apply(patch: Partial<DistributedDemoState>): void {
		if (typeof patch.paramsB === 'number') paramsB = snapParams(patch.paramsB);
		if (typeof patch.cards === 'number') cards = snapCards(patch.cards);
		if (typeof patch.stages === 'number') stages = snapStages(patch.stages);
		if (typeof patch.micro === 'number') micro = snapMicro(patch.micro);
	}

	function reset(): void {
		apply(start);
	}

	onMount(() => {
		return demos?.register('distributed-training', {
			set: (patch) => apply(patch as Partial<DistributedDemoState>),
		});
	});
</script>

<div class="dd" id="demo-distributed-training" data-demo="distributed-training">
	<div class="dd-controls">
		<label class="dd-ctl">
			<span class="dd-label">Параметров, млрд</span>
			<input
				class="dd-range"
				type="range"
				min={PARAMS_MIN}
				max={PARAMS_MAX}
				step={PARAMS_STEP}
				value={paramsB}
				oninput={(e) => (paramsB = snapParams(Number(e.currentTarget.value)))}
			/>
			<output class="dd-val">{paramsB}</output>
		</label>

		<label class="dd-ctl">
			<span class="dd-label">GPU</span>
			<input
				class="dd-range"
				type="range"
				min={0}
				max={CARD_COUNTS.length - 1}
				step={1}
				value={cardIndex}
				oninput={(e) => (cards = CARD_COUNTS[Number(e.currentTarget.value)] ?? cards)}
			/>
			<output class="dd-val">{cards}</output>
		</label>
	</div>

	<h3 class="dd-title">Память на одну GPU</h3>
	<p class="dd-sub">Состояния модели: веса, градиенты и оптимизатор. Активации не учтены.</p>

	<ul class="dd-bars">
		{#each rows as r (r.id)}
			<li class="dd-row">
				<span class="dd-row-label">{r.label}</span>
				<span class="dd-track">
					<span class="dd-bar" class:is-over={!r.fits} style:width="{(r.gb / maxGb) * 100}%"></span>
					<span class="dd-limit" style:left="{limitPct}%" aria-hidden="true"></span>
				</span>
				<span class="dd-row-val" class:is-over={!r.fits}>
					{r.gb.toFixed(1)} ГБ{r.fits ? '' : ' · не влезает'}
				</span>
			</li>
		{/each}
	</ul>
	<p class="dd-legend">Пунктир: память карты {GPU_MEMORY_GB} ГБ.</p>
	<p class="dd-desc" aria-live="polite">{memDesc}</p>

	<div class="dd-sep"></div>

	<h3 class="dd-title">Простой конвейера</h3>
	<div class="dd-controls">
		<label class="dd-ctl">
			<span class="dd-label">Стадий p</span>
			<input
				class="dd-range"
				type="range"
				min={STAGES_MIN}
				max={STAGES_MAX}
				step={1}
				value={stages}
				oninput={(e) => (stages = snapStages(Number(e.currentTarget.value)))}
			/>
			<output class="dd-val">{stages}</output>
		</label>
		<label class="dd-ctl">
			<span class="dd-label">Микробатчей m</span>
			<input
				class="dd-range"
				type="range"
				min={MICRO_MIN}
				max={MICRO_MAX}
				step={1}
				value={micro}
				oninput={(e) => (micro = snapMicro(Number(e.currentTarget.value)))}
			/>
			<output class="dd-val">{micro}</output>
		</label>
	</div>

	<div class="dd-pipe" aria-hidden="true">
		<div class="dd-grid" style:--cols={grid[0]?.length ?? 0}>
			{#each grid as row, s (s)}
				{#each row as busy, t (t)}
					<span class="dd-cell" class:is-busy={busy}></span>
				{/each}
			{/each}
		</div>
		<p class="dd-axis">Строки: стадии. Столбцы: такты. Закрашено: стадия работает.</p>
	</div>
	<p class="dd-desc" aria-live="polite">
		{bubbleDesc} Доля простоя: {idlePct} %.
	</p>

	<div class="dd-foot">
		<p class="dd-note">
			<strong>Что заметить:</strong> шардирование уменьшает память на карту почти пропорционально числу
			карт. Конвейер при малом m простаивает, при росте m простой падает.
		</p>
		<button type="button" class="dd-reset" onclick={reset}>Сбросить</button>
	</div>
</div>

<style>
	.dd {
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
	}
	.dd :global(*),
	.dd :global(*::before),
	.dd :global(*::after) {
		box-sizing: border-box;
	}
	.dd p,
	.dd ul,
	.dd li,
	.dd h3 {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.dd button {
		font: inherit;
	}

	.dd-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.dd-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.dd-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.dd-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.dd-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.dd-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.dd-title {
		margin-top: var(--space-6);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.dd-sub,
	.dd-legend,
	.dd-axis {
		color: var(--text-muted);
		font-size: 12px;
	}
	.dd-sub {
		margin-top: var(--space-1);
	}

	.dd-bars {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.dd-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		grid-template-areas:
			'label label'
			'track val';
		gap: var(--space-1) var(--space-3);
		align-items: center;
	}
	.dd-row-label {
		grid-area: label;
		color: var(--text);
	}
	.dd-track {
		position: relative;
		grid-area: track;
		height: 14px;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}
	.dd-bar {
		position: absolute;
		inset: 0 auto 0 0;
		max-width: 100%;
		background: var(--topic);
		border-radius: var(--radius-sm);
		transition: width var(--dur) var(--ease);
	}
	.dd-bar.is-over {
		background: var(--cat-2);
	}
	.dd-limit {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 0;
		border-left: 2px dashed var(--text-muted);
	}
	.dd-row-val {
		grid-area: val;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: var(--text);
		white-space: nowrap;
	}
	.dd-row-val.is-over {
		color: var(--cat-2);
	}
	.dd-legend {
		margin-top: var(--space-2);
	}

	.dd-desc {
		margin-top: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}

	.dd-sep {
		height: 1px;
		margin-top: var(--space-6);
		background: var(--border);
	}

	.dd-pipe {
		margin-top: var(--space-4);
		overflow: hidden;
	}
	.dd-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 2px;
	}
	.dd-cell {
		display: block;
		aspect-ratio: 1;
		background: var(--surface-2);
		border-radius: 2px;
	}
	.dd-cell.is-busy {
		background: var(--cat-1);
	}
	.dd-axis {
		margin-top: var(--space-2);
	}

	.dd-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-3) var(--space-4);
		margin-top: var(--space-6);
	}
	.dd-note {
		max-width: 60ch;
		color: var(--text-muted);
	}
	.dd-note strong {
		color: var(--text);
	}
	.dd-reset {
		height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		cursor: pointer;
		transition: border-color var(--dur) var(--ease);
	}
	.dd-reset:hover {
		border-color: var(--topic);
	}
	.dd-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.dd *,
		.dd *::before,
		.dd *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.dd {
			padding: var(--space-4);
		}
		.dd-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.dd-ctl {
			flex-wrap: wrap;
		}
		.dd-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
