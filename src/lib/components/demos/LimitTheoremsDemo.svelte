<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		BINS,
		N_DEFAULT,
		N_MAX,
		N_MIN,
		N_STEP,
		REPS,
		SOURCE_KINDS,
		type LimitTheoremsDemoState,
		type SourceKind,
		bandHalfWidth,
		describeState,
		histogram,
		histogramDomain,
		isSourceKind,
		measurements,
		normalPdf,
		pathFromPoints,
		runningMeans,
		sampleMeans,
		scaleLinear,
		snapN,
		summarize,
		trueMean,
		trueVariance,
	} from '$lib/demos/limit-theorems';

	/** Law of large numbers and CLT demo. Registers itself as demo `limit-theorems`. */
	let { initial }: { initial?: Partial<LimitTheoremsDemoState> } = $props();

	/** Short button labels; the full description is in the chart text. */
	const SOURCE_LABEL: Record<SourceKind, string> = {
		uniform: 'Равномерное',
		exponential: 'Экспоненциальное',
		die: 'Кубик',
	};

	/** Start values: the props only seed them, and «Сбросить» returns to them. */
	/* svelte-ignore state_referenced_locally */
	const START: LimitTheoremsDemoState = {
		source: isSourceKind(initial?.source) ? initial.source : 'uniform',
		n: snapN(initial?.n ?? N_DEFAULT),
	};

	let source = $state<SourceKind>(START.source);
	let n = $state(START.n);
	/** Real widths of the two charts in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wLeft = $state(0);
	let wRight = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const H = 170;
	const PAD_T = 10;
	const PAD_B = 22;
	const PAD_X = 8;
	/** Chart widths in px; 320 until the first measurement. */
	const wL = $derived(wLeft >= 120 ? wLeft : 320);
	const wR = $derived(wRight >= 120 ? wRight : 320);

	const mu = $derived(trueMean(source));
	const sd = $derived(Math.sqrt(trueVariance(source)));
	const means = $derived(sampleMeans(source, n));
	const summary = $derived(summarize(source, n, means));
	const status = $derived(describeState(source, n, summary));

	// Left chart: running mean of one fixed stream, with the band of two standard errors.
	const run = $derived(runningMeans(measurements(source, n)));
	const xMax = $derived(Math.max(n, 2));
	const yLo = $derived(mu - 4 * sd);
	const yHi = $derived(mu + 4 * sd);
	const px = (k: number) => scaleLinear(k, 1, xMax, PAD_X, wL - PAD_X);
	/** Values outside the vertical domain are drawn at its edge. */
	const py = (v: number) =>
		scaleLinear(Math.min(yHi, Math.max(yLo, v)), yLo, yHi, H - PAD_B, PAD_T);
	const runPath = $derived(pathFromPoints(run.map((v, i) => [px(i + 1), py(v)] as const)));
	const bandPath = $derived.by(() => {
		const upper: (readonly [number, number])[] = [];
		const lower: (readonly [number, number])[] = [];
		for (let k = 1; k <= n; k++) {
			const b = bandHalfWidth(source, k);
			upper.push([px(k), py(mu + b)]);
			lower.push([px(k), py(mu - b)]);
		}
		return `${pathFromPoints([...upper, ...lower.reverse()])} Z`;
	});
	const muY = $derived(py(mu));

	// Right chart: histogram of the means of REPS samples of size n, with the normal curve.
	const domain = $derived(histogramDomain(source, n));
	const binW = $derived((domain[1] - domain[0]) / BINS);
	const counts = $derived(histogram(means, BINS, domain[0], domain[1]));
	const dens = $derived(counts.map((c) => c / (REPS * binW)));
	const seTheory = $derived(summary.seTheory);
	const yMaxR = $derived(Math.max(...dens, normalPdf(mu, mu, seTheory)) * 1.12);
	const rx = (x: number) => scaleLinear(x, domain[0], domain[1], PAD_X, wR - PAD_X);
	const ry = (d: number) => scaleLinear(d, 0, yMaxR, H - PAD_B, PAD_T);
	const bars = $derived(
		dens.map((d, i) => {
			const x0 = rx(domain[0] + i * binW);
			const x1 = rx(domain[0] + (i + 1) * binW);
			const y = ry(d);
			return { x: x0, w: Math.max(0, x1 - x0 - 1), y, h: H - PAD_B - y, count: counts[i] };
		}),
	);
	const curvePath = $derived.by(() => {
		const pts: (readonly [number, number])[] = [];
		const steps = 100;
		for (let i = 0; i <= steps; i++) {
			const x = domain[0] + ((domain[1] - domain[0]) * i) / steps;
			pts.push([rx(x), ry(normalPdf(x, mu, seTheory))]);
		}
		return pathFromPoints(pts);
	});
	const muX = $derived(rx(mu));

	const descLeft = $derived(
		`Среднее первых k измерений одной серии, k от 1 до ${n}. Ожидание ${mu.toFixed(2)}, полоса ±2σ/√k.`,
	);
	const descRight = $derived(
		`Гистограмма средних ${REPS} выборок по ${n} измерений. Сплошная кривая: нормальное распределение со средним ${mu.toFixed(2)} и стандартным отклонением ${seTheory.toFixed(3)}.`,
	);

	function apply(patch: Partial<LimitTheoremsDemoState>): void {
		if (isSourceKind(patch.source)) source = patch.source;
		if (typeof patch.n === 'number') n = snapN(patch.n);
	}

	function reset(): void {
		source = START.source;
		n = START.n;
	}

	onMount(() => {
		return demos?.register('limit-theorems', {
			set: (patch) => apply(patch as Partial<LimitTheoremsDemoState>),
		});
	});
