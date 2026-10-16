<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { runSimulation } from '$lib/prob/simulate';
	import { toNumber } from '$lib/prob/rational';
	import type { ProblemDef, ProblemParams, Rational, SimulationState } from '$lib/prob/types';
	import { clampTrials, formatDecimal } from './format';
	import { frequencyMax, linePath, logTicks, xForTrials, yForFreq } from './chart';

	/** Monte-Carlo run of one problem: N trials, live convergence chart, text summary. */
	let {
		problem,
		params,
		exact,
		valid,
		paramsKey,
	}: {
		problem: ProblemDef;
		params: ProblemParams;
		exact: Record<string, Rational>;
		valid: boolean;
		/** Changes whenever the parameters change: a running experiment is then stopped. */
		paramsKey: string;
	} = $props();

	const MIN_N = 100;
	const MAX_N = 1_000_000;
	const WIDTH_FALLBACK = 640;
	const HEIGHT = 220;
	const PAD = { top: 12, right: 44, bottom: 30, left: 44 };

	let trialsInput = $state(10_000);
	let running = $state(false);
	let sim: SimulationState | null = $state(null);
	let width = $state(WIDTH_FALLBACK);
	let handle: { cancel(): void } | null = null;

	const questions = $derived(problem.questions);
	const exactValues = $derived(
		questions.map((q) => (exact[q.key] ? toNumber(exact[q.key] as Rational) : Number.NaN)),
	);
	const yMax = $derived(frequencyMax(exactValues));
	const axisMax = $derived(Math.max(MIN_N, trialsInput));
	const plotLeft = PAD.left;
	const plotRight = $derived(Math.max(PAD.left + 1, width - PAD.right));
	const plotTop = PAD.top;
	const plotBottom = HEIGHT - PAD.bottom;

	const toX = (t: number): number => xForTrials(t, axisMax, plotLeft, plotRight);
	const toY = (f: number): number => yForFreq(f, yMax, plotTop, plotBottom);
	const ticks = $derived(logTicks(axisMax));
	const yTicks = $derived([0, yMax / 2, yMax]);

	function stop(): void {
		handle?.cancel();
	}

	function start(): void {
		if (!valid || running) return;
		const n = clampTrials(trialsInput, MIN_N, MAX_N);
		trialsInput = n;
		const snapshot: ProblemParams = { ...params };
		running = true;
		sim = null;
		const run = runSimulation({
			trials: n,
			trial: (rng) => problem.trial(snapshot, rng),
			seed: Math.floor(Math.random() * 2 ** 31),
			chunk: 2000,
			onProgress: (state) => {
				if (handle === run) sim = state;
			},
		});
		handle = run;
		run.done.then((state) => {
			if (handle === run) {
				sim = state;
				running = false;
				handle = null;
			}
		});
	}

	// Parameters changed: a running or finished experiment belongs to the old numbers.
	$effect(() => {
		void paramsKey;
		untrack(() => {
			stop();
			running = false;
			handle = null;
			sim = null;
		});
	});

	onDestroy(stop);

	const summary = $derived(
		questions.map((q, i) => {
			const r = exact[q.key];
			const f = sim && sim.trials > 0 ? (sim.hits[q.key] ?? 0) / sim.trials : null;
			return {
				key: q.key,
				color: `var(--cat-${Math.min(i + 1, 6)})`,
				hasExact: Number.isFinite(exactValues[i] ?? Number.NaN),
				exactY: toY(exactValues[i] ?? 0),
				exactDec: r ? formatDecimal(r) : '—',
				freqText: f === null ? '—' : f.toFixed(4),
				path: linePath(sim?.series[q.key] ?? [], toX, toY),
			};
		}),
	);
</script>

