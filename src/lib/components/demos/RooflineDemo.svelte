<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		EXP_MAX,
		EXP_MIN,
		EXP_STEP,
		KERNELS,
		SOURCE_TEXT,
		SOURCE_URL,
		UNITS,
		X_TICKS,
		Y_TICKS,
		attainable,
		bound,
		clampIntensity,
		describeRoofline,
		expFromIntensity,
		formatNumber,
		intensityFromExp,
		isUnit,
		kernelById,
		ridgePoint,
		roofPoints,
		utilization,
		xToPx,
		yToPx,
		type PlotBox,
		type RooflineDemoState,
		type Unit,
	} from '$lib/demos/roofline';

	/** Roofline demo: the roof of one GPU for FP32 and FP16 tensor cores, and a task point on it. Registers as `roofline`. */
	let { initial }: { initial?: Partial<RooflineDemoState> } = $props();

	const PLOT_H = 260;
	const PAD = { left: 48, right: 14, top: 14, bottom: 40 };

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	const START: RooflineDemoState = {
		intensity: clampIntensity(initial?.intensity ?? kernelById('decode').intensity),
		unit: isUnit(initial?.unit) ? initial.unit : kernelById('decode').unit,
	};

	let intensity = $state(START.intensity);
	let unit = $state<Unit>(START.unit);
	/** Real width of the plot in px; the SVG is drawn at this width (no viewBox scaling). */
	let plotW = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const box = $derived<PlotBox>({
		width: plotW >= 200 ? plotW : 360,
		height: PLOT_H,
		left: PAD.left,
		right: PAD.right,
		top: PAD.top,
		bottom: PAD.bottom,
	});

	const UNIT_KEYS = Object.keys(UNITS) as Unit[];
	const att = $derived(attainable(intensity, unit));
	const limit = $derived(bound(intensity, unit));
	const pct = $derived(Math.round(utilization(intensity, unit) * 100));
	const activeKernel = $derived(
		KERNELS.find(
			(k) => k.unit === unit && Math.abs(Math.log10(k.intensity) - Math.log10(intensity)) < 1e-6,
		),
	);
	const note = $derived(describeRoofline(intensity, unit));

	const px = $derived(xToPx(intensity, box));
	const py = $derived(yToPx(att, box));
	/** Label goes left of the point when the point is in the right half, and below it when it is at the top. */
	const labelLeft = $derived(px > box.width * 0.55);
	const labelY = $derived(py < 40 ? py + 26 : py - 12);
	const labelX = $derived(labelLeft ? px - 10 : px + 10);
	/** Narrow plots (phones): fewer ticks, and the two ridge labels go to opposite sides of their lines. */
	const compact = $derived(box.width < 480);
	const xTicks = $derived(compact ? X_TICKS.filter((_, i) => i % 2 === 0) : X_TICKS);
	const yTicks = $derived(compact ? Y_TICKS.filter((_, i) => i % 2 === 0) : Y_TICKS);

	function roofPath(u: Unit): string {
		return roofPoints(u)
			.map((p) => `${xToPx(p.x, box).toFixed(1)},${yToPx(p.y, box).toFixed(1)}`)
			.join(' ');
	}

	function setUnit(u: Unit) {
		unit = u;
	}

	function pickKernel(id: (typeof KERNELS)[number]['id']) {
		const k = kernelById(id);
		intensity = k.intensity;
		unit = k.unit;
	}

	function reset() {
		intensity = START.intensity;
		unit = START.unit;
	}

	function apply(patch: Partial<RooflineDemoState>): void {
		if (typeof patch.intensity === 'number') intensity = clampIntensity(patch.intensity);
		if (isUnit(patch.unit)) unit = patch.unit;
	}

	onMount(() => {
		return demos?.register('roofline', {
			set: (patch) => apply(patch as Partial<RooflineDemoState>),
		});
	});
</script>

