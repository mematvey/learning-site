<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type EntityId,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		DEG_MAX,
		DEG_MIN,
		DEFAULT_DEGREE,
		allStats,
		describeRegime,
		fitsOnGrid,
		gridXs,
		makeDatasets,
		snapDegree,
		trueFn,
		type BiasVarianceDemoState,
	} from '$lib/demos/bias-variance';

	/** Props: `initial` only seeds the state; the demo owns it afterwards. */
	let { initial }: { initial?: Partial<BiasVarianceDemoState> } = $props();

	/** Fixed data and statistics: computed once, identical on every page load. */
	const datasets = makeDatasets();
	const STATS = allStats(datasets);
	const drawGrid = gridXs(81);
	const trueCurve = drawGrid.map((x) => [x, trueFn(x)] as [number, number]);
	const sample = datasets[0] ?? { xs: [], ys: [] };
	const degrees = Array.from({ length: DEG_MAX - DEG_MIN + 1 }, (_, i) => DEG_MIN + i);

	/* Upper bound of the error plot: higher values (near-interpolating fits) are clipped. */
	const CURVE_Y_MAX = 1;
	const FIT_Y = 1.5;

	/* svelte-ignore state_referenced_locally */
	let degree = $state(snapDegree(initial?.degree ?? DEFAULT_DEGREE));
	let fitsW = $state(0);
	let curveW = $state(0);

	/** Entity colour for each series: bias -> Q, variance -> K, sum -> V (the same tokens as `Ref`). */
	const SERIES: { key: 'bias2' | 'variance' | 'sum'; label: string; entity: EntityId }[] = [
		{ key: 'bias2', label: 'смещение²', entity: 'q' },
		{ key: 'variance', label: 'разброс', entity: 'k' },
		{ key: 'sum', label: 'сумма', entity: 'v' },
	];

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const current = $derived(STATS[degree - DEG_MIN] ?? STATS[0]);
	const fits = $derived(fitsOnGrid(datasets, degree, drawGrid));
	/** Average fit over the trials, on the drawing grid. */
	const meanFit = $derived(
		drawGrid.map(
			(_, g) => fits.reduce((s, row) => s + (row[g] ?? 0), 0) / Math.max(1, fits.length),
		),
	);
	const regime = $derived(current ? describeRegime(current) : '');

	function apply(patch: Partial<BiasVarianceDemoState>): void {
		if (typeof patch.degree === 'number') degree = snapDegree(patch.degree);
	}

	onMount(() =>
		demos?.register('bias-variance', {
			set: (patch) => apply(patch as Partial<BiasVarianceDemoState>),
		}),
	);

	function onRangeInput(e: Event): void {
		degree = snapDegree(Number((e.currentTarget as HTMLInputElement).value));
	}

	/* ---- geometry: SVG is drawn at the real container width (no viewBox scaling) ---- */
	const FIT_H = 260;
	const CURVE_H = 260;
	const M = { top: 12, right: 14, bottom: 30, left: 40 };

	function polyline(pts: [number, number][]): string {
		return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
	}

	/* Fit plot: x in [0, 1], y in [-FIT_Y, FIT_Y]. */
	const fx = $derived((x: number) => M.left + x * Math.max(1, fitsW - M.left - M.right));
	const fy = (y: number) => M.top + ((FIT_Y - y) / (2 * FIT_Y)) * (FIT_H - M.top - M.bottom);

	/* Error plot: x = degree, y in [0, CURVE_Y_MAX] (clipped). */
	const cx = $derived(
		(k: number) =>
			M.left + ((k - DEG_MIN) / (DEG_MAX - DEG_MIN)) * Math.max(1, curveW - M.left - M.right),
	);
	const cy = (v: number) =>
		M.top + (1 - Math.min(v, CURVE_Y_MAX) / CURVE_Y_MAX) * (CURVE_H - M.top - M.bottom);

	const curvePath = (key: 'bias2' | 'variance' | 'sum') =>
		polyline(STATS.map((s) => [cx(s.degree), cy(s[key])] as [number, number]));

	const clipped = $derived(STATS.some((s) => s.sum > CURVE_Y_MAX));
	const fitBottom = $derived(FIT_H - M.bottom);
	const curveBottom = $derived(CURVE_H - M.bottom);

	function dim(entity: EntityId): boolean {
		return hl !== null && hl !== entity;
	}
</script>

