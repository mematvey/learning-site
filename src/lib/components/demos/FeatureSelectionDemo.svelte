<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		N_FEATURES,
		NOISE_MAX_BOUND,
		THRESHOLD_DEFAULT,
		THRESHOLD_MAX,
		THRESHOLD_MIN,
		THRESHOLD_STEP,
		type FeatureSelectionDemoState,
		type SelectionMode,
		displayedCount,
		evaluate,
		formatRu,
		isSelectionMode,
		noiseMaxMean,
		snapThreshold,
		sortedCurve,
	} from '$lib/demos/feature-selection';

	/** Feature selection on pure noise. Registers itself as demo `feature-selection`. */
	let { initial }: { initial?: Partial<FeatureSelectionDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let threshold = $state(snapThreshold(initial?.threshold ?? THRESHOLD_DEFAULT));
	/* svelte-ignore state_referenced_locally */
	let mode = $state<SelectionMode>(isSelectionMode(initial?.mode) ? initial.mode : 'before');
	/** Real width of the chart in px; the SVG is drawn at this width (no viewBox scaling). */
	let chartW = $state(0);

	const CHART_H = 180;
	const PAD_L = 40;
	const PAD_B = 22;
	const PAD_T = 8;
	const Y_MAX = 0.6;

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const outcome = $derived(evaluate(threshold));
	const curve = $derived(sortedCurve(mode));
	const kept = $derived(displayedCount(mode, threshold));
	const plotW = $derived(chartW >= 200 ? chartW : 320);
	const innerW = $derived(plotW - PAD_L - 8);
	const innerH = CHART_H - PAD_T - PAD_B;
	const noiseMax = noiseMaxMean();

	const xOf = (rank: number) => PAD_L + (rank / (N_FEATURES - 1)) * innerW;
	const yOf = (v: number) => PAD_T + innerH - (Math.min(v, Y_MAX) / Y_MAX) * innerH;
	const vOf = (y: number) => ((PAD_T + innerH - y) / innerH) * Y_MAX;

	/** SVG path of the whole sorted curve. */
	const linePath = $derived.by(() => {
		let d = '';
		for (let i = 0; i < curve.length; i++) {
			d += `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(curve[i] as number).toFixed(1)}`;
		}
		return d;
	});
	/** Filled area under the kept part of the curve (ranks 1..kept). */
	const areaPath = $derived.by(() => {
		if (kept === 0) return '';
		let d = `M${xOf(0).toFixed(1)},${yOf(0).toFixed(1)}`;
		for (let i = 0; i < kept; i++)
			d += `L${xOf(i).toFixed(1)},${yOf(curve[i] as number).toFixed(1)}`;
		d += `L${xOf(kept - 1).toFixed(1)},${yOf(0).toFixed(1)}Z`;
		return d;
	});
	const thresholdY = $derived(yOf(threshold));
	const keptX = $derived(xOf(Math.max(0, kept - 1)));

	const modeLabel = $derived(
		mode === 'before' ? 'отбор до разбиения на фолды' : 'отбор внутри каждого фолда',
	);
	const pctBefore = $derived(outcome.before);
	const pctInside = $derived(outcome.inside);
	const summary = $derived(
		`Порог |corr| ${formatRu(threshold, 2)}: отобрано ${kept} из ${N_FEATURES} признаков (прогон 1). ` +
			`Средняя оценка кросс-валидации: до разбиения ${formatRu(pctBefore, 2)}, внутри фолда ${formatRu(pctInside, 2)}. ` +
			`Угадывание даёт 0,50.`,
	);
	const note = $derived(
		mode === 'before'
			? `Отбор видит все строки, включая тестовые фолды. Признаки подобраны под метки, и оценка около ${formatRu(pctBefore, 1)} на чистом шуме. Порог меняет число признаков, но не эту ошибку.`
			: `Отбор повторён внутри обучающей части каждого фолда. Тестовый фолд отбор не видит, и оценка около ${formatRu(pctInside, 1)}: модель без сигнала угадывает.`,
	);

	function apply(patch: Partial<FeatureSelectionDemoState>): void {
		if (typeof patch.threshold === 'number') threshold = snapThreshold(patch.threshold);
		if (isSelectionMode(patch.mode)) mode = patch.mode;
	}

	function reset(): void {
		threshold = THRESHOLD_DEFAULT;
		mode = 'before';
	}

	/** Dragging on the chart sets the threshold from the pointer height. */
	function drag(e: PointerEvent): void {
		const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const y = e.clientY - box.top;
		threshold = snapThreshold(vOf(y));
	}

	function startDrag(e: PointerEvent): void {
		(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
		drag(e);
	}

	function moveDrag(e: PointerEvent): void {
		if (!(e.currentTarget as SVGSVGElement).hasPointerCapture(e.pointerId)) return;
		drag(e);
	}

	onMount(() => {
		return demos?.register('feature-selection', {
			set: (patch) => apply(patch as Partial<FeatureSelectionDemoState>),
		});
	});
</script>

<figure class="fs" id="demo-feature-selection" data-demo="feature-selection">
	<div class="fs-controls">
		<div class="fs-group" role="group" aria-label="Место отбора признаков">
			<button
				type="button"
				class="fs-seg"
				aria-pressed={mode === 'before'}
				onclick={() => (mode = 'before')}>До разбиения</button
			>
			<button
				type="button"
				class="fs-seg"
				aria-pressed={mode === 'inside'}
				onclick={() => (mode = 'inside')}>Внутри фолда</button
			>
		</div>

		<label class="fs-ctl">
			<span class="fs-label">Порог <span class="fs-sym">|corr|</span></span>
			<input
				class="fs-range"
				type="range"
				min={THRESHOLD_MIN}
				max={THRESHOLD_MAX}
				step={THRESHOLD_STEP}
				value={threshold}
				oninput={(e) => (threshold = snapThreshold(Number(e.currentTarget.value)))}
			/>
			<output class="fs-val">{formatRu(threshold, 2)}</output>
		</label>

		<button type="button" class="fs-reset" onclick={reset}>Сбросить</button>
	</div>

	<p class="fs-mode">
		Сейчас: {modeLabel}. Перетащите линию порога на графике или используйте ползунок.
	</p>

	<div class="fs-chart" bind:clientWidth={chartW}>
		<p class="fs-panel-t">
			Оценка |corr| признаков по убыванию <span class="fs-muted">(прогон 1 из 50)</span>
		</p>
		<svg
			class="fs-svg"
			width={plotW}
			height={CHART_H}
			aria-hidden="true"
			onpointerdown={startDrag}
			onpointermove={moveDrag}
			onpointerup={(e) => (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId)}
		>
			<line class="fs-axis" x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + innerH} />
			<line
				class="fs-axis"
				x1={PAD_L}
				x2={PAD_L + innerW}
				y1={PAD_T + innerH}
				y2={PAD_T + innerH}
			/>
			{#each [0, 0.2, 0.4, 0.6] as tick (tick)}
				<text class="fs-tick" x={PAD_L - 6} y={yOf(tick) + 4} text-anchor="end"
					>{formatRu(tick, 1)}</text
				>
			{/each}
			<text class="fs-tick" x={PAD_L} y={CHART_H - 4}>1</text>
			<text class="fs-tick" x={PAD_L + innerW} y={CHART_H - 4} text-anchor="end">{N_FEATURES}</text>

			<line
				class="fs-noise"
				x1={PAD_L}
				x2={PAD_L + innerW}
				y1={yOf(NOISE_MAX_BOUND)}
				y2={yOf(NOISE_MAX_BOUND)}
			/>

			{#if areaPath}
				<path class="fs-area" d={areaPath} />
			{/if}
			<path class="fs-curve" d={linePath} />
			<line class="fs-kept" x1={keptX} x2={keptX} y1={PAD_T} y2={PAD_T + innerH} />

			<line class="fs-thr" x1={PAD_L} x2={PAD_L + innerW} y1={thresholdY} y2={thresholdY} />
			<rect
				class="fs-handle"
				x={PAD_L + innerW - 6}
				y={thresholdY - 10}
				width="12"
				height="20"
				rx="3"
			/>
		</svg>
		<p class="fs-caption">
			Признаков на графике {N_FEATURES}, отобрано в этом прогоне: <strong>{kept}</strong>
		</p>
	</div>

	<div class="fs-results" role="group" aria-label="Оценка кросс-валидации">
		<div class="fs-row" class:is-active={mode === 'before'}>
			<span class="fs-row-t">До разбиения</span>
			<div class="fs-bar-track">
				<div class="fs-bar fs-bar-before" style:width="{(pctBefore * 100).toFixed(1)}%"></div>
				<span class="fs-chance" aria-hidden="true"></span>
			</div>
			<span class="fs-row-v">{formatRu(pctBefore, 2)}</span>
			<span class="fs-row-n">в среднем: {formatRu(outcome.beforeCount, 0)}</span>
		</div>
		<div class="fs-row" class:is-active={mode === 'inside'}>
			<span class="fs-row-t">Внутри фолда</span>
			<div class="fs-bar-track">
				<div class="fs-bar fs-bar-inside" style:width="{(pctInside * 100).toFixed(1)}%"></div>
				<span class="fs-chance" aria-hidden="true"></span>
			</div>
			<span class="fs-row-v">{formatRu(pctInside, 2)}</span>
			<span class="fs-row-n">в среднем: {formatRu(outcome.insideCount, 0)}</span>
		</div>
		<p class="fs-scale">
			Пунктир: угадывание, 0,50. Шкала от 0 до 1. Оценки усреднены по 50 прогонам и 5 фолдам.
		</p>
	</div>

	<dl class="fs-stats">
		<dt>Максимум |corr| среди шума</dt>
		<dd>{formatRu(noiseMax, 2)}</dd>
		<dt>Граница √(2 ln p / n)</dt>
		<dd>{formatRu(NOISE_MAX_BOUND, 2)}</dd>
	</dl>

	<p class="fs-note">{note}</p>
	<p class="fs-sr" aria-live="polite">{summary}</p>
</figure>

<style>
	.fs {
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
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.fs :global(*),
	.fs :global(*::before),
	.fs :global(*::after) {
		box-sizing: border-box;
	}
	.fs dl,
	.fs dd,
	.fs dt,
	.fs p {
		margin: 0;
	}
	.fs button {
		font: inherit;
	}
	.fs-muted {
		color: var(--text-muted);
	}
	.fs-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}
	.fs-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* Controls */
	.fs-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.fs-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.fs-seg,
	.fs-reset {
		min-height: 36px;
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
	.fs-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.fs-reset {
		border: 1px solid var(--border);
		color: var(--text);
		background: var(--surface-2);
	}
	.fs-reset:hover,
	.fs-seg:hover {
		color: var(--text);
	}
	.fs-seg:focus-visible,
	.fs-reset:focus-visible,
	.fs-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.fs-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.fs-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.fs-range {
		width: 160px;
		min-height: 36px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.fs-val {
		min-width: 4ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.fs-mode {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Chart */
	.fs-chart {
		margin-top: var(--space-5);
	}
	.fs-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.fs-svg {
		display: block;
		max-width: 100%;
		height: 180px;
		touch-action: none;
		cursor: ns-resize;
		overflow: visible;
	}
	.fs-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.6;
	}
	.fs-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.fs-noise {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 2 4;
		opacity: 0.7;
	}
	.fs-curve {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
	}
	.fs-area {
		fill: var(--topic);
		opacity: 0.35;
	}
	.fs-kept {
		stroke: var(--topic);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.fs-thr {
		stroke: var(--cat-3);
		stroke-width: 2;
	}
	.fs-handle {
		fill: var(--cat-3);
		stroke: var(--surface);
		stroke-width: 2;
	}
	.fs-caption {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.fs-caption strong {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	/* Results */
	.fs-results {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-5);
	}
	.fs-row {
		display: grid;
		grid-template-columns: minmax(0, 9.5rem) minmax(0, 1fr) 3.5rem;
		grid-template-areas:
			't b v'
			'. n n';
		align-items: center;
		gap: var(--space-1) var(--space-3);
		opacity: 0.6;
		transition: opacity var(--dur) var(--ease);
	}
	.fs-row.is-active {
		opacity: 1;
	}
	.fs-row-t {
		grid-area: t;
		color: var(--text);
	}
	.fs-bar-track {
		grid-area: b;
		position: relative;
		height: 14px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.fs-bar {
		height: 100%;
		transition: width var(--dur) var(--ease);
	}
	.fs-bar-before {
		background: var(--cat-4);
	}
	.fs-bar-inside {
		background: var(--cat-1);
	}
	.fs-chance {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		border-left: 1px dashed var(--text);
	}
	.fs-row-v {
		grid-area: v;
		text-align: right;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.fs-row-n {
		grid-area: n;
		color: var(--text-muted);
		font-size: 12px;
	}
	.fs-scale {
		color: var(--text-muted);
		font-size: 12px;
	}

	/* Statistics and note */
	.fs-stats {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-5);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.fs-stats dt {
		color: var(--text-muted);
	}
	.fs-stats dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.fs-note {
		margin-top: var(--space-4);
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.fs *,
		.fs *::before,
		.fs *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.fs {
			padding: var(--space-4);
		}
		.fs-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.fs-ctl {
			flex-wrap: wrap;
		}
		.fs-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.fs-row {
			grid-template-columns: minmax(0, 1fr) 3.5rem;
			grid-template-areas:
				't v'
				'b b'
				'n n';
		}
	}
</style>