</script>

<figure class="lt" id="demo-limit-theorems" data-demo="limit-theorems">
	<div class="lt-controls">
		<div class="lt-group" role="group" aria-label="Распределение одного измерения">
			{#each SOURCE_KINDS as kind (kind)}
				<button
					type="button"
					class="lt-seg"
					aria-pressed={source === kind}
					onclick={() => (source = kind)}>{SOURCE_LABEL[kind]}</button
				>
			{/each}
		</div>

		<label class="lt-ctl">
			<span class="lt-label"><span class="lt-sym">n</span> (измерений)</span>
			<input
				class="lt-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step={N_STEP}
				value={n}
				oninput={(e) => (n = snapN(Number(e.currentTarget.value)))}
			/>
			<output class="lt-val">{n}</output>
		</label>

		<button type="button" class="lt-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="lt-plots">
		<div class="lt-panel" bind:clientWidth={wLeft}>
			<p class="lt-panel-t">Среднее при росте n</p>
			<svg
				class="lt-svg"
				viewBox="0 0 {wL} {H}"
				role="img"
				aria-labelledby="lt-left-title lt-left-desc"
			>
				<title id="lt-left-title">Выборочное среднее по мере роста числа измерений</title>
				<desc id="lt-left-desc">{descLeft}</desc>
				<path class="lt-band" d={bandPath} />
				<line class="lt-mu" x1={PAD_X} x2={wL - PAD_X} y1={muY.toFixed(1)} y2={muY.toFixed(1)} />
				<path class="lt-run" d={runPath} />
				<text class="lt-tick" x={PAD_X} y={H - 4} text-anchor="start">1</text>
				<text class="lt-tick" x={wL - PAD_X} y={H - 4} text-anchor="end">{n}</text>
			</svg>
		</div>

		<div class="lt-panel" bind:clientWidth={wRight}>
			<p class="lt-panel-t">Распределение средних</p>
			<svg
				class="lt-svg"
				viewBox="0 0 {wR} {H}"
				role="img"
				aria-labelledby="lt-right-title lt-right-desc"
			>
				<title id="lt-right-title">Гистограмма средних выборок</title>
				<desc id="lt-right-desc">{descRight}</desc>
				{#each bars as b, i (i)}
					<rect
						class="lt-bar"
						x={b.x.toFixed(1)}
						y={b.y.toFixed(1)}
						width={b.w.toFixed(1)}
						height={b.h.toFixed(1)}
					>
						<title>интервал {i + 1}: {b.count} выборок</title>
					</rect>
				{/each}
				<path class="lt-curve" d={curvePath} />
				<line class="lt-mu" x1={muX.toFixed(1)} x2={muX.toFixed(1)} y1={PAD_T} y2={H - PAD_B} />
				<text class="lt-tick" x={PAD_X} y={H - 4} text-anchor="start">{domain[0].toFixed(2)}</text>
				<text class="lt-tick" x={wR - PAD_X} y={H - 4} text-anchor="end"
					>{domain[1].toFixed(2)}</text
				>
			</svg>
		</div>
	</div>

	<dl class="lt-stats">
		<dt>Статистика</dt>
		<dd class="lt-h">симуляция</dd>
		<dd class="lt-h">σ/√n</dd>
		<dt>Стандартная ошибка</dt>
		<dd>{summary.se.toFixed(3)}</dd>
		<dd>{seTheory.toFixed(3)}</dd>
	</dl>

	<p class="lt-status" aria-live="polite">{status}</p>

	<p class="lt-notice">
		<strong>Что заметить.</strong> Полоса вокруг ожидания сужается как 1/√n, а среднее серии стягивается
		к горизонтальной линии. Гистограмма средних становится симметричной и похожей на колокол, даже если
		одно измерение несимметрично, как экспоненциальное.
	</p>
</figure>

<style>
	.lt {
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
	.lt :global(*),
	.lt :global(*::before),
	.lt :global(*::after) {
		box-sizing: border-box;
	}
	.lt dl,
	.lt dd,
	.lt dt,
	.lt p {
		margin: 0;
	}
	.lt button {
		font: inherit;
	}
	.lt-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.lt-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.lt-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.lt-seg,
	.lt-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.lt-seg {
		border: 0;
		background: none;
		color: var(--text-muted);
	}
	.lt-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.lt-reset {
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text);
	}
	.lt-seg:focus-visible,
	.lt-reset:focus-visible,
	.lt-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.lt-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.lt-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.lt-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.lt-val {
		min-width: 3ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Charts */
	.lt-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.lt-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.lt-svg {
		display: block;
		width: 100%;
		height: 170px;
		overflow: visible;
	}
	.lt-band {
		fill: var(--topic);
		opacity: 0.15;
	}
	.lt-run {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.lt-mu {
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.lt-bar {
		fill: var(--cat-1);
		opacity: 0.85;
	}
	.lt-curve {
		fill: none;
		stroke: var(--cat-4);
		stroke-width: 2;
	}
	.lt-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	/* Statistics */
	.lt-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.lt-stats dt {
		color: var(--text-muted);
	}
	.lt-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.lt-stats .lt-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-size: 12px;
	}
	.lt-stats dt:first-child {
		color: var(--text);
		font-weight: 600;
	}
	.lt-status {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.lt-notice {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.lt *,
		.lt *::before,
		.lt *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.lt {
			padding: var(--space-4);
		}
		.lt-plots {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
		.lt-range {
			width: 120px;
		}
	}

	@media (max-width: 559px) {
		.lt-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.lt-ctl {
			flex-wrap: wrap;
		}
		.lt-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
