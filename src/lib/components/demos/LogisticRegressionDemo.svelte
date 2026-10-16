<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import katex from 'katex';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		DEFAULT_STATE,
		ZERO_PARAMS,
		DOMAIN_MAX,
		DOMAIN_MIN,
		GRID_N,
		LR_MAX,
		LR_MIN,
		LR_STEP,
		PARAM_MAX,
		PARAM_MIN,
		PARAM_STEP,
		THRESHOLD_MAX,
		THRESHOLD_MIN,
		THRESHOLD_STEP,
		accuracy,
		boundarySegment,
		classify,
		confusion,
		gdStep,
		gdSteps,
		logLoss,
		makeDataset,
		mergeState,
		predictProba,
		probabilityGrid,
		type LogisticDemoState,
	} from '$lib/demos/logistic-regression';

	/** Props of the demo: a partial initial state (the demo owns the state afterwards). */
	interface LogisticRegressionDemoProps {
		initial?: Partial<LogisticDemoState>;
	}

	let { initial }: LogisticRegressionDemoProps = $props();

	/** Registered name: equals the chapter slug. */
	const DEMO_NAME = 'logistic-regression';
	/** Upper bound of the plot size in px; the plot is drawn at its real size. */
	const PLOT_MAX = 520;

	const DATA = makeDataset();

	const TEX: Record<string, string> = {
		model: '\\hat{p} = \\sigma\\!\\left(w_1 x_1 + w_2 x_2 + b\\right)',
		loss: '\\mathcal{L} = -\\frac{1}{n}\\sum_i \\left[y_i\\ln \\hat{p}_i + (1-y_i)\\ln(1-\\hat{p}_i)\\right]',
	};

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let st = $state<LogisticDemoState>(mergeState(DEFAULT_STATE, initial ?? {}));
	let steps = $state(0);
	let root: HTMLElement | undefined = $state();
	/** Real width of the plot wrapper in px; the SVG is drawn at this size (no viewBox scaling). */
	let plotW = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const params = $derived({ w1: st.w1, w2: st.w2, b: st.b });
	const S = $derived(Math.round(Math.min(Math.max(plotW || 300, 240), PLOT_MAX)));
	const cell = $derived(S / GRID_N);
	const grid = $derived(probabilityGrid(params));
	const preds = $derived(DATA.map((p) => classify(predictProba(params, p.x, p.y), st.threshold)));
	const cm = $derived(confusion(DATA, params, st.threshold));
	const acc = $derived(accuracy(cm));
	const loss = $derived(logLoss(DATA, params));
	const seg = $derived(boundarySegment(params, st.threshold));
	const errors = $derived(cm.fp + cm.fn);

	/** Data → pixel coordinates of the square plot (y grows downwards). */
	const sx = (x: number): number => ((x - DOMAIN_MIN) / (DOMAIN_MAX - DOMAIN_MIN)) * S;
	const sy = (y: number): number => ((DOMAIN_MAX - y) / (DOMAIN_MAX - DOMAIN_MIN)) * S;

	const note = $derived(
		`Порог ${st.threshold.toFixed(2)}: класс 1 предсказан там, где p ≥ ${st.threshold.toFixed(2)}. ` +
			`Ошибок: ${errors} из ${DATA.length}. Граница — линия, где p = ${st.threshold.toFixed(2)}.`,
	);

	function apply(patch: Partial<LogisticDemoState>): void {
		Object.assign(st, mergeState(st, patch));
	}

	function stepOnce(): void {
		Object.assign(st, gdStep(DATA, params, st.lr));
		steps += 1;
	}

	function stepMany(k: number): void {
		Object.assign(st, gdSteps(DATA, params, st.lr, k));
		steps += k;
	}

	function reset(): void {
		Object.assign(st, ZERO_PARAMS);
		steps = 0;
	}

	onMount(() => {
		// Renders KaTeX formulas; without a successful render the static fallback text stays.
		root?.querySelectorAll<HTMLElement>('.ld-tex[data-key]').forEach((el) => {
			const src = TEX[el.dataset.key ?? ''];
			if (!src) return;
			try {
				katex.render(src, el, { trust: true, strict: 'ignore', throwOnError: false });
			} catch {
				/* keep fallback text */
			}
		});
		return demos?.register(DEMO_NAME, {
			set: (patch) => apply(patch as Partial<LogisticDemoState>),
		});
	});
</script>

<figure
	class="ld"
	id="demo-logistic-regression"
	data-demo={DEMO_NAME}
	class:hl-q={hl === 'q'}
	class:hl-k={hl === 'k'}
	class:hl-v={hl === 'v'}
	bind:this={root}
