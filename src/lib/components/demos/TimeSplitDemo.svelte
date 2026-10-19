<script lang="ts">
	import {
		MODE_LABELS,
		MODE_NOTES,
		N,
		N_SPLITS,
		SERIES,
		SPLIT_MODES,
		clampFold,
		describeSplit,
		fitLine,
		isSplitMode,
		modeMae,
		rangeText,
		scoreSplit,
		splitFor,
		type SplitMode,
		type TimeSplitDemoState,
	} from '$lib/demos/time-series-validation';

	/** Random, time-ordered and sliding-window splits of a 12-point series. Registers no context. */
	let { initial }: { initial?: Partial<TimeSplitDemoState> } = $props();

	const start: TimeSplitDemoState = {
		mode: isSplitMode(initial?.mode) ? initial.mode : 'random',
		fold: clampFold(initial?.fold ?? 1),
	};

	let mode = $state<SplitMode>(start.mode);
	let fold = $state(start.fold);
	/** Real width of the chart in px; the SVG is drawn at this width (no viewBox scaling). */
	let width = $state(0);

	const H = 180;
	const PAD = 16;
	/** Fixed vertical range of the chart, so the picture does not jump between splits. */
	const Y_MIN = 8;
	const Y_MAX = 22;

	const split = $derived(splitFor(mode, fold));
	const score = $derived(scoreSplit(split));
	const line = $derived(fitLine(split.train));
	const overall = $derived(modeMae(mode));
	const plotW = $derived(width >= 200 ? width : 320);
	const announce = $derived(describeSplit(mode, fold));
	const trainText = $derived(rangeText(split.train));
	const testText = $derived(rangeText(split.test));

	function xOf(i: number): number {
		return PAD + (i * (plotW - 2 * PAD)) / (N - 1);
	}

	function yOf(v: number): number {
		return H - PAD - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * (H - 2 * PAD);
	}

	function roleOf(i: number): 'train' | 'test' | 'none' {
		if (split.test.includes(i)) return 'test';
		if (split.train.includes(i)) return 'train';
		return 'none';
	}

	function nextFold(): void {
		fold = (fold % N_SPLITS) + 1;
	}

	function reset(): void {
		mode = start.mode;
		fold = start.fold;
	}
</script>

