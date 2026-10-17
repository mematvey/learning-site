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
		N_MAX,
		N_MIN,
		N_STEP,
		TILE_OPTIONS,
		applyPatch,
		describeState,
		formatCount,
		readsPerElementNaive,
		readsPerElementTiled,
		reduction,
		sharedBytesPerBlock,
		totalReadsNaive,
		totalReadsTiled,
		type MatmulTilingDemoState,
	} from '$lib/demos/matmul-optimization';

	/** Matmul tiling demo: counts global-memory reads for naive and tiled products. Registers itself as demo `matmul-tiling`. */
	let { initial }: { initial?: Partial<MatmulTilingDemoState> } = $props();

	const CHART_H = 200;
	const PAD = 24;

	/* Start state: defaults with the props applied. Reset returns to it. */
	/* svelte-ignore state_referenced_locally */
	const START = applyPatch(DEFAULT_STATE, initial ?? {});

	let st = $state<MatmulTilingDemoState>({ ...START });
	/** Real width of the chart in px; the SVG is drawn at this width (no viewBox scaling). */
	let chartW = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const plotW = $derived(chartW >= 120 ? chartW : 320);
	const naivePer = $derived(readsPerElementNaive(st.n));
	const tiledPer = $derived(readsPerElementTiled(st.n, st.tile));
	const totalNaive = $derived(totalReadsNaive(st.n));
	const totalTiled = $derived(totalReadsTiled(st.n, st.tile));
	const red = $derived(reduction(st.n, st.tile));
	const note = $derived(describeState(st));

	/** One bar per tile option: reads of one element of A (or B) at this tile size. */
	const bars = $derived.by(() => {
		const slot = (plotW - 2 * PAD) / TILE_OPTIONS.length;
		const half = CHART_H - 2 * PAD;
		return TILE_OPTIONS.map((t, j) => {
			const v = readsPerElementTiled(st.n, t);
			const h = (v / naivePer) * half;
			return {
				t,
				v,
				x: PAD + j * slot + slot * 0.2,
				w: slot * 0.6,
				y: CHART_H - PAD - h,
				h,
				current: t === st.tile,
			};
		});
	});

	const desc = $derived(
		`Чтений одного элемента из глобальной памяти при тайле ${st.tile} × ${st.tile}: ${tiledPer}. Наивный алгоритм: ${naivePer}.`,
	);

	function apply(patch: Partial<MatmulTilingDemoState>): void {
		st = applyPatch(st, patch);
	}

	function reset(): void {
		st = { ...START };
	}

	onMount(() =>
		demos?.register('matmul-tiling', {
			set: (patch) => apply(patch as Partial<MatmulTilingDemoState>),
		}),
	);
</script>

<figure class="mt" id="demo-matmul-tiling" data-demo="matmul-tiling" class:hl-q={hl === 'q'}>
	<div class="mt-controls">
		<label class="mt-ctl">
			<span class="mt-label"><span class="mt-sym">n</span> (размер матриц)</span>
			<input
				class="mt-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step={N_STEP}
				value={st.n}
				oninput={(e) => apply({ n: Number(e.currentTarget.value) })}
			/>
			<output class="mt-val">{st.n}</output>
		</label>

		<div class="mt-group" role="group" aria-label="Размер тайла">
			{#each TILE_OPTIONS as t (t)}
				<button
					type="button"
					class="mt-seg"
					aria-pressed={st.tile === t}
					onclick={() => apply({ tile: t })}>{t}</button
				>
			{/each}
		</div>
		<span class="mt-label">тайл T × T</span>

		<button type="button" class="mt-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="mt-formula" aria-hidden="true">
		Наивно: 2 n³ обращений. Тайлами: 2 n² · ⌈n / T⌉ обращений.
	</div>

	<div class="mt-panel" bind:clientWidth={chartW}>
		<p class="mt-panel-t">
			Чтений одного элемента A из глобальной памяти <span class="mt-muted">по размеру тайла</span>
		</p>
		<svg
			class="mt-svg"
			viewBox="0 0 {plotW} {CHART_H}"
			role="img"
			aria-labelledby="mt-title mt-desc"
		>
			<title id="mt-title">Число чтений элемента при разных размерах тайла</title>
			<desc id="mt-desc">{desc}</desc>
			<line class="mt-base" x1={PAD} x2={plotW - PAD} y1={CHART_H - PAD} y2={CHART_H - PAD} />
			{#each bars as b (b.t)}
				<rect
					class={b.current ? 'mt-bar mt-bar-cur' : 'mt-bar'}
					x={b.x.toFixed(1)}
					y={b.y.toFixed(1)}
					width={b.w.toFixed(1)}
					height={b.h.toFixed(1)}
				>
					<title>T = {b.t}: {b.v} чтений</title>
				</rect>
				<text class="mt-tick" x={(b.x + b.w / 2).toFixed(1)} y={CHART_H - 6}>{b.t}</text>
				<text class="mt-count" x={(b.x + b.w / 2).toFixed(1)} y={(b.y - 4).toFixed(1)}>{b.v}</text>
			{/each}
		</svg>
	</div>

	<dl class="mt-stats">
		<dt>Величина</dt>
		<dd class="mt-h">значение</dd>
		<dt>Чтений одного элемента A или B</dt>
		<dd>{tiledPer} вместо {naivePer}</dd>
		<dt>Всего обращений, наивно</dt>
		<dd>{formatCount(totalNaive)}</dd>
		<dt>Всего обращений, тайлами</dt>
		<dd>{formatCount(totalTiled)}</dd>
		<dt>Разделяемая память на блок (float32)</dt>
		<dd>{formatCount(sharedBytesPerBlock(st.tile))} Б</dd>
		<dt>Выигрыш</dt>
		<dd>в {red.toFixed(1)} раза</dd>
	</dl>

	<p class="mt-note" aria-live="polite">{note}</p>
</figure>

<style>
	.mt {
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
	.mt :global(*),
	.mt :global(*::before),
	.mt :global(*::after) {
		box-sizing: border-box;
	}
	.mt dl,
	.mt dd,
	.mt dt,
	.mt p {
		margin: 0;
	}
	.mt button {
		font: inherit;
	}
	.mt-muted {
		color: var(--text-muted);
	}
	.mt-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.mt-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.mt-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.mt-seg,
	.mt-reset {
		min-width: 32px;
		height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.mt-reset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-sans);
		color: var(--text);
	}
	.mt-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.mt-seg:focus-visible,
	.mt-reset:focus-visible,
	.mt-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.mt-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.mt-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.mt-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.mt-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.mt-formula {
		margin-top: var(--space-4);
		color: var(--text);
		font-family: var(--font-serif);
		font-size: var(--fs-base);
		line-height: 1.3;
	}

	/* Chart */
	.mt-panel {
		margin-top: var(--space-6);
	}
	.mt-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.mt-svg {
		display: block;
		width: 100%;
		height: 200px;
		overflow: visible;
	}
	.mt-base {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.mt-bar {
		fill: var(--text-muted);
		opacity: 0.55;
	}
	.mt-bar-cur {
		fill: var(--topic);
		opacity: 1;
	}
	.mt-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		text-anchor: middle;
	}
	.mt-count {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
		text-anchor: middle;
	}

	/* Statistics */
	.mt-stats {
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
	.mt-stats dt {
		color: var(--text-muted);
	}
	.mt-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.mt-h {
		font-family: var(--font-sans);
	}
	.mt-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.mt.hl-q .mt-stats {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.mt *,
		.mt *::before,
		.mt *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.mt {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.mt-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.mt-ctl {
			flex-wrap: wrap;
		}
		.mt-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
