<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		PRESETS,
		W_MAX,
		W_MIN,
		describeState,
		initialWeights,
		isPreset,
		setWeight,
		summarize,
		weightFromY,
		type Preset,
		type RandomVariableDemoState,
	} from '$lib/demos/random-variables';

	/** Discrete random variable demo: editable column weights, expectation and variance. Registers itself as demo `random-variables`. */
	let { initial }: { initial?: Partial<RandomVariableDemoState> } = $props();

	/* svelte-ignore state_referenced_locally */
	let preset = $state<Preset>(isPreset(initial?.preset) ? initial.preset : 'die');
	/** Weights of each preset are kept apart, so switching presets does not lose the edits. */
	let weights = $state<Record<Preset, number[]>>({
		die: initialWeights('die'),
		sum: initialWeights('sum'),
	});
	/** Width of the chart in px; 320 until the first measurement. */
	let plotW = $state(0);
	let dragging = $state(false);

	const H = 200;
	const PAD_T = 24;
	const PAD_B = 28;
	const plotH = H - PAD_T - PAD_B;

	const def = $derived(PRESETS[preset]);
	const w = $derived(weights[preset]);
	const W = $derived(plotW >= 120 ? plotW : 320);
	const slot = $derived(W / def.values.length);
	const barW = $derived(slot * 0.7);
	const summary = $derived(summarize(def.values, w));
	const maxProb = $derived(summary ? Math.max(...summary.probs) : 0);
	const status = $derived(describeState(def, summary));

	/** Bar height is proportional to the probability; the tallest column fills the plot. */
	function barHeight(p: number): number {
		return maxProb > 0 ? (p / maxProb) * plotH : 0;
	}
	/** x of a value on the axis: values are consecutive integers, so the column centre is linear. */
	function centreX(v: number): number {
		return (v - (def.values[0] ?? 0) + 0.5) * slot;
	}

	const meanX = $derived(summary ? centreX(summary.mean) : 0);
	const bandL = $derived(summary ? centreX(summary.mean - summary.std) : 0);
	const bandR = $derived(summary ? centreX(summary.mean + summary.std) : 0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	function setColumn(index: number, value: number): void {
		weights[preset] = setWeight(weights[preset], index, value);
	}

	function resetPreset(): void {
		weights[preset] = initialWeights(preset);
	}

	function applyPatch(patch: Partial<RandomVariableDemoState>): void {
		if (isPreset(patch.preset)) preset = patch.preset;
	}

	/** Maps a pointer position to a column and sets its weight from the height. */
	function applyPointer(e: PointerEvent): void {
		const svg = e.currentTarget as SVGSVGElement;
		const r = svg.getBoundingClientRect();
		if (r.width <= 0 || r.height <= 0) return;
		const x = (e.clientX - r.left) * (W / r.width);
		const y = (e.clientY - r.top) * (H / r.height);
		const n = def.values.length;
		const index = Math.min(n - 1, Math.max(0, Math.floor(x / slot)));
		setColumn(index, weightFromY(y - PAD_T, plotH));
	}

	function onPointerDown(e: PointerEvent): void {
		const svg = e.currentTarget as SVGSVGElement;
		svg.setPointerCapture(e.pointerId);
		dragging = true;
		applyPointer(e);
	}

	function onPointerMove(e: PointerEvent): void {
		if (dragging) applyPointer(e);
	}

	function onPointerUp(): void {
		dragging = false;
	}

	/** Arrow keys change a column by one step; Home and End set the minimum and maximum. */
	function onColumnKey(e: KeyboardEvent, index: number): void {
		const current = w[index] ?? 0;
		let next: number | null = null;
		if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = current + 1;
		else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = current - 1;
		else if (e.key === 'Home') next = W_MIN;
		else if (e.key === 'End') next = W_MAX;
		if (next === null) return;
		e.preventDefault();
		setColumn(index, next);
	}

	onMount(() => {
		return demos?.register('random-variables', {
			set: (patch) => applyPatch(patch as Partial<RandomVariableDemoState>),
		});
	});
</script>

<figure class="rv" id="demo-random-variables" data-demo="random-variables">
	<div class="rv-controls">
		<div class="rv-group" role="group" aria-label="Величина">
			{#each Object.values(PRESETS) as p (p.id)}
				<button
					type="button"
					class="rv-seg"
					aria-pressed={preset === p.id}
					onclick={() => (preset = p.id)}>{p.label}</button
				>
			{/each}
		</div>
		<button type="button" class="rv-reset" onclick={resetPreset}>Сбросить</button>
	</div>

	<div class="rv-plot" bind:clientWidth={plotW}>
		<svg
			class="rv-svg"
			class:is-dragging={dragging}
			viewBox="0 0 {W} {H}"
			role="group"
			aria-label="Столбцы вероятностей. Перетаскивайте мышью или меняйте стрелками с клавиатуры."
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		>
			{#if summary}
				<rect
					class="rv-band"
					x={bandL.toFixed(1)}
					y={PAD_T}
					width={Math.max(0, bandR - bandL).toFixed(1)}
					height={plotH}
				/>
			{/if}
			<line class="rv-base" x1="0" x2={W} y1={PAD_T + plotH} y2={PAD_T + plotH} />
			{#each def.values as v, i (v)}
				{@const p = summary?.probs[i] ?? 0}
				{@const h = barHeight(p)}
				<g
					class="rv-col"
					role="slider"
					tabindex="0"
					aria-label="Значение {v}"
					aria-orientation="vertical"
					aria-valuemin={W_MIN}
					aria-valuemax={W_MAX}
					aria-valuenow={w[i] ?? 0}
					aria-valuetext="вес {w[i] ?? 0}, вероятность {(p * 100).toFixed(1)} процента"
					onkeydown={(e) => onColumnKey(e, i)}
				>
					<rect
						class="rv-bar"
						x={(i * slot + slot * 0.15).toFixed(1)}
						y={(PAD_T + plotH - h).toFixed(1)}
						width={barW.toFixed(1)}
						height={h.toFixed(1)}
					/>
					<text class="rv-prob" x={(i * slot + slot / 2).toFixed(1)} y={PAD_T + plotH - h - 5}
						>{(p * 100).toFixed(1)}%</text
					>
					<text class="rv-tick" x={(i * slot + slot / 2).toFixed(1)} y={H - 8}>{v}</text>
				</g>
			{/each}
			{#if summary}
				<line
					class="rv-mean"
					x1={meanX.toFixed(1)}
					x2={meanX.toFixed(1)}
					y1={PAD_T}
					y2={PAD_T + plotH}
				/>
			{/if}
		</svg>
	</div>

	<div class="rv-stats-wrap">
		<dl class="rv-stats">
			<dt>E[X] (ожидание)</dt>
			<dd>{summary ? summary.mean.toFixed(2) : '—'}</dd>
			<dt>Var(X) (дисперсия)</dt>
			<dd>{summary ? summary.variance.toFixed(2) : '—'}</dd>
			<dt>σ (стандартное отклонение)</dt>
			<dd>{summary ? summary.std.toFixed(2) : '—'}</dd>
			<dt>Сумма вероятностей</dt>
			<dd>{summary ? summary.probs.reduce((s, p) => s + p, 0).toFixed(2) : '—'}</dd>
		</dl>
	</div>

	<p class="rv-status" aria-live="polite">{status}</p>

	<p class="rv-note"><b>Что заметить:</b> {def.note}</p>
</figure>

<style>
	.rv {
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
	.rv :global(*),
	.rv :global(*::before),
	.rv :global(*::after) {
		box-sizing: border-box;
	}
	.rv dl,
	.rv dd,
	.rv dt,
	.rv p {
		margin: 0;
	}
	.rv button {
		font: inherit;
	}

	/* Controls */
	.rv-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.rv-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.rv-seg,
	.rv-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.rv-seg {
		border: 0;
		background: none;
		color: var(--text-muted);
	}
	.rv-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.rv-reset {
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text);
	}
	.rv-seg:focus-visible,
	.rv-reset:focus-visible,
	.rv-col:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Chart */
	.rv-plot {
		margin-top: var(--space-6);
	}
	.rv-svg {
		display: block;
		width: 100%;
		height: 200px;
		overflow: visible;
		touch-action: none;
		cursor: ns-resize;
		user-select: none;
	}
	.rv-svg.is-dragging {
		cursor: grabbing;
	}
	.rv-base {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.rv-band {
		fill: var(--topic);
		opacity: 0.12;
	}
	.rv-bar {
		fill: var(--topic);
	}
	.rv-col:hover .rv-bar {
		opacity: 0.85;
	}
	.rv-mean {
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.rv-prob {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		text-anchor: middle;
	}
	.rv-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		text-anchor: middle;
	}

	/* Statistics */
	.rv-stats-wrap {
		margin-top: var(--space-6);
	}
	.rv-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.rv-stats dt {
		color: var(--text-muted);
	}
	.rv-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.rv-status {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.rv-note {
		margin-top: var(--space-3);
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.rv *,
		.rv *::before,
		.rv *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.rv {
			padding: var(--space-4);
		}
		.rv-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.rv-group {
			width: 100%;
		}
		.rv-seg {
			flex: 1 1 auto;
		}
	}
</style>