<div class="ex" data-experiment>
	<div class="ex-controls">
		<label class="ex-n">
			<span>Испытаний (N)</span>
			<input
				type="number"
				min={MIN_N}
				max={MAX_N}
				step="100"
				inputmode="numeric"
				bind:value={trialsInput}
				disabled={running}
			/>
		</label>
		{#if running}
			<button type="button" class="ex-btn" onclick={stop}>Остановить</button>
		{:else}
			<button type="button" class="ex-btn ex-btn-primary" onclick={start} disabled={!valid}>
				Запустить
			</button>
		{/if}
		<progress
			class="ex-progress"
			max={axisMax}
			value={sim ? sim.trials : 0}
			aria-label="Прогресс эксперимента"
		></progress>
		<span class="ex-status" aria-live="polite">
			{#if sim}
				{sim.trials} из {axisMax}{running ? '' : ' · готово'}
			{:else if !valid}
				Исправьте параметры
			{:else}
				Симуляция не запущена
			{/if}
		</span>
	</div>

	<figure class="ex-fig" bind:clientWidth={width}>
		<svg
			{width}
			height={HEIGHT}
			viewBox={`0 0 ${width} ${HEIGHT}`}
			role="img"
			aria-label="График сходимости эмпирической доли к точному значению"
		>
			{#each yTicks as t (t)}
				<line class="ex-grid" x1={plotLeft} x2={plotRight} y1={toY(t)} y2={toY(t)} />
				<text class="ex-tick" x={plotLeft - 6} y={toY(t) + 4} text-anchor="end">{t.toFixed(2)}</text
				>
			{/each}
			{#each ticks as t (t)}
				<line class="ex-grid ex-grid-x" x1={toX(t)} x2={toX(t)} y1={plotTop} y2={plotBottom} />
				<text class="ex-tick" x={toX(t)} y={HEIGHT - 8} text-anchor="middle"
					>{t.toLocaleString('ru-RU')}</text
				>
			{/each}
			{#each summary as s (s.key)}
				{#if s.hasExact}
					<line
						class="ex-exact"
						style="stroke: {s.color}"
						x1={plotLeft}
						x2={plotRight}
						y1={s.exactY}
						y2={s.exactY}
					/>
				{/if}
				{#if s.path}
					<path class="ex-line" style="stroke: {s.color}" d={s.path} fill="none" />
				{/if}
			{/each}
		</svg>
		<figcaption class="ex-legend">
			{#each summary as s (s.key)}
				<span class="ex-legend-item">
					<span class="ex-swatch" style="background: {s.color}"></span>
					{s.key}) эмпирическая {s.freqText}, точная {s.exactDec}
				</span>
			{/each}
		</figcaption>
	</figure>
</div>

<style>
	.ex {
		display: grid;
		gap: var(--space-3);
		margin-block: var(--space-4);
	}
	.ex-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.ex-n {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.ex-n input {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--text);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-1) var(--space-2);
		width: 9ch;
	}
	.ex-btn {
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-1) var(--space-3);
		cursor: pointer;
	}
	.ex-btn-primary {
		color: var(--surface);
		background: var(--topic);
		border-color: var(--topic);
	}
	.ex-btn:disabled,
	.ex-n input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.ex-btn:focus-visible,
	.ex-n input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.ex-progress {
		flex: 1 1 120px;
		min-width: 100px;
		height: 8px;
		accent-color: var(--topic);
	}
	.ex-status {
		font-size: var(--fs-sm);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.ex-fig {
		margin: 0;
		min-width: 0;
	}
	.ex-fig svg {
		display: block;
		width: 100%;
		height: auto;
		background: var(--surface-2);
		border-radius: var(--radius);
	}
	.ex-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.ex-grid-x {
		stroke-dasharray: 2 4;
	}
	.ex-tick {
		font-size: 12px;
		fill: var(--text-muted);
		font-family: var(--font-mono);
	}
	.ex-line {
		stroke-width: 2;
	}
	.ex-exact {
		stroke-width: 1.5;
		stroke-dasharray: 6 4;
	}
	.ex-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-2);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.ex-legend-item {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-variant-numeric: tabular-nums;
	}
	.ex-swatch {
		width: 12px;
		height: 3px;
		border-radius: 2px;
	}
</style>