<figure class="rl" id="demo-roofline" data-demo="roofline">
	<div class="rl-controls">
		<div class="rl-group" role="group" aria-label="Примеры ядер">
			{#each KERNELS as k (k.id)}
				<button
					type="button"
					class="rl-seg"
					aria-pressed={activeKernel?.id === k.id}
					onclick={() => pickKernel(k.id)}
				>
					<span class="rl-letter">{k.letter}</span>
					{k.label}
				</button>
			{/each}
		</div>

		<div class="rl-group" role="group" aria-label="Вычислительный блок">
			{#each UNIT_KEYS as u (u)}
				<button type="button" class="rl-seg" aria-pressed={unit === u} onclick={() => setUnit(u)}>
					{UNITS[u].label}
				</button>
			{/each}
		</div>

		<label class="rl-ctl">
			<span class="rl-label">Интенсивность</span>
			<input
				class="rl-range"
				type="range"
				min={EXP_MIN}
				max={EXP_MAX}
				step={EXP_STEP}
				value={expFromIntensity(intensity)}
				oninput={(e) => (intensity = intensityFromExp(Number(e.currentTarget.value)))}
			/>
			<output class="rl-val">{formatNumber(intensity)}</output>
		</label>

		<button type="button" class="rl-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="rl-plot" bind:clientWidth={plotW}>
		<svg
			class="rl-svg"
			viewBox="0 0 {box.width} {box.height}"
			role="img"
			aria-labelledby="rl-title rl-desc"
		>
			<title id="rl-title"
				>Roofline: достижимая производительность от арифметической интенсивности</title
			>
			<desc id="rl-desc">{note}</desc>

			{#each yTicks as v (v)}
				<line
					class="rl-grid"
					x1={box.left}
					x2={box.width - box.right}
					y1={yToPx(v, box).toFixed(1)}
					y2={yToPx(v, box).toFixed(1)}
				/>
				<text class="rl-tick" x={box.left - 6} y={(yToPx(v, box) + 4).toFixed(1)} text-anchor="end"
					>{formatNumber(v)}</text
				>
			{/each}

			{#each xTicks as v (v)}
				<line
					class="rl-grid"
					x1={xToPx(v, box).toFixed(1)}
					x2={xToPx(v, box).toFixed(1)}
					y1={box.top}
					y2={box.height - box.bottom}
				/>
				<text
					class="rl-tick"
					x={xToPx(v, box).toFixed(1)}
					y={box.height - box.bottom + 16}
					text-anchor="middle">{formatNumber(v)}</text
				>
			{/each}

			<text
				class="rl-axis"
				x={box.left + (box.width - box.left - box.right) / 2}
				y={box.height - 4}
				text-anchor="middle">арифметическая интенсивность, FLOP на байт</text
			>
			<text
				class="rl-axis"
				x="0"
				y="0"
				text-anchor="middle"
				transform="translate(12 {box.top + (box.height - box.top - box.bottom) / 2}) rotate(-90)"
				>TFLOPS</text
			>

			{#each UNIT_KEYS as u, ui (u)}
				{@const r = ridgePoint(u)}
				<line
					class="rl-ridge rl-ridge-{u}"
					class:is-off={u !== unit}
					x1={xToPx(r, box).toFixed(1)}
					x2={xToPx(r, box).toFixed(1)}
					y1={box.top}
					y2={box.height - box.bottom}
				/>
				<text
					class="rl-ridge-t rl-ridge-{u}"
					class:is-off={u !== unit}
					x={xToPx(r, box).toFixed(1)}
					y={box.height - box.bottom - 6}
					text-anchor={compact && ui === 0 ? 'end' : 'start'}
					dx={compact && ui === 0 ? -4 : 4}>перегиб {formatNumber(r)}</text
				>
			{/each}

			{#each UNIT_KEYS as u (u)}
				<polyline
					class="rl-roof rl-roof-{u}"
					class:is-off={u !== unit}
					points={roofPath(u)}
					fill="none"
				/>
				<text
					class="rl-peak rl-roof-{u}"
					class:is-off={u !== unit}
					x={box.width - box.right - 4}
					y={yToPx(UNITS[u].tflops, box) - 6}
					text-anchor="end">{UNITS[u].tflops} TFLOPS, {UNITS[u].label}</text
				>
			{/each}

			{#each KERNELS as k (k.id)}
				{@const kx = xToPx(k.intensity, box)}
				{@const ky = yToPx(attainable(k.intensity, k.unit), box)}
				<circle class="rl-kernel" cx={kx.toFixed(1)} cy={ky.toFixed(1)} r="4" />
				<text class="rl-kernel-t" x={kx.toFixed(1)} y={(ky + 16).toFixed(1)} text-anchor="middle"
					>{k.letter}</text
				>
			{/each}

			<circle class="rl-point" cx={px.toFixed(1)} cy={py.toFixed(1)} r="6" />
			<text
				class="rl-point-t"
				x={labelX.toFixed(1)}
				y={labelY.toFixed(1)}
				text-anchor={labelLeft ? 'end' : 'start'}
			>
				<tspan class:is-off={limit !== 'memory'}>память</tspan><tspan class="rl-sep">/</tspan><tspan
					class:is-off={limit !== 'compute'}>вычисления</tspan
				>
			</text>
		</svg>
	</div>

	<dl class="rl-stats">
		<dt>Интенсивность</dt>
		<dd>{formatNumber(intensity)} FLOP/байт</dd>
		<dt>Предел</dt>
		<dd>{limit === 'memory' ? 'память' : 'вычисления'}</dd>
		<dt>Достижимо</dt>
		<dd>{formatNumber(att)} TFLOPS ({pct} % пика)</dd>
		<dt>Пик блока</dt>
		<dd>{UNITS[unit].tflops} TFLOPS</dd>
		<dt>Перегиб блока</dt>
		<dd>{formatNumber(ridgePoint(unit))} FLOP/байт</dd>
	</dl>

	<p class="rl-live" aria-live="polite">{note}</p>

	<p class="rl-note">
		<strong>Что заметить:</strong> на наклонной части производительность растёт вместе с интенсивностью,
		и добавлять вычислительные блоки бесполезно. Правее перегиба растёт только полка.
	</p>

	<p class="rl-source">
		Пики и пропускная способность HBM:
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external documentation URL, not a site route -->
		<a href={SOURCE_URL} rel="noopener noreferrer" target="_blank">{SOURCE_TEXT}</a>. Плотные
		значения, без разреженности; пик FP16 с разреженностью (1979 TFLOPS) не показан.
	</p>
</figure>

<style>
	.rl {
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
	.rl :global(*),
	.rl :global(*::before),
	.rl :global(*::after) {
		box-sizing: border-box;
	}
	.rl dl,
	.rl dd,
	.rl dt,
	.rl p {
		margin: 0;
	}
	.rl button {
		font: inherit;
	}

	/* Controls */
	.rl-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.rl-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		gap: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.rl-seg {
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
	.rl-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.rl-letter {
		display: inline-block;
		margin-right: 4px;
		font-family: var(--font-mono);
		font-weight: 600;
	}
	.rl-seg:focus-visible,
	.rl-range:focus-visible,
	.rl-reset:focus-visible,
	.rl-source a:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.rl-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.rl-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.rl-range {
		width: 160px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.rl-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.rl-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}

	/* Plot */
	.rl-plot {
		margin-top: var(--space-6);
	}
	.rl-svg {
		display: block;
		width: 100%;
		height: 260px;
		overflow: visible;
	}
	.rl-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	/* design-system §4/§9: tick and label text is at least 12px; narrow plots drop ticks instead. */
	.rl-tick,
	.rl-ridge-t,
	.rl-peak,
	.rl-kernel-t {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.rl-axis {
		fill: var(--text-muted);
		font-size: 12px;
	}
	.rl-roof {
		stroke-width: 2.5;
		stroke-linejoin: round;
		transition: opacity var(--dur) var(--ease);
	}
	.rl-roof-fp16Tensor {
		stroke: var(--topic);
	}
	.rl-roof-fp32 {
		stroke: var(--cat-4);
	}
	.rl-peak.rl-roof-fp16Tensor,
	.rl-ridge-t.rl-roof-fp16Tensor {
		fill: var(--topic);
	}
	.rl-peak.rl-roof-fp32,
	.rl-ridge-t.rl-roof-fp32 {
		fill: var(--cat-4);
	}
	.rl-ridge {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		opacity: 0.6;
	}
	.rl-ridge.is-off,
	.rl-ridge-t.is-off,
	.rl-roof.is-off,
	.rl-peak.is-off {
		opacity: 0.35;
	}
	.rl-kernel {
		fill: var(--surface);
		stroke: var(--text);
		stroke-width: 1.5;
	}
	.rl-kernel-t {
		fill: var(--text);
		font-weight: 600;
	}
	.rl-point {
		fill: var(--text);
		stroke: var(--surface);
		stroke-width: 2;
		transition:
			cx var(--dur) var(--ease),
			cy var(--dur) var(--ease);
	}
	.rl-point-t {
		fill: var(--text);
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 600;
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 3px;
	}
	.rl-point-t .is-off {
		fill: var(--text-muted);
		font-weight: 400;
	}
	.rl-sep {
		fill: var(--text-muted);
	}

	/* Statistics */
	.rl-stats {
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
	.rl-stats dt {
		color: var(--text-muted);
	}
	.rl-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.rl-live {
		margin-top: var(--space-4);
		color: var(--text);
	}
	.rl-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.rl-source {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 12px;
	}
	.rl-source a {
		color: var(--topic);
	}

	@media (prefers-reduced-motion: reduce) {
		.rl *,
		.rl *::before,
		.rl *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.rl {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.rl-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.rl-group {
			display: flex;
			flex-direction: column;
			align-items: stretch;
		}
		.rl-seg {
			text-align: left;
		}
		.rl-ctl {
			flex-wrap: wrap;
		}
		.rl-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.rl-stats {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}
</style>