<figure class="ts" id="demo-time-series-split" data-demo="time-series-split">
	<div class="ts-controls">
		<div class="ts-group" role="group" aria-label="Способ разбиения">
			{#each SPLIT_MODES as m (m)}
				<button type="button" class="ts-seg" aria-pressed={mode === m} onclick={() => (mode = m)}
					>{MODE_LABELS[m]}</button
				>
			{/each}
		</div>

		<div class="ts-group" role="group" aria-label="Номер разбиения">
			{#each Array.from({ length: N_SPLITS }, (_, k) => k + 1) as k (k)}
				<button type="button" class="ts-seg" aria-pressed={fold === k} onclick={() => (fold = k)}
					>{k}</button
				>
			{/each}
		</div>
	</div>

	<div class="ts-plot" bind:clientWidth={width}>
		<svg class="ts-svg" viewBox="0 0 {plotW} {H}" role="img" aria-labelledby="ts-title ts-desc">
			<title id="ts-title">Ряд из двенадцати точек с разбиением на обучение и тест</title>
			<desc id="ts-desc">{announce}</desc>
			<polyline
				class="ts-series"
				points={SERIES.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')}
			/>
			<line
				class="ts-fit"
				x1={xOf(0).toFixed(1)}
				x2={xOf(N - 1).toFixed(1)}
				y1={yOf(line.a).toFixed(1)}
				y2={yOf(line.a + line.b * (N - 1)).toFixed(1)}
			/>
			{#each score.points as p (p.t)}
				<line
					class="ts-err"
					x1={xOf(p.t).toFixed(1)}
					x2={xOf(p.t).toFixed(1)}
					y1={yOf(p.actual).toFixed(1)}
					y2={yOf(p.pred).toFixed(1)}
				/>
				<rect
					class="ts-pred"
					x={(xOf(p.t) - 4).toFixed(1)}
					y={(yOf(p.pred) - 4).toFixed(1)}
					width="8"
					height="8"
				>
					<title>точка {p.t}: прогноз {p.pred.toFixed(2)}, факт {p.actual}</title>
				</rect>
			{/each}
			{#each SERIES as v, i (i)}
				<circle class="ts-pt ts-{roleOf(i)}" cx={xOf(i).toFixed(1)} cy={yOf(v).toFixed(1)} r="5">
					<title>точка {i}: {v}</title>
				</circle>
			{/each}
		</svg>
	</div>

	<div class="ts-strip" aria-hidden="true">
		{#each [...SERIES.keys()] as i (i)}
			<div class="ts-cell ts-{roleOf(i)}">{i}</div>
		{/each}
	</div>

	<ul class="ts-legend" aria-hidden="true">
		<li><span class="ts-key ts-train"></span>обучение</li>
		<li><span class="ts-key ts-test"></span>тест</li>
		<li><span class="ts-key ts-pred-key"></span>прогноз</li>
	</ul>

	<dl class="ts-stats">
		<dt>Обучение</dt>
		<dd>точки {trainText}</dd>
		<dt>Тест</dt>
		<dd>точки {testText}</dd>
		<dt>Средняя ошибка на тесте</dt>
		<dd>{score.mae.toFixed(2)}</dd>
	</dl>

	<div class="ts-compare">
		<p class="ts-compare-t">Средняя ошибка по трём разбиениям</p>
		<ul>
			{#each SPLIT_MODES as m (m)}
				<li class:is-current={m === mode}>
					<span>{MODE_LABELS[m]}</span>
					<span class="ts-mono">{modeMae(m).toFixed(2)}</span>
				</li>
			{/each}
		</ul>
		<p class="ts-muted">Выбрано: {MODE_LABELS[mode].toLowerCase()}, {overall.toFixed(2)}.</p>
	</div>

	<p class="ts-note" aria-live="polite">{MODE_NOTES[mode]}</p>
	<p class="ts-sr" aria-live="polite">{announce}</p>

	<div class="ts-actions">
		<button type="button" class="ts-btn" onclick={nextFold}>Следующее разбиение</button>
		<button type="button" class="ts-btn ts-btn-ghost" onclick={reset}>Сбросить</button>
	</div>

	<p class="ts-look">
		<strong>Что заметить:</strong> случайное разбиение даёт самую маленькую ошибку, хотя модель та же.
		Её тест стоит между точками, которые модель уже видела справа и слева. Переключите режим и сравните
		строку «Средняя ошибка».
	</p>
</figure>

<style>
	.ts {
		position: relative;
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
	.ts :global(*),
	.ts :global(*::before),
	.ts :global(*::after) {
		box-sizing: border-box;
	}
	.ts dl,
	.ts dd,
	.ts dt,
	.ts p,
	.ts ul {
		margin: 0;
		padding: 0;
	}
	.ts ul {
		list-style: none;
	}
	.ts button {
		font: inherit;
	}
	.ts-muted {
		color: var(--text-muted);
	}
	.ts-mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	/* Visually hidden, read by screen readers through aria-live. */
	.ts-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* Controls */
	.ts-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ts-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.ts-seg {
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
	.ts-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.ts-seg:focus-visible,
	.ts-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Chart */
	.ts-plot {
		margin-top: var(--space-6);
	}
	.ts-svg {
		display: block;
		width: 100%;
		height: 180px;
		overflow: visible;
	}
	.ts-series {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
		opacity: 0.6;
	}
	.ts-fit {
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.ts-err {
		stroke: var(--cat-3);
		stroke-width: 2;
	}
	.ts-pred {
		fill: var(--surface);
		stroke: var(--text);
		stroke-width: 1.5;
	}
	.ts-pt {
		stroke: var(--surface);
		stroke-width: 1.5;
		transition: fill var(--dur) var(--ease);
	}
	.ts-pt.ts-train,
	.ts-cell.ts-train,
	.ts-key.ts-train {
		fill: var(--cat-1);
		background: var(--cat-1);
	}
	.ts-pt.ts-test,
	.ts-cell.ts-test,
	.ts-key.ts-test {
		fill: var(--cat-3);
		background: var(--cat-3);
	}
	.ts-pt.ts-none {
		fill: var(--text-muted);
		opacity: 0.35;
	}
	.ts-key.ts-pred-key {
		background: var(--surface);
		border: 1.5px solid var(--text);
	}

	/* Strip of indices */
	.ts-strip {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 3px;
		margin-top: var(--space-2);
	}
	.ts-cell {
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.ts-cell.ts-train,
	.ts-cell.ts-test {
		color: var(--surface);
		font-weight: 600;
	}
	.ts-cell.ts-none {
		color: var(--text-muted);
	}

	.ts-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}
	.ts-legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.ts-key {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	/* Stats and comparison */
	.ts-stats {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.ts-stats dt {
		color: var(--text-muted);
	}
	.ts-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.ts-compare {
		margin-top: var(--space-6);
	}
	.ts-compare-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.ts-compare li {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
	}
	.ts-compare li.is-current {
		background: var(--surface-2);
		color: var(--text);
		font-weight: 600;
	}
	.ts-compare p {
		margin-top: var(--space-2);
		font-size: 13px;
	}

	.ts-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.ts-look {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}

	.ts-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-6);
	}
	.ts-btn {
		min-height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--topic);
		border-radius: var(--radius);
		background: var(--topic);
		color: var(--surface);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.ts-btn-ghost {
		background: none;
		color: var(--topic);
	}

	@media (prefers-reduced-motion: reduce) {
		.ts *,
		.ts *::before,
		.ts *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.ts {
			padding: var(--space-4);
		}
		.ts-cell {
			font-size: 11px;
			height: 24px;
		}
		.ts-stats {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
