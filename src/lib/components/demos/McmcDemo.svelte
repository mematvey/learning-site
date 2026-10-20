<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		BINS,
		BURN_IN,
		N_STEPS,
		RHAT_WARN,
		START_POINTS,
		STEP_DEFAULT,
		STEP_MAX,
		STEP_MIN,
		STEP_STEP,
		SEED_DEFAULT,
		X_MAX,
		X_MIN,
		chainStats,
		describeRun,
		type ChainRun,
		fmt,
		histogram,
		nextSeed,
		percent,
		rhatAt,
		runChains,
		snapSeed,
		snapStep,
		snapT,
		targetCurve,
		tracePoints,
		valueToY,
		type McmcDemoState,
	} from '$lib/demos/mcmc';

	/** MCMC demo: Metropolis–Hastings on a two-mode target. Registers itself as demo `mcmc`. */
	let { initial }: { initial?: Partial<McmcDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let step = $state(snapStep(initial?.step ?? STEP_DEFAULT));
	/* svelte-ignore state_referenced_locally */
	let seed = $state(snapSeed(initial?.seed ?? SEED_DEFAULT));
	/* svelte-ignore state_referenced_locally */
	let t = $state(snapT(initial?.t ?? N_STEPS));
	let playing = $state(false);
	/** Real widths of the two charts in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wTrace = $state(0);
	let wHist = $state(0);

	const CHART_H = 170;
	/** Space under the histogram for x tick labels. */
	const AXIS_H = 20;
	/** Steps per millisecond while the animation plays (about 2.5 s for the full run). */
	const STEPS_PER_MS = 8;
	const TICKS = [-6, -4, -2, 0, 2, 4, 6];

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const runs = $derived(runChains(step, seed));
	/* runChains always returns START_POINTS.length chains, so index 0 exists. */
	const main = $derived(runs[0] as ChainRun);
	const stats = $derived(chainStats(main, t, BURN_IN));
	const rh = $derived(rhatAt(runs, t, BURN_IN));
	const live = $derived(describeRun(step, stats, rh, t));
	const rhWarn = $derived(rh !== null && rh > RHAT_WARN);

	const plotTrace = $derived(wTrace >= 120 ? wTrace : 320);
	const plotHist = $derived(wHist >= 120 ? wHist : 320);
	const traces = $derived(
		runs.map((r, k) => ({ k, pts: tracePoints(r.samples, t, plotTrace, CHART_H) })),
	);
	const headX = $derived((t / N_STEPS) * plotTrace);
	const headY = $derived(
		t > 0 ? valueToY(main.samples[t - 1] ?? 0, CHART_H, X_MIN, X_MAX) : CHART_H / 2,
	);
	const burnW = $derived((BURN_IN / N_STEPS) * plotTrace);

	const hist = $derived(histogram(main.samples.subarray(BURN_IN, Math.max(BURN_IN, t))));
	const curve = targetCurve(BINS);
	const yMax = $derived(Math.max(0.05, ...hist, ...curve) * 1.1);
	const histH = CHART_H - AXIS_H;
	const barW = $derived(plotHist / BINS);
	const curvePts = $derived(
		curve
			.map((d, i) => `${((i + 0.5) * barW).toFixed(1)},${valueToY(d, histH, 0, yMax).toFixed(1)}`)
			.join(' '),
	);
	const tickX = (v: number, w: number) => ((v - X_MIN) / (X_MAX - X_MIN)) * w;
	const traceColor = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)'];
	const startsText = START_POINTS.slice(1).join(', ');

	function reduceMotion(): boolean {
		return (
			typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	function play(): void {
		if (playing) {
			playing = false;
			return;
		}
		if (t >= N_STEPS) t = 0;
		if (reduceMotion()) {
			t = N_STEPS;
			return;
		}
		playing = true;
	}

	function addSteps(n: number): void {
		t = snapT(t + n);
	}

	function reset(): void {
		playing = false;
		step = STEP_DEFAULT;
		seed = SEED_DEFAULT;
		t = N_STEPS;
	}

	function apply(patch: Partial<McmcDemoState>): void {
		if (typeof patch.step === 'number') step = snapStep(patch.step);
		if (typeof patch.seed === 'number') seed = snapSeed(patch.seed);
		if (typeof patch.t === 'number') {
			playing = false;
			t = snapT(patch.t);
		}
	}

	/** Advances the displayed chain frame by frame; stops at the end of the run. */
	$effect(() => {
		if (!playing) return;
		let raf = 0;
		let last = performance.now();
		const frame = (now: number) => {
			const dt = now - last;
			last = now;
			t = Math.min(N_STEPS, t + Math.max(1, Math.round(dt * STEPS_PER_MS)));
			if (t >= N_STEPS) {
				playing = false;
				return;
			}
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});

	onMount(() => {
		return demos?.register('mcmc', {
			set: (patch) => apply(patch as Partial<McmcDemoState>),
		});
	});
</script>

<figure class="mc" id="demo-mcmc" data-demo="mcmc">
	<div class="mc-controls">
		<label class="mc-ctl">
			<span class="mc-label"><span class="mc-sym">σ</span> шага предложения</span>
			<input
				class="mc-range"
				type="range"
				min={STEP_MIN}
				max={STEP_MAX}
				step={STEP_STEP}
				value={step}
				oninput={(e) => (step = snapStep(Number(e.currentTarget.value)))}
			/>
			<output class="mc-val">{fmt(step, 1)}</output>
		</label>

		<label class="mc-ctl">
			<span class="mc-label">Шагов цепи</span>
			<input
				class="mc-range"
				type="range"
				min="0"
				max={N_STEPS}
				step="100"
				value={t}
				oninput={(e) => {
					playing = false;
					t = snapT(Number(e.currentTarget.value));
				}}
			/>
			<output class="mc-val">{t.toLocaleString('ru-RU').replace(/\s/g, ' ')}</output>
		</label>
	</div>

	<div class="mc-buttons">
		<button type="button" class="mc-btn mc-primary" onclick={play}>
			{playing ? 'Пауза' : t >= N_STEPS ? 'Заново' : 'Играть'}
		</button>
		<button type="button" class="mc-btn" onclick={() => addSteps(100)} disabled={t >= N_STEPS}
			>+100 шагов</button
		>
		<button
			type="button"
			class="mc-btn"
			title="Другой seed для тех же настроек"
			onclick={() => (seed = nextSeed(seed))}>Seed {seed}</button
		>
		<button type="button" class="mc-btn mc-ghost" onclick={reset}>Сброс</button>
	</div>

	<div class="mc-plots">
		<div class="mc-panel" bind:clientWidth={wTrace}>
			<p class="mc-panel-t">След цепи <span class="mc-muted">x по шагам</span></p>
			<svg
				class="mc-svg"
				viewBox="0 0 {plotTrace} {CHART_H}"
				role="img"
				aria-labelledby="mc-trace-title mc-trace-desc"
			>
				<title id="mc-trace-title">След цепей Метрополиса–Гастингса</title>
				<desc id="mc-trace-desc">
					Значение x по шагам для {START_POINTS.length} цепей. Первая цепь начинается в 0, остальные в
					{startsText}. Первые {fmt(BURN_IN, 0)} шагов заштрихованы как прогрев.
				</desc>
				<rect class="mc-burn" x="0" y="0" width={burnW.toFixed(1)} height={CHART_H} />
				<line
					class="mc-guide"
					x1="0"
					x2="100%"
					y1={valueToY(0, CHART_H, X_MIN, X_MAX)}
					y2={valueToY(0, CHART_H, X_MIN, X_MAX)}
				/>
				<line
					class="mc-guide mc-guide-mode"
					x1="0"
					x2="100%"
					y1={valueToY(2, CHART_H, X_MIN, X_MAX)}
					y2={valueToY(2, CHART_H, X_MIN, X_MAX)}
				/>
				<line
					class="mc-guide mc-guide-mode"
					x1="0"
					x2="100%"
					y1={valueToY(-2, CHART_H, X_MIN, X_MAX)}
					y2={valueToY(-2, CHART_H, X_MIN, X_MAX)}
				/>
				{#each traces as tr (tr.k)}
					<polyline
						class="mc-trace"
						class:mc-trace-main={tr.k === 0}
						points={tr.pts}
						style:stroke={traceColor[tr.k]}
					/>
				{/each}
				{#if t > 0}
					<circle class="mc-head" cx={headX.toFixed(1)} cy={headY.toFixed(1)} r="4" />
				{/if}
				<text class="mc-tick" x="2" y={valueToY(2, CHART_H, X_MIN, X_MAX) - 4}>2</text>
				<text class="mc-tick" x="2" y={valueToY(-2, CHART_H, X_MIN, X_MAX) - 4}>−2</text>
			</svg>
			<p class="mc-legend">
				Сплошная линия: цепь из 0. Остальные: старты {startsText}.
			</p>
		</div>

		<div class="mc-panel" bind:clientWidth={wHist}>
			<p class="mc-panel-t">
				Гистограмма после прогрева <span class="mc-muted">против плотности</span>
			</p>
			<svg
				class="mc-svg"
				viewBox="0 0 {plotHist} {CHART_H}"
				role="img"
				aria-labelledby="mc-hist-title mc-hist-desc"
			>
				<title id="mc-hist-title">Выборка цепи и целевая плотность</title>
				<desc id="mc-hist-desc">
					{stats.n === 0
						? `Выборка начнётся после прогрева: ${fmt(BURN_IN, 0)} шагов.`
						: `Гистограмма ${stats.n.toLocaleString('ru-RU')} значений цепи после прогрева; линия — целевая плотность с пиками в −2 и 2.`}
				</desc>
				{#each hist as h, i (i)}
					<rect
						class="mc-bar"
						x={(i * barW).toFixed(1)}
						y={valueToY(h, histH, 0, yMax).toFixed(1)}
						width={Math.max(0, barW - 1).toFixed(1)}
						height={(histH - valueToY(h, histH, 0, yMax)).toFixed(1)}
					/>
				{/each}
				<polyline class="mc-curve" points={curvePts} />
				{#each TICKS as v (v)}
					<text
						class="mc-tick"
						x={tickX(v, plotHist).toFixed(1)}
						y={CHART_H - 4}
						text-anchor={v === X_MIN ? 'start' : v === X_MAX ? 'end' : 'middle'}>{v}</text
					>
				{/each}
			</svg>
			<p class="mc-legend">Столбцы: цепь. Линия: целевая плотность.</p>
		</div>
	</div>

	<dl class="mc-stats">
		<dt>Величина</dt>
		<dd class="mc-h">значение</dd>
		<dd class="mc-h">цель</dd>
		<dt>Доля принятых</dt>
		<dd>
			{percent(stats.rate)}
			<span class="mc-meter" aria-hidden="true"
				><span style:width={`${Math.round((stats.rate ?? 0) * 100)}%`}></span></span
			>
		</dd>
		<dd class="mc-h">сколько предложений приняты</dd>
		<dt>Время в правом пике</dt>
		<dd>{percent(stats.shareRight)}</dd>
		<dd class="mc-h">50% при хорошем перемешивании</dd>
		<dt>Среднее</dt>
		<dd>{fmt(stats.mean)}</dd>
		<dd class="mc-h">0</dd>
		<dt>Разброс (σ)</dt>
		<dd>{fmt(stats.std)}</dd>
		<dd class="mc-h">≈ 2,24</dd>
		<dt>R-hat</dt>
		<dd class:mc-warn={rhWarn}>{fmt(rh)}</dd>
		<dd class="mc-h">≤ {fmt(RHAT_WARN)}, {START_POINTS.length} цепи</dd>
	</dl>

	<p class="mc-live" aria-live="polite">{live}</p>
</figure>

<style>
	.mc {
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
	.mc :global(*),
	.mc :global(*::before),
	.mc :global(*::after) {
		box-sizing: border-box;
	}
	.mc dl,
	.mc dd,
	.mc dt,
	.mc p {
		margin: 0;
	}
	.mc button {
		font: inherit;
	}
	.mc-muted {
		color: var(--text-muted);
	}
	.mc-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.mc-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.mc-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.mc-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.mc-range {
		width: 170px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.mc-val {
		min-width: 6ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.mc-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.mc-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.mc-btn:hover:not(:disabled) {
		background: var(--surface-2);
	}
	.mc-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.mc-btn.mc-primary {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.mc-btn.mc-ghost {
		border-style: dashed;
		color: var(--text-muted);
	}
	.mc-btn:focus-visible,
	.mc-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Charts */
	.mc-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.mc-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.mc-svg {
		display: block;
		width: 100%;
		height: 170px;
		overflow: visible;
	}
	.mc-legend {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.mc-burn {
		fill: var(--surface-2);
	}
	.mc-guide {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.mc-guide-mode {
		stroke-dasharray: 4 3;
	}
	.mc-trace {
		fill: none;
		stroke-width: 1;
		stroke-linejoin: round;
		opacity: 0.55;
	}
	.mc-trace-main {
		stroke-width: 1.5;
		opacity: 1;
	}
	.mc-head {
		fill: var(--text);
	}
	.mc-bar {
		fill: var(--cat-1);
		opacity: 0.75;
		transition:
			y var(--dur) var(--ease),
			height var(--dur) var(--ease);
	}
	.mc-curve {
		fill: none;
		stroke: var(--text);
		stroke-width: 2;
	}
	.mc-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	/* Statistics */
	.mc-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1.4fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.mc-stats dt {
		color: var(--text);
		font-weight: 600;
	}
	.mc-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.mc-stats .mc-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-size: 12px;
	}
	.mc-stats .mc-warn {
		color: var(--warn);
		font-weight: 600;
	}
	.mc-meter {
		display: inline-block;
		width: 64px;
		height: 6px;
		margin-left: var(--space-2);
		vertical-align: middle;
		background: var(--surface-2);
		border-radius: 3px;
		overflow: hidden;
	}
	.mc-meter > span {
		display: block;
		height: 100%;
		background: var(--topic);
		transition: width var(--dur) var(--ease);
	}
	.mc-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.mc *,
		.mc *::before,
		.mc *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.mc {
			padding: var(--space-4);
		}
		.mc-plots {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (max-width: 559px) {
		.mc-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.mc-ctl {
			flex-wrap: wrap;
		}
		.mc-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.mc-stats {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		.mc-stats .mc-h {
			grid-column: 1 / -1;
			margin-bottom: var(--space-2);
		}
	}
</style>
