<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		FAILABLE,
		STEPS,
		STEP_IDS,
		advance,
		describeRun,
		editParam,
		editStep,
		initialRun,
		isFail,
		released,
		runAll,
		stepKeys,
		statusLabel,
		type PipelineDemoState,
		type PipelineRun,
		type StepDef,
		type StepId,
		type StepStatus,
	} from '$lib/demos/pipelines-ci';

	/** Pipeline demo: DAG of steps, step-by-step run, cache by key. Registers itself as demo `pipelines-ci`. */
	let { initial }: { initial?: Partial<PipelineDemoState> } = $props();

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const start: PipelineDemoState = { fail: isFail(initial?.fail) ? initial.fail : null };

	/* The props only seed the initial state: the demo owns it afterwards. */
	let fail = $state<StepId | null>(start.fail);
	let run = $state<PipelineRun>(initialRun());
	let editId = $state<StepId>('train');
	/** Real width of the chart in px. Narrow screens get a vertical layout. */
	let chartW = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const vertical = $derived(chartW > 0 && chartW < 540);
	const W = $derived(vertical ? 340 : 640);
	const H = $derived(vertical ? 368 : 230);
	const NODE_W = $derived(vertical ? 150 : 112);
	const NODE_H = $derived(vertical ? 50 : 56);

	const keys = $derived(stepKeys(run.revs, STEPS, run.params));
	const desc = $derived(describeRun(run));
	const isReleased = $derived(released(run));
	const failTitle = $derived(
		fail === null ? 'нет' : (STEPS.find((s) => s.id === fail)?.title ?? ''),
	);

	type Box = { id: StepId; x: number; y: number; w: number; h: number };
	/** Position of each step: horizontal columns by depth, or vertical rows by depth on narrow screens. */
	const boxes = $derived<Box[]>(
		STEPS.map((s: StepDef) =>
			vertical
				? { id: s.id, x: 8 + s.row * 180, y: 8 + s.col * 72, w: NODE_W, h: NODE_H }
				: { id: s.id, x: 8 + s.col * 128, y: s.row === 0 ? 40 : 150, w: NODE_W, h: NODE_H },
		),
	);
	const boxOf = (id: StepId): Box =>
		boxes.find((b) => b.id === id) ?? { id, x: 0, y: 0, w: NODE_W, h: NODE_H };

	/** Edges from each dependency to the step that reads it. */
	const edges = STEPS.flatMap((s) => s.deps.map((from) => ({ from, to: s.id })));

	function edgePath(a: Box, b: Box): string {
		if (vertical) {
			const x1 = a.x + a.w / 2;
			const y1 = a.y + a.h;
			const x2 = b.x + b.w / 2;
			const y2 = b.y;
			const my = (y1 + y2) / 2;
			return `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
		}
		const x1 = a.x + a.w;
		const y1 = a.y + a.h / 2;
		const x2 = b.x;
		const y2 = b.y + b.h / 2;
		const mx = (x1 + x2) / 2;
		return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
	}

	function passed(s: StepStatus): boolean {
		return s === 'ok' || s === 'cached';
	}

	function nodeLabel(id: StepId, s: StepStatus): string {
		if (id === 'deploy' && s === 'ok') return 'выложено';
		return statusLabel(s);
	}

	const graphDesc = `Граф пайплайна из ${STEPS.length} шагов. Данные и тесты кода стоят в начале; признаки, обучение и оценка идут по цепочке; выкладка ждёт оценку и тесты.`;

	function apply(patch: Partial<PipelineDemoState>): void {
		if (isFail(patch.fail)) fail = patch.fail;
		run = initialRun();
	}

	function reset(): void {
		fail = start.fail;
		run = initialRun();
		editId = 'train';
	}

	function changeCode(): void {
		run = editStep(run, editId);
	}

	function changeParam(): void {
		run = editParam(run, editId);
	}

	onMount(() =>
		demos?.register('pipelines-ci', {
			set: (patch) => apply(patch as Partial<PipelineDemoState>),
		}),
	);
</script>

<figure
	class="pl"
	id="demo-pipelines-ci"
	data-demo="pipelines-ci"
	class:hl-q={hl === 'q'}
	class:hl-v={hl === 'v'}
>
	<div class="pl-controls">
		<div class="pl-group" role="group" aria-label="Шаг, который упадёт">
			<span class="pl-group-t">Сбой на шаге</span>
			<div class="pl-group-b">
				<button
					type="button"
					class="pl-seg"
					aria-pressed={fail === null}
					onclick={() => (fail = null)}>нет</button
				>
				{#each FAILABLE as id (id)}
					<button
						type="button"
						class="pl-seg"
						aria-pressed={fail === id}
						onclick={() => (fail = id)}>{STEPS.find((s) => s.id === id)?.title}</button
					>
				{/each}
			</div>
		</div>

		<div class="pl-buttons">
			<button type="button" class="pl-btn pl-btn-main" onclick={() => (run = advance(run, fail))}
				>Шаг</button
			>
			<button type="button" class="pl-btn" onclick={() => (run = runAll(run, fail))}
				>Весь прогон</button
			>
			<button type="button" class="pl-btn" onclick={reset}>Сбросить</button>
		</div>

		<div class="pl-edit">
			<label class="pl-label" for="pl-edit-step">Правка шага</label>
			<select id="pl-edit-step" class="pl-select" bind:value={editId}>
				{#each STEP_IDS as id (id)}
					<option value={id}>{STEPS.find((s) => s.id === id)?.title}</option>
				{/each}
			</select>
			<button type="button" class="pl-btn" onclick={changeCode}>Изменить код</button>
			<button type="button" class="pl-btn" onclick={changeParam}>Изменить параметр</button>
		</div>
	</div>

	<div class="pl-formula" aria-hidden="true">
		ключ<sub>s</sub> = H(версия кода<sub>s</sub>, параметры θ<sub>s</sub>, ключи входов)
	</div>

	<div class="pl-chart" bind:clientWidth={chartW}>
		<svg class="pl-svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="pl-title pl-desc">
			<title id="pl-title">Граф шагов пайплайна</title>
			<desc id="pl-desc">{graphDesc} Сейчас: {desc}</desc>

			{#each edges as e (e.from + '-' + e.to)}
				{@const a = boxOf(e.from)}
				{@const b = boxOf(e.to)}
				<path
					class="pl-edge"
					class:pl-edge-lit={passed(run.status[e.from]) && run.status[e.to] !== 'pending'}
					class:pl-edge-blocked={run.status[e.to] === 'blocked'}
					d={edgePath(a, b)}
				/>
			{/each}

			{#each boxes as b (b.id)}
				{@const s = run.status[b.id]}
				{@const def = STEPS.find((x) => x.id === b.id)}
				<g class="pl-node pl-{s}" transform="translate({b.x} {b.y})">
					<rect width={b.w} height={b.h} rx="8" />
					<text class="pl-name" x={b.w / 2} y={b.h / 2 - 3} text-anchor="middle"
						>{def?.title ?? ''}</text
					>
					<text class="pl-state" x={b.w / 2} y={b.h / 2 + 13} text-anchor="middle"
						>{nodeLabel(b.id, s)}</text
					>
					<title>{def?.title}: {nodeLabel(b.id, s)}</title>
				</g>
			{/each}
		</svg>
	</div>

	<dl class="pl-stats">
		<dt>Шаг</dt>
		<dd class="pl-h">статус · ключ кеша</dd>
		{#each STEPS as st (st.id)}
			<dt>{st.title}</dt>
			<dd>
				<span class="pl-st pl-st-{run.status[st.id]}">{nodeLabel(st.id, run.status[st.id])}</span>
				<code class="pl-key" title="ключ кеша шага">{keys[st.id]}</code>
			</dd>
		{/each}
		<dt>Выкладка</dt>
		<dd class="pl-release" class:pl-release-ok={isReleased}>
			{isReleased ? 'разрешена' : 'заблокирована'}
		</dd>
	</dl>

	<p class="pl-note" aria-live="polite">{desc}</p>
	<p class="pl-sr">Настроено: сбой на шаге «{failTitle}».</p>

	<div class="pl-notice">
		<p class="pl-h2">Что заметить</p>
		<ul>
			<li>
				Упавший шаг красный, все шаги ниже него заблокированы. Выкладка стоит за оценкой, поэтому
				она тоже заблокирована.
			</li>
			<li>
				Повторный прогон после сбоя берёт уже сделанные шаги из кеша и пересчитывает только то, чего
				не было. Сбойный шаг в кеш не попадает.
			</li>
			<li>
				Правка кода или параметра меняет ключ шага и всех шагов ниже него. Шаги выше по графу
				остаются из кеша.
			</li>
		</ul>
	</div>
</figure>

<style>
	.pl {
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
	.pl :global(*),
	.pl :global(*::before),
	.pl :global(*::after) {
		box-sizing: border-box;
	}
	.pl dl,
	.pl dd,
	.pl dt,
	.pl p,
	.pl ul {
		margin: 0;
	}
	.pl ul {
		padding-left: var(--space-4);
	}
	.pl button,
	.pl select {
		font: inherit;
	}

	/* Controls */
	.pl-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.pl-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.pl-group-t,
	.pl-label {
		color: var(--text-muted);
		font-size: 13px;
	}
	.pl-group-b {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 3px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.pl-seg,
	.pl-btn {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.pl-btn {
		border-color: var(--border);
		border-radius: var(--radius);
		color: var(--text);
		background: var(--surface);
	}
	.pl-btn-main {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.pl-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.pl-buttons,
	.pl-edit {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.pl-edit {
		gap: var(--space-2);
	}
	.pl-select {
		min-height: 32px;
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
	}
	.pl-seg:focus-visible,
	.pl-btn:focus-visible,
	.pl-select:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.pl-formula {
		margin-top: var(--space-4);
		color: var(--text);
		font-family: var(--font-serif);
		font-size: var(--fs-base);
		line-height: 1.3;
	}
	.pl-formula :global(sub) {
		font-size: 0.75em;
	}

	/* Chart */
	.pl-chart {
		margin-top: var(--space-4);
	}
	.pl-svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 380px;
		overflow: visible;
	}
	.pl-edge {
		fill: none;
		stroke: var(--border);
		stroke-width: 2;
		transition: stroke var(--dur) var(--ease);
	}
	.pl-edge-lit {
		stroke: var(--topic);
	}
	.pl-edge-blocked {
		stroke: var(--text-muted);
		stroke-dasharray: 5 4;
	}
	.pl-node rect {
		fill: var(--surface);
		stroke: var(--border);
		stroke-width: 1.5;
		transition:
			fill var(--dur) var(--ease),
			stroke var(--dur) var(--ease);
	}
	.pl-name {
		fill: var(--text);
		font-family: var(--font-sans);
		font-size: 14px;
		font-weight: 600;
	}
	.pl-state {
		fill: var(--text-muted);
		font-family: var(--font-sans);
		font-size: 12px;
	}
	.pl-ok rect {
		fill: var(--topic-soft);
		stroke: var(--topic);
	}
	.pl-cached rect {
		fill: var(--surface-2);
		stroke: var(--cat-1);
		stroke-width: 2;
	}
	.pl-cached .pl-state {
		fill: var(--cat-1);
	}
	.pl-fail rect {
		fill: var(--surface);
		stroke: var(--fail);
		stroke-width: 2.5;
	}
	.pl-fail .pl-state {
		fill: var(--fail);
		font-weight: 700;
	}
	.pl-blocked rect {
		stroke: var(--text-muted);
		stroke-dasharray: 5 4;
	}
	.pl-blocked {
		opacity: 0.6;
	}

	/* Table */
	.pl-stats {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.pl-stats dt {
		color: var(--text-muted);
	}
	.pl-h {
		color: var(--text-muted) !important;
	}
	.pl-stats dd {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: baseline;
		color: var(--text);
	}
	.pl-st {
		font-weight: 600;
	}
	.pl-st-fail {
		color: var(--fail);
	}
	.pl-st-cached {
		color: var(--cat-1);
	}
	.pl-st-ok {
		color: var(--ok);
	}
	.pl-st-blocked {
		color: var(--text-muted);
	}
	.pl-key {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.pl-release {
		font-weight: 600;
		color: var(--fail) !important;
	}
	.pl-release-ok {
		color: var(--ok) !important;
	}

	.pl-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.pl-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* What to notice */
	.pl-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.pl-h2 {
		margin-bottom: var(--space-1);
		font-family: var(--font-serif);
		font-weight: 600;
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.pl.hl-q .pl-stats {
		opacity: 0.45;
	}
	.pl.hl-v .pl-chart {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
		border-radius: var(--radius);
	}

	@media (prefers-reduced-motion: reduce) {
		.pl *,
		.pl *::before,
		.pl *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.pl {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.pl-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.pl-buttons,
		.pl-edit {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}
		.pl-edit .pl-label {
			grid-column: 1 / -1;
		}
		.pl-select {
			grid-column: 1 / -1;
		}
		.pl-stats {
			grid-template-columns: minmax(0, 1fr);
		}
		.pl-stats dd {
			margin-bottom: var(--space-2);
		}
	}
</style>
