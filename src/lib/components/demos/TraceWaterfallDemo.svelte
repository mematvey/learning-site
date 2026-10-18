<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		TAIL_SAMPLE,
		bottleneck,
		buildTrace,
		describeSpeedup,
		describeTrace,
		duration,
		fmt,
		mean,
		modelShare,
		shareOf,
		summarizeLatency,
		sumChildSeconds,
		totalSeconds,
		type TraceDemoState,
	} from '$lib/demos/observability';

	/**
	 * Waterfall of one request (a model trace, not measured data) with the sequential and parallel
	 * modes, a speed-up switch and the mean-versus-tail comparison. Registers itself as demo `observability`.
	 */
	let { initial }: { initial?: Partial<TraceDemoState> } = $props();

	/** Fixed axis in seconds, the same for every mode, so the modes can be compared by eye. */
	const AXIS_MAX = 10;
	const TICKS = [0, 2, 4, 6, 8, 10];
	const LABEL_W = 104;
	const ROW_H = 34;
	const AXIS_H = 26;
	const BAR_H = 16;
	const DEFAULT_WIDTH = 360;

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let parallel = $state(initial?.parallel === true);
	/* svelte-ignore state_referenced_locally */
	let fastSearch = $state(initial?.fastSearch === true);
	/** Real width of the plot container in px; the SVG is drawn at this width (no viewBox scaling). */
	let width = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const traceState: TraceDemoState = $derived({ parallel, fastSearch });
	const spans = $derived(buildTrace(traceState));
	const total = $derived(totalSeconds(spans));
	const sum = $derived(sumChildSeconds(spans));
	const share = $derived(modelShare(spans));
	const top = $derived(bottleneck(spans));
	const live = $derived(describeTrace(traceState));
	const speed = $derived(describeSpeedup(parallel));
	const isDefault = $derived(!parallel && !fastSearch);

	const plotW = $derived(Math.max(120, (width >= 240 ? width : DEFAULT_WIDTH) - LABEL_W - 12));
	const svgW = $derived(LABEL_W + plotW + 12);
	const svgH = $derived(AXIS_H + spans.length * ROW_H + 4);
	const xOf = (t: number) => LABEL_W + (t / AXIS_MAX) * plotW;

	/** Latency sample of the chapter: fixed, so the numbers are the ones in the text. */
	const lat = summarizeLatency(TAIL_SAMPLE);
	const latMean = mean(TAIL_SAMPLE);
	const latDesc = `Девять запросов по 1,0 с и один по 9,0 с. Среднее ${fmt(latMean, 1)} с, p95 ${fmt(lat.p95, 1)} с.`;

	function apply(patch: Partial<TraceDemoState>): void {
		if (typeof patch.parallel === 'boolean') parallel = patch.parallel;
		if (typeof patch.fastSearch === 'boolean') fastSearch = patch.fastSearch;
	}

	function reset(): void {
		parallel = false;
		fastSearch = false;
	}

	onMount(() => {
		return demos?.register('observability', {
			set: (patch) => apply(patch as Partial<TraceDemoState>),
		});
	});
</script>

