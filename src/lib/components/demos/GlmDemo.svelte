<script lang="ts">
	import {
		ALPHA_MAX,
		ALPHA_MIN,
		ALPHA_STEP,
		COUNT_MAX,
		COUNT_MIN,
		DEFAULT_ALPHA,
		DEFAULT_COUNTS,
		GRID,
		PLOT,
		X_VALUES,
		bandPath,
		curveAt,
		describeGlm,
		fitGlm,
		fmt,
		isLink,
		linePath,
		normalizeCounts,
		plotPoints,
		predictiveBand,
		type PlotPoint,
		pxToValue,
		setCount,
		snapAlpha,
		snapCount,
		summarize,
		xToPx,
		yToPx,
		type GlmDemoState,
		type Link,
	} from '$lib/demos/glm';

	/** Counts GLM demo: Poisson and negative-binomial fits, dispersion and the link function. */
	let { initial }: { initial?: Partial<GlmDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let counts = $state<number[]>(normalizeCounts(initial?.counts ?? DEFAULT_COUNTS));
	/* svelte-ignore state_referenced_locally */
	let link = $state<Link>(isLink(initial?.link) ? initial.link : 'log');
	/* svelte-ignore state_referenced_locally */
	let slope = $state(initial?.slope === true);
	/* svelte-ignore state_referenced_locally */
	let alpha = $state(snapAlpha(initial?.alpha ?? DEFAULT_ALPHA));

	let svgEl = $state<SVGSVGElement | undefined>(undefined);
	let dragging = $state<number | null>(null);

	const opts = $derived({ slope, link });
	const points = $derived(plotPoints(counts));
	const fitP = $derived(fitGlm(X_VALUES, counts, { ...opts, alpha: 0 }));
	const fitN = $derived(fitGlm(X_VALUES, counts, { ...opts, alpha }));
	const summary = $derived(summarize(fitP));
	const curveP = $derived(curveAt(fitP, GRID));
	const curveN = $derived(curveAt(fitN, GRID));
	const bandP = $derived(predictiveBand(curveP, 0));
	const bandN = $derived(predictiveBand(curveN, alpha));
	const pathBandP = $derived(bandPath(GRID, bandP.lo, bandP.hi));
	const pathBandN = $derived(bandPath(GRID, bandN.lo, bandN.hi));
	const pathP = $derived(linePath(GRID, curveP));
	const pathN = $derived(linePath(GRID, curveN));
	const note = $derived(describeGlm(fitP, fitN, summary));
	const linkName = $derived(link === 'log' ? 'логарифм' : 'тождественная');
	const desc = $derived(
		`Счётчики ${counts.join(', ')} при x = 1…6. Связь: ${linkName}. ` +
			`Пуассон: φ̂ = ${fmt(fitP.phi)}; отрицательно-биномиальная с α = ${fmt(alpha)}: φ̂ = ${fmt(fitN.phi)}.`,
	);

	function setValue(i: number, value: number): void {
		counts = setCount(counts, i, value);
	}

	function onPointerDown(e: PointerEvent, i: number): void {
		dragging = i;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onPointerMove(e: PointerEvent, i: number): void {
		if (dragging !== i || !svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		const py = ((e.clientY - rect.top) / rect.height) * PLOT.H;
		setValue(i, snapCount(pxToValue(py)));
	}

	function onPointerUp(): void {
		dragging = null;
	}

	const STEPS: Record<string, number> = {
		ArrowUp: 1,
		ArrowRight: 1,
		ArrowDown: -1,
		ArrowLeft: -1,
		PageUp: 5,
		PageDown: -5,
	};

	function onKey(e: KeyboardEvent, pt: PlotPoint): void {
		const step = STEPS[e.key] ?? 0;
		if (step === 0) return;
		e.preventDefault();
		setValue(pt.index, pt.value + step);
	}

	function reset(): void {
		counts = [...DEFAULT_COUNTS];
		link = 'log';
		slope = false;
		alpha = DEFAULT_ALPHA;
	}

	const yTicks = [0, 6, 12, 18, 24];
</script>

<figure class="glm" id="demo-glm" data-demo="glm">
	<div class="glm-controls">
		<div class="glm-group" role="group" aria-label="Связующая функция">
			<span class="glm-cap">Связь</span>
			<button
				type="button"
				class="glm-seg"
				aria-pressed={link === 'log'}
				onclick={() => (link = 'log')}>log (счётчик)</button
			>
			<button
				type="button"
				class="glm-seg"
				aria-pressed={link === 'identity'}
				onclick={() => (link = 'identity')}>тождественная</button
			>
		</div>

		<label class="glm-check">
			<input type="checkbox" bind:checked={slope} />
			<span>признак x (наклон β₁)</span>
		</label>

		<label class="glm-ctl">
			<span class="glm-label">переразброс α <span class="glm-muted">(дисперсия μ + αμ²)</span></span
			>
			<input
				class="glm-range"
				type="range"
				min={ALPHA_MIN}
				max={ALPHA_MAX}
				step={ALPHA_STEP}
				value={alpha}
				oninput={(e) => (alpha = snapAlpha(Number(e.currentTarget.value)))}
			/>
			<output class="glm-val">{fmt(alpha)}</output>
		</label>

		<button type="button" class="glm-reset" onclick={reset}>Сбросить</button>
	</div>

	<p class="glm-hint">
		Перетащите точку вверх или вниз (или стрелками на клавиатуре), чтобы изменить счётчик.
	</p>

	<svg
		bind:this={svgEl}
		class="glm-svg"
		viewBox="0 0 {PLOT.W} {PLOT.H}"
		role="img"
		aria-labelledby="glm-title glm-desc"
	>
		<title id="glm-title">Счётчики и средние модели по признаку x</title>
		<desc id="glm-desc">{desc}</desc>

		{#each yTicks as t (t)}
			<line class="glm-grid" x1={PLOT.padL} x2={PLOT.W - PLOT.padR} y1={yToPx(t)} y2={yToPx(t)} />
			<text class="glm-tick" x={PLOT.padL - 6} y={yToPx(t) + 4} text-anchor="end">{t}</text>
		{/each}
		{#each X_VALUES as xv (xv)}
			<text class="glm-tick" x={xToPx(xv)} y={PLOT.H - 10} text-anchor="middle">{xv}</text>
		{/each}
		<line class="glm-axis" x1={PLOT.padL} x2={PLOT.padL} y1={PLOT.padT} y2={PLOT.H - PLOT.padB} />
		<line
			class="glm-axis"
			x1={PLOT.padL}
			x2={PLOT.W - PLOT.padR}
			y1={PLOT.H - PLOT.padB}
			y2={PLOT.H - PLOT.padB}
		/>

		<path class="glm-band glm-band-n" d={pathBandN} />
		<path class="glm-band glm-band-p" d={pathBandP} />
		<path class="glm-curve-n" d={pathN} />
		<path class="glm-curve-p" d={pathP} />

		{#each points as pt (pt.index)}
			<circle
				class="glm-point"
				class:is-drag={dragging === pt.index}
				cx={xToPx(pt.x)}
				cy={yToPx(pt.value)}
				r="7"
				role="slider"
				tabindex="0"
				aria-label="Счётчик при x = {pt.x}"
				aria-valuemin={COUNT_MIN}
				aria-valuemax={COUNT_MAX}
				aria-valuenow={pt.value}
				aria-valuetext={String(pt.value)}
				onpointerdown={(e) => onPointerDown(e, pt.index)}
				onpointermove={(e) => onPointerMove(e, pt.index)}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
				onkeydown={(e) => onKey(e, pt)}
			/>
		{/each}
	</svg>

	<ul class="glm-legend">
		<li><i class="glm-sw glm-sw-p"></i>Пуассон: средняя линия и полоса 95 %</li>
		<li><i class="glm-sw glm-sw-n"></i>Отриц.-биномиальная: средняя линия и полоса</li>
	</ul>

	<table class="glm-table">
		<caption class="glm-cap-t">Пуассоновская модель по данным</caption>
		<tbody>
			<tr>
				<th scope="row">μ при x = 1</th>
				<td>{fmt(summary.level)}</td>
				<td class="glm-muted">{slope ? 'с наклоном' : 'exp(β₀)'}</td>
			</tr>
			<tr>
				<th scope="row">φ̂ (Пирсон)</th>
				<td class:is-bad={summary.phi > 1.5}>{fmt(fitP.phi)}</td>
				<td class="glm-muted">{summary.phi > 1.5 ? 'переразброс' : 'близко к 1'}</td>
			</tr>
			<tr>
				<th scope="row">SE, без поправки</th>
				<td>{fmt(summary.levelRaw.se, 3)}</td>
				<td>ДИ [{fmt(summary.levelRaw.lo)}; {fmt(summary.levelRaw.hi)}]</td>
			</tr>
			<tr>
				<th scope="row">SE, с поправкой φ̂</th>
				<td>{fmt(summary.levelScaled.se)}</td>
				<td>ДИ [{fmt(summary.levelScaled.lo)}; {fmt(summary.levelScaled.hi)}]</td>
			</tr>
			{#if slope}
				{#each summary.coefs as c (c.name)}
					<tr>
						<th scope="row">{c.name}</th>
						<td>{fmt(c.value)}</td>
						<td>SE {fmt(c.seRaw)} → {fmt(c.seScaled)}</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>

	<p class="glm-note" aria-live="polite">
		<strong>Что заметить:</strong>
		{note}
	</p>

	<button type="button" class="glm-reset-bottom" onclick={reset}>Сбросить к примеру из главы</button
	>
</figure>

<style>
	.glm {
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
		min-width: 0;
	}
	.glm :global(*),
	.glm :global(*::before),
	.glm :global(*::after) {
		box-sizing: border-box;
	}
	.glm p,
	.glm ul,
	.glm li {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.glm button {
		font: inherit;
	}
	.glm-muted {
		color: var(--text-muted);
	}

	/* Controls */
	.glm-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.glm-group {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.glm-cap {
		padding: 0 var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.glm-seg {
		padding: 4px 10px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 13px;
	}
	.glm-seg[aria-pressed='true'] {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow);
	}
	.glm-check {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
	}
	.glm-ctl {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.glm-label {
		font-size: 13px;
	}
	.glm-range {
		width: 140px;
		max-width: 100%;
		accent-color: var(--topic);
	}
	.glm-val {
		min-width: 2.5em;
		font-variant-numeric: tabular-nums;
	}
	.glm-reset,
	.glm-reset-bottom {
		padding: 4px 12px;
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
		font-size: 13px;
	}
	.glm-hint {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Plot */
	.glm-svg {
		display: block;
		width: 100%;
		height: auto;
		margin-top: var(--space-3);
		overflow: visible;
	}
	.glm-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.glm-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.glm-tick {
		fill: var(--text-muted);
		font-size: 13px;
		font-family: var(--font-sans);
	}
	.glm-band-p {
		fill: var(--topic);
		fill-opacity: 0.16;
		stroke: none;
	}
	.glm-band-n {
		fill: var(--cat-2);
		fill-opacity: 0.1;
		stroke: none;
	}
	.glm-curve-p {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2.5;
	}
	.glm-curve-n {
		fill: none;
		stroke: var(--cat-2);
		stroke-width: 2.5;
		stroke-dasharray: 6 4;
	}
	.glm-point {
		fill: var(--surface);
		stroke: var(--text);
		stroke-width: 2;
		cursor: ns-resize;
		touch-action: none;
	}
	.glm-point.is-drag {
		fill: var(--topic);
	}
	.glm-point:focus-visible {
		outline: none;
		stroke: var(--accent);
		stroke-width: 3;
	}

	/* Legend */
	.glm-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.glm-legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.glm-sw {
		display: inline-block;
		width: 18px;
		height: 0;
		border-top: 2.5px solid;
	}
	.glm-sw-p {
		border-color: var(--topic);
	}
	.glm-sw-n {
		border-color: var(--cat-2);
		border-top-style: dashed;
	}

	/* Table */
	.glm-table {
		width: 100%;
		margin-top: var(--space-4);
		border-collapse: collapse;
		font-size: 13px;
		table-layout: fixed;
	}
	.glm-cap-t {
		text-align: left;
		padding-bottom: var(--space-2);
		color: var(--text-muted);
	}
	.glm-table th,
	.glm-table td {
		padding: var(--space-2) var(--space-2);
		border-top: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
		overflow-wrap: anywhere;
		font-weight: 400;
	}
	.glm-table th {
		width: 38%;
	}
	.glm-table .is-bad {
		color: var(--warn);
		font-weight: 600;
	}

	/* Note */
	.glm-note {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--topic);
		background: var(--topic-soft);
		border-radius: var(--radius-sm);
		font-size: 14px;
	}
	.glm-reset-bottom {
		margin-top: var(--space-4);
	}

	@media (max-width: 480px) {
		.glm {
			padding: var(--space-4);
		}
		.glm-range {
			width: 100%;
		}
	}
</style>
