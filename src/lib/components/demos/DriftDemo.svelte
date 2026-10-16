<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		DEFAULT_SHIFT,
		HIST_HI,
		HIST_LO,
		KS_C_05,
		PSI_ALERT,
		PSI_BINS,
		PSI_WARN,
		SHIFT_MAX,
		SHIFT_MIN,
		SHIFT_STEP,
		binShares,
		describeDrift,
		histogram,
		ksCritical,
		ksPValue,
		ksStatistic,
		makeSamples,
		productionSample,
		psiFromShares,
		psiLevel,
		quantileEdges,
		snapShift,
		type DriftDemoState,
	} from '$lib/demos/monitoring-drift';

	/** Drift demo: reference vs shifted production feature, with PSI and KS against thresholds. Registers as `drift`. */
	let { initial }: { initial?: Partial<DriftDemoState> } = $props();

	/* svelte-ignore state_referenced_locally */
	const START: DriftDemoState = { shift: snapShift(initial?.shift ?? DEFAULT_SHIFT) };

	let st = $state<DriftDemoState>({ ...START });

	/** Chart size in SVG units (scaled by CSS). */
	const W = 360;
	const H = 200;
	const PAD_L = 12;
	const PAD_B = 22;
	const PLOT_W = W - PAD_L * 2;
	const PLOT_H = H - PAD_B - 8;
	/** Gauge scale for PSI: 0 to GAUGE_MAX. */
	const GAUGE_MAX = 0.5;

	const samples = makeSamples();
	const edges = quantileEdges(samples.ref, PSI_BINS);
	const refShares = binShares(samples.ref, edges);
	const refDensity = histogram(samples.ref);

	const prod = $derived(productionSample(samples.z, st.shift));
	const prodShares = $derived(binShares(prod, edges));
	const prodDensity = $derived(histogram(prod));
	const psiValue = $derived(psiFromShares(refShares, prodShares));
	const level = $derived(psiLevel(psiValue));
	const ksD = $derived(ksStatistic(samples.ref, prod));
	const ksCrit = $derived(ksCritical(samples.ref.length, prod.length, KS_C_05));
	const ksP = $derived(ksPValue(ksD, samples.ref.length, prod.length));
	const ksAlarm = $derived(ksD > ksCrit);
	const desc = $derived(describeDrift(st.shift, psiValue, ksD, ksCrit, ksP));
	const levelText = $derived(
		level === 'stable' ? 'стабильно' : level === 'warning' ? 'внимание' : 'тревога',
	);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	// Fixed vertical scale from the reference peak: a shift flattens or moves the production curve, it does not rescale the axis.
	const maxDensity = Math.max(...refDensity) * 1.1;
	const binCount = refDensity.length;
	const barW = PLOT_W / binCount;

	function yOf(d: number): number {
		return 8 + PLOT_H * (1 - d / maxDensity);
	}

	function xOfBin(i: number): number {
		return PAD_L + i * barW;
	}

	function apply(patch: Partial<DriftDemoState>): void {
		st = { ...st, ...patch };
	}

	function reset(): void {
		st = { ...START };
	}

	function onShift(e: Event): void {
		apply({ shift: snapShift(Number((e.currentTarget as HTMLInputElement).value)) });
	}

	/** Gauge position for a PSI value in [0, GAUGE_MAX]. */
	function gaugePct(v: number): number {
		return Math.min(100, (Math.max(0, v) / GAUGE_MAX) * 100);
	}

	onMount(() => {
		return demos?.register('drift', {
			set: (patch) => apply(patch as Partial<DriftDemoState>),
		});
	});
</script>

