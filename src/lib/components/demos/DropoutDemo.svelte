<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DEFAULT_P,
		DEFAULT_STEP,
		DEFAULT_WD,
		EPOCHS,
		N_NEURONS,
		P_MAX,
		P_MIN,
		P_STEP,
		WD_MAX,
		WD_MIN,
		WD_STEP,
		type DropoutDemoState,
		bestEpoch,
		describeState,
		trainLoss,
		valLoss,
		dropoutMask,
		keepScale,
		lossCurves,
		snapP,
		snapStep,
		snapWd,
	} from '$lib/demos/regularization-dl';

	/** Dropout and weight decay demo: one layer's mask and training / validation curves. Registers itself as demo `regularization-dl`. */
	let { initial }: { initial?: Partial<DropoutDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let p = $state(snapP(initial?.p ?? DEFAULT_P));
	/* svelte-ignore state_referenced_locally */
	let wd = $state(snapWd(initial?.wd ?? DEFAULT_WD));
	/* svelte-ignore state_referenced_locally */
	let step = $state(snapStep(initial?.step ?? DEFAULT_STEP));
	/** Real widths of the two plots in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wNeurons = $state(0);
	let wCurves = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const keep = $derived(dropoutMask(N_NEURONS, p, step));
	const scale = $derived(keepScale(p));
	const curves = $derived(lossCurves(p, wd));
	const best = $derived(bestEpoch(curves.val));
	const note = $derived(describeState({ p, wd, step }));
	const dropped = $derived(keep.filter((k) => !k).length);

	/** Plot sizes in px; 480 until the first measurement. */
	const plotWN = $derived(wNeurons >= 120 ? wNeurons : 480);
	const plotWC = $derived(wCurves >= 160 ? wCurves : 480);
	const CH = 200;
	const M = { l: 36, r: 12, t: 12, b: 26 };
	const Y_MAX = 1.3;

	const xOf = (t: number) => M.l + (t / EPOCHS) * (plotWC - M.l - M.r);
	const yOf = (v: number) => M.t + (1 - Math.min(v, Y_MAX) / Y_MAX) * (CH - M.t - M.b);
	const pathOf = (vals: readonly number[]) =>
		vals.map((v, t) => `${t === 0 ? 'M' : 'L'}${xOf(t).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' ');
	const trainPath = $derived(pathOf(curves.train));
	const valPath = $derived(pathOf(curves.val));
	const bestX = $derived(xOf(best).toFixed(1));
	const yTicks = [0, 0.5, 1];
	const xTicks = [0, 20, 40, 60];

	function apply(patch: Partial<DropoutDemoState>): void {
		if (typeof patch.p === 'number') p = snapP(patch.p);
		if (typeof patch.wd === 'number') wd = snapWd(patch.wd);
		if (typeof patch.step === 'number') step = snapStep(patch.step);
	}

	function reset(): void {
		p = DEFAULT_P;
		wd = DEFAULT_WD;
		step = DEFAULT_STEP;
	}

	onMount(() => {
		return demos?.register('regularization-dl', {
			set: (patch) => apply(patch as Partial<DropoutDemoState>),
		});
	});
</script>

<figure class="dd" id="demo-regularization-dl" data-demo="regularization-dl">
	<div class="dd-controls">
		<label class="dd-ctl">
			<span class="dd-label"><span class="dd-sym">p</span> (доля выключенных)</span>
			<input
				class="dd-range"
				type="range"
				min={P_MIN}
				max={P_MAX}
				step={P_STEP}
				value={p}
				oninput={(e) => (p = snapP(Number(e.currentTarget.value)))}
			/>
			<output class="dd-val">{p.toFixed(1)}</output>
		</label>

		<label class="dd-ctl">
			<span class="dd-label"><span class="dd-sym">λ</span> (затухание весов)</span>
			<input
				class="dd-range"
				type="range"
				min={WD_MIN}
				max={WD_MAX}
				step={WD_STEP}
				value={wd}
				oninput={(e) => (wd = snapWd(Number(e.currentTarget.value)))}
			/>
			<output class="dd-val">{wd.toFixed(2)}</output>
		</label>

		<div class="dd-buttons">
			<button type="button" class="dd-btn" onclick={() => (step += 1)}>Следующая маска</button>
			<button type="button" class="dd-btn dd-btn-ghost" onclick={reset}>Сбросить</button>
		</div>
	</div>

	<div class="dd-panel" bind:clientWidth={wNeurons}>
		<p class="dd-panel-t">Слой нейронов: шаг {step + 1}</p>
		<svg
			class="dd-svg dd-neurons"
			viewBox="0 0 {plotWN} 76"
			role="img"
			aria-labelledby="dd-neurons-title dd-neurons-desc"
		>
			<title id="dd-neurons-title">Маска dropout на одном шаге</title>
			<desc id="dd-neurons-desc">
				Выключено {dropped} из {N_NEURONS} нейронов. Оставшиеся умножаются на {scale.toFixed(2)}.
			</desc>
			{#each keep as k, i (i)}
				{@const cx = ((i + 0.5) * plotWN) / N_NEURONS}
				<g class="dd-node" class:is-dropped={!k}>
					<circle cx={cx.toFixed(1)} cy="34" r="13" class="dd-circle" />
					{#if !k}
						<text class="dd-cross" x={cx.toFixed(1)} y="39">×</text>
					{/if}
				</g>
			{/each}
		</svg>
		<p class="dd-caption">
			Выключенные нейроны не участвуют в этом шаге. Оставшиеся умножаются на
			<span class="dd-mono">1/(1 − p) = {scale.toFixed(2)}</span>.
		</p>
	</div>

	<div class="dd-panel" bind:clientWidth={wCurves}>
		<p class="dd-panel-t">Ошибка по эпохам</p>
		<svg
			class="dd-svg"
			viewBox="0 0 {plotWC} {CH}"
			role="img"
			aria-labelledby="dd-curves-title dd-curves-desc"
		>
			<title id="dd-curves-title">Кривые ошибки на обучении и валидации</title>
			<desc id="dd-curves-desc">
				Минимум ошибки на валидации на эпохе {best}. Ошибка на обучении на последней эпохе:
				{trainLoss(EPOCHS, p, wd).toFixed(2)}, на валидации: {valLoss(EPOCHS, p, wd).toFixed(2)}.
			</desc>
			{#each yTicks as v (v)}
				<line class="dd-grid" x1={M.l} x2={plotWC - M.r} y1={yOf(v)} y2={yOf(v)} />
				<text class="dd-tick" x={M.l - 6} y={yOf(v) + 4} text-anchor="end">{v.toFixed(1)}</text>
			{/each}
			{#each xTicks as t (t)}
				<text class="dd-tick" x={xOf(t)} y={CH - 6} text-anchor="middle">{t}</text>
			{/each}
			<line class="dd-best" x1={bestX} x2={bestX} y1={M.t} y2={CH - M.b} />
			<text class="dd-best-t" x={Number(bestX) + 4} y={M.t + 10}>ранняя остановка</text>
			<path class="dd-line dd-line-train" d={trainPath} fill="none" />
			<path class="dd-line dd-line-val" d={valPath} fill="none" />
		</svg>
		<p class="dd-legend">
			<span class="dd-key dd-key-train"></span> обучение
			<span class="dd-key dd-key-val"></span> валидация
		</p>
	</div>

	<p class="dd-note" aria-live="polite">{note}</p>

	<p class="dd-notice">
		<strong>Что заметить:</strong> при p = 0 и λ = 0 ошибка на валидации растёт после минимума, а разрыв
		с обучением большой. Чем сильнее регуляризация, тем выше ошибка на обучении и тем меньше разрыв. При
		очень больших p ошибка на валидации выше, чем при умеренных значениях: модель недообучена.
	</p>
</figure>

<style>
	.dd {
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
	.dd :global(*),
	.dd :global(*::before),
	.dd :global(*::after) {
		box-sizing: border-box;
	}
	.dd p {
		margin: 0;
	}
	.dd button {
		font: inherit;
	}
	.dd-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}
	.dd-mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	/* Controls */
	.dd-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.dd-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.dd-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.dd-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.dd-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.dd-buttons {
		display: flex;
		gap: var(--space-2);
		margin-left: auto;
	}
	.dd-btn {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--topic);
		border-radius: var(--radius);
		background: var(--topic);
		color: var(--surface);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.dd-btn-ghost {
		background: none;
		border-color: var(--border);
		color: var(--text);
	}
	.dd-btn:focus-visible,
	.dd-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Plots */
	.dd-panel {
		margin-top: var(--space-6);
	}
	.dd-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.dd-svg {
		display: block;
		width: 100%;
		height: 200px;
		overflow: visible;
	}
	.dd-neurons {
		height: 76px;
	}
	.dd-circle {
		fill: var(--topic);
		stroke: var(--topic);
		stroke-width: 1.5;
		transition:
			fill var(--dur) var(--ease),
			opacity var(--dur) var(--ease);
	}
	.dd-node.is-dropped .dd-circle {
		fill: var(--surface-2);
		stroke: var(--text-muted);
		stroke-dasharray: 3 3;
		opacity: 0.8;
	}
	.dd-cross {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 18px;
		text-anchor: middle;
	}
	.dd-caption {
		margin-top: var(--space-2);
		color: var(--text-muted);
	}
	.dd-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.dd-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.dd-best {
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		opacity: 0.6;
	}
	.dd-best-t {
		fill: var(--text-muted);
		font-size: 12px;
	}
	.dd-line {
		stroke-width: 2.5;
		stroke-linejoin: round;
		stroke-linecap: round;
		transition: opacity var(--dur) var(--ease);
	}
	.dd-line-train {
		stroke: var(--cat-1);
	}
	.dd-line-val {
		stroke: var(--cat-3);
	}
	.dd-legend {
		margin-top: var(--space-2);
		color: var(--text-muted);
	}
	.dd-key {
		display: inline-block;
		width: 16px;
		height: 3px;
		margin: 0 var(--space-1) 3px var(--space-3);
		vertical-align: middle;
		border-radius: 2px;
	}
	.dd-key-train {
		background: var(--cat-1);
	}
	.dd-key-val {
		background: var(--cat-3);
	}

	/* Text */
	.dd-note {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.dd-notice {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.dd *,
		.dd *::before,
		.dd *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.dd {
			padding: var(--space-4);
		}
		.dd-range {
			width: 120px;
		}
		.dd-buttons {
			margin-left: 0;
		}
	}

	@media (max-width: 559px) {
		.dd-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.dd-ctl {
			flex-wrap: wrap;
		}
		.dd-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
