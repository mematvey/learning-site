<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		DEFAULT_STATE,
		GROWTH_NAMES,
		K_MAX,
		K_MIN,
		K_STEP,
		N_MAX,
		N_MIN,
		N_STEP,
		Y_MAX,
		applyPatch,
		cheaper,
		crossover,
		curvePoints,
		describeState,
		formatCount,
		operations,
		type ComplexityDemoState,
		type GrowthName,
	} from '$lib/demos/complexity';

	/** Growth-of-operations demo: four functions on one axis, slider n and constant K. Registers itself as demo `complexity`. */
	let { initial }: { initial?: Partial<ComplexityDemoState> } = $props();

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const START = applyPatch(DEFAULT_STATE, initial ?? {});

	let st = $state<ComplexityDemoState>({ ...START });
	/** Real width of the chart in px; the SVG is drawn at this width (no viewBox scaling). */
	let chartW = $state(0);

	const CHART_H = 220;
	const PAD = 12;
	/** Values above the frame are clipped; the path is clamped so the numbers stay printable. */
	const V_CLAMP = 2 * Y_MAX;

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const plotW = $derived(chartW >= 120 ? chartW : 320);
	const sx = (n: number) => PAD + ((n - N_MIN) / (N_MAX - N_MIN)) * (plotW - 2 * PAD);
	const sy = (v: number) => CHART_H - PAD - (Math.min(v, V_CLAMP) / Y_MAX) * (CHART_H - 2 * PAD);

	const LABEL: Record<GrowthName, string> = {
		linear: 'K · n',
		nlogn: 'n log₂ n',
		quadratic: 'n²',
		exponential: '2ⁿ',
	};
	const COLOR: Record<GrowthName, string> = {
		linear: 'var(--topic)',
		nlogn: 'var(--cat-3)',
		quadratic: 'var(--cat-2)',
		exponential: 'var(--cat-4)',
	};

	const paths = $derived(
		Object.fromEntries(
			GROWTH_NAMES.map((name) => [
				name,
				curvePoints(name, st.k)
					.map(([n, v], i) => `${i === 0 ? 'M' : 'L'}${sx(n).toFixed(1)} ${sy(v).toFixed(1)}`)
					.join(''),
			]),
		) as Record<GrowthName, string>,
	);

	const markX = $derived(sx(st.n));
	const crossX = $derived(sx(crossover(st.k)));
	const values = $derived(
		GROWTH_NAMES.map((name) => ({ name, label: LABEL[name], v: operations(name, st.n, st.k) })),
	);
	const who = $derived(cheaper(st.n, st.k));
	const note = $derived(describeState(st));
	const desc = $derived(
		`Число операций от n = ${N_MIN} до ${N_MAX}: K · n, n log₂ n, n² и 2ⁿ при K = ${st.k}. Маркер на n = ${st.n}.`,
	);

	function apply(patch: Partial<ComplexityDemoState>): void {
		st = applyPatch(st, patch);
	}

	function reset(): void {
		st = { ...START };
	}

	onMount(() =>
		demos?.register('complexity', {
			set: (patch) => apply(patch as Partial<ComplexityDemoState>),
		}),
	);
</script>