<figure class="ob" id="demo-observability" data-demo="observability" data-hl={hl ?? undefined}>
	<p class="ob-tag">
		Модельная трасса: длительности заданы для примера и не измерены в реальной системе.
	</p>

	<div class="ob-controls">
		<div class="ob-group" role="group" aria-label="Порядок поиска">
			<button
				type="button"
				class="ob-seg"
				aria-pressed={!parallel}
				onclick={() => (parallel = false)}>Последовательно</button
			>
			<button type="button" class="ob-seg" aria-pressed={parallel} onclick={() => (parallel = true)}
				>Два поиска параллельно</button
			>
		</div>
		<button
			type="button"
			class="ob-toggle"
			aria-pressed={fastSearch}
			onclick={() => (fastSearch = !fastSearch)}>Поиск вдвое быстрее</button
		>
		<button type="button" class="ob-reset" disabled={isDefault} onclick={reset}>Сбросить</button>
	</div>

	<div class="ob-plot" bind:clientWidth={width}>
		<svg
			class="ob-svg"
			width={svgW}
			height={svgH}
			viewBox="0 0 {svgW} {svgH}"
			role="img"
			aria-labelledby="ob-title ob-desc"
		>
			<title id="ob-title">Водопад трассы запроса, модельные данные</title>
			<desc id="ob-desc">{live}</desc>
			{#each TICKS as t (t)}
				<line class="ob-grid" x1={xOf(t)} x2={xOf(t)} y1={AXIS_H} y2={svgH - 4} />
				<text class="ob-tick" x={xOf(t)} y={AXIS_H - 8} text-anchor="middle">{t} с</text>
			{/each}
			{#each spans as s, i (s.id)}
				{@const y = AXIS_H + i * ROW_H}
				{@const d = duration(s)}
				<text class="ob-name" x="0" y={y + 14}>{s.id}</text>
				<text class="ob-dur" x="0" y={y + 28}>{fmt(d, 2)} с</text>
				<rect
					class="ob-bar"
					class:ob-root={s.kind === 'root'}
					class:ob-top={s.id === top.id}
					x={xOf(s.start).toFixed(1)}
					y={y + 8}
					width={Math.max(2, xOf(s.end) - xOf(s.start)).toFixed(1)}
					height={BAR_H}
					rx="3"
				>
					<title>{s.id}: {fmt(d, 2)} с, доля {fmt(shareOf(s, spans) * 100, 1)}%</title>
				</rect>
			{/each}
		</svg>
	</div>

	<div class="ob-legend" aria-hidden="true">
		<span class="ob-sw ob-sw-step"></span> шаг
		<span class="ob-sw ob-sw-top"></span> узкое место
		<span class="ob-sw ob-sw-root"></span> корневой спан
	</div>

	<dl class="ob-stats">
		<dt>Корень answer</dt>
		<dd>{fmt(total, 2)} с</dd>
		<dt>Сумма шагов</dt>
		<dd>{fmt(sum, 2)} с</dd>
		<dt>Доля модели</dt>
		<dd>{fmt(share, 2)}</dd>
		<dt>Узкое место</dt>
		<dd>{top.id}</dd>
	</dl>

	<p class="ob-live" aria-live="polite">{live}</p>
	<p class="ob-note">{speed}</p>

	<h3 class="ob-h">Среднее против хвоста</h3>
	<p class="ob-p">Десять запросов за смену: девять по 1,0 с и один 9,0 с.</p>
	<div class="ob-lat-wrap">
		<svg class="ob-lat" viewBox="0 0 300 90" role="img" aria-labelledby="ob-lat-t ob-lat-d">
			<title id="ob-lat-t">Задержки десяти запросов</title>
			<desc id="ob-lat-d">{latDesc}</desc>
			{#each TAIL_SAMPLE as v, i (i)}
				<rect
					class="ob-lat-bar"
					class:ob-lat-slow={v > 2}
					x={i * 30 + 6}
					y={88 - v * 8}
					width="18"
					height={v * 8}
					rx="2"
				/>
			{/each}
		</svg>
	</div>
	<dl class="ob-stats">
		<dt>Среднее</dt>
		<dd>{fmt(latMean, 1)} с</dd>
		<dt>Медиана (p50)</dt>
		<dd>{fmt(lat.p50, 1)} с</dd>
		<dt>p90</dt>
		<dd>{fmt(lat.p90, 1)} с</dd>
		<dt>p95</dt>
		<dd>{fmt(lat.p95, 1)} с</dd>
		<dt>p99</dt>
		<dd>{fmt(lat.p99, 1)} с</dd>
	</dl>
	<p class="ob-note">
		Среднее 1,8 с выглядит терпимо, но один из десяти пользователей ждал 9,0 с. Этот хвост видно
		только по перцентилям и по трассам самых медленных запросов.
	</p>

	<p class="ob-look">
		<strong>Что заметить:</strong> полоса вызова модели занимает почти весь корень. Поиск вдвое быстрее
		почти не меняет картину. В параллельном режиме сумма шагов больше корня, поэтому смотрите на ось времени,
		а не на доли.
	</p>
</figure>

<style>
	.ob {
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
	.ob :global(*),
	.ob :global(*::before),
	.ob :global(*::after) {
		box-sizing: border-box;
	}
	.ob dl,
	.ob dd,
	.ob dt,
	.ob p,
	.ob h3 {
		margin: 0;
	}
	.ob button {
		font: inherit;
	}
	.ob-tag {
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Controls */
	.ob-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-4);
		margin-top: var(--space-4);
	}
	.ob-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.ob-seg,
	.ob-toggle,
	.ob-reset {
		min-height: 34px;
		padding: 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}
	.ob-seg[aria-pressed='true'],
	.ob-toggle[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.ob-toggle {
		border-color: var(--border);
		color: var(--text);
	}
	.ob-toggle[aria-pressed='true'] {
		border-color: var(--topic);
	}
	.ob-reset:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.ob-seg:focus-visible,
	.ob-toggle:focus-visible,
	.ob-reset:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Waterfall */
	.ob-plot {
		margin-top: var(--space-6);
		overflow: hidden;
	}
	.ob-svg {
		display: block;
		max-width: 100%;
		height: auto;
	}
	.ob-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.ob-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.ob-name {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.ob-dur {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.ob-bar {
		fill: var(--cat-1);
	}
	.ob-bar.ob-root {
		fill: var(--surface-2);
		stroke: var(--border);
	}
	.ob-bar.ob-top {
		fill: var(--cat-2);
	}

	.ob-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}
	.ob-sw {
		display: inline-block;
		width: 12px;
		height: 12px;
		margin-right: var(--space-1);
		border-radius: 2px;
		vertical-align: -1px;
	}
	.ob-sw-step {
		background: var(--cat-1);
	}
	.ob-sw-top {
		background: var(--cat-2);
	}
	.ob-sw-root {
		background: var(--surface-2);
		border: 1px solid var(--border);
	}

	/* Statistics */
	.ob-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.ob-stats dt {
		color: var(--text-muted);
	}
	.ob-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.ob-live {
		margin-top: var(--space-4);
		color: var(--text);
	}
	.ob-note {
		margin-top: var(--space-2);
		color: var(--text-muted);
	}
	.ob-look {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.ob-look strong {
		color: var(--text);
	}

	/* Mean versus tail */
	.ob-h {
		margin-top: var(--space-8);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.ob-p {
		margin-top: var(--space-1);
		color: var(--text-muted);
	}
	.ob-lat-wrap {
		margin-top: var(--space-3);
	}
	.ob-lat {
		display: block;
		width: 100%;
		max-width: 360px;
		height: 90px;
	}
	.ob-lat-bar {
		fill: var(--cat-1);
	}
	.ob-lat-bar.ob-lat-slow {
		fill: var(--cat-2);
	}

	@media (prefers-reduced-motion: reduce) {
		.ob *,
		.ob *::before,
		.ob *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.ob {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.ob-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.ob-group {
			display: flex;
		}
		.ob-seg {
			flex: 1 1 0;
		}
	}
</style>
