<script lang="ts">
	import { onMount } from 'svelte';
	import {
		N_POINTS,
		SAMPLE_SEED,
		T,
		alphaBar,
		beta,
		clampStep,
		curvePath,
		describeForward,
		describeReverse,
		forwardPoints,
		formatNumber,
		initialNoise,
		makeData,
		makeNoise,
		mulberry32,
		noiseShare,
		plotX,
		reverseStepAll,
		signalShare,
		type Point,
	} from '$lib/demos/diffusion';

	/** Diffusion demo: forward noising of a 2D point cloud and a reverse sampler. Standalone. */
	let { initial }: { initial?: { t?: number } } = $props();

	/** Steps per animation tick. Forward: one tick is 50 ms; reverse: one tick is 40 ms. */
	const FORWARD_STEP = 8;
	const REVERSE_STEP = 8;
	const FORWARD_MS = 50;
	const REVERSE_MS = 40;
	const VIEW = 4.5;
	const CHART_H = 200;

	const data: Point[] = makeData();
	const noise: Point[] = makeNoise();

	type Mode = 'forward' | 'reverse';
	type Running = 'none' | 'forward' | 'reverse';

	let mode = $state<Mode>('forward');
	/* svelte-ignore state_referenced_locally */
	let t = $state(clampStep(initial?.t ?? 0));
	let running = $state<Running>('none');
	let reduced = $state(false);
	let wChart = $state(0);

	/** Reverse sampler: current step and cloud. The RNG is reset together with the cloud. */
	let sampleRng = mulberry32(SAMPLE_SEED);
	let rt = $state(T);
	let rx = $state.raw<Point[]>(initialNoise(N_POINTS, sampleRng));

	const plotW = $derived(wChart >= 160 ? wChart : 320);
	const fwd = $derived(forwardPoints(data, noise, t));
	const points = $derived(mode === 'forward' ? fwd : rx);
	const curStep = $derived(mode === 'forward' ? t : rt);
	const status = $derived(mode === 'forward' ? describeForward(t) : describeReverse(rt));
	const marker = $derived(plotX(curStep, plotW));
	const sigPath = $derived(curvePath(signalShare, plotW, CHART_H));
	const noiPath = $derived(curvePath(noiseShare, plotW, CHART_H));

	function toView(p: Point): [number, number] {
		return [p[0], -p[1]];
	}

	function stop(): void {
		running = 'none';
	}

	function setMode(next: Mode): void {
		stop();
		mode = next;
	}

	/** One reverse step: predicts the noise and removes it, then adds the posterior noise. */
	function stepReverse(): void {
		if (rt <= 0) return;
		rx = reverseStepAll(rx, rt, sampleRng);
		rt -= 1;
	}

	function resetReverse(): void {
		stop();
		sampleRng = mulberry32(SAMPLE_SEED);
		rx = initialNoise(N_POINTS, sampleRng);
		rt = T;
	}

	function runReverseToEnd(): void {
		if (rt <= 0) return;
		if (reduced) {
			while (rt > 0) stepReverse();
			return;
		}
		running = 'reverse';
	}

	function playForward(): void {
		if (reduced) {
			t = T;
			return;
		}
		if (t >= T) t = 0;
		running = 'forward';
	}

	function tick(): void {
		if (running === 'forward') {
			t = Math.min(T, t + FORWARD_STEP);
			if (t >= T) stop();
		} else if (running === 'reverse') {
			for (let i = 0; i < REVERSE_STEP && rt > 0; i++) stepReverse();
			if (rt <= 0) stop();
		}
	}

	$effect(() => {
		if (running === 'none') return;
		const id = setInterval(tick, running === 'forward' ? FORWARD_MS : REVERSE_MS);
		return () => clearInterval(id);
	});

	onMount(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduced = mq.matches;
		const onChange = (e: MediaQueryListEvent) => {
			reduced = e.matches;
			if (reduced) stop();
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});
</script>

