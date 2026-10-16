<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		BLOCK_SIZES,
		DEFAULT_STATE,
		N_MAX,
		N_MIN,
		applyPatch,
		describeGrid,
		globalIndex,
		layoutGrid,
		summarize,
		threadOf,
		type CudaGridDemoState,
		type Rounding,
	} from '$lib/demos/cuda-basics';

	/** CUDA grid demo: blocks and threads for N elements. Registers itself as demo `cuda-grid`. */
	let { initial }: { initial?: Partial<CudaGridDemoState> } = $props();

	/* Start state: defaults with the props applied. Reset returns to it. */
	/* svelte-ignore state_referenced_locally */
	const START = applyPatch(DEFAULT_STATE, initial ?? {});

	let st = $state<CudaGridDemoState>({ ...START });

	const sum = $derived(summarize(st));
	const layout = $derived(layoutGrid(sum));
	const selThread = $derived(threadOf(st.sel, st.blockDim));
	const selIndex = $derived(st.sel);
	const desc = $derived(describeGrid(sum));
	const showLabels = $derived(sum.blocks <= 16);
	const hasThreads = $derived(sum.launched > 0);
	const selWorks = $derived(selIndex < st.n);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	function apply(patch: Partial<CudaGridDemoState>): void {
		st = applyPatch(st, patch);
	}

	function reset(): void {
		st = { ...START };
	}

	function setRounding(r: Rounding): void {
		apply({ rounding: r });
	}

	onMount(() =>
		demos?.register('cuda-grid', {
			set: (patch) => apply(patch as Partial<CudaGridDemoState>),
		}),
	);
</script>

