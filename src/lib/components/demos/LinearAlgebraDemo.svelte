<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DEFAULT_MATRIX,
		ENTRY_STEP,
		PRESETS,
		applyMat,
		describeMatrix,
		det,
		ellipsePoints,
		eigen2,
		formatNumber,
		gridLines,
		lowRankError,
		snapEntry,
		svd2,
		type Mat2,
		type Vec2,
	} from '$lib/demos/linear-algebra-essentials';

	/** Matrix 2×2 as a map of the plane. Registers itself as demo `linear-algebra-essentials`. */
	let { initial }: { initial?: Partial<Mat2> } = $props();

	/** Half-width of the plot in math units; the viewBox is [-HALF, HALF] on both axes. */
	const HALF = 3.5;
	const IDENTITY: Mat2 = { a: 1, b: 0, c: 0, d: 1 };
	/** Reference grid and circle (the plane before the map), drawn faintly. */
	const GRID0 = gridLines(IDENTITY, 4);
	const CIRCLE0 = ellipsePoints(IDENTITY, 120);

	const start = (src: Partial<Mat2> | undefined): Mat2 => ({
		a: snapEntry(src?.a ?? DEFAULT_MATRIX.a),
		b: snapEntry(src?.b ?? DEFAULT_MATRIX.b),
		c: snapEntry(src?.c ?? DEFAULT_MATRIX.c),
		d: snapEntry(src?.d ?? DEFAULT_MATRIX.d),
	});

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let m = $state<Mat2>(start(initial));
	let svgEl: SVGSVGElement | undefined = $state();
	/** Index of the basis vector being dragged (0 = e₁, 1 = e₂), or null. */
	let drag = $state<0 | 1 | null>(null);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	/** Images of the basis vectors: the columns of A. */
	const e1 = $derived<Vec2>(applyMat(m, [1, 0]));
	const e2 = $derived<Vec2>(applyMat(m, [0, 1]));
	const eig = $derived(eigen2(m));
	const sv = $derived(svd2(m));
	const err1 = $derived(lowRankError(m, 1));
	const dt = $derived(det(m));
	const note = $derived(describeMatrix(m));
	const gridD = $derived(segs(gridLines(m, 4)));
	const ellipseD = $derived(poly(ellipsePoints(m, 120)));
	const grid0D = segs(GRID0);
	const circle0D = poly(CIRCLE0);
	const presetId = $derived(
		PRESETS.find((p) => p.m.a === m.a && p.m.b === m.b && p.m.c === m.c && p.m.d === m.d)?.id ??
			null,
	);

	/** SVG path data in math coordinates; the y axis is flipped on screen. */
	function pt(p: Vec2): string {
		return `${p[0].toFixed(3)} ${(-p[1]).toFixed(3)}`;
	}
	function segs(lines: Array<[Vec2, Vec2]>): string {
		return lines.map(([p, q]) => `M${pt(p)}L${pt(q)}`).join('');
	}
	function poly(points: Vec2[]): string {
		return `M${points.map(pt).join('L')}Z`;
	}
	function line(p: Vec2): string {
		return `M0 0L${pt(p)}`;
	}
	/** A line through the origin along a unit direction, long enough to cross the plot. */
	function through(v: Vec2): string {
		return `M${pt([-HALF * v[0], -HALF * v[1]])}L${pt([HALF * v[0], HALF * v[1]])}`;
	}

	function setColumn(k: 0 | 1, x: number, y: number): void {
		const xs = snapEntry(x);
		const ys = snapEntry(y);
		m = k === 0 ? { ...m, a: xs, c: ys } : { ...m, b: xs, d: ys };
	}

	/** Converts a pointer position to math coordinates. */
	function toMath(e: PointerEvent): Vec2 {
		const r = svgEl!.getBoundingClientRect();
		const x = ((e.clientX - r.left) / r.width) * 2 * HALF - HALF;
		const y = HALF - ((e.clientY - r.top) / r.height) * 2 * HALF;
		return [x, y];
	}

	function onHandleDown(k: 0 | 1, e: PointerEvent): void {
		drag = k;
		svgEl?.setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onMove(e: PointerEvent): void {
		if (drag === null) return;
		const [x, y] = toMath(e);
		setColumn(drag, x, y);
	}

	function onUp(e: PointerEvent): void {
		if (drag === null) return;
		drag = null;
		if (svgEl?.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
	}

	function onKey(k: 0 | 1, e: KeyboardEvent): void {
		const step = e.shiftKey ? 5 * ENTRY_STEP : ENTRY_STEP;
		const [dx, dy] =
			e.key === 'ArrowLeft'
				? [-step, 0]
				: e.key === 'ArrowRight'
					? [step, 0]
					: e.key === 'ArrowUp'
						? [0, step]
						: e.key === 'ArrowDown'
							? [0, -step]
							: [0, 0];
		if (dx === 0 && dy === 0) return;
		e.preventDefault();
		const [x, y] = k === 0 ? e1 : e2;
		setColumn(k, x + dx, y + dy);
	}

	function usePreset(next: Mat2): void {
		m = { ...next };
	}

	function reset(): void {
		usePreset(start(initial));
	}

	/** Patch from the text (DemoLink): only the given entries change. */
	function apply(patch: Partial<Mat2>): void {
		m = {
			a: typeof patch.a === 'number' ? snapEntry(patch.a) : m.a,
			b: typeof patch.b === 'number' ? snapEntry(patch.b) : m.b,
			c: typeof patch.c === 'number' ? snapEntry(patch.c) : m.c,
			d: typeof patch.d === 'number' ? snapEntry(patch.d) : m.d,
		};
	}

	onMount(() => {
		return demos?.register('linear-algebra-essentials', {
			set: (patch) => apply(patch as Partial<Mat2>),
		});
	});

	const fmt = (v: number) => formatNumber(v, 2);
	const fmtEntry = (v: number) => formatNumber(v, 1);
</script>

<figure class="la" id="demo-linear-algebra-essentials" data-demo="linear-algebra-essentials">
	<div class="la-controls">
		<div class="la-group" role="group" aria-label="Готовые матрицы">
			{#each PRESETS as p (p.id)}
				<button
					type="button"
					class="la-seg"
					aria-pressed={presetId === p.id}
					onclick={() => usePreset(p.m)}>{p.label}</button
				>
			{/each}
		</div>
		<button type="button" class="la-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="la-matrix">
		<span class="la-bracket">(</span>
		<span class="la-grid2">
			<span>{fmtEntry(m.a)}</span><span>{fmtEntry(m.b)}</span>
			<span>{fmtEntry(m.c)}</span><span>{fmtEntry(m.d)}</span>
		</span>
		<span class="la-bracket">)</span>
		<span class="la-hint"
			>Перетащите конец вектора e₁ или e₂ (стрелки на клавиатуре, Shift — крупный шаг).</span
		>
	</div>

	<div class="la-plot">
		<svg
			bind:this={svgEl}
			class="la-svg"
			viewBox="{-HALF} {-HALF} {2 * HALF} {2 * HALF}"
			role="img"
			aria-labelledby="la-title la-desc"
			onpointermove={onMove}
			onpointerup={onUp}
			onpointercancel={onUp}
		>
			<title id="la-title">Матрица как преобразование плоскости</title>
			<desc id="la-desc">{note}</desc>

			<path class="la-grid0" d={grid0D} />
			<path class="la-circle0" d={circle0D} />

			<path class="la-grid" d={gridD} />
			<path class="la-ellipse" d={ellipseD} />

			{#if eig.real}
				{#each eig.vectors as v, i (i)}
					<path class="la-eig" d={through(v)} />
				{/each}
			{/if}

			{#each sv.u as u, i (i)}
				<path class="la-axis" d={line([u[0] * (sv.sigma[i] ?? 0), u[1] * (sv.sigma[i] ?? 0)])} />
			{/each}

			<path class="la-vec la-vec-1" d={line(e1)} />
			<path class="la-vec la-vec-2" d={line(e2)} />

			{#each [e1, e2] as p, k (k)}
				<g
					class="la-handle"
					class:is-drag={drag === k}
					role="button"
					tabindex="0"
					aria-label={k === 0
						? `Вектор e₁ переходит в (${fmtEntry(m.a)}, ${fmtEntry(m.c)}). Перетащите или используйте стрелки.`
						: `Вектор e₂ переходит в (${fmtEntry(m.b)}, ${fmtEntry(m.d)}). Перетащите или используйте стрелки.`}
					onpointerdown={(e) => onHandleDown(k as 0 | 1, e)}
					onkeydown={(e) => onKey(k as 0 | 1, e)}
				>
					<circle class="la-hit" cx={p[0]} cy={-p[1]} r="0.35" />
					<circle class="la-dot" class:la-dot-2={k === 1} cx={p[0]} cy={-p[1]} r="0.13" />
					<text class="la-label" x={p[0] + 0.2} y={-p[1] - 0.2}>e{k === 0 ? '₁' : '₂'}</text>
				</g>
			{/each}
		</svg>
	</div>

	<dl class="la-stats">
		<dt>det A</dt>
		<dd>{fmt(dt)}</dd>
		<dt>Собственные числа</dt>
		<dd>
			{#if eig.real}
				{fmt(eig.values[0])}, {fmt(eig.values[1])}
			{:else}
				комплексные
			{/if}
		</dd>
		<dt>Сингулярные числа σ</dt>
		<dd>{fmt(sv.sigma[0])}, {fmt(sv.sigma[1])}</dd>
		<dt>Ошибка ранга 1</dt>
		<dd>‖A − A₁‖<sub>F</sub> = {fmt(err1)}</dd>
	</dl>

	<p class="la-note" aria-live="polite">
		<strong>Что заметить:</strong>
		{note}
	</p>
</figure>

<style>
	.la {
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
	.la :global(*),
	.la :global(*::before),
	.la :global(*::after) {
		box-sizing: border-box;
	}
	.la dl,
	.la dd,
	.la dt,
	.la p {
		margin: 0;
	}
	.la button {
		font: inherit;
	}
	.la sub {
		font-size: 0.75em;
	}

	/* Controls */
	.la-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.la-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.la-seg,
	.la-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.la-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
	}
	.la-reset {
		border-color: var(--border);
		color: var(--text);
	}
	.la-seg:focus-visible,
	.la-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Matrix readout */
	.la-matrix {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4) 0;
	}
	.la-bracket {
		font-family: var(--font-mono);
		font-size: 32px;
		line-height: 1;
		color: var(--text-muted);
	}
	.la-grid2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(48px, auto));
		gap: var(--space-1) var(--space-4);
		font-family: var(--font-mono);
		font-size: var(--fs-base);
		text-align: right;
	}
	.la-hint {
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}

	/* Plot */
	.la-plot {
		max-width: 420px;
		margin: 0 auto;
	}
	.la-svg {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		touch-action: none;
		user-select: none;
	}
	.la-grid0 {
		fill: none;
		stroke: var(--border);
		stroke-width: 0.02;
	}
	.la-circle0 {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 0.02;
		stroke-dasharray: 0.08 0.08;
	}
	.la-grid {
		fill: none;
		stroke: var(--topic);
		stroke-opacity: 0.35;
		stroke-width: 0.025;
	}
	.la-ellipse {
		fill: color-mix(in srgb, var(--topic) 14%, transparent);
		stroke: var(--topic);
		stroke-width: 0.06;
	}
	.la-eig {
		fill: none;
		stroke: var(--cat-1);
		stroke-width: 0.03;
		stroke-dasharray: 0.12 0.08;
	}
	.la-axis {
		fill: none;
		stroke: var(--cat-4);
		stroke-width: 0.05;
	}
	.la-vec {
		fill: none;
		stroke: var(--text);
		stroke-width: 0.04;
	}
	.la-vec-1 {
		stroke: var(--cat-3);
	}
	.la-handle {
		cursor: grab;
		outline: none;
	}
	.la-handle.is-drag {
		cursor: grabbing;
	}
	.la-hit {
		fill: transparent;
	}
	.la-dot {
		fill: var(--cat-3);
		stroke: var(--surface);
		stroke-width: 0.03;
	}
	.la-dot-2 {
		fill: var(--cat-4);
	}
	.la-handle:focus-visible .la-dot {
		stroke: var(--text);
		stroke-width: 0.06;
	}
	.la-label {
		font-family: var(--font-mono);
		font-size: 0.22px;
		fill: var(--text);
		pointer-events: none;
	}

	/* Readout */
	.la-stats {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-2) var(--space-6);
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.la-stats dt {
		color: var(--text-muted);
	}
	.la-stats dd {
		font-family: var(--font-mono);
	}
	.la-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.la-note strong {
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.la * {
			transition: none !important;
		}
	}
	@media (max-width: 720px) {
		.la {
			padding: var(--space-4);
		}
	}
	@media (max-width: 559px) {
		.la-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.la-group {
			display: flex;
		}
		.la-group .la-seg {
			flex: 1;
		}
		.la-stats {
			grid-template-columns: 1fr;
			gap: var(--space-1);
		}
		.la-stats dd {
			margin-bottom: var(--space-2);
		}
	}
</style>