<figure class="df" data-demo="diffusion">
	<div class="df-controls">
		<div class="df-group" role="group" aria-label="Режим">
			<button
				type="button"
				class="df-seg"
				aria-pressed={mode === 'forward'}
				onclick={() => setMode('forward')}>Прямой процесс</button
			>
			<button
				type="button"
				class="df-seg"
				aria-pressed={mode === 'reverse'}
				onclick={() => setMode('reverse')}>Обратный процесс</button
			>
		</div>
	</div>

	{#if mode === 'forward'}
		<div class="df-row">
			<label class="df-ctl">
				<span class="df-label">Шаг <span class="df-sym">t</span></span>
				<input
					class="df-range"
					type="range"
					min="0"
					max={T}
					step="1"
					bind:value={t}
					oninput={stop}
					aria-valuetext={`шаг ${t} из ${T}`}
				/>
				<output class="df-val">{t}</output>
			</label>
			<div class="df-actions">
				{#if running === 'forward'}
					<button type="button" class="df-btn" onclick={stop}>Пауза</button>
				{:else}
					<button type="button" class="df-btn" onclick={playForward}>
						{reduced ? `Перейти к t = ${T}` : 'Анимировать'}
					</button>
				{/if}
				<button
					type="button"
					class="df-btn df-btn-ghost"
					onclick={() => {
						stop();
						t = 0;
					}}>Сброс</button
				>
			</div>
		</div>
	{:else}
		<div class="df-row">
			<p class="df-step">
				Шаг <span class="df-val">{rt}</span> из {T}
			</p>
			<div class="df-actions">
				{#if running === 'reverse'}
					<button type="button" class="df-btn" onclick={stop}>Пауза</button>
				{:else}
					<button type="button" class="df-btn" onclick={stepReverse} disabled={rt <= 0}
						>Один шаг</button
					>
					<button type="button" class="df-btn" onclick={runReverseToEnd} disabled={rt <= 0}>
						{reduced ? 'До конца' : 'Дойти до t = 0'}
					</button>
				{/if}
				<button type="button" class="df-btn df-btn-ghost" onclick={resetReverse}>Сбросить</button>
			</div>
		</div>
	{/if}

	<div class="df-plots">
		<div class="df-panel">
			<p class="df-panel-t">
				{mode === 'forward' ? 'Облако на шаге t' : 'Образцы на шаге t'}
			</p>
			<svg
				class="df-svg"
				viewBox="{-VIEW} {-VIEW} {2 * VIEW} {2 * VIEW}"
				role="img"
				aria-labelledby="df-cloud-title df-cloud-desc"
			>
				<title id="df-cloud-title">Двумерное облако точек</title>
				<desc id="df-cloud-desc">{status}</desc>
				<line class="df-axis" x1={-VIEW} x2={VIEW} y1="0" y2="0" />
				<line class="df-axis" x1="0" x2="0" y1={-VIEW} y2={VIEW} />
				{#each data as p, i (i)}
					<circle class="df-ghost" cx={p[0].toFixed(3)} cy={(-p[1]).toFixed(3)} r="0.12" />
				{/each}
				{#each points as p, i (i)}
					{@const v = toView(p)}
					<circle class="df-dot" cx={v[0].toFixed(3)} cy={v[1].toFixed(3)} r="0.13" />
				{/each}
			</svg>
			<p class="df-key">
				<span class="df-key-dot"></span> текущие точки
				<span class="df-key-ghost"></span> исходные данные
			</p>
		</div>

		<div class="df-panel">
			<p class="df-panel-t">Доли сигнала и шума</p>
			<div class="df-plot" bind:clientWidth={wChart}>
				<svg
					class="df-chart"
					viewBox="0 0 {plotW} {CHART_H + 28}"
					role="img"
					aria-labelledby="df-chart-title df-chart-desc"
				>
					<title id="df-chart-title">График долей сигнала и шума по шагам</title>
					<desc id="df-chart-desc">
						Доля сигнала падает от 1 до 0,006, доля шума растёт от 0 до 1. Текущий шаг {curStep}.
					</desc>
					<line class="df-grid" x1="0" x2={plotW} y1="0" y2="0" />
					<line class="df-grid" x1="0" x2={plotW} y1={CHART_H / 2} y2={CHART_H / 2} />
					<line class="df-grid" x1="0" x2={plotW} y1={CHART_H} y2={CHART_H} />
					<path class="df-line df-line-sig" d={sigPath} />
					<path class="df-line df-line-noi" d={noiPath} />
					<line class="df-marker" x1={marker} x2={marker} y1="0" y2={CHART_H} />
					{#each [0, 250, 500, 750, 1000] as tick (tick)}
						<text
							class="df-tick"
							x={plotX(tick, plotW)}
							y={CHART_H + 18}
							text-anchor={tick === 0 ? 'start' : tick === T ? 'end' : 'middle'}>{tick}</text
						>
					{/each}
					<text class="df-tick" x="4" y="14">1</text>
					<text class="df-tick" x="4" y={CHART_H - 4}>0</text>
				</svg>
			</div>
			<p class="df-key">
				<span class="df-key-sig"></span> √ᾱ сигнал
				<span class="df-key-noi"></span> √(1 − ᾱ) шум
			</p>
		</div>
	</div>

	<dl class="df-stats">
		<dt>Шаг t</dt>
		<dd>{curStep}</dd>
		<dt>β<sub>t</sub></dt>
		<dd>
			{mode === 'forward' && t > 0
				? formatNumber(beta(t), 4)
				: mode === 'reverse' && rt > 0
					? formatNumber(beta(rt), 4)
					: '—'}
		</dd>
		<dt>ᾱ<sub>t</sub></dt>
		<dd>{formatNumber(alphaBar(curStep), 4)}</dd>
		<dt>Доля сигнала</dt>
		<dd>{formatNumber(signalShare(curStep), 4)}</dd>
		<dt>Доля шума</dt>
		<dd>{formatNumber(noiseShare(curStep), 4)}</dd>
	</dl>

	<p class="df-live" aria-live="polite">{status}</p>
	<p class="df-note">
		{#if mode === 'forward'}
			Серые кольца показывают исходные данные. С ростом шага точки сжимаются к нулю и смешиваются с
			шумом. Расписание β<sub>t</sub> задаёт, сколько шума добавляется за шаг: от 1·10⁻⁴ до 0,02.
		{:else}
			Обратный шаг предсказывает шум и вычитает его, а затем добавляет малый новый шум (кроме шага
			1). Предсказатель здесь точный для известного облака из двух кластеров, а не обученная сеть.
		{/if}
	</p>
</figure>

<style>
	.df {
		margin: 0;
		padding: var(--space-6) var(--space-8) var(--space-8);
		max-width: 100%;
		min-width: 0;
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
		overflow-wrap: anywhere;
	}
	.df :global(*),
	.df :global(*::before),
	.df :global(*::after) {
		box-sizing: border-box;
	}
	.df dl,
	.df dd,
	.df dt,
	.df p {
		margin: 0;
	}
	.df button {
		font: inherit;
	}
	.df-controls {
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.df-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.df-seg {
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
	.df-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.df-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		margin-top: var(--space-4);
	}
	.df-ctl {
		display: flex;
		flex: 1 1 260px;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}
	.df-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.df-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}
	.df-range {
		flex: 1 1 auto;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.df-val,
	.df-step {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.df-step {
		flex: 1 1 200px;
	}
	.df-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.df-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--topic);
		border-radius: var(--radius);
		background: var(--topic);
		color: var(--surface);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.df-btn-ghost {
		background: none;
		color: var(--text);
		border-color: var(--border);
	}
	.df-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.df-seg:focus-visible,
	.df-btn:focus-visible,
	.df-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.df-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.df-panel {
		min-width: 0;
	}
	.df-plot {
		min-width: 0;
		width: 100%;
	}
	.df-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.df-svg {
		display: block;
		width: 100%;
		max-width: 280px;
		height: auto;
		aspect-ratio: 1;
		margin: 0 auto;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.df-axis {
		stroke: var(--text-muted);
		stroke-width: 0.02;
		opacity: 0.5;
	}
	.df-ghost {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 0.03;
		opacity: 0.6;
	}
	.df-dot {
		fill: var(--topic);
		opacity: 0.9;
		transition:
			cx var(--dur) var(--ease),
			cy var(--dur) var(--ease);
	}
	.df-chart {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.df-grid {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.35;
	}
	.df-line {
		fill: none;
		stroke-width: 2;
	}
	.df-line-sig {
		stroke: var(--topic);
	}
	.df-line-noi {
		stroke: var(--cat-2);
		stroke-dasharray: 5 4;
	}
	.df-marker {
		stroke: var(--text);
		stroke-width: 1.5;
		opacity: 0.7;
	}
	.df-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.df-key {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.df-key-dot,
	.df-key-sig,
	.df-key-noi,
	.df-key-ghost {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.df-key-dot {
		background: var(--topic);
	}
	.df-key-ghost {
		border: 1px solid var(--text-muted);
	}
	.df-key-sig {
		width: 14px;
		height: 3px;
		border-radius: 0;
		background: var(--topic);
	}
	.df-key-noi {
		width: 14px;
		height: 3px;
		border-radius: 0;
		background: var(--cat-2);
	}

	.df-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.df-stats dt {
		color: var(--text-muted);
	}
	.df-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.df-live {
		margin-top: var(--space-4);
		color: var(--text);
	}
	.df-note {
		margin-top: var(--space-2);
		color: var(--text-muted);
	}

	@media (max-width: 559px) {
		.df {
			padding: var(--space-4);
		}
		.df-plots {
			grid-template-columns: minmax(0, 1fr);
		}
		.df-ctl {
			flex-basis: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.df *,
		.df *::before,
		.df *::after {
			transition: none !important;
		}
	}
</style>