<figure class="cx" id="demo-complexity" data-demo="complexity" class:hl-q={hl === 'q'}>
	<div class="cx-controls">
		<label class="cx-ctl">
			<span class="cx-label"><span class="cx-sym">n</span> (размер входа)</span>
			<input
				class="cx-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step={N_STEP}
				value={st.n}
				oninput={(e) => apply({ n: Number(e.currentTarget.value) })}
			/>
			<output class="cx-val">{st.n}</output>
		</label>

		<label class="cx-ctl">
			<span class="cx-label"><span class="cx-sym">K</span> (константа K · n)</span>
			<input
				class="cx-range"
				type="range"
				min={K_MIN}
				max={K_MAX}
				step={K_STEP}
				value={st.k}
				oninput={(e) => apply({ k: Number(e.currentTarget.value) })}
			/>
			<output class="cx-val">{st.k}</output>
		</label>

		<button type="button" class="cx-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="cx-panel" bind:clientWidth={chartW}>
		<svg
			class="cx-svg"
			viewBox="0 0 {plotW} {CHART_H}"
			role="img"
			aria-labelledby="cx-title cx-desc"
		>
			<title id="cx-title">Число операций для четырёх функций роста</title>
			<desc id="cx-desc">{desc}</desc>
			<defs>
				<clipPath id="cx-clip">
					<rect x="0" y="0" width={plotW} height={CHART_H} />
				</clipPath>
			</defs>
			<line class="cx-axis" x1={PAD} x2={plotW - PAD} y1={CHART_H - PAD} y2={CHART_H - PAD} />
			<line class="cx-cross" x1={crossX} x2={crossX} y1={PAD} y2={CHART_H - PAD}>
				<title>пересечение K · n и n² при n = {crossover(st.k)}</title>
			</line>
			<g clip-path="url(#cx-clip)">
				{#each GROWTH_NAMES as name (name)}
					<path class="cx-curve" style:stroke={COLOR[name]} d={paths[name]} />
				{/each}
				{#each values as row (row.name)}
					<circle cx={markX.toFixed(1)} cy={sy(row.v).toFixed(1)} r="4" fill={COLOR[row.name]}>
						<title>{row.label}: {formatCount(row.v)}</title>
					</circle>
				{/each}
			</g>
			<line
				class="cx-marker"
				x1={markX.toFixed(1)}
				x2={markX.toFixed(1)}
				y1={PAD}
				y2={CHART_H - PAD}
			/>
		</svg>
		<ul class="cx-legend" aria-hidden="true">
			{#each GROWTH_NAMES as name (name)}
				<li><span class="cx-swatch" style:background={COLOR[name]}></span>{LABEL[name]}</li>
			{/each}
		</ul>
	</div>

	<dl class="cx-stats">
		<dt>Функция</dt>
		<dd class="cx-h">операций при n = {st.n}</dd>
		{#each values as row (row.name)}
			<dt>{row.label}</dt>
			<dd>{formatCount(row.v)}</dd>
		{/each}
		<dt>Пересечение K · n и n²</dt>
		<dd>n = {crossover(st.k)}</dd>
	</dl>

	<p class="cx-note" aria-live="polite">{note}</p>

	<div class="cx-notice">
		<p class="cx-h2">Что заметить</p>
		<ul>
			<li>
				Кривые при малом n близко друг к другу. 2ⁿ уходит за верх графика уже при n около 14, а n² и
				K · n остаются в пределах.
			</li>
			<li>
				При K = 100 квадратичный алгоритм дешевле линейного до n = 100. Константа сдвигает точку
				пересечения: она равна K.
			</li>
			<li>
				{#if who === 'quadratic'}
					Сейчас меньше операций у n²: выбор по одному замеру на маленьком входе может обмануть.
				{:else}
					Сейчас меньше операций у K · n: при больших n рост важнее константы.
				{/if}
			</li>
		</ul>
	</div>
</figure>

<style>
	.cx {
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
	.cx :global(*),
	.cx :global(*::before),
	.cx :global(*::after) {
		box-sizing: border-box;
	}
	.cx dl,
	.cx dd,
	.cx dt,
	.cx p,
	.cx ul {
		margin: 0;
	}
	.cx ul {
		padding-left: var(--space-4);
	}
	.cx button {
		font: inherit;
	}
	.cx-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.cx-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cx-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.cx-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cx-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cx-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.cx-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.cx-reset:focus-visible,
	.cx-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Chart */
	.cx-panel {
		margin-top: var(--space-6);
	}
	.cx-svg {
		display: block;
		width: 100%;
		height: 220px;
		overflow: visible;
	}
	.cx-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.6;
	}
	.cx-cross {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 4 3;
	}
	.cx-curve {
		fill: none;
		stroke-width: 2.5;
		stroke-linejoin: round;
	}
	.cx-marker {
		stroke: var(--text);
		stroke-width: 1;
		opacity: 0.6;
	}
	.cx-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-2);
		padding: 0;
		list-style: none;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.cx-legend li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.cx-swatch {
		display: inline-block;
		width: 12px;
		height: 3px;
		border-radius: 2px;
	}

	/* Statistics */
	.cx-stats {
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
	.cx-stats dt {
		color: var(--text-muted);
	}
	.cx-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
		overflow-wrap: anywhere;
	}
	.cx-h {
		font-family: var(--font-sans);
	}
	.cx-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* What to notice */
	.cx-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.cx-h2 {
		margin-bottom: var(--space-1);
		font-family: var(--font-serif);
		font-weight: 600;
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.cx.hl-q .cx-stats {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.cx *,
		.cx *::before,
		.cx *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.cx {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.cx-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.cx-ctl {
			flex-wrap: wrap;
		}
		.cx-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
