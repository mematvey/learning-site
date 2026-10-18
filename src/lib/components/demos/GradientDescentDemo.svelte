<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DOM_HI,
		DOM_LO,
		ETA_DEFAULT,
		ETA_MAX,
		ETA_MIN,
		ETA_STEP,
		STEPS_DEFAULT,
		STEPS_MAX,
		STEPS_MIN,
		W_STAR,
		type Dim,
		type GradientDescentDemoState,
		contourRadii,
		curvePoints1d,
		describeState,
		fmt,
		isOutside1d,
		isOutside2d,
		itemAt,
		lastStepText1d,
		lastStepText2d,
		loss1d,
		loss2d,
		lossY,
		regimeOf,
		scaleX,
		scaleYUp,
		snapDim,
		snapEta,
		snapSteps,
		stabilityLimits,
		trajectory1d,
		trajectory2d,
	} from '$lib/demos/gradient-descent';

	/** Gradient descent on one weight (1D) or two weights (2D). Registers itself as demo `gradient-descent`. */
	let { initial }: { initial?: Partial<GradientDescentDemoState> } = $props();

	// Start state, also the target of the reset button. The props only seed it once.
	/* svelte-ignore state_referenced_locally */
	const defaults = {
		dim: snapDim(initial?.dim),
		eta: snapEta(initial?.eta ?? ETA_DEFAULT),
		steps: snapSteps(initial?.steps ?? STEPS_DEFAULT),
	};

	let dim = $state<Dim>(defaults.dim);
	let eta = $state(defaults.eta);
	let steps = $state(defaults.steps);
	/** Real widths of the chart panels in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wPanel1 = $state(0);
	let wPanel2 = $state(0);

	const H1 = 240;
	const plotW1 = $derived(wPanel1 >= 200 ? wPanel1 : 480);
	const size2 = $derived(Math.min(wPanel2 >= 160 ? wPanel2 : 320, 360));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const traj1 = $derived(trajectory1d(eta, steps));
	const traj2 = $derived(trajectory2d(eta, steps));
	const limit = $derived(stabilityLimits(dim).limit);
	const diverging = $derived(regimeOf(dim, eta) === 'diverge');
	const note = $derived(describeState(dim, eta, steps, dim === 1 ? traj1 : traj2));
	const formula = $derived(dim === 1 ? lastStepText1d(traj1, eta) : lastStepText2d(traj2, eta));
	const cur1 = $derived(itemAt(traj1, -1));
	const cur2 = $derived(itemAt(traj2, -1));
	const lossNow = $derived(dim === 1 ? loss1d(cur1) : loss2d(cur2[0], cur2[1]));
	const distNow = $derived(
		dim === 1 ? Math.abs(cur1 - W_STAR) : Math.hypot(cur2[0] - W_STAR, cur2[1] - W_STAR),
	);
	const curveD = $derived(
		curvePoints1d(plotW1, H1)
			.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
			.join(' '),
	);

	function clampDom(v: number): number {
		return Math.min(DOM_HI, Math.max(DOM_LO, v));
	}

	/** Points of the 1D trajectory in chart pixels; points outside the chart are drawn at the edge. */
	const pts1 = $derived(
		traj1.map((w, i) => {
			const L = loss1d(w);
			return {
				i,
				w,
				L,
				x: scaleX(clampDom(w), plotW1),
				y: lossY(L, H1),
				out: isOutside1d(w, L),
			};
		}),
	);
	const pts2 = $derived(
		traj2.map(([a, b], i) => ({
			i,
			a,
			b,
			x: scaleX(clampDom(a), size2),
			y: scaleYUp(clampDom(b), size2),
			out: isOutside2d(a, b),
		})),
	);
	const polyline1 = $derived(pts1.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
	const polyline2 = $derived(pts2.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
	const contours = [1, 4, 9, 16];
	const minX2 = $derived(scaleX(W_STAR, size2));
	const minY2 = $derived(scaleYUp(W_STAR, size2));
	const minX1 = $derived(scaleX(W_STAR, plotW1));
	const baseY1 = $derived(lossY(0, H1));

	function apply(patch: Partial<GradientDescentDemoState>): void {
		if (patch.dim !== undefined) dim = snapDim(patch.dim);
		if (typeof patch.eta === 'number') eta = snapEta(patch.eta);
		if (typeof patch.steps === 'number') steps = snapSteps(patch.steps);
	}

	function reset(): void {
		dim = defaults.dim;
		eta = defaults.eta;
		steps = defaults.steps;
	}

	onMount(() => {
		return demos?.register('gradient-descent', {
			set: (patch) => apply(patch as Partial<GradientDescentDemoState>),
		});
	});
</script>

<figure class="gd" id="demo-gradient-descent" data-demo="gradient-descent">
	<div class="gd-controls">
		<div class="gd-group" role="group" aria-label="Размерность функции потерь">
			<button type="button" class="gd-seg" aria-pressed={dim === 1} onclick={() => (dim = 1)}
				>1D: L(w)</button
			>
			<button type="button" class="gd-seg" aria-pressed={dim === 2} onclick={() => (dim = 2)}
				>2D: L(w₁, w₂)</button
			>
		</div>

		<label class="gd-ctl">
			<span class="gd-label">Шаг обучения <span class="gd-sym">η</span></span>
			<input
				class="gd-range"
				type="range"
				min={ETA_MIN}
				max={ETA_MAX}
				step={ETA_STEP}
				value={eta}
				oninput={(e) => (eta = snapEta(Number(e.currentTarget.value)))}
			/>
			<output class="gd-val">{fmt(eta)}</output>
		</label>

		<label class="gd-ctl">
			<span class="gd-label">Шагов</span>
			<input
				class="gd-range"
				type="range"
				min={STEPS_MIN}
				max={STEPS_MAX}
				step="1"
				value={steps}
				oninput={(e) => (steps = snapSteps(Number(e.currentTarget.value)))}
			/>
			<output class="gd-val">{steps}</output>
		</label>

		<button type="button" class="gd-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="gd-formula">
		{#if dim === 1}
			<span class="gd-tex">L(w) = (w − 3)²,&nbsp;&nbsp;w ← w − η · 2(w − 3)</span>
		{:else}
			<span class="gd-tex">L = (w₁ − 3)² + 4(w₂ − 3)²,&nbsp;&nbsp;w ← w − η · ∇L</span>
		{/if}
	</div>

	{#if dim === 1}
		<div class="gd-panel" bind:clientWidth={wPanel1}>
			<svg
				class="gd-svg"
				viewBox="0 0 {plotW1} {H1}"
				role="img"
				aria-labelledby="gd-1d-title gd-1d-desc"
			>
				<title id="gd-1d-title">Функция потерь одного веса</title>
				<desc id="gd-1d-desc"
					>Парабола L(w) = (w − 3)² с минимумом при w = 3 и траектория из {steps} шагов. Текущее состояние
					описано в тексте под рисунком.</desc
				>
				<line class="gd-axis" x1="0" x2={plotW1} y1={baseY1} y2={baseY1} />
				<line class="gd-min" x1={minX1} x2={minX1} y1="0" y2={baseY1} />
				<text class="gd-tick" x={minX1} y={H1 - 8} text-anchor="middle">w* = 3</text>
				<text class="gd-tick" x={scaleX(0, plotW1)} y={H1 - 8} text-anchor="middle">0</text>
				<text class="gd-tick" x={scaleX(6, plotW1)} y={H1 - 8} text-anchor="middle">6</text>
				<text class="gd-tick" x="4" y="12">L</text>
				<path class="gd-curve" d={curveD} />
				<polyline class="gd-path" points={polyline1} />
				{#each pts1 as p (p.i)}
					<circle
						class="gd-pt"
						class:is-start={p.i === 0}
						class:is-last={p.i === pts1.length - 1}
						class:is-out={p.out}
						cx={p.x.toFixed(1)}
						cy={p.y.toFixed(1)}
						r={p.i === 0 || p.i === pts1.length - 1 ? 5 : 3}
					>
						<title>
							шаг {p.i}: w = {fmt(p.w)}, L = {fmt(p.L)}{p.out ? ' (за пределами рисунка)' : ''}
						</title>
					</circle>
				{/each}
			</svg>
		</div>
	{:else}
		<div class="gd-panel gd-panel-2d" bind:clientWidth={wPanel2}>
			<svg
				class="gd-svg"
				viewBox="0 0 {size2} {size2}"
				role="img"
				aria-labelledby="gd-2d-title gd-2d-desc"
			>
				<title id="gd-2d-title">Линии уровня функции потерь двух весов</title>
				<desc id="gd-2d-desc"
					>Эллипсы L = const с центром в точке (3, 3). Вдоль w₂ эллипсы в два раза уже, то есть
					кривизна по w₂ в четыре раза больше. Траектория из {steps} шагов.</desc
				>
				{#each contours as level (level)}
					{@const r = contourRadii(level, size2)}
					<ellipse class="gd-contour" cx={minX2} cy={minY2} rx={r.rx} ry={r.ry} />
				{/each}
				<circle class="gd-min2" cx={minX2} cy={minY2} r="4" />
				<text class="gd-tick" x={minX2 + 8} y={minY2 - 8}>минимум (3, 3)</text>
				<polyline class="gd-path" points={polyline2} />
				{#each pts2 as p (p.i)}
					<circle
						class="gd-pt"
						class:is-start={p.i === 0}
						class:is-last={p.i === pts2.length - 1}
						class:is-out={p.out}
						cx={p.x.toFixed(1)}
						cy={p.y.toFixed(1)}
						r={p.i === 0 || p.i === pts2.length - 1 ? 5 : 3}
					>
						<title>
							шаг {p.i}: w₁ = {fmt(p.a)}, w₂ = {fmt(p.b)}{p.out ? ' (за пределами рисунка)' : ''}
						</title>
					</circle>
				{/each}
			</svg>
		</div>
	{/if}

	<dl class="gd-stats">
		<dt>Шаг</dt>
		<dd>{steps}</dd>
		<dt>{dim === 1 ? 'w сейчас' : 'w₁, w₂ сейчас'}</dt>
		<dd>{dim === 1 ? fmt(cur1) : `${fmt(cur2[0])}, ${fmt(cur2[1])}`}</dd>
		<dt>Потери L</dt>
		<dd>{fmt(lossNow)}</dd>
		<dt>Расстояние до минимума</dt>
		<dd>{fmt(distNow)}</dd>
		<dt>Порог η</dt>
		<dd>{fmt(limit)}</dd>
	</dl>

	<p class="gd-last">Последний шаг: {formula}</p>
	<p class="gd-note" aria-live="polite">{note}</p>
	{#if diverging}
		<p class="gd-warn">Шаг слишком большой: точка уходит от минимума.</p>
	{/if}
</figure>

<style>
	.gd {
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
	.gd :global(*),
	.gd :global(*::before),
	.gd :global(*::after) {
		box-sizing: border-box;
	}
	.gd dl,
	.gd dd,
	.gd dt,
	.gd p {
		margin: 0;
	}
	.gd button {
		font: inherit;
	}
	.gd-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.gd-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.gd-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.gd-seg {
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
	.gd-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.gd-seg:focus-visible,
	.gd-range:focus-visible,
	.gd-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.gd-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.gd-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.gd-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.gd-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.gd-reset {
		height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		cursor: pointer;
	}
	.gd-reset:hover {
		border-color: var(--topic);
	}

	.gd-formula {
		margin-top: var(--space-4);
		color: var(--text);
		font-size: var(--fs-base);
	}
	.gd-tex {
		font-family: var(--font-serif);
	}

	/* Chart */
	.gd-panel {
		margin-top: var(--space-6);
	}
	.gd-panel-2d {
		max-width: 360px;
		margin-left: auto;
		margin-right: auto;
	}
	.gd-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.gd-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.6;
	}
	.gd-min,
	.gd-min2 {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 4 3;
		fill: none;
	}
	.gd-min2 {
		stroke: var(--topic);
		stroke-width: 1.5;
	}
	.gd-curve {
		fill: none;
		stroke: var(--text);
		stroke-width: 2;
		opacity: 0.85;
	}
	.gd-contour {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.6;
	}
	.gd-path {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2;
		stroke-linejoin: round;
		transition: opacity var(--dur) var(--ease);
	}
	.gd-pt {
		fill: var(--topic);
		stroke: var(--surface);
		stroke-width: 1;
	}
	.gd-pt.is-start {
		fill: var(--surface);
		stroke: var(--text);
		stroke-width: 2;
	}
	.gd-pt.is-last {
		stroke: var(--topic);
		stroke-width: 2;
	}
	.gd-pt.is-out {
		fill: var(--warn);
	}
	.gd-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	/* Text under the chart */
	.gd-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.gd-stats dt {
		color: var(--text-muted);
	}
	.gd-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.gd-last {
		margin-top: var(--space-4);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.gd-note {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.gd-warn {
		margin-top: var(--space-3);
		color: var(--warn);
		font-weight: 600;
	}

	@media (prefers-reduced-motion: reduce) {
		.gd *,
		.gd *::before,
		.gd *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.gd {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.gd-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.gd-ctl {
			flex-wrap: wrap;
		}
		.gd-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
