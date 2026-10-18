<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		LOG_C_DEFAULT,
		LOG_C_MAX,
		LOG_C_MIN,
		LOG_C_STEP,
		TOKENS_PER_PARAM,
		describeScaling,
		formatSci,
		lossCurve,
		scalingPoint,
		snapLogC,
		type ScalingLawsDemoState,
	} from '$lib/demos/lm-training-scaling';

	/**
	 * Compute-optimal scaling demo. A model of the chapter's rule (D = 20·N, C = 6·N·D), not a training run.
	 * Registers itself as demo `lm-training-scaling`.
	 */
	let { initial }: { initial?: Partial<ScalingLawsDemoState> } = $props();

	const H = 170;
	const PAD_L = 40;
	const PAD_R = 8;
	const PAD_T = 8;
	const PAD_B = 22;
	/** Log10 axis range of the two charts for N and D. */
	const LOG_Y_MIN = 7;
	const LOG_Y_MAX = 13;

	/** Start budget: the given one, or the example from the text. */
	/* svelte-ignore state_referenced_locally */
	const START = snapLogC(initial?.logC ?? LOG_C_DEFAULT);

	// The props only seed the initial state: the demo owns it afterwards.
	let logC = $state(START);
	/** Real widths of the two charts in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wOpt = $state(0);
	let wLoss = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const point = $derived(scalingPoint(logC));
	const plotWOpt = $derived(wOpt >= 160 ? wOpt : 320);
	const plotWLoss = $derived(wLoss >= 160 ? wLoss : 320);
	const desc = $derived(describeScaling(point));

	/** Precomputed optimal path: log10 values for the charts. */
	const CURVE = lossCurve(61).map((p) => ({
		x: Math.log10(p.c),
		n: Math.log10(p.n),
		d: Math.log10(p.d),
		loss: p.loss,
	}));
	const LOSS_LO = Math.min(...CURVE.map((p) => p.loss)) - 0.1;
	const LOSS_HI = Math.max(...CURVE.map((p) => p.loss)) + 0.1;

	function xOf(x: number, w: number): number {
		return PAD_L + ((x - LOG_C_MIN) / (LOG_C_MAX - LOG_C_MIN)) * (w - PAD_L - PAD_R);
	}
	function yOf(v: number, lo: number, hi: number): number {
		return PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
	}
	function path(pts: { x: number; y: number }[]): string {
		return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
	}

	const logCPt = $derived(Math.log10(point.c));
	const optN = $derived(
		CURVE.map((p) => ({ x: xOf(p.x, plotWOpt), y: yOf(p.n, LOG_Y_MIN, LOG_Y_MAX) })),
	);
	const optD = $derived(
		CURVE.map((p) => ({ x: xOf(p.x, plotWOpt), y: yOf(p.d, LOG_Y_MIN, LOG_Y_MAX) })),
	);
	const lossPts = $derived(
		CURVE.map((p) => ({ x: xOf(p.x, plotWLoss), y: yOf(p.loss, LOSS_LO, LOSS_HI) })),
	);
	const markOptX = $derived(xOf(logCPt, plotWOpt));
	const markNY = $derived(yOf(Math.log10(point.n), LOG_Y_MIN, LOG_Y_MAX));
	const markDY = $derived(yOf(Math.log10(point.d), LOG_Y_MIN, LOG_Y_MAX));
	const markLossX = $derived(xOf(logCPt, plotWLoss));
	const markLossY = $derived(yOf(point.loss, LOSS_LO, LOSS_HI));

	const XTICKS = [18, 20, 22, 24];
	const YTICKS_NR = [8, 10, 12];

	function setLogC(v: number): void {
		logC = snapLogC(v);
	}

	function apply(patch: Partial<ScalingLawsDemoState>): void {
		if (typeof patch.logC === 'number') setLogC(patch.logC);
	}

	function reset(): void {
		logC = START;
	}

	onMount(() => {
		return demos?.register('lm-training-scaling', {
			set: (patch) => apply(patch as Partial<ScalingLawsDemoState>),
		});
	});
</script>

