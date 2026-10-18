<script lang="ts">
	import { getContext, onMount, untrack } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		KERNEL,
		SIGNAL,
		W_MAX,
		W_MIN,
		W_STEP,
		STEPS_MAX,
		STEPS_MIN,
		type ConvRnnDemoState,
		conv1dValid,
		describeConv,
		describeRnn,
		formatNum,
		gradientAt,
		gradientProfile,
		profileMax,
		snapKernelPos,
		snapSteps,
		snapT,
		snapW,
		validPositions,
	} from '$lib/demos/cnn-rnn';

	/** Convolution (top) and recurrent gradient decay (bottom). Registers itself as demo `cnn-rnn`. */
	let { initial }: { initial?: Partial<ConvRnnDemoState> } = $props();

	const OUT_COUNT = validPositions(SIGNAL.length, KERNEL.length);
	const COLS = SIGNAL.map((_, i) => i);
	const OUTPUT = conv1dValid(SIGNAL, KERNEL);
	const DEFAULTS: ConvRnnDemoState = { kernelPos: 0, w: 0.9, steps: 50, t: 0 };

	/** Start state: defaults overridden by `initial`. The demo owns the state afterwards. */
	function start(p: Partial<ConvRnnDemoState> | undefined): ConvRnnDemoState {
		const steps = snapSteps(p?.steps ?? DEFAULTS.steps);
		return {
			kernelPos: snapKernelPos(p?.kernelPos ?? DEFAULTS.kernelPos),
			w: snapW(p?.w ?? DEFAULTS.w),
			steps,
			t: snapT(p?.t ?? DEFAULTS.t, steps),
		};
	}

	const init = untrack(() => start(initial));
	let kernelPos = $state(init.kernelPos);
	let w = $state(init.w);
	let steps = $state(init.steps);
	let tRaw = $state(init.t);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	/** Step t is kept inside 0..T when T shrinks. */
	const t = $derived(snapT(tRaw, steps));
	const kPos = $derived(snapKernelPos(kernelPos));
	const profile = $derived(gradientProfile(w, steps));
	const scale = $derived(profileMax(profile));
	const gHere = $derived(gradientAt(w, steps, t));
	const convText = $derived(describeConv(kPos));
	const rnnText = $derived(describeRnn(w, steps, t));
	const readout = $derived(`${convText} ${rnnText}`);

	function apply(patch: Partial<ConvRnnDemoState>): void {
		const next = start({
			kernelPos: patch.kernelPos ?? kernelPos,
			w: patch.w ?? w,
			steps: patch.steps ?? steps,
			t: patch.t ?? t,
		});
		kernelPos = next.kernelPos;
		w = next.w;
		steps = next.steps;
		tRaw = next.t;
	}

	function reset(): void {
		apply(DEFAULTS);
	}

	onMount(() => {
		return demos?.register('cnn-rnn', {
			set: (patch) => apply(patch as Partial<ConvRnnDemoState>),
		});
	});
</script>