<figure class="dr" id="demo-drift" data-demo="drift" class:hl-q={hl === 'q'}>
	<div class="dr-controls">
		<label class="dr-ctl">
			<span class="dr-label"><span class="dr-sym">μ</span> сдвиг признака (в σ)</span>
			<input
				class="dr-range"
				type="range"
				min={SHIFT_MIN}
				max={SHIFT_MAX}
				step={SHIFT_STEP}
				value={st.shift}
				oninput={onShift}
			/>
			<output class="dr-val">{st.shift.toFixed(1)}</output>
		</label>

		<button type="button" class="dr-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="dr-plot">
		<svg class="dr-svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="dr-title dr-desc">
			<title id="dr-title">Распределение признака: обучение и продакшен</title>
			<desc id="dr-desc">{desc}</desc>
			<line class="dr-base" x1={PAD_L} x2={W - PAD_L} y1={H - PAD_B} y2={H - PAD_B} />
			{#each refDensity as d, i (i)}
				<rect
					class="dr-ref"
					x={xOfBin(i).toFixed(1)}
					y={yOf(d).toFixed(1)}
					width={(barW - 1).toFixed(1)}
					height={(H - PAD_B - yOf(d)).toFixed(1)}
				/>
			{/each}
			{#each prodDensity as d, i (i)}
				<rect
					class="dr-prod"
					x={xOfBin(i).toFixed(1)}
					y={yOf(d).toFixed(1)}
					width={(barW - 1).toFixed(1)}
					height={(H - PAD_B - yOf(d)).toFixed(1)}
				/>
			{/each}
			<text class="dr-axis" x={PAD_L} y={H - 6}>{HIST_LO}</text>
			<text class="dr-axis" x={W - PAD_L} y={H - 6} text-anchor="end">{HIST_HI}</text>
		</svg>
	</div>

	<div class="dr-legend" aria-hidden="true">
		<span class="dr-key dr-key-ref"></span> обучение (N(0, 1))
		<span class="dr-key dr-key-prod"></span> продакшен (N(μ, 1))
	</div>

	<p class="dr-desc" aria-live="polite">{desc}</p>

	<div class="dr-metrics">
		<section class="dr-metric" aria-labelledby="dr-psi-t">
			<h4 id="dr-psi-t" class="dr-metric-t">PSI</h4>
			<output class="dr-big dr-level-{level}">{psiValue.toFixed(3)}</output>
			<span class="dr-badge dr-level-{level}">{levelText}</span>
			<div class="dr-gauge" aria-hidden="true">
				<div class="dr-gauge-fill dr-level-{level}" style="width: {gaugePct(psiValue)}%"></div>
				<span class="dr-tick" style="left: {gaugePct(PSI_WARN)}%"></span>
				<span class="dr-tick" style="left: {gaugePct(PSI_ALERT)}%"></span>
			</div>
			<p class="dr-small">
				условные пороги {PSI_WARN} и {PSI_ALERT}: меньше {PSI_WARN} стабильно, выше {PSI_ALERT} сильный
				сдвиг
			</p>
		</section>

		<section class="dr-metric" aria-labelledby="dr-ks-t">
			<h4 id="dr-ks-t" class="dr-metric-t">KS, статистика D</h4>
			<output class="dr-big dr-level-{ksAlarm ? 'alert' : 'stable'}">{ksD.toFixed(3)}</output>
			<span class="dr-badge dr-level-{ksAlarm ? 'alert' : 'stable'}"
				>{ksAlarm ? 'тревога' : 'в норме'}</span
			>
			<dl class="dr-stats">
				<dt>критическое D (α = 0.05, по формуле из главы)</dt>
				<dd>{ksCrit.toFixed(3)}</dd>
				<dt>p-value</dt>
				<dd>{ksP.toFixed(3)}</dd>
			</dl>
		</section>
	</div>

	<div class="dr-note">
		<p class="dr-note-t">Что заметить</p>
		<p>
			PSI сравнивает доли наблюдений по десяти корзинам, границы которых взяты из обучения. Пороги
			0.1 и 0.25 условные: их выбирают под задачу, а не берут из закона. KS смотрит на всю функцию
			распределения без корзин. При большой выборке он реагирует даже на небольшой сдвиг, так что
			значимый по статистике сдвиг не обязательно вреден для модели.
		</p>
	</div>
</figure>

<style>
	.dr {
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
	.dr :global(*),
	.dr :global(*::before),
	.dr :global(*::after) {
		box-sizing: border-box;
	}
	.dr dl,
	.dr dd,
	.dr dt,
	.dr p,
	.dr h4,
	.dr output {
		margin: 0;
	}
	.dr button {
		font: inherit;
	}
	.dr-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.dr-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.dr-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.dr-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.dr-range {
		width: 170px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.dr-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.dr-reset {
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
	.dr-reset:hover {
		background: var(--surface-2);
	}
	.dr-range:focus-visible,
	.dr-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Chart */
	.dr-plot {
		display: flex;
		justify-content: center;
		margin-top: var(--space-6);
	}
	.dr-svg {
		display: block;
		width: 100%;
		max-width: 420px;
		height: auto;
		overflow: visible;
	}
	.dr-base {
		stroke: var(--border);
		stroke-width: 1;
	}
	.dr-ref {
		fill: var(--cat-1);
		fill-opacity: 0.35;
	}
	.dr-prod {
		fill: var(--cat-2);
		fill-opacity: 0.35;
		stroke: var(--cat-2);
		stroke-width: 1;
	}
	.dr-axis {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.dr-legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.dr-key {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: var(--space-1);
		border-radius: 2px;
		vertical-align: middle;
	}
	.dr-key-ref {
		background: var(--cat-1);
		opacity: 0.6;
	}
	.dr-key-prod {
		background: var(--cat-2);
		opacity: 0.6;
	}

	.dr-desc {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* Metrics */
	.dr-metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-4);
		margin-top: var(--space-6);
	}
	.dr-metric {
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.dr-metric-t {
		font-family: var(--font-serif);
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
	}
	.dr-big {
		display: block;
		margin-top: var(--space-1);
		font-family: var(--font-mono);
		font-size: 22px;
		font-variant-numeric: tabular-nums;
	}
	.dr-badge {
		display: inline-block;
		margin-top: var(--space-1);
		padding: 0 var(--space-2);
		border-radius: var(--radius-sm);
		border: 1px solid currentColor;
		font-size: 12px;
	}
	.dr-level-stable {
		color: var(--ok);
	}
	.dr-level-warning {
		color: var(--warn);
	}
	.dr-level-alert {
		color: var(--fail);
	}
	.dr-gauge {
		position: relative;
		height: 8px;
		margin-top: var(--space-3);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.dr-gauge-fill {
		height: 100%;
		background: currentColor;
		transition: width var(--dur) var(--ease);
	}
	.dr-tick {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--text-muted);
	}
	.dr-small {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.dr-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-3);
		font-size: 12px;
	}
	.dr-stats dt {
		color: var(--text-muted);
	}
	.dr-stats dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.dr-note {
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		color: var(--text-muted);
	}
	.dr-note-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}

	.dr.hl-q .dr-metrics {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.dr *,
		.dr *::before,
		.dr *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.dr {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.dr-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.dr-ctl {
			flex-wrap: wrap;
		}
		.dr-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.dr-metrics {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
