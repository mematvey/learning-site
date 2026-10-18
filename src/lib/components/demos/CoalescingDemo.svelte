<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		DEFAULT_STATE,
		ELEM_BYTES,
		OFFSET_MAX,
		OFFSET_MIN,
		SEGMENT_OPTIONS,
		STRIDE_MAX,
		STRIDE_MIN,
		WARP_SIZE,
		analyse,
		applyPatch,
		describeAccess,
		efficiencyPercent,
		type CoalescingDemoState,
	} from '$lib/demos/memory-coalescing';

	/** Memory-coalescing demo: one warp reads float32 with a stride. Registers itself as demo `coalescing`. */
	let { initial }: { initial?: Partial<CoalescingDemoState> } = $props();

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const START = applyPatch(DEFAULT_STATE, initial ?? {});

	/* The props only seed the initial state: the demo owns it afterwards. */
	let st = $state<CoalescingDemoState>({ ...START });

	/* SVG geometry in viewBox units. */
	const LABEL_W = 84;
	const GRID_W = 276;
	const ROW_H = 10;
	const ROW_GAP = 3;
	const PAD_TOP = 4;

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const a = $derived(analyse(st));
	const desc = $derived(describeAccess(st));
	const cellW = $derived(GRID_W / a.cellsPerSegment);
	const svgH = $derived(PAD_TOP + a.transactionCount * (ROW_H + ROW_GAP));
	/** Transaction index of each thread, for coloring the warp strip. */
	const threadTr = $derived.by(() => {
		const out: number[] = new Array<number>(WARP_SIZE).fill(0);
		for (const tr of a.transactions) for (const l of tr.lanes) out[l.thread] = tr.index;
		return out;
	});
	const slots = $derived(Array.from({ length: a.cellsPerSegment }, (_, i) => i));
	const seg = $derived(st.segmentBytes);

	/** Transactions are colored with the categorical tokens --cat-1..--cat-6, cycling. */
	function colorOf(index: number): string {
		return `var(--cat-${(index % 6) + 1})`;
	}

	function apply(patch: Partial<CoalescingDemoState>): void {
		st = applyPatch(st, patch);
	}

	function reset(): void {
		st = { ...START };
	}

	onMount(() =>
		demos?.register('coalescing', {
			set: (patch) => apply(patch as Partial<CoalescingDemoState>),
		}),
	);
</script>

<figure
	class="cl"
	id="demo-coalescing"
	data-demo="coalescing"
	class:hl-q={hl === 'q'}
	class:hl-v={hl === 'v'}
