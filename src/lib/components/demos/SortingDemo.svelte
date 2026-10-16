<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		ALGO_INFO,
		DEFAULT_STATE,
		DEMO_ALGOS,
		N_MAX,
		N_MIN,
		VALUE_MAX,
		applyState,
		clampStep,
		makeArray,
		sortedArray,
		targetCount,
		targetValue,
		traceBinarySearch,
		traceSort,
		type DemoAlgo,
		type SortingDemoState,
	} from '$lib/demos/sorting-searching';

	/** Sorting and binary search demo on a generated array. Registers itself as demo `sorting-searching`. */
	let { initial }: { initial?: Partial<SortingDemoState> } = $props();

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const START = applyState(DEFAULT_STATE, initial ?? {});

	/* The props only seed the initial state: the demo owns it afterwards. */
	let algo = $state<DemoAlgo>(START.algo);
	let n = $state(START.n);
	let seed = $state(START.seed);
	let step = $state(START.step);
	let target = $state(START.target);
	let playing = $state(false);

	/* Chart geometry in SVG units (the SVG is drawn at this size, scaled by CSS). */
	const W = 360;
	const H = 200;
	const BASE = H - 26;
	const MAX_BAR = BASE - 26;
	const STEP_MS = 700;

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const isSearch = $derived(algo === 'binary');
	const input = $derived(makeArray(seed, n));
	const sorted = $derived(sortedArray(seed, n));
	const searchValue = $derived(targetValue(sorted, target));
	const sortTrace = $derived(
		isSearch ? null : traceSort(algo as Exclude<DemoAlgo, 'binary'>, input),
	);
	const searchTrace = $derived(isSearch ? traceBinarySearch(sorted, searchValue) : null);
	const total = $derived(sortTrace ? sortTrace.steps.length : (searchTrace?.steps.length ?? 1));
	const cur = $derived(clampStep(step, total));
	const sortStep = $derived(sortTrace?.steps[cur] ?? null);
	const searchStep = $derived(searchTrace?.steps[cur] ?? null);
	const info = $derived(ALGO_INFO[algo]);

	/** Bars of the current frame: heights are proportional to the value, the scale is fixed at VALUE_MAX. */
	const bars = $derived.by(() => {
		const arr = isSearch ? sorted : (sortStep?.array ?? input);
		const slot = W / arr.length;
		return arr.map((v, i) => {
			const h = (v / VALUE_MAX) * MAX_BAR;
			let cls = 'sd-idle';
			if (isSearch) {
				const s = searchStep;
				if (!s || i < s.lo || i > s.hi) cls = 'sd-out';
				else if (s.found === i) cls = 'sd-found';
				else if (s.mid === i) cls = 'sd-active';
			} else if (sortStep) {
				if (sortStep.fixed.includes(i)) cls = 'sd-fixed';
				else if (sortStep.pivot === i) cls = 'sd-pivot';
				else if (sortStep.active.includes(i)) cls = 'sd-active';
			}
			return {
				i,
				v,
				x: i * slot + slot * 0.15,
				w: slot * 0.7,
				y: BASE - h,
				h,
				cls,
				cx: i * slot + slot / 2,
			};
		});
	});

	const stepText = $derived(isSearch ? (searchStep?.text ?? '') : (sortStep?.text ?? ''));
	const comparisons = $derived(
		isSearch ? (searchStep?.comparisons ?? 0) : (sortStep?.comparisons ?? 0),
	);
	const moves = $derived(sortStep?.moves ?? 0);
	const fullComparisons = $derived(
		isSearch ? (searchTrace?.comparisons ?? 0) : (sortTrace?.comparisons ?? 0),
	);
	const fullMoves = $derived(sortTrace?.moves ?? 0);

	const note = $derived(`Шаг ${cur + 1} из ${total}. ${stepText}`);
	const descChart = $derived(
		isSearch
			? `Отсортированный массив из ${n} чисел. Ищем ${searchValue}. ${stepText}`
			: `Массив из ${n} чисел, алгоритм «${info.label}». ${stepText}`,
	);

	/** Search target as text: integers are present in the array, values ending in .5 are absent. */
	const targetLabel = $derived(String(searchValue));

	function setAlgo(a: DemoAlgo): void {
		algo = a;
		step = 0;
		playing = false;
	}

	function setN(v: number): void {
		const s = applyState({ algo, n, seed, step, target }, { n: v });
		n = s.n;
		target = s.target;
		step = 0;
		playing = false;
	}

	function newArray(): void {
		seed += 1;
		step = 0;
		playing = false;
	}

	function apply(patch: Partial<SortingDemoState>): void {
		const s = applyState({ algo, n, seed, step, target }, patch);
		algo = s.algo;
		n = s.n;
		seed = s.seed;
		target = s.target;
		step = s.step;
		playing = false;
	}

	function reset(): void {
		algo = START.algo;
		n = START.n;
		seed = START.seed;
		target = START.target;
		step = START.step;
		playing = false;
	}

	function prev(): void {
		playing = false;
		step = Math.max(0, cur - 1);
	}

	function next(): void {
		playing = false;
		step = Math.min(total - 1, cur + 1);
	}

	function togglePlay(): void {
		if (!playing && cur >= total - 1) step = 0;
		playing = !playing;
	}

	$effect(() => {
		if (!playing) return;
		const id = setInterval(() => {
			if (step >= total - 1) {
				playing = false;
				return;
			}
			step += 1;
		}, STEP_MS);
		return () => clearInterval(id);
	});

	onMount(() =>
		demos?.register('sorting-searching', {
			set: (patch) => apply(patch as Partial<SortingDemoState>),
		}),
	);