<figure class="cr" id="demo-cnn-rnn" data-demo="cnn-rnn" data-hl={hl ?? undefined}>
	<div class="cr-controls">
		<label class="cr-ctl">
			<span class="cr-label">Позиция ядра</span>
			<input
				class="cr-range"
				type="range"
				min="0"
				max={OUT_COUNT - 1}
				step="1"
				value={kPos}
				oninput={(e) => (kernelPos = snapKernelPos(Number(e.currentTarget.value)))}
			/>
			<output class="cr-val">{kPos + 1}</output>
		</label>

		<label class="cr-ctl">
			<span class="cr-label"><span class="cr-sym">w</span> (вес связи)</span>
			<input
				class="cr-range"
				type="range"
				min={W_MIN}
				max={W_MAX}
				step={W_STEP}
				value={w}
				oninput={(e) => (w = snapW(Number(e.currentTarget.value)))}
			/>
			<output class="cr-val">{formatNum(w)}</output>
		</label>

		<label class="cr-ctl">
			<span class="cr-label"><span class="cr-sym">T</span> (шагов)</span>
			<input
				class="cr-range"
				type="range"
				min={STEPS_MIN}
				max={STEPS_MAX}
				step="1"
				value={steps}
				oninput={(e) => (steps = snapSteps(Number(e.currentTarget.value)))}
			/>
			<output class="cr-val">{steps}</output>
		</label>

		<label class="cr-ctl">
			<span class="cr-label">Шаг <span class="cr-sym">t</span> (0 — начало)</span>
			<input
				class="cr-range"
				type="range"
				min="0"
				max={steps}
				step="1"
				value={t}
				oninput={(e) => (tRaw = snapT(Number(e.currentTarget.value), steps))}
			/>
			<output class="cr-val">{t}</output>
		</label>

		<button type="button" class="cr-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="cr-panel">
		<p class="cr-panel-t">Свёртка: ядро проходит по сигналу</p>
		<div class="cr-grid" role="img" aria-label="Сигнал, ядро и выход свёртки">
			<span class="cr-row-l">x</span>
			{#each COLS as i (i)}
				<span class="cr-cell" class:is-win={i >= kPos && i < kPos + KERNEL.length}>{SIGNAL[i]}</span
				>
			{/each}
			<span class="cr-row-l">ядро</span>
			{#each COLS as i (i)}
				<span class="cr-cell cr-k">
					{i >= kPos && i < kPos + KERNEL.length
						? String(KERNEL[i - kPos] ?? 0).replace('-', '−')
						: ''}
				</span>
			{/each}
			<span class="cr-row-l">y</span>
			{#each COLS as i (i)}
				<span
					class="cr-cell cr-out"
					class:is-cur={i === kPos}
					class:is-done={i < OUT_COUNT && i <= kPos}
				>
					{i < OUT_COUNT && i <= kPos ? formatNum(OUTPUT[i] ?? 0) : ''}
				</span>
			{/each}
		</div>
	</div>

	<div class="cr-panel">
		<p class="cr-panel-t">Рекуррентная сеть: градиент назад от конца цепочки</p>
		<div class="cr-bars" role="img" aria-label="Величина градиента на каждом шаге цепочки">
			{#each profile as g, i (i)}
				<span
					class="cr-bar"
					class:is-cur={i === t}
					style="height: {Math.max(2, (g / scale) * 100).toFixed(2)}%"
					title="шаг {i}: {formatNum(g)}"
				></span>
			{/each}
		</div>
		<div class="cr-axis">
			<span>шаг 0</span>
			<span>шаг {steps}</span>
		</div>
	</div>

	<dl class="cr-stats">
		<dt>Градиент на шаге t</dt>
		<dd>{formatNum(gHere)}</dd>
		<dt>Градиент в начале (t = 0)</dt>
		<dd>{formatNum(gradientAt(w, steps, 0))}</dd>
	</dl>

	<p class="cr-live" aria-live="polite">{readout}</p>

	<div class="cr-notice">
		<p class="cr-notice-t">Что заметить</p>
		<p>
			При w меньше 1 каждый шаг назад умножает градиент на w. При w = 0,9 и T = 50 градиент в начале
			цепочки около 0,005 от конечного. При w = 1,1 он растёт примерно до 117.
		</p>
	</div>
</figure>

<style>
	.cr {
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
	.cr :global(*),
	.cr :global(*::before),
	.cr :global(*::after) {
		box-sizing: border-box;
	}
	.cr dl,
	.cr dd,
	.cr dt,
	.cr p {
		margin: 0;
	}
	.cr button {
		font: inherit;
	}
	.cr-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.cr-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cr-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.cr-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cr-range {
		width: 130px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cr-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.cr-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.cr-range:focus-visible,
	.cr-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Convolution grid */
	.cr-panel {
		margin-top: var(--space-6);
	}
	.cr-panel-t {
		margin-bottom: var(--space-3);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.cr-grid {
		display: grid;
		grid-template-columns: 56px repeat(5, minmax(0, 1fr));
		gap: var(--space-1);
		align-items: stretch;
	}
	.cr-row-l {
		display: flex;
		align-items: center;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.cr-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 36px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}
	.cr-cell.is-win {
		border-color: var(--cat-1);
		background: color-mix(in srgb, var(--cat-1) 14%, var(--bg));
	}
	.cr-k {
		border-color: transparent;
		background: none;
		color: var(--cat-1);
	}
	.cr-out.is-done {
		color: var(--cat-3);
		font-weight: 600;
	}
	.cr-out.is-cur {
		border-color: var(--topic);
		box-shadow: inset 0 0 0 1px var(--topic);
	}

	/* Recurrent bars */
	.cr-bars {
		display: flex;
		align-items: flex-end;
		gap: 1px;
		height: 140px;
		padding: var(--space-2) var(--space-2) 0;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
		border-radius: var(--radius) var(--radius) 0 0;
	}
	.cr-bar {
		flex: 1 1 0;
		min-width: 0;
		background: var(--cat-1);
		opacity: 0.55;
		border-radius: 2px 2px 0 0;
		transition: height var(--dur) var(--ease);
	}
	.cr-bar.is-cur {
		background: var(--cat-2);
		opacity: 1;
	}
	.cr-axis {
		display: flex;
		justify-content: space-between;
		margin-top: var(--space-1);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	/* Readouts */
	.cr-stats {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.cr-stats dt {
		color: var(--text-muted);
	}
	.cr-stats dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.cr-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-size: 13px;
	}
	.cr-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--topic);
		background: var(--topic-soft);
		border-radius: var(--radius);
	}
	.cr-notice-t {
		margin-bottom: var(--space-1);
		font-weight: 600;
	}

	@media (prefers-reduced-motion: reduce) {
		.cr *,
		.cr *::before,
		.cr *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.cr {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.cr-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.cr-ctl {
			flex-wrap: wrap;
		}
		.cr-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.cr-grid {
			grid-template-columns: 44px repeat(5, minmax(0, 1fr));
		}
		.cr-cell {
			font-size: 12px;
		}
	}
</style>