<figure class="sl" id="demo-lm-training-scaling" data-demo="lm-training-scaling">
	<div class="sl-controls">
		<label class="sl-ctl">
			<span class="sl-label">Бюджет C</span>
			<input
				class="sl-range"
				type="range"
				min={LOG_C_MIN}
				max={LOG_C_MAX}
				step={LOG_C_STEP}
				value={logC}
				aria-valuetext={`${formatSci(point.c)} FLOP`}
				oninput={(e) => setLogC(Number(e.currentTarget.value))}
			/>
			<output class="sl-val">{formatSci(point.c)} FLOP</output>
		</label>
		<div class="sl-buttons">
			<button type="button" class="sl-btn" onclick={() => setLogC(LOG_C_DEFAULT)}>
				Пример из текста: C = 1.2·10²⁰
			</button>
			<button type="button" class="sl-btn" onclick={reset}>Сброс</button>
		</div>
	</div>

	<p class="sl-badge">Расчёт по модели, а не замер обучения</p>

	<div class="sl-plots">
		<div class="sl-panel" bind:clientWidth={wOpt}>
			<p class="sl-panel-t">Оптимум: параметры и токены</p>
			<svg
				class="sl-svg"
				viewBox="0 0 {plotWOpt} {H}"
				role="img"
				aria-labelledby="sl-opt-title sl-opt-desc"
			>
				<title id="sl-opt-title">Оптимальное число параметров и токенов по бюджету</title>
				<desc id="sl-opt-desc">{desc}</desc>
				{#each XTICKS as t (t)}
					<line
						class="sl-grid"
						x1={xOf(t, plotWOpt)}
						x2={xOf(t, plotWOpt)}
						y1={PAD_T}
						y2={H - PAD_B}
					/>
					<text class="sl-tick" x={xOf(t, plotWOpt)} y={H - 6}>1e{t}</text>
				{/each}
				{#each YTICKS_NR as t (t)}
					<text class="sl-tick sl-tick-y" x={PAD_L - 6} y={yOf(t, LOG_Y_MIN, LOG_Y_MAX) + 4}
						>1e{t}</text
					>
				{/each}
				<path class="sl-line sl-line-n" d={path(optN)} />
				<path class="sl-line sl-line-d" d={path(optD)} />
				<line class="sl-cursor" x1={markOptX} x2={markOptX} y1={PAD_T} y2={H - PAD_B} />
				<circle class="sl-dot sl-dot-n" cx={markOptX} cy={markNY} r="4" />
				<circle class="sl-dot sl-dot-d" cx={markOptX} cy={markDY} r="4" />
			</svg>
			<p class="sl-legend">
				<span class="sl-sw sl-sw-n"></span>N, параметры
				<span class="sl-sw sl-sw-d"></span>D, токены
			</p>
		</div>

		<div class="sl-panel" bind:clientWidth={wLoss}>
			<p class="sl-panel-t">Ожидаемая потеря</p>
			<svg
				class="sl-svg"
				viewBox="0 0 {plotWLoss} {H}"
				role="img"
				aria-labelledby="sl-loss-title sl-loss-desc"
			>
				<title id="sl-loss-title">Ожидаемая потеря по модели вдоль оптимального пути</title>
				<desc id="sl-loss-desc"
					>Потеря при бюджете C = {formatSci(point.c)}: {point.loss.toFixed(2)}.</desc
				>
				{#each XTICKS as t (t)}
					<line
						class="sl-grid"
						x1={xOf(t, plotWLoss)}
						x2={xOf(t, plotWLoss)}
						y1={PAD_T}
						y2={H - PAD_B}
					/>
					<text class="sl-tick" x={xOf(t, plotWLoss)} y={H - 6}>1e{t}</text>
				{/each}
				<path class="sl-line sl-line-loss" d={path(lossPts)} />
				<line class="sl-cursor" x1={markLossX} x2={markLossX} y1={PAD_T} y2={H - PAD_B} />
				<circle class="sl-dot sl-dot-loss" cx={markLossX} cy={markLossY} r="4" />
				<text class="sl-tick sl-tick-y" x={PAD_L - 6} y={PAD_T + 10}>{LOSS_HI.toFixed(1)}</text>
				<text class="sl-tick sl-tick-y" x={PAD_L - 6} y={H - PAD_B}>{LOSS_LO.toFixed(1)}</text>
			</svg>
			<p class="sl-legend">
				<span class="sl-sw sl-sw-loss"></span>потеря L = E + A/N^α + B/D^β
			</p>
		</div>
	</div>

	<dl class="sl-stats">
		<dt>Бюджет C, FLOP</dt>
		<dd>{formatSci(point.c)}</dd>
		<dt>Параметры N (оптимум)</dt>
		<dd>{formatSci(point.n)}</dd>
		<dt>Токены D = {TOKENS_PER_PARAM}·N</dt>
		<dd>{formatSci(point.d)}</dd>
		<dt>Потеря (модель)</dt>
		<dd>{point.loss.toFixed(2)}</dd>
	</dl>

	<p class="sl-live" aria-live="polite">{desc}</p>

	<div class="sl-note">
		<p class="sl-note-t">Что заметить</p>
		<p>
			При росте бюджета растут и N, и D, а их отношение остаётся равным {TOKENS_PER_PARAM}. Потеря
			падает, и каждый следующий порядок величины бюджета даёт меньший выигрыш.
		</p>
	</div>
</figure>

<style>
	.sl {
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
	.sl :global(*),
	.sl :global(*::before),
	.sl :global(*::after) {
		box-sizing: border-box;
	}
	.sl dl,
	.sl dd,
	.sl dt,
	.sl p {
		margin: 0;
	}
	.sl button {
		font: inherit;
	}

	/* Controls */
	.sl-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.sl-ctl {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
	.sl-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.sl-range {
		width: 220px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.sl-val {
		min-width: 12ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.sl-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.sl-btn {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.sl-btn:hover {
		border-color: var(--topic);
	}
	.sl-btn:focus-visible,
	.sl-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.sl-badge {
		display: inline-block;
		margin-top: var(--space-4);
		padding: 2px var(--space-3);
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 12px;
	}

	/* Charts */
	.sl-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-4);
	}
	.sl-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.sl-svg {
		display: block;
		width: 100%;
		height: 170px;
		overflow: visible;
	}
	.sl-grid {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.2;
	}
	.sl-cursor {
		stroke: var(--text);
		stroke-width: 1;
		stroke-dasharray: 4 3;
		opacity: 0.6;
	}
	.sl-line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.sl-line-n {
		stroke: var(--cat-1);
	}
	.sl-line-d {
		stroke: var(--cat-2);
	}
	.sl-line-loss {
		stroke: var(--topic);
	}
	.sl-dot {
		stroke: var(--surface);
		stroke-width: 2;
	}
	.sl-dot-n {
		fill: var(--cat-1);
	}
	.sl-dot-d {
		fill: var(--cat-2);
	}
	.sl-dot-loss {
		fill: var(--topic);
	}
	.sl-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
		text-anchor: middle;
	}
	.sl-tick-y {
		text-anchor: end;
	}
	.sl-legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.sl-sw {
		display: inline-block;
		width: 12px;
		height: 3px;
		border-radius: 2px;
		margin-left: var(--space-2);
	}
	.sl-sw-n {
		background: var(--cat-1);
	}
	.sl-sw-d {
		background: var(--cat-2);
	}
	.sl-sw-loss {
		background: var(--topic);
	}

	/* Statistics */
	.sl-stats {
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
	.sl-stats dt {
		color: var(--text-muted);
	}
	.sl-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.sl-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-size: 13px;
	}
	.sl-note {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--topic);
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}
	.sl-note-t {
		margin-bottom: var(--space-1);
		font-weight: 600;
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.sl *,
		.sl *::before,
		.sl *::after {
			transition: none !important;
			animation: none !important;
		}
	}

	@media (max-width: 720px) {
		.sl {
			padding: var(--space-4);
		}
		.sl-plots {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 559px) {
		.sl-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.sl-ctl {
			flex-wrap: wrap;
		}
		.sl-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.sl-buttons {
			flex-direction: column;
		}
		.sl-btn {
			width: 100%;
		}
	}
</style>