<figure class="bv" id="demo-bias-variance" data-demo="bias-variance">
	<div class="bv-controls">
		<label class="bv-ctl">
			<span class="bv-label">Степень полинома <i>k</i></span>
			<input
				class="bv-range"
				type="range"
				min={DEG_MIN}
				max={DEG_MAX}
				step="1"
				value={degree}
				aria-label="Степень полинома k"
				aria-valuetext={`k = ${degree}`}
				oninput={onRangeInput}
			/>
			<output class="bv-k">k = {degree}</output>
		</label>
	</div>

	<div class="bv-plots">
		<div class="bv-panel" bind:clientWidth={fitsW}>
			<p class="bv-title">Подгонки на 40 выборках</p>
			<svg
				class="bv-svg"
				width={fitsW}
				height={FIT_H}
				role="img"
				aria-labelledby="bv-fit-title bv-fit-desc"
			>
				<title id="bv-fit-title">Полиномы степени {degree} на разных выборках</title>
				<desc id="bv-fit-desc"
					>Серые кривые — подгонки на отдельных выборках, толстая — средняя подгонка, пунктир —
					истинная функция sin(2πx), точки — одна выборка с шумом.</desc
				>
				<defs>
					<clipPath id="bv-clip-fit">
						<rect
							x={M.left}
							y={M.top}
							width={Math.max(0, fitsW - M.left - M.right)}
							height={fitBottom - M.top}
						/>
					</clipPath>
				</defs>
				{#each [-1, 0, 1] as t (t)}
					<line class="bv-grid" x1={M.left} x2={fitsW - M.right} y1={fy(t)} y2={fy(t)} />
					<text class="bv-tick" x={M.left - 6} y={fy(t)} dy="0.32em" text-anchor="end">{t}</text>
				{/each}
				{#each [0, 0.5, 1] as t (t)}
					<text class="bv-tick" x={fx(t)} y={fitBottom + 16} text-anchor="middle">{t}</text>
				{/each}
				<line class="bv-axis" x1={M.left} x2={fitsW - M.right} y1={fitBottom} y2={fitBottom} />
				<g clip-path="url(#bv-clip-fit)">
					{#each fits as row, t (t)}
						<path
							class="bv-cloud"
							d={polyline(drawGrid.map((x, g) => [fx(x), fy(row[g] ?? 0)] as [number, number]))}
						/>
					{/each}
					<path
						class="bv-true"
						d={polyline(trueCurve.map(([x, y]) => [fx(x), fy(y)] as [number, number]))}
					/>
					<path
						class="bv-mean"
						class:is-dim={dim('q')}
						d={polyline(drawGrid.map((x, g) => [fx(x), fy(meanFit[g] ?? 0)] as [number, number]))}
					/>
				</g>
				{#each sample.xs as x, i (i)}
					<circle class="bv-point" cx={fx(x)} cy={fy(sample.ys[i] ?? 0)} r="3" />
				{/each}
			</svg>
		</div>

		<div class="bv-panel" bind:clientWidth={curveW}>
			<p class="bv-title">Ошибка по степени</p>
			<ul class="bv-legend" aria-hidden="true">
				{#each SERIES as s, i (s.key)}
					<li class="bv-key" class:is-dim={dim(s.entity)} style:--c={`var(--cat-${i + 1})`}>
						<span class="bv-sw"></span>{s.label}
					</li>
				{/each}
			</ul>
			<svg
				class="bv-svg"
				width={curveW}
				height={CURVE_H}
				role="img"
				aria-labelledby="bv-curve-title bv-curve-desc"
			>
				<title id="bv-curve-title">Смещение², разброс и их сумма по степени полинома</title>
				<desc id="bv-curve-desc"
					>При росте степени смещение падает, разброс растёт. Текущая степень k = {degree}:
					смещение² {current?.bias2.toFixed(3)}, разброс {current?.variance.toFixed(3)}.</desc
				>
				<defs>
					<clipPath id="bv-clip-curve">
						<rect
							x={M.left}
							y={M.top}
							width={Math.max(0, curveW - M.left - M.right)}
							height={curveBottom - M.top}
						/>
					</clipPath>
				</defs>
				{#each [0, 0.5, 1] as v (v)}
					<line class="bv-grid" x1={M.left} x2={curveW - M.right} y1={cy(v)} y2={cy(v)} />
					<text class="bv-tick" x={M.left - 6} y={cy(v)} dy="0.32em" text-anchor="end">{v}</text>
				{/each}
				{#each degrees as k (k)}
					{#if k === 1 || k % 2 === 1}
						<text class="bv-tick" x={cx(k)} y={curveBottom + 16} text-anchor="middle">{k}</text>
					{/if}
				{/each}
				<line class="bv-axis" x1={M.left} x2={curveW - M.right} y1={curveBottom} y2={curveBottom} />
				<line class="bv-cur" x1={cx(degree)} x2={cx(degree)} y1={M.top} y2={curveBottom} />
				<g clip-path="url(#bv-clip-curve)">
					{#each SERIES as s, i (s.key)}
						<path
							class="bv-curve"
							class:is-dim={dim(s.entity)}
							style:--c={`var(--cat-${i + 1})`}
							d={curvePath(s.key)}
						/>
					{/each}
				</g>
				{#each SERIES as s, i (s.key)}
					{@const v = current?.[s.key] ?? 0}
					<circle
						class="bv-dot"
						class:is-dim={dim(s.entity)}
						style:--c={`var(--cat-${i + 1})`}
						cx={cx(degree)}
						cy={cy(v)}
						r="4"
					/>
				{/each}
			</svg>
			{#if clipped}
				<p class="bv-clip">Значения выше {CURVE_Y_MAX} обрезаны по высоте графика.</p>
			{/if}
		</div>
	</div>

	<p class="bv-note" aria-live="polite">
		{#if current}
			При k = {degree}: смещение² = {current.bias2.toFixed(3)}, разброс = {current.variance.toFixed(
				3,
			)}, сумма = {current.sum.toFixed(3)}. {regime}
		{/if}
	</p>
</figure>

<style>
	.bv {
		margin: 0;
		padding: var(--space-6) var(--space-8) var(--space-8);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.5;
		text-align: left;
	}
	.bv :global(*),
	.bv :global(*::before),
	.bv :global(*::after) {
		box-sizing: border-box;
	}
	.bv p,
	.bv ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Controls */
	.bv-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.bv-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.bv-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.bv-range {
		width: 200px;
		max-width: 100%;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.bv-k {
		min-width: 6ch;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* Plots */
	.bv-plots {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-6);
		padding-top: var(--space-4);
	}
	.bv-panel {
		min-width: 0;
	}
	.bv-title {
		margin-bottom: var(--space-2);
		color: var(--text-muted);
	}
	.bv-svg {
		display: block;
		max-width: 100%;
		overflow: visible;
	}
	.bv-grid {
		stroke: var(--border);
	}
	.bv-axis {
		stroke: var(--text-muted);
	}
	.bv-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.bv-cloud {
		fill: none;
		stroke: var(--cat-2);
		stroke-opacity: 0.14;
		stroke-width: 1;
	}
	.bv-true {
		fill: none;
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
	}
	.bv-mean {
		fill: none;
		stroke: var(--cat-1);
		stroke-width: 2.5;
		stroke-linejoin: round;
		transition: stroke-opacity var(--dur-fast) var(--ease);
	}
	.bv-point {
		fill: var(--text);
		fill-opacity: 0.75;
	}
	.bv-cur {
		stroke: var(--text-muted);
		stroke-dasharray: 3 3;
	}
	.bv-curve {
		fill: none;
		stroke: var(--c);
		stroke-width: 2;
		stroke-linejoin: round;
		transition: stroke-opacity var(--dur-fast) var(--ease);
	}
	.bv-dot {
		fill: var(--c);
		stroke: var(--surface);
		stroke-width: 1.5;
		transition: opacity var(--dur-fast) var(--ease);
	}
	.is-dim {
		opacity: 0.35;
	}

	/* Legend */
	.bv-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin-bottom: var(--space-2);
		color: var(--text);
	}
	.bv-key {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		transition: opacity var(--dur-fast) var(--ease);
	}
	.bv-sw {
		width: 14px;
		height: 3px;
		border-radius: 2px;
		background: var(--c);
	}
	.bv-key.is-dim {
		opacity: 0.35;
	}

	.bv-clip {
		margin-top: var(--space-1);
		color: var(--text-muted);
		font-size: 12px;
	}

	/* Readout */
	.bv-note {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		font-size: 14px;
	}

	@media (max-width: 720px) {
		.bv {
			padding: var(--space-4);
		}
		.bv-plots {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bv * {
			transition: none !important;
		}
	}
</style>
