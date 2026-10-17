<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import { trueFn } from '$lib/demos/bias-variance';
	import {
		DEFAULT_DEGREE,
		DEFAULT_LOG_LAMBDA,
		DEFAULT_PENALTY,
		DEG_MAX,
		DEG_MIN,
		LOG_LAMBDA_MAX,
		LOG_LAMBDA_MIN,
		LOG_LAMBDA_STEP,
		ZERO_TOL,
		curvePoints,
		describeModel,
		fitModel,
		formatLambda,
		isPenalty,
		lambdaOf,
		mse,
		nonZeroCount,
		penalisedNorm,
		snapDegree,
		snapLogLambda,
		testSet,
		trainSet,
		type Penalty,
		type RegularizationDemoState,
	} from '$lib/demos/regularization';

	/** Ridge / lasso demo: polynomial fits on fixed noisy points. Registers itself as demo `regularization`. */
	let { initial }: { initial?: Partial<RegularizationDemoState> } = $props();

	/* Fixed data: computed once, identical on every page load. */
	const TRAIN = trainSet();
	const TEST = testSet();
	/** Vertical range of the fit chart: [-CURVE_Y, CURVE_Y]. */
	const CURVE_Y = 1.6;
	const CHART_H = 220;
	const PAD = 12;
	const trueCurve = Array.from({ length: 81 }, (_, i) => {
		const x = i / 80;
		return [x, trueFn(x)] as [number, number];
	});

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const start = {
		degree: snapDegree(initial?.degree ?? DEFAULT_DEGREE),
		logLambda: snapLogLambda(initial?.logLambda ?? DEFAULT_LOG_LAMBDA),
		penalty: isPenalty(initial?.penalty) ? initial.penalty : DEFAULT_PENALTY,
	};

	/* The props only seed the initial state: the demo owns it afterwards. */
	let degree = $state(start.degree);
	let logLambda = $state(start.logLambda);
	let penalty = $state<Penalty>(start.penalty);
	/** Real widths of the two charts in px; the SVGs are drawn at this width (no viewBox scaling). */
	let fitW = $state(0);
	let weightsW = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const lambda = $derived(lambdaOf(logLambda));
	const w = $derived(fitModel(TRAIN, degree, logLambda, penalty));
	const trainErr = $derived(mse(TRAIN, w));
	const testErr = $derived(mse(TEST, w));
	const nz = $derived(nonZeroCount(w));
	const norm = $derived(penalisedNorm(w));
	const curve = $derived(curvePoints(w));
	const note = $derived(describeModel(penalty, degree, w, trainErr, testErr));
	const isL1 = $derived(penalty === 'l1');

	const plotFitW = $derived(fitW >= 120 ? fitW : 320);
	const plotWeightsW = $derived(weightsW >= 120 ? weightsW : 320);
	/** Symmetric value range of the weights chart, with headroom, never below 0.5. */
	const weightDomain = $derived(Math.max(0.5, ...w.map((v) => Math.abs(v))) * 1.15);

	/** Fit chart: x in [0, 1] maps to the width, y in [-CURVE_Y, CURVE_Y] maps to the height. */
	const sxFit = (x: number) => PAD + x * (plotFitW - 2 * PAD);
	const syFit = (y: number) => CHART_H / 2 - (y / CURVE_Y) * (CHART_H / 2 - PAD);
	const fitPath = $derived(
		curve
			.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sxFit(x).toFixed(1)} ${syFit(y).toFixed(1)}`)
			.join(''),
	);
	const truePath = $derived(
		trueCurve
			.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sxFit(x).toFixed(1)} ${syFit(y).toFixed(1)}`)
			.join(''),
	);

	/** Weights chart: one bar per coefficient w_0..w_k, zero line in the middle. */
	const bars = $derived.by(() => {
		const n = w.length;
		const slot = (plotWeightsW - 2 * PAD) / n;
		const half = CHART_H / 2 - PAD;
		return w.map((v, j) => {
			const h = (Math.abs(v) / weightDomain) * half;
			return {
				j,
				v,
				x: PAD + j * slot + slot * 0.15,
				w: slot * 0.7,
				y: v >= 0 ? CHART_H / 2 - h : CHART_H / 2,
				h,
				zero: Math.abs(v) <= ZERO_TOL,
			};
		});
	});

	const descFit = $derived(
		`Кривая степени ${degree} при λ = ${formatLambda(lambda)} по ${TRAIN.xs.length} точкам; пунктир — истинная функция.`,
	);
	const descWeights = $derived(
		`Коэффициенты w от 0 до ${degree}. Ненулевых штрафуемых весов: ${nz} из ${degree}.`,
	);

	function apply(patch: Partial<RegularizationDemoState>): void {
		if (typeof patch.degree === 'number') degree = snapDegree(patch.degree);
		if (typeof patch.logLambda === 'number') logLambda = snapLogLambda(patch.logLambda);
		if (isPenalty(patch.penalty)) penalty = patch.penalty;
	}

	function reset(): void {
		degree = start.degree;
		logLambda = start.logLambda;
		penalty = start.penalty;
	}

	onMount(() =>
		demos?.register('regularization', {
			set: (patch) => apply(patch as Partial<RegularizationDemoState>),
		}),
	);