</script>

<figure
	class="sd"
	id="demo-sorting-searching"
	data-demo="sorting-searching"
	class:hl-q={hl === 'q'}
>
	<div class="sd-controls">
		<div class="sd-group" role="group" aria-label="Алгоритм">
			{#each DEMO_ALGOS as a (a)}
				<button type="button" class="sd-seg" aria-pressed={algo === a} onclick={() => setAlgo(a)}
					>{ALGO_INFO[a].label}</button
				>
			{/each}
		</div>

		<label class="sd-ctl">
			<span class="sd-label"><span class="sd-sym">n</span> (размер)</span>
			<input
				class="sd-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step="1"
				value={n}
				oninput={(e) => setN(Number(e.currentTarget.value))}
			/>
			<output class="sd-val">{n}</output>
		</label>

		{#if isSearch}
			<label class="sd-ctl">
				<span class="sd-label">искомое</span>
				<input
					class="sd-range"
					type="range"
					min="0"
					max={targetCount(n) - 1}
					step="1"
					value={target}
					oninput={(e) => {
						target = Number(e.currentTarget.value);
						step = 0;
						playing = false;
					}}
				/>
				<output class="sd-val">{targetLabel}</output>
			</label>
		{/if}

		<div class="sd-actions">
			<button type="button" class="sd-btn" onclick={newArray}>Другой массив</button>
			<button type="button" class="sd-btn" onclick={reset}>Сбросить</button>
		</div>
	</div>

	<div class="sd-player">
		<button type="button" class="sd-btn" onclick={prev} disabled={cur === 0}>Назад</button>
		<button type="button" class="sd-btn sd-play" onclick={togglePlay} aria-pressed={playing}>
			{playing ? 'Пауза' : 'Играть'}
		</button>
		<button type="button" class="sd-btn" onclick={next} disabled={cur >= total - 1}>Далее</button>
		<label class="sd-step">
			<span class="sd-label">Шаг</span>
			<input
				class="sd-range"
				type="range"
				min="0"
				max={Math.max(0, total - 1)}
				step="1"
				value={cur}
				oninput={(e) => {
					step = Number(e.currentTarget.value);
					playing = false;
				}}
			/>
			<output class="sd-val">{cur + 1} / {total}</output>
		</label>
	</div>

	<div class="sd-chart">
		<svg class="sd-svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="sd-title sd-desc">
			<title id="sd-title">Столбцы значений массива на текущем шаге</title>
			<desc id="sd-desc">{descChart}</desc>
			<line class="sd-base" x1="0" x2={W} y1={BASE} y2={BASE} />
			{#each bars as b (b.i)}
				<rect
					class="sd-bar {b.cls}"
					x={b.x.toFixed(1)}
					y={b.y.toFixed(1)}
					width={b.w.toFixed(1)}
					height={b.h.toFixed(1)}
				>
					<title>a[{b.i}] = {b.v}</title>
				</rect>
				<text class="sd-val-label" x={b.cx.toFixed(1)} y={(b.y - 5).toFixed(1)}>{b.v}</text>
				<text class="sd-tick" x={b.cx.toFixed(1)} y={H - 6}>{b.i}</text>
			{/each}
		</svg>
		<ul class="sd-legend" aria-hidden="true">
			{#if isSearch}
				<li><span class="sd-key sd-key-active"></span>середина диапазона</li>
				<li><span class="sd-key sd-key-found"></span>найдено</li>
				<li><span class="sd-key sd-key-out"></span>вне диапазона</li>
			{:else}
				<li><span class="sd-key sd-key-active"></span>сравнение или запись</li>
				<li><span class="sd-key sd-key-pivot"></span>опорный или ключ</li>
				<li><span class="sd-key sd-key-fixed"></span>на месте</li>
			{/if}
		</ul>
	</div>

	<dl class="sd-stats">
		<dt>Величина</dt>
		<dd class="sd-h">текущий шаг</dd>
		<dt>Сравнения</dt>
		<dd>{comparisons} из {fullComparisons}</dd>
		{#if !isSearch}
			<dt>Перестановки и записи</dt>
			<dd>{moves} из {fullMoves}</dd>
		{/if}
		<dt>Худший случай</dt>
		<dd>{info.worst}</dd>
		<dt>В среднем</dt>
		<dd>{info.average}</dd>
		<dt>Дополнительная память</dt>
		<dd>{info.extraMemory}</dd>
		<dt>Устойчивость</dt>
		<dd>{info.stable ? 'да' : 'нет'}</dd>
	</dl>

	<p class="sd-note" aria-live="polite">{note}</p>

	<div class="sd-notice">
		<p class="sd-h2">Что заметить</p>
		<ul>
			<li>
				Вставки на уже отсортированном массиве делают n − 1 сравнение, на обратном: n(n − 1)/2.
			</li>
			<li>
				Слияние делает примерно n log n сравнений при любом порядке, но ему нужен буфер размера n.
			</li>
			<li>
				Быстрая сортировка с опорным элементом на краю на отсортированном входе деградирует до n(n −
				1)/2 сравнений.
			</li>
			<li>
				Бинарный поиск делает не больше log₂ n + 1 сравнений, но работает только на отсортированном
				массиве.
			</li>
		</ul>
	</div>
</figure>

<style>
	.sd {
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
	.sd :global(*),
	.sd :global(*::before),
	.sd :global(*::after) {
		box-sizing: border-box;
	}
	.sd dl,
	.sd dd,
	.sd dt,
	.sd p,
	.sd ul {
		margin: 0;
	}
	.sd ul {
		padding-left: var(--space-4);
	}
	.sd button {
		font: inherit;
	}
	.sd-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.sd-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.sd-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.sd-seg,
	.sd-btn {
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
	.sd-btn {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.sd-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.sd-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.sd-play[aria-pressed='true'] {
		background: var(--topic-soft);
	}
	.sd-seg:focus-visible,
	.sd-btn:focus-visible,
	.sd-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.sd-ctl,
	.sd-step {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.sd-actions,
	.sd-player {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.sd-player {
		margin-top: var(--space-4);
	}
	.sd-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.sd-range {
		width: 140px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.sd-step .sd-range {
		width: 180px;
	}
	.sd-val {
		min-width: 5ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Chart */
	.sd-chart {
		margin-top: var(--space-6);
	}
	.sd-svg {
		display: block;
		width: 100%;
		height: 200px;
		overflow: visible;
	}
	.sd-base {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.sd-bar {
		transition:
			fill var(--dur) var(--ease),
			opacity var(--dur) var(--ease);
	}
	.sd-idle {
		fill: var(--text-muted);
		opacity: 0.4;
	}
	.sd-active {
		fill: var(--cat-2);
		opacity: 1;
	}
	.sd-pivot {
		fill: var(--topic);
		opacity: 1;
	}
	.sd-fixed {
		fill: var(--ok);
		opacity: 0.75;
	}
	.sd-found {
		fill: var(--ok);
		opacity: 1;
	}
	.sd-out {
		fill: var(--text-muted);
		opacity: 0.12;
	}
	.sd-val-label {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 10px;
		text-anchor: middle;
		font-variant-numeric: tabular-nums;
	}
	.sd-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
		text-anchor: middle;
	}
	.sd-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-2);
		padding: 0;
		list-style: none;
		color: var(--text-muted);
		font-size: 12px;
	}
	.sd-legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.sd-key {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
	.sd-key-active {
		background: var(--cat-2);
	}
	.sd-key-pivot {
		background: var(--topic);
	}
	.sd-key-fixed {
		background: var(--ok);
	}
	.sd-key-found {
		background: var(--ok);
	}
	.sd-key-out {
		background: var(--text-muted);
		opacity: 0.3;
	}

	/* Statistics */
	.sd-stats {
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
	.sd-stats dt {
		color: var(--text-muted);
	}
	.sd-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.sd-h {
		font-family: var(--font-sans);
	}
	.sd-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* What to notice */
	.sd-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.sd-h2 {
		margin-bottom: var(--space-1);
		font-family: var(--font-serif);
		font-weight: 600;
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.sd.hl-q .sd-stats {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.sd *,
		.sd *::before,
		.sd *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.sd {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.sd-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.sd-ctl,
		.sd-step {
			flex-wrap: wrap;
		}
		.sd-range,
		.sd-step .sd-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
