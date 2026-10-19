<script lang="ts">
	import {
		ALPHA,
		INITIAL_POINTS,
		X_MAX,
		X_MIN,
		Y_MAX,
		Y_MIN,
		analyze,
		bandHalfWidth,
		describeFit,
		fitOls,
		fmt,
		fmtP,
		snapX,
		snapY,
		type Point,
	} from '$lib/demos/regression';

	/** Least squares residuals demo: draggable points, residual squares, slope CI band and p-value. */
	let { initial }: { initial?: { points?: Point[] } } = $props();

	const VW = 360;
	const VH = 260;
	const ML = 34;
	const MR = 12;
	const MT = 12;
	const MB = 28;
	const PW = VW - ML - MR;
	const PH = VH - MT - MB;
	const CLIP_ID = 'ols-plot-clip';
	const KEY_STEP = 0.1;
	const KEY_STEP_FAST = 0.5;

	// The prop only seeds the initial points; reset returns to them.
	// svelte-ignore state_referenced_locally
	const startPoints = (initial?.points ?? INITIAL_POINTS).map((p) => ({ x: p.x, y: p.y }));
	let points = $state<Point[]>(startPoints);
	let svgEl: SVGSVGElement | undefined = $state();
	let dragIndex: number | null = $state(null);

	const fit = $derived(fitOls(points));
	const a = $derived(analyze(points));
	/** Per-point drawing data: pixel positions of the point and of its fitted value, residual and square side. */
	const geom = $derived(
		points.map((p) => {
			const yhat = fit ? fit.intercept + fit.slope * p.x : p.y;
			const r = p.y - yhat;
			return { x: px(p.x), y: py(p.y), yhat: py(yhat), r, side: Math.abs(r) * yScale };
		}),
	);
	const liveText = $derived(describeFit(a));

	const xTicks = [0, 1, 2, 3, 4, 5, 6];
	const yTicks = [0, 3, 6, 9, 12];

	function px(x: number): number {
		return ML + ((x - X_MIN) / (X_MAX - X_MIN)) * PW;
	}
	function py(y: number): number {
		return MT + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * PH;
	}
	/** Pixels per data unit on the y axis; residual squares use it so that their sides match the residuals. */
	const yScale = PH / (Y_MAX - Y_MIN);

	/** Confidence band of the mean response, drawn as one closed path. */
	const bandPath = $derived.by(() => {
		if (!a) return '';
		const xs: number[] = [];
		for (let i = 0; i <= 24; i++) xs.push(X_MIN + ((X_MAX - X_MIN) * i) / 24);
		const upper = xs.map((x) => {
			const yhat = a.intercept + a.slope * x;
			return `${px(x).toFixed(1)} ${py(yhat + bandHalfWidth(a, x)).toFixed(1)}`;
		});
		const lower = xs
			.map((x) => {
				const yhat = a.intercept + a.slope * x;
				return `${px(x).toFixed(1)} ${py(yhat - bandHalfWidth(a, x)).toFixed(1)}`;
			})
			.reverse();
		return `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`;
	});

	const linePts = $derived.by(() => {
		if (!fit) return null;
		return {
			x1: px(X_MIN),
			y1: py(fit.intercept + fit.slope * X_MIN),
			x2: px(X_MAX),
			y2: py(fit.intercept + fit.slope * X_MAX),
		};
	});

	/** Converts a pointer position in client px to data coordinates. */
	function toData(clientX: number, clientY: number): Point | null {
		if (!svgEl) return null;
		const rect = svgEl.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;
		const vx = ((clientX - rect.left) / rect.width) * VW;
		const vy = ((clientY - rect.top) / rect.height) * VH;
		return {
			x: X_MIN + ((vx - ML) / PW) * (X_MAX - X_MIN),
			y: Y_MAX - ((vy - MT) / PH) * (Y_MAX - Y_MIN),
		};
	}

	function startDrag(i: number, e: PointerEvent): void {
		dragIndex = i;
		e.preventDefault();
		svgEl?.setPointerCapture(e.pointerId);
	}

	function moveDrag(e: PointerEvent): void {
		if (dragIndex === null) return;
		const d = toData(e.clientX, e.clientY);
		if (!d) return;
		points[dragIndex] = { x: snapX(d.x), y: snapY(d.y) };
	}

	function endDrag(e: PointerEvent): void {
		if (dragIndex === null) return;
		dragIndex = null;
		if (svgEl?.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
	}

	function onKey(i: number, e: KeyboardEvent): void {
		const step = e.shiftKey ? KEY_STEP_FAST : KEY_STEP;
		const p = points[i];
		if (!p) return;
		let next: Point;
		switch (e.key) {
			case 'ArrowUp':
				next = { x: p.x, y: snapY(p.y + step) };
				break;
			case 'ArrowDown':
				next = { x: p.x, y: snapY(p.y - step) };
				break;
			case 'ArrowRight':
				next = { x: snapX(p.x + step), y: p.y };
				break;
			case 'ArrowLeft':
				next = { x: snapX(p.x - step), y: p.y };
				break;
			default:
				return;
		}
		e.preventDefault();
		points[i] = next;
	}

	function reset(): void {
		points = startPoints.map((p) => ({ x: p.x, y: p.y }));
	}

	function pointLabel(i: number): string {
		const p = points[i] ?? { x: 0, y: 0 };
		return `Точка ${i + 1}: x = ${fmt(p.x, 1)}, y = ${fmt(p.y, 1)}`;
	}
</script>

<figure class="ols" id="demo-ols-residuals" data-demo="ols-residuals">
	<div class="ols-head">
		<p class="ols-hint">
			Перетащите точку или выберите её и двигайте стрелками (с Shift шаг больше).
		</p>
		<button type="button" class="ols-reset" onclick={reset}>Сбросить</button>
	</div>

	<svg
		bind:this={svgEl}
		class="ols-svg"
		viewBox="0 0 {VW} {VH}"
		role="group"
		aria-labelledby="ols-title ols-desc"
		onpointermove={moveDrag}
		onpointerup={endDrag}
		onpointercancel={endDrag}
	>
		<title id="ols-title">Точки и прямая наименьших квадратов</title>
		<desc id="ols-desc">{liveText}</desc>

		<defs>
			<clipPath id={CLIP_ID}>
				<rect x={ML} y={MT} width={PW} height={PH} />
			</clipPath>
		</defs>

		{#each yTicks as t (t)}
			<line class="ols-grid" x1={ML} x2={VW - MR} y1={py(t)} y2={py(t)} />
			<text class="ols-tick" x={ML - 6} y={py(t) + 4} text-anchor="end">{t}</text>
		{/each}
		{#each xTicks as t (t)}
			<text class="ols-tick" x={px(t)} y={VH - 8} text-anchor="middle">{t}</text>
		{/each}
		<line class="ols-axis" x1={ML} x2={ML} y1={MT} y2={MT + PH} />
		<line class="ols-axis" x1={ML} x2={VW - MR} y1={MT + PH} y2={MT + PH} />

		<g clip-path="url(#{CLIP_ID})">
			{#if bandPath}
				<path class="ols-band" d={bandPath} />
			{/if}

			{#if linePts}
				<line class="ols-line" x1={linePts.x1} y1={linePts.y1} x2={linePts.x2} y2={linePts.y2} />
			{/if}

			{#each geom as g, i (i)}
				<rect
					class="ols-sq"
					class:is-neg={g.r < 0}
					x={g.x}
					y={Math.min(g.y, g.yhat)}
					width={g.side}
					height={g.side}
				/>
				<line class="ols-res" x1={g.x} y1={g.y} x2={g.x} y2={g.yhat} />
			{/each}
		</g>

		{#each points as p, i (i)}
			<circle
				class="ols-pt"
				class:is-drag={dragIndex === i}
				cx={px(p.x)}
				cy={py(p.y)}
				r="6"
				role="button"
				tabindex="0"
				aria-label={pointLabel(i)}
				onpointerdown={(e) => startDrag(i, e)}
				onkeydown={(e) => onKey(i, e)}
			/>
		{/each}
	</svg>

	<dl class="ols-stats">
		<div>
			<dt>Наклон β₁</dt>
			<dd>{a ? fmt(a.slope) : '—'}</dd>
		</div>
		<div>
			<dt>Свободный член β₀</dt>
			<dd>{a ? fmt(a.intercept) : '—'}</dd>
		</div>
		<div>
			<dt>SSE</dt>
			<dd>{a ? fmt(a.sse, 3) : '—'}</dd>
		</div>
		<div>
			<dt>SE(β₁)</dt>
			<dd>{a ? fmt(a.se, 3) : '—'}</dd>
		</div>
		<div>
			<dt>95%-й интервал</dt>
			<dd>{a ? `[${fmt(a.ci.lo)}; ${fmt(a.ci.hi)}]` : '—'}</dd>
		</div>
		<div class:is-warn={a !== null && a.p >= ALPHA}>
			<dt>p-значение наклона</dt>
			<dd>{a ? fmtP(a.p) : '—'}</dd>
		</div>
	</dl>

	<p class="ols-live" aria-live="polite">{liveText}</p>
</figure>

<style>
	.ols {
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
	.ols :global(*),
	.ols :global(*::before),
	.ols :global(*::after) {
		box-sizing: border-box;
	}
	.ols dl,
	.ols dd,
	.ols dt,
	.ols p {
		margin: 0;
	}
	.ols button {
		font: inherit;
	}

	.ols-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ols-hint {
		color: var(--text-muted);
	}
	.ols-reset {
		height: 32px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		cursor: pointer;
	}
	.ols-reset:focus-visible,
	.ols-pt:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.ols-svg {
		display: block;
		width: 100%;
		max-width: 560px;
		height: auto;
		margin-top: var(--space-4);
		touch-action: none;
		user-select: none;
	}
	.ols-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.ols-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.ols-tick {
		fill: var(--text-muted);
		font-size: 11px;
		font-family: var(--font-mono);
	}
	.ols-band {
		fill: var(--topic);
		fill-opacity: 0.15;
		stroke: none;
	}
	.ols-line {
		stroke: var(--topic);
		stroke-width: 2;
	}
	.ols-res {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.ols-sq {
		fill: var(--text-muted);
		fill-opacity: 0.2;
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.ols-sq.is-neg {
		fill-opacity: 0.1;
	}
	.ols-pt {
		fill: var(--surface);
		stroke: var(--text);
		stroke-width: 2;
		cursor: grab;
	}
	.ols-pt.is-drag {
		cursor: grabbing;
		fill: var(--topic);
	}

	.ols-stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3) var(--space-6);
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.ols-stats dt {
		color: var(--text-muted);
	}
	.ols-stats dd {
		font-family: var(--font-mono);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}
	.ols-stats .is-warn dd {
		color: var(--text);
		text-decoration: underline dotted;
	}

	.ols-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	@media (max-width: 420px) {
		.ols {
			padding: var(--space-5) var(--space-4) var(--space-6);
		}
		.ols-stats {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ols * {
			transition: none !important;
		}
	}
</style>