>
	<div class="cl-controls">
		<div class="cl-group" role="group" aria-label="Размер транзакции">
			{#each SEGMENT_OPTIONS as s (s)}
				<button
					type="button"
					class="cl-seg"
					aria-pressed={seg === s}
					onclick={() => apply({ segmentBytes: s })}>{s} байт</button
				>
			{/each}
		</div>

		<label class="cl-ctl">
			<span class="cl-label"><span class="cl-sym">шаг</span> (элементов)</span>
			<input
				class="cl-range"
				type="range"
				min={STRIDE_MIN}
				max={STRIDE_MAX}
				step="1"
				value={st.stride}
				oninput={(e) => apply({ stride: Number(e.currentTarget.value) })}
			/>
			<output class="cl-val">{st.stride}</output>
		</label>

		<label class="cl-ctl">
			<span class="cl-label"><span class="cl-sym">сдвиг</span> начала</span>
			<input
				class="cl-range"
				type="range"
				min={OFFSET_MIN}
				max={OFFSET_MAX}
				step="1"
				value={st.offset}
				oninput={(e) => apply({ offset: Number(e.currentTarget.value) })}
			/>
			<output class="cl-val">{st.offset}</output>
		</label>

		<button type="button" class="cl-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="cl-group cl-pattern" role="group" aria-label="Порядок обхода матрицы">
		<button
			type="button"
			class="cl-seg"
			aria-pressed={st.stride === 1}
			onclick={() => apply({ stride: 1 })}>Обход по строкам (шаг 1)</button
		>
		<button
			type="button"
			class="cl-seg"
			aria-pressed={st.stride === 32}
			onclick={() => apply({ stride: 32 })}>Обход по столбцам, 32 в строке (шаг 32)</button
		>
	</div>
	<p class="cl-hint">
		Переключатель размера: 32 байта это единица передачи на устройствах с compute capability 6.0 и
		выше, 128 байт это линия кэша L1 (для сравнения с более крупной единицей). При 128 байтах
		наименьшая доля полезных байт ниже: 1/32, то есть около 3%.
	</p>

	<div class="cl-formula" aria-hidden="true">
		адрес потока t = (сдвиг + t · шаг) · {ELEM_BYTES} байта
	</div>

	<p class="cl-h">Потоки варпа ({WARP_SIZE}) и их транзакции</p>
	<div class="cl-warp" role="list" aria-label="Потоки варпа и номер транзакции">
		{#each Array.from({ length: WARP_SIZE }, (_, i) => i) as t (t)}
			<div
				class="cl-thread"
				role="listitem"
				style="background: {colorOf(threadTr[t] ?? 0)}"
				title="поток {t}: элемент {st.offset + t * st.stride}"
			>
				{t}
			</div>
		{/each}
	</div>

	<p class="cl-h">Сегменты памяти: серые клетки не запрошены, цветные нужны потокам</p>
	<div class="cl-map">
		<svg
			class="cl-svg"
			viewBox="0 0 {LABEL_W + GRID_W} {svgH}"
			role="img"
			aria-labelledby="cl-map-title cl-map-desc"
		>
			<title id="cl-map-title">Транзакции варпа по сегментам памяти</title>
			<desc id="cl-map-desc">{desc}</desc>
			{#each a.transactions as tr (tr.segment)}
				{@const y = PAD_TOP + tr.index * (ROW_H + ROW_GAP)}
				<text class="cl-row-label" x="0" y={y + ROW_H - 1}
					>{tr.segment * seg}–{(tr.segment + 1) * seg - 1}</text
				>
				{#each slots as c (c)}
					<rect
						class="cl-slot"
						x={(LABEL_W + c * cellW).toFixed(2)}
						{y}
						width={(cellW - 1).toFixed(2)}
						height={ROW_H}
					/>
				{/each}
				{#each tr.lanes as l (l.thread)}
					<rect
						class="cl-hit"
						style="fill: {colorOf(tr.index)}"
						x={(LABEL_W + l.cell * cellW).toFixed(2)}
						{y}
						width={(cellW - 1).toFixed(2)}
						height={ROW_H}
					>
						<title>поток {l.thread}</title>
					</rect>
				{/each}
			{/each}
		</svg>
	</div>

	<dl class="cl-stats">
		<dt>Транзакций</dt>
		<dd>{a.transactionCount} <span class="cl-muted">(минимум {a.minTransactions})</span></dd>
		<dt>Запрошено байт</dt>
		<dd>{a.usefulBytes}</dd>
		<dt>Передано байт</dt>
		<dd>{a.movedBytes}</dd>
		<dt>Полезных байт</dt>
		<dd>{efficiencyPercent(a.efficiency)}%</dd>
	</dl>

	<p class="cl-note" aria-live="polite">{desc}</p>
</figure>

<style>
	.cl {
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
	.cl :global(*),
	.cl :global(*::before),
	.cl :global(*::after) {
		box-sizing: border-box;
	}
	.cl dl,
	.cl dd,
	.cl dt,
	.cl p {
		margin: 0;
	}
	.cl button {
		font: inherit;
	}
	.cl-muted {
		color: var(--text-muted);
	}
	.cl-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.cl-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cl-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.cl-seg,
	.cl-reset {
		min-height: 32px;
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
	.cl-reset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.cl-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.cl-seg:focus-visible,
	.cl-reset:focus-visible,
	.cl-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.cl-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.cl-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cl-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cl-val {
		min-width: 3ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.cl-pattern {
		margin-top: var(--space-4);
		flex-wrap: wrap;
	}
	.cl-hint {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.cl-formula {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
	}

	.cl-h {
		margin-top: var(--space-6);
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}

	/* Warp strip: 32 threads in two rows of 16 */
	.cl-warp {
		display: grid;
		grid-template-columns: repeat(16, minmax(0, 1fr));
		gap: 3px;
	}
	.cl-thread {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 24px;
		border-radius: 3px;
		color: var(--surface);
		font-family: var(--font-mono);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	/* Transaction map */
	.cl-map {
		overflow-x: auto;
	}
	.cl-svg {
		display: block;
		width: 100%;
		height: auto;
		min-width: 360px;
		max-width: 480px;
		overflow: visible;
	}
	.cl-row-label {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 9px;
	}
	.cl-slot {
		fill: var(--surface-2);
		stroke: var(--border);
		stroke-width: 0.5;
	}
	.cl-hit {
		stroke: var(--surface);
		stroke-width: 0.5;
	}

	/* Statistics */
	.cl-stats {
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
	.cl-stats dt {
		color: var(--text-muted);
	}
	.cl-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.cl-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.cl.hl-q .cl-stats {
		opacity: 0.45;
	}
	.cl.hl-v .cl-warp {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
		border-radius: var(--radius);
	}

	@media (prefers-reduced-motion: reduce) {
		.cl *,
		.cl *::before,
		.cl *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.cl {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.cl-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.cl-ctl {
			flex-wrap: wrap;
		}
		.cl-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