</script>

<figure
	class="rg"
	id="demo-regularization"
	data-demo="regularization"
	class:hl-q={hl === 'q'}
	class:hl-v={hl === 'v'}
>
	<div class="rg-controls">
		<div class="rg-group" role="group" aria-label="Тип штрафа">
			<button type="button" class="rg-seg" aria-pressed={!isL1} onclick={() => (penalty = 'l2')}
				>L2 (ridge)</button
			>
			<button type="button" class="rg-seg" aria-pressed={isL1} onclick={() => (penalty = 'l1')}
				>L1 (lasso)</button
			>
		</div>

		<label class="rg-ctl">
			<span class="rg-label"><span class="rg-sym">k</span> (степень)</span>
			<input
				class="rg-range"
				type="range"
				min={DEG_MIN}
				max={DEG_MAX}
				step="1"
				value={degree}
				oninput={(e) => (degree = snapDegree(Number(e.currentTarget.value)))}
			/>
			<output class="rg-val">{degree}</output>
		</label>

		<label class="rg-ctl">
			<span class="rg-label"><span class="rg-sym">λ</span> (штраф)</span>
			<input
				class="rg-range"
				type="range"
				min={LOG_LAMBDA_MIN}
				max={LOG_LAMBDA_MAX}
				step={LOG_LAMBDA_STEP}
				value={logLambda}
				oninput={(e) => (logLambda = snapLogLambda(Number(e.currentTarget.value)))}
			/>
			<output class="rg-val">{formatLambda(lambda)}</output>
		</label>

		<button type="button" class="rg-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="rg-formula" aria-hidden="true">
		{#if isL1}
			min ‖y − Xw‖² + λ · Σ<sub>j≥1</sub> |w<sub>j</sub>|
		{:else}
			min ‖y − Xw‖² + λ · Σ<sub>j≥1</sub> w<sub>j</sub>²
		{/if}
	</div>

	<div class="rg-plots">
		<div class="rg-panel" bind:clientWidth={fitW}>
			<p class="rg-panel-t">Кривая <span class="rg-muted">f(x)</span></p>
			<svg
				class="rg-svg"
				viewBox="0 0 {plotFitW} {CHART_H}"
				role="img"
				aria-labelledby="rg-fit-title rg-fit-desc"
			>
				<title id="rg-fit-title">Полиномиальная кривая на точках обучения</title>
				<desc id="rg-fit-desc">{descFit}</desc>
				<defs>
					<clipPath id="rg-fit-clip">
						<rect x="0" y="0" width={plotFitW} height={CHART_H} />
					</clipPath>
				</defs>
				<line class="rg-zero" x1="0" x2={plotFitW} y1={syFit(0)} y2={syFit(0)} />
				<path class="rg-true" d={truePath} />
				<g clip-path="url(#rg-fit-clip)">
					<path class="rg-fit" d={fitPath} />
				</g>
				{#each TRAIN.xs as x, i (i)}
					<circle
						class="rg-pt"
						cx={sxFit(x).toFixed(1)}
						cy={syFit(TRAIN.ys[i] ?? 0).toFixed(1)}
						r="3"
					>
						<title>точка {i + 1}: y = {(TRAIN.ys[i] ?? 0).toFixed(2)}</title>
					</circle>
				{/each}
			</svg>
		</div>

		<div class="rg-panel" bind:clientWidth={weightsW}>
			<p class="rg-panel-t">Веса <span class="rg-muted">w</span></p>
			<svg
				class="rg-svg"
				viewBox="0 0 {plotWeightsW} {CHART_H}"
				role="img"
				aria-labelledby="rg-w-title rg-w-desc"
			>
				<title id="rg-w-title">Коэффициенты полинома в базе Лежандра</title>
				<desc id="rg-w-desc">{descWeights}</desc>
				<line class="rg-zero" x1="0" x2={plotWeightsW} y1={CHART_H / 2} y2={CHART_H / 2} />
				{#each bars as b (b.j)}
					{#if b.zero}
						<line
							class="rg-zero-mark"
							x1={b.x.toFixed(1)}
							x2={(b.x + b.w).toFixed(1)}
							y1={CHART_H / 2}
							y2={CHART_H / 2}
						>
							<title>w{b.j} = 0</title>
						</line>
					{:else}
						<rect
							class={b.j === 0 ? 'rg-bar rg-bar-free' : 'rg-bar rg-bar-pen'}
							x={b.x.toFixed(1)}
							y={b.y.toFixed(1)}
							width={b.w.toFixed(1)}
							height={b.h.toFixed(1)}
						>
							<title>w{b.j} = {b.v.toFixed(3)}</title>
						</rect>
					{/if}
					<text class="rg-tick" x={(b.x + b.w / 2).toFixed(1)} y={CHART_H - 2}>{b.j}</text>
				{/each}
			</svg>
		</div>
	</div>

	<dl class="rg-stats">
		<dt>Величина</dt>
		<dd class="rg-h">значение</dd>
		<dt>Ошибка на обучении</dt>
		<dd>{trainErr.toFixed(3)}</dd>
		<dt>Ошибка на контрольных точках</dt>
		<dd>{testErr.toFixed(3)}</dd>
		<dt>‖w‖ без свободного члена</dt>
		<dd>{norm.toFixed(2)}</dd>
		<dt>Ненулевых весов</dt>
		<dd>{nz} из {degree}</dd>
	</dl>

	<p class="rg-note" aria-live="polite">{note}</p>

	<div class="rg-notice">
		<p class="rg-h2">Что заметить</p>
		<ul>
			<li>
				При λ почти нуле высокая степень проходит через точки обучения, но ошибка на контрольных
				точках велика.
			</li>
			<li>
				L2 (ridge) сжимает все веса, но обычно не обнуляет их: ненулевых весов остаётся столько же.
			</li>
			<li>L1 (lasso) обнуляет часть весов точно: это отбор членов полинома.</li>
			<li>
				При очень большом λ обе модели становятся почти константой: ошибка растёт уже из-за
				смещения.
			</li>
		</ul>
	</div>
</figure>

<style>
	.rg {
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
	.rg :global(*),
	.rg :global(*::before),
	.rg :global(*::after) {
		box-sizing: border-box;
	}
	.rg dl,
	.rg dd,
	.rg dt,
	.rg p,
	.rg ul {
		margin: 0;
	}
	.rg ul {
		padding-left: var(--space-4);
	}
	.rg button {
		font: inherit;
	}
	.rg-muted {
		color: var(--text-muted);
	}
	.rg-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.rg-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.rg-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.rg-seg,
	.rg-reset {
		height: 32px;
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
	.rg-reset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.rg-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.rg-seg:focus-visible,
	.rg-reset:focus-visible,
	.rg-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.rg-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.rg-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.rg-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.rg-val {
		min-width: 5ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.rg-formula {
		margin-top: var(--space-4);
		color: var(--text);
		font-family: var(--font-serif);
		font-size: var(--fs-base);
		line-height: 1.3;
	}
	.rg-formula :global(sub) {
		font-size: 0.75em;
	}

	/* Charts */
	.rg-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.rg-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.rg-svg {
		display: block;
		width: 100%;
		height: 220px;
		overflow: visible;
	}
	.rg-zero {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.rg-true {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
	}
	.rg-fit {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2.5;
		stroke-linejoin: round;
	}
	.rg-pt {
		fill: var(--text);
	}
	.rg-bar-pen {
		fill: var(--topic);
	}
	.rg-bar-free {
		fill: var(--text-muted);
	}
	.rg-zero-mark {
		stroke: var(--text);
		stroke-width: 2;
	}
	.rg-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		text-anchor: middle;
	}

	/* Statistics */
	.rg-stats {
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
	.rg-stats dt {
		color: var(--text-muted);
	}
	.rg-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.rg-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* What to notice */
	.rg-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.rg-h2 {
		margin-bottom: var(--space-1);
		font-family: var(--font-serif);
		font-weight: 600;
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.rg.hl-q .rg-stats {
		opacity: 0.45;
	}
	.rg.hl-v .rg-panel:first-child {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
		border-radius: var(--radius);
	}

	@media (prefers-reduced-motion: reduce) {
		.rg *,
		.rg *::before,
		.rg *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.rg {
			padding: var(--space-4);
		}
		.rg-plots {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
		.rg-range {
			width: 120px;
		}
	}

	@media (max-width: 559px) {
		.rg-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.rg-ctl {
			flex-wrap: wrap;
		}
		.rg-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