>
	<div class="ld-controls">
		<label class="ld-ctl">
			<span class="ld-label">w<sub>1</sub></span>
			<input
				class="ld-range"
				type="range"
				min={PARAM_MIN}
				max={PARAM_MAX}
				step={PARAM_STEP}
				bind:value={st.w1}
			/>
			<output class="ld-val">{st.w1.toFixed(1)}</output>
		</label>
		<label class="ld-ctl">
			<span class="ld-label">w<sub>2</sub></span>
			<input
				class="ld-range"
				type="range"
				min={PARAM_MIN}
				max={PARAM_MAX}
				step={PARAM_STEP}
				bind:value={st.w2}
			/>
			<output class="ld-val">{st.w2.toFixed(1)}</output>
		</label>
		<label class="ld-ctl">
			<span class="ld-label">смещение <i>b</i></span>
			<input
				class="ld-range"
				type="range"
				min={PARAM_MIN}
				max={PARAM_MAX}
				step={PARAM_STEP}
				bind:value={st.b}
			/>
			<output class="ld-val">{st.b.toFixed(1)}</output>
		</label>
		<label class="ld-ctl">
			<span class="ld-label">порог</span>
			<input
				class="ld-range"
				type="range"
				min={THRESHOLD_MIN}
				max={THRESHOLD_MAX}
				step={THRESHOLD_STEP}
				bind:value={st.threshold}
			/>
			<output class="ld-val">{st.threshold.toFixed(2)}</output>
		</label>
		<label class="ld-ctl">
			<span class="ld-label">шаг α</span>
			<input
				class="ld-range"
				type="range"
				min={LR_MIN}
				max={LR_MAX}
				step={LR_STEP}
				bind:value={st.lr}
			/>
			<output class="ld-val">{st.lr.toFixed(2)}</output>
		</label>
	</div>

	<div class="ld-main">
		<div class="ld-plot" bind:clientWidth={plotW}>
			<svg
				class="ld-svg"
				width={S}
				height={S}
				viewBox="0 0 {S} {S}"
				role="img"
				aria-labelledby="ld-title ld-desc"
			>
				<title id="ld-title">Граница логистической регрессии</title>
				<desc id="ld-desc"
					>Два класса точек на плоскости, фон окрашен вероятностью класса 1, линия показывает порог.
					Точки, отнесённые к другому классу, обведены.</desc
				>
				<g class="ld-bg">
					{#each grid as row, r (r)}
						{#each row as p, c (c)}
							<rect
								x={c * cell}
								y={r * cell}
								width={cell + 0.5}
								height={cell + 0.5}
								style:fill="color-mix(in srgb, var(--seq-1) {(p * 100).toFixed(1)}%, var(--seq-0))"
							></rect>
						{/each}
					{/each}
				</g>
				<rect class="ld-frame" x="0.5" y="0.5" width={S - 1} height={S - 1}></rect>
				{#if seg}
					<line
						class="ld-line"
						x1={sx(seg[0]).toFixed(1)}
						y1={sy(seg[1]).toFixed(1)}
						x2={sx(seg[2]).toFixed(1)}
						y2={sy(seg[3]).toFixed(1)}
					></line>
				{/if}
				{#each DATA as pt, i (i)}
					<circle
						class="ld-pt"
						class:is-one={pt.label === 1}
						class:is-miss={preds[i] !== pt.label}
						cx={sx(pt.x).toFixed(1)}
						cy={sy(pt.y).toFixed(1)}
						r="5"
					></circle>
				{/each}
				<text class="ld-axis" x={S - 6} y={S - 6} text-anchor="end">x₁ →</text>
				<text class="ld-axis" x="6" y="16">x₂ ↑</text>
			</svg>
			<p class="ld-legend">
				<span class="ld-dot is-one"></span> класс 1
				<span class="ld-dot"></span> класс 0
				<span class="ld-dot is-miss"></span> ошибка
				<span class="ld-ramp" aria-hidden="true"></span> фон: p(класс 1) от 0 до 1
			</p>
		</div>

		<div class="ld-side">
			<div class="ld-actions">
				<button type="button" class="ld-btn ld-btn-primary" onclick={stepOnce}>Шаг GD</button>
				<button type="button" class="ld-btn" onclick={() => stepMany(10)}>10 шагов</button>
				<button type="button" class="ld-btn" onclick={reset}>Сброс</button>
			</div>
			<p class="ld-stats">
				Шагов: <b>{steps}</b>. log-loss: <b>{loss.toFixed(3)}</b>. Точность:
				<b>{(acc * 100).toFixed(0)}%</b>
			</p>

			<table class="ld-cm">
				<caption>Матрица ошибок при пороге {st.threshold.toFixed(2)}</caption>
				<thead>
					<tr>
						<th scope="col">Факт \ прогноз</th>
						<th scope="col">1</th>
						<th scope="col">0</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">1</th>
						<td class="ld-cm-ok">{cm.tp} <small>TP</small></td>
						<td class="ld-cm-bad">{cm.fn} <small>FN</small></td>
					</tr>
					<tr>
						<th scope="row">0</th>
						<td class="ld-cm-bad">{cm.fp} <small>FP</small></td>
						<td class="ld-cm-ok">{cm.tn} <small>TN</small></td>
					</tr>
				</tbody>
			</table>

			<div class="ld-formulas">
				<span class="ld-tex" data-key="model">p̂ = σ(w₁x₁ + w₂x₂ + b)</span>
				<span class="ld-tex" data-key="loss">L = −(1/n) Σ [y ln p̂ + (1−y) ln(1−p̂)]</span>
			</div>
		</div>
	</div>

	<!-- Caption, number and text alternative come from the enclosing Figure; this line only describes the state. -->
	<p class="ld-note">{note}</p>
</figure>

<style>
	.ld {
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
	.ld :global(*),
	.ld :global(*::before),
	.ld :global(*::after) {
		box-sizing: border-box;
	}
	.ld p {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
	}
	.ld sub {
		font-size: 0.75em;
		line-height: 0;
	}
	.ld button {
		font: inherit;
	}
	.ld-tex {
		white-space: nowrap;
	}

	/* Controls */
	.ld-controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: var(--space-3) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ld-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.ld-label {
		color: var(--text-muted);
		white-space: nowrap;
		min-width: 6.5em;
	}
	.ld-range {
		flex: 1 1 auto;
		min-width: 0;
		width: 100px;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.ld-val {
		min-width: 4.5ch;
		text-align: right;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Plot and side panel */
	.ld-main {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
		gap: var(--space-8);
		margin-top: var(--space-6);
		align-items: start;
	}
	.ld-plot {
		min-width: 0;
		max-width: 520px;
	}
	.ld-svg {
		display: block;
		max-width: 100%;
		height: auto;
		border-radius: var(--radius);
		overflow: hidden;
	}
	.ld-bg rect {
		stroke: none;
		transition: fill var(--dur) var(--ease);
	}
	.ld-frame {
		fill: none;
		stroke: var(--border);
		stroke-width: 1;
	}
	.ld-line {
		stroke: var(--text);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.ld-pt {
		fill: var(--cat-1);
		stroke: var(--surface);
		stroke-width: 1.5;
		transition: stroke-width var(--dur) var(--ease);
	}
	.ld-pt.is-one {
		fill: var(--cat-2);
	}
	.ld-pt.is-miss {
		stroke: var(--text);
		stroke-width: 2.5;
	}
	.ld-axis {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.ld-legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 12px;
	}
	.ld-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: 2px;
		border-radius: 50%;
		background: var(--cat-1);
		vertical-align: -1px;
	}
	.ld-dot.is-one {
		background: var(--cat-2);
	}
	.ld-dot.is-miss {
		background: var(--surface);
		border: 2px solid var(--text);
		width: 8px;
		height: 8px;
	}

	.ld-ramp {
		width: 56px;
		height: 8px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: linear-gradient(to right, var(--seq-0), var(--seq-1));
	}

	.ld-side {
		display: grid;
		gap: var(--space-4);
		min-width: 0;
	}
	.ld-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.ld-btn {
		min-height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text);
		font-size: 13px;
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}
	.ld-btn:hover {
		border-color: var(--accent);
	}
	.ld-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.ld-btn-primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--surface);
	}
	.ld-stats {
		color: var(--text-muted);
		font-size: 13px;
	}
	.ld-stats b {
		color: var(--text);
		font-family: var(--font-mono);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* Confusion matrix */
	.ld-cm {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.ld-cm caption {
		caption-side: top;
		margin-bottom: var(--space-2);
		text-align: left;
		color: var(--text-muted);
	}
	.ld-cm th,
	.ld-cm td {
		padding: var(--space-2);
		border: 1px solid var(--border);
		text-align: center;
		font-family: var(--font-mono);
	}
	.ld-cm th {
		background: var(--surface-2);
		font-weight: 600;
		color: var(--text-muted);
	}
	.ld-cm td {
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
	}
	.ld-cm td small {
		font-size: 11px;
		font-weight: 400;
		color: var(--text-muted);
	}
	.ld-cm-ok {
		background: color-mix(in srgb, var(--ok) 14%, var(--surface));
	}
	.ld-cm-bad {
		background: color-mix(in srgb, var(--warn) 14%, var(--surface));
	}

	/* Formulas scroll inside this box on narrow screens instead of widening the page. */
	.ld-formulas {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		overflow-x: auto;
		scrollbar-width: thin;
		padding-bottom: var(--space-3);
		color: var(--text);
		font-size: 15px;
	}

	/* Description under the figure */
	.ld-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT): q = points, k = boundary, v = matrix */
	.ld.hl-q .ld-pt {
		stroke-width: 3;
	}
	.ld.hl-k .ld-bg,
	.ld.hl-k .ld-pt {
		opacity: 0.45;
	}
	.ld.hl-k .ld-line {
		stroke-width: 4;
	}
	.ld.hl-v .ld-cm {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
	}

	@media (prefers-reduced-motion: reduce) {
		.ld *,
		.ld *::before,
		.ld *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.ld {
			padding: var(--space-4);
		}
		.ld-main {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (max-width: 559px) {
		.ld-controls {
			grid-template-columns: minmax(0, 1fr);
		}
		.ld-ctl {
			flex-wrap: nowrap;
		}
		.ld-label {
			min-width: 5.5em;
		}
	}
</style>