<figure class="cu" id="demo-cuda-grid" data-demo="cuda-grid">
	<div class="cu-controls">
		<label class="cu-ctl">
			<span class="cu-label"><span class="cu-sym">N</span> (элементы)</span>
			<input
				class="cu-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step="1"
				value={st.n}
				oninput={(e) => apply({ n: Number(e.currentTarget.value) })}
			/>
			<output class="cu-val">{st.n}</output>
		</label>

		<div class="cu-ctl">
			<span class="cu-label"><span class="cu-sym">B</span> (потоков в блоке)</span>
			<div class="cu-group" role="group" aria-label="Потоков в блоке">
				{#each BLOCK_SIZES as b (b)}
					<button
						type="button"
						class="cu-seg"
						aria-pressed={st.blockDim === b}
						onclick={() => apply({ blockDim: b })}>{b}</button
					>
				{/each}
			</div>
		</div>

		<div class="cu-group" role="group" aria-label="Округление числа блоков">
			<button
				type="button"
				class="cu-seg"
				aria-pressed={st.rounding === 'up'}
				onclick={() => setRounding('up')}>вверх, верно</button
			>
			<button
				type="button"
				class="cu-seg"
				aria-pressed={st.rounding === 'down'}
				onclick={() => setRounding('down')}>вниз, ошибка</button
			>
		</div>

		<button type="button" class="cu-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="cu-formula" aria-hidden="true">
		G = ⌈N / B⌉ = ⌈{st.n} / {st.blockDim}⌉ = {sum.blocks} &nbsp;·&nbsp; i = blockIdx · B + threadIdx
	</div>

	<div class="cu-plot">
		<svg
			class="cu-svg"
			viewBox="0 0 {layout.width} {layout.height}"
			role="img"
			aria-labelledby="cu-title cu-desc"
		>
			<title id="cu-title">Сетка блоков и потоков для {st.n} элементов</title>
			<desc id="cu-desc">{desc}</desc>

			{#each layout.tiles as tile (tile.block)}
				{#if showLabels}
					<text class="cu-tick" x={tile.labelX} y={tile.labelY}>блок {tile.block}</text>
				{/if}
				{#each tile.cells as c (c.index)}
					<rect
						class="cu-cell"
						class:cu-work={c.work}
						class:cu-sel={c.index === selIndex}
						x={c.x.toFixed(1)}
						y={c.y.toFixed(1)}
						width={6.5}
						height={6.5}
					>
						<title
							>блок {c.block}, поток {c.thread}, i = {c.index}{c.work
								? ': работает с элементом'
								: ': лишний, ничего не делает'}</title
						>
					</rect>
				{/each}
			{/each}

			{#if layout.missedLabel}
				<text class="cu-tick cu-tick-miss" x={layout.missedLabel.x} y={layout.missedLabel.y}>
					элементы без потока
				</text>
			{/if}
			{#each layout.missed as m (m.index)}
				<rect
					class="cu-cell cu-miss"
					x={m.x.toFixed(1)}
					y={m.y.toFixed(1)}
					width={6.5}
					height={6.5}
				>
					<title>элемент {m.index}: не обработан</title>
				</rect>
			{/each}
		</svg>
	</div>

	<div class="cu-legend" aria-hidden="true">
		<span><i class="cu-key cu-key-work"></i>работает</span>
		<span><i class="cu-key cu-key-idle"></i>лишний поток</span>
		<span><i class="cu-key cu-key-miss"></i>не обработан</span>
	</div>

	<div class="cu-thread">
		<label class="cu-ctl cu-ctl-wide">
			<span class="cu-label">Поток с номером i</span>
			<input
				class="cu-range"
				type="range"
				min="0"
				max={Math.max(0, sum.launched - 1)}
				step="1"
				value={st.sel}
				disabled={!hasThreads}
				oninput={(e) => apply({ sel: Number(e.currentTarget.value) })}
			/>
			<output class="cu-val">{hasThreads ? st.sel : '—'}</output>
		</label>
		<p class="cu-calc" aria-live="polite">
			{#if hasThreads}
				blockIdx = {selThread.block}, threadIdx = {selThread.thread}: i = {selThread.block} · {st.blockDim}
				+ {selThread.thread} = {globalIndex(selThread.block, st.blockDim, selThread.thread)}.
				{selWorks ? 'Поток работает с элементом x[i].' : 'Поток лишний: i ≥ N, работы нет.'}
			{:else}
				Блоков нет: ни один поток не запущен.
			{/if}
		</p>
	</div>

	<dl class="cu-stats">
		<dt>Блоков запущено</dt>
		<dd>{sum.blocks}</dd>
		<dt>Потоков запущено</dt>
		<dd>{sum.launched}</dd>
		<dt>Лишних потоков</dt>
		<dd>{sum.idle}</dd>
		<dt>Элементов без потока</dt>
		<dd>{sum.missed}</dd>
	</dl>

	<p class="cu-desc" aria-live="polite">{desc}</p>
</figure>

<style>
	.cu {
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
	.cu :global(*),
	.cu :global(*::before),
	.cu :global(*::after) {
		box-sizing: border-box;
	}
	.cu dl,
	.cu dd,
	.cu dt,
	.cu p {
		margin: 0;
	}
	.cu button {
		font: inherit;
	}
	.cu-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.cu-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cu-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.cu-seg,
	.cu-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.cu-reset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.cu-reset:hover {
		background: var(--surface-2);
	}
	.cu-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.cu-seg:focus-visible,
	.cu-reset:focus-visible,
	.cu-range:focus-visible,
	.cu-cell:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.cu-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.cu-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cu-range {
		width: 180px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cu-range:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
	.cu-val {
		min-width: 5ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.cu-formula {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
	}

	/* Grid */
	.cu-plot {
		margin-top: var(--space-4);
	}
	.cu-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.cu-cell {
		fill: var(--surface-2);
		stroke: var(--border);
		stroke-width: 0.6;
		cursor: pointer;
		transition: fill var(--dur) var(--ease);
	}
	.cu-cell.cu-work {
		fill: var(--topic);
		stroke: none;
	}
	.cu-cell.cu-miss {
		fill: var(--cat-4);
		stroke: none;
		cursor: default;
	}
	.cu-cell.cu-sel {
		stroke: var(--text);
		stroke-width: 1.8;
	}
	.cu-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.cu-tick-miss {
		fill: var(--cat-4);
	}

	.cu-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}
	.cu-legend span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.cu-key {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
	.cu-key-work {
		background: var(--topic);
	}
	.cu-key-idle {
		background: var(--surface-2);
		border: 1px solid var(--border);
	}
	.cu-key-miss {
		background: var(--cat-4);
	}

	.cu-thread {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.cu-ctl-wide {
		flex-wrap: wrap;
	}
	.cu-calc {
		margin-top: var(--space-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
	}

	/* Statistics */
	.cu-stats {
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
	.cu-stats dt {
		color: var(--text-muted);
	}
	.cu-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.cu-desc {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.cu *,
		.cu *::before,
		.cu *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.cu {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.cu-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.cu-ctl {
			flex-wrap: wrap;
		}
		.cu-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.cu-seg {
			padding: 0 var(--space-2);
		}
	}
</style>
