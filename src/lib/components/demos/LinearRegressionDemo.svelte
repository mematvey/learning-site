<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import katex from 'katex';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		GD_STEPS,
		LAMBDA_DEFAULT,
		LAMBDA_MAX,
		LAMBDA_MIN,
		LAMBDA_STEP,
		LR_DEFAULT,
		LR_MAX,
		LR_MIN,
		LR_STEP,
		addPoint,
		clampUnit,
		fitOls,
		fitRidge,
		fmt,
		gradientDescent,
		makePoints,
		mse,
		movePoint,
		predict,
		r2,
		removePoint,
		snapTo,
		type LinearRegressionDemoState,
		type Line,
		type Point,
	} from '$lib/demos/linear-regression';

	/** Least squares, ridge and gradient descent on a point cloud. Registers as demo `linear-regression`. */
	let { initial }: { initial?: Partial<LinearRegressionDemoState> } = $props();

	/* svelte-ignore state_referenced_locally */
	let lambda = $state(
		snapTo(initial?.lambda ?? LAMBDA_DEFAULT, LAMBDA_MIN, LAMBDA_MAX, LAMBDA_STEP),
	);
	/* svelte-ignore state_referenced_locally */
	let lr = $state(snapTo(initial?.lr ?? LR_DEFAULT, LR_MIN, LR_MAX, LR_STEP));
	let points = $state<Point[]>(makePoints());
	/** Index of the point being dragged with the pointer. */
	let drag = $state<number | null>(null);
	/** Real widths in px: plots are drawn at this size (no viewBox scaling). */
	let plotW = $state(0);
	let lossW = $state(0);
	let root: HTMLElement | undefined = $state();
	let svgEl: SVGSVGElement | undefined = $state();

	const PLOT_H = 300;
	const LOSS_H = 140;
	const PAD = 28;

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const W = $derived(plotW > 0 ? plotW : 360);
	const LW = $derived(lossW > 0 ? lossW : 360);

	const ols = $derived(fitOls(points));
	const ridge = $derived(fitRidge(points, lambda));
	const olsMse = $derived(ols ? mse(points, ols) : null);
	const olsR2 = $derived(ols ? r2(points, ols) : null);
	/** Ratio of the ridge slope to the least squares slope: 1 at λ = 0, 0 at large λ. */
	const shrink = $derived(ridge && ols && ols.a !== 0 ? ridge.a / ols.a : null);
	const gd = $derived(gradientDescent(points, lr, GD_STEPS));
	const diverged = $derived(gd.losses.some((v) => !Number.isFinite(v)));
	const gdEnd = $derived(gd.losses[GD_STEPS]);

	/** Data → plot pixels. Unit square maps to the frame inside PAD. */
	const sx = (x: number): number => PAD + x * (W - 2 * PAD);
	const sy = (y: number): number => PLOT_H - PAD - y * (PLOT_H - 2 * PAD);
	const lx = (k: number): number => PAD + (k / GD_STEPS) * (LW - 2 * PAD);

	function lineEnds(l: Line) {
		return { x1: sx(0), y1: sy(predict(l, 0)), x2: sx(1), y2: sy(predict(l, 1)) };
	}
	const olsEnds = $derived(ols ? lineEnds(ols) : null);
	const ridgeEnds = $derived(ridge && lambda > 0 ? lineEnds(ridge) : null);
	/** Vertical segments from each point to the least squares line. */
	const resLines = $derived(
		ols ? points.map((p) => ({ x: sx(p.x), y1: sy(p.y), y2: sy(predict(ols, p.x)) })) : [],
	);

	/** Loss curve: the scale covers finite losses and the least squares MSE. */
	const lossMax = $derived(
		Math.max(1e-9, ...gd.losses.filter((v) => Number.isFinite(v)), olsMse ?? 0),
	);
	const lossY = (v: number): number => PAD + (1 - v / lossMax) * (LOSS_H - 2 * PAD);
	const lossPath = $derived.by(() => {
		let d = '';
		gd.losses.forEach((v, k) => {
			if (!Number.isFinite(v)) return;
			d += `${d ? 'L' : 'M'}${lx(k).toFixed(1)} ${lossY(v).toFixed(1)} `;
		});
		return d.trim();
	});
	const olsLossY = $derived(olsMse !== null && Number.isFinite(olsMse) ? lossY(olsMse) : null);

	const TEX: Record<string, string> = {
		lambda: '\\lambda',
		fOls: '\\hat a = \\dfrac{\\sum_i (x_i-\\bar x)(y_i-\\bar y)}{\\sum_i (x_i-\\bar x)^2}',
		fRidge: '\\hat a_\\lambda = \\dfrac{S_{xy}}{S_{xx}+\\lambda}',
		fGd: 'a \\leftarrow a - \\eta\\,\\dfrac{\\partial L}{\\partial a}',
	};

	function apply(patch: Partial<LinearRegressionDemoState>): void {
		if (typeof patch.lambda === 'number') {
			lambda = snapTo(patch.lambda, LAMBDA_MIN, LAMBDA_MAX, LAMBDA_STEP);
		}
		if (typeof patch.lr === 'number') lr = snapTo(patch.lr, LR_MIN, LR_MAX, LR_STEP);
	}

	/** Pointer position in data coordinates (unit square), or null before mount. */
	function toData(e: MouseEvent): { x: number; y: number } | null {
		const rect = svgEl?.getBoundingClientRect();
		if (!rect) return null;
		const px = e.clientX - rect.left;
		const py = e.clientY - rect.top;
		return {
			x: clampUnit((px - PAD) / (W - 2 * PAD)),
			y: clampUnit((PLOT_H - PAD - py) / (PLOT_H - 2 * PAD)),
		};
	}

	function onBgClick(e: MouseEvent): void {
		const p = toData(e);
		if (p) points = addPoint(points, p.x, p.y);
	}

	function onPointDown(e: PointerEvent, i: number): void {
		e.stopPropagation();
		e.preventDefault();
		drag = i;
		svgEl?.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent): void {
		if (drag === null) return;
		const p = toData(e);
		if (p) points = movePoint(points, drag, p.x, p.y);
	}

	function endDrag(): void {
		drag = null;
	}

	/** Keyboard: arrows move the point (Shift = coarse step), Delete removes it. */
	function onPointKey(e: KeyboardEvent, i: number): void {
		const p = points[i];
		if (!p) return;
		const step = e.shiftKey ? 0.05 : 0.01;
		switch (e.key) {
			case 'ArrowLeft':
				points = movePoint(points, i, p.x - step, p.y);
				break;
			case 'ArrowRight':
				points = movePoint(points, i, p.x + step, p.y);
				break;
			case 'ArrowUp':
				points = movePoint(points, i, p.x, p.y + step);
				break;
			case 'ArrowDown':
				points = movePoint(points, i, p.x, p.y - step);
				break;
			case 'Delete':
			case 'Backspace':
				points = removePoint(points, i);
				break;
			default:
				return;
		}
		e.preventDefault();
	}

	/** Keyboard-friendly way to add a point: on the middle of the plot, at the current fit. */
	function addMid(): void {
		const y = ols ? predict(ols, 0.5) : 0.5;
		points = addPoint(points, 0.5, y);
	}

	function reset(): void {
		points = makePoints();
	}

	onMount(() => {
		// Renders KaTeX formulas; without a successful render the static fallback text stays.
		root?.querySelectorAll<HTMLElement>('.ld-tex[data-key]').forEach((el) => {
			const src = TEX[el.dataset.key ?? ''];
			if (!src) return;
			try {
				katex.render(src, el, { strict: 'ignore', throwOnError: false });
			} catch {
				/* keep fallback text */
			}
		});
		return demos?.register('linear-regression', {
			set: (patch) => apply(patch as Partial<LinearRegressionDemoState>),
		});
	});
</script>

<figure
	class="ld"
	id="demo-linear-regression"
	data-demo="linear-regression"
	class:hl-q={hl === 'q'}
	class:hl-k={hl === 'k'}
	class:hl-v={hl === 'v'}
	bind:this={root}
>
	<div class="ld-controls">
		<label class="ld-ctl">
			<span class="ld-label">Регуляризация <span class="ld-tex" data-key="lambda">λ</span></span>
			<input
				class="ld-range"
				type="range"
				min={LAMBDA_MIN}
				max={LAMBDA_MAX}
				step={LAMBDA_STEP}
				value={lambda}
				oninput={(e) => (lambda = Number((e.currentTarget as HTMLInputElement).value))}
			/>
			<output class="ld-val">λ = {fmt(lambda)}</output>
		</label>
		<button type="button" class="ld-btn" onclick={addMid}>Добавить точку</button>
		<button type="button" class="ld-btn" onclick={reset}>Сбросить точки</button>
	</div>

	<div class="ld-plot" bind:clientWidth={plotW}>
		<svg
			class="ld-svg"
			width={W}
			height={PLOT_H}
			viewBox="0 0 {W} {PLOT_H}"
			bind:this={svgEl}
			role="group"
			aria-label="Точки и прямая регрессии. Клик по полю добавляет точку, перетаскивание двигает её."
			onpointermove={onPointerMove}
			onpointerup={endDrag}
			onpointercancel={endDrag}
		>
			<!-- Pointer-only shortcut: keyboard users add points with the "Добавить точку" button. -->
			<rect
				class="ld-bg"
				role="presentation"
				x={PAD}
				y={PAD}
				width={W - 2 * PAD}
				height={PLOT_H - 2 * PAD}
				onclick={onBgClick}
			/>
			<rect class="ld-frame" x={PAD} y={PAD} width={W - 2 * PAD} height={PLOT_H - 2 * PAD} />

			{#each resLines as r, i (i)}
				<line class="ld-res" x1={r.x} y1={r.y1} x2={r.x} y2={r.y2} />
			{/each}

			{#if olsEnds}
				<line class="ld-ols" x1={olsEnds.x1} y1={olsEnds.y1} x2={olsEnds.x2} y2={olsEnds.y2} />
			{/if}
			{#if ridgeEnds}
				<line
					class="ld-ridge"
					x1={ridgeEnds.x1}
					y1={ridgeEnds.y1}
					x2={ridgeEnds.x2}
					y2={ridgeEnds.y2}
				/>
			{/if}

			{#each points as p, i (i)}
				<g
					class="ld-pt"
					role="button"
					tabindex="0"
					aria-label="Точка {i + 1}: x = {fmt(p.x)}, y = {fmt(
						p.y,
					)}. Стрелки двигают, Delete удаляет."
					onpointerdown={(e) => onPointDown(e, i)}
					onkeydown={(e) => onPointKey(e, i)}
				>
					<circle class="ld-hit" cx={sx(p.x)} cy={sy(p.y)} r="12" />
					<circle class="ld-dot" cx={sx(p.x)} cy={sy(p.y)} r="5" />
				</g>
			{/each}
		</svg>
	</div>
	<p class="ld-hint">
		Клик по полю добавляет точку, перетаскивание двигает. Фокус на точке: стрелки двигают (с Shift —
		крупнее), Delete удаляет.
	</p>

	<div class="ld-bottom">
		<section class="ld-panel" aria-labelledby="ld-ols-title">
			<h3 id="ld-ols-title" class="ld-title">Прямая МНК и ridge</h3>
			{#if ols}
				<p class="ld-formula"><span class="ld-tex" data-key="fOls">\hat a = …</span></p>
				<dl class="ld-stats">
					<div>
						<dt>a (МНК)</dt>
						<dd>{fmt(ols.a)}</dd>
					</div>
					<div>
						<dt>b (МНК)</dt>
						<dd>{fmt(ols.b)}</dd>
					</div>
					<div>
						<dt>MSE</dt>
						<dd>{fmt(olsMse, 3)}</dd>
					</div>
					<div>
						<dt>R²</dt>
						<dd>{fmt(olsR2)}</dd>
					</div>
					<div>
						<dt>a<sub>λ</sub> / a</dt>
						<dd>{fmt(shrink)}</dd>
					</div>
				</dl>
				<p class="ld-formula ld-formula-ridge">
					<span class="ld-tex" data-key="fRidge">\hat a_\lambda = …</span>
				</p>
				<p class="ld-note">
					Сплошная линия — МНК, штриховая — ridge при λ = {fmt(lambda)}; a<sub>λ</sub> = {fmt(
						ridge?.a,
					)}.
				</p>
			{:else}
				<p class="ld-note">Прямая не определена: нужны минимум две точки с разными x.</p>
			{/if}
		</section>

		<section class="ld-panel" aria-labelledby="ld-gd-title">
			<h3 id="ld-gd-title" class="ld-title">Градиентный спуск</h3>
			<label class="ld-ctl">
				<span class="ld-label">Шаг <span class="ld-tex" data-key="eta">η</span></span>
				<input
					class="ld-range"
					type="range"
					min={LR_MIN}
					max={LR_MAX}
					step={LR_STEP}
					value={lr}
					oninput={(e) => (lr = Number((e.currentTarget as HTMLInputElement).value))}
				/>
				<output class="ld-val">η = {fmt(lr)}</output>
			</label>
			<div class="ld-plot ld-plot-loss" bind:clientWidth={lossW}>
				<svg
					class="ld-svg"
					width={LW}
					height={LOSS_H}
					viewBox="0 0 {LW} {LOSS_H}"
					role="img"
					aria-label="Кривая MSE по шагам градиентного спуска, {GD_STEPS} шагов"
				>
					<rect class="ld-frame" x={PAD} y={PAD} width={LW - 2 * PAD} height={LOSS_H - 2 * PAD} />
					{#if olsLossY !== null}
						<line class="ld-ref" x1={PAD} x2={LW - PAD} y1={olsLossY} y2={olsLossY} />
					{/if}
					<path class="ld-loss" d={lossPath} />
					<text class="ld-axis" x={PAD} y={LOSS_H - 6}>шаг 0</text>
					<text class="ld-axis" x={LW - PAD} y={LOSS_H - 6} text-anchor="end">шаг {GD_STEPS}</text>
				</svg>
			</div>
			<dl class="ld-stats">
				<div>
					<dt>a после шагов</dt>
					<dd>{fmt(gd.line.a)}</dd>
				</div>
				<div>
					<dt>b после шагов</dt>
					<dd>{fmt(gd.line.b)}</dd>
				</div>
				<div>
					<dt>MSE</dt>
					<dd>{fmt(gdEnd, 3)}</dd>
				</div>
			</dl>
			{#if diverged}
				<p class="ld-note ld-warn">Расходится: шаг слишком большой, значения вышли за пределы.</p>
			{:else}
				<p class="ld-note">Линия на графике — MSE на каждом из {GD_STEPS} шагов, с нуля.</p>
			{/if}
		</section>
	</div>
</figure>

<style>
	.ld {
		margin: 0;
		padding: var(--space-6) var(--space-8) var(--space-8);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.5;
		text-align: left;
		letter-spacing: normal;
		text-transform: none;
	}
	.ld :global(*),
	.ld :global(*::before),
	.ld :global(*::after) {
		box-sizing: border-box;
	}
	.ld p,
	.ld dl,
	.ld dd,
	.ld dt,
	.ld h3 {
		margin: 0;
	}
	.ld button {
		font: inherit;
	}
	.ld-tex {
		white-space: nowrap;
	}

	/* Controls */
	.ld-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ld-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.ld-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.ld-val {
		min-width: 9ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.ld-range {
		width: 180px;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.ld-btn {
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: 13px;
		cursor: pointer;
	}
	.ld-btn:focus-visible,
	.ld-range:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Plot */
	.ld-plot {
		margin-top: var(--space-4);
		width: 100%;
	}
	.ld-svg {
		display: block;
		max-width: 100%;
		height: auto;
		overflow: hidden;
		touch-action: none;
	}
	.ld-bg {
		fill: var(--surface-2);
		cursor: crosshair;
	}
	.ld-frame {
		fill: none;
		stroke: var(--border);
		pointer-events: none;
	}
	.ld-res {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 2 3;
		pointer-events: none;
	}
	.ld-ols {
		stroke: var(--text);
		stroke-width: 2;
		pointer-events: none;
	}
	.ld-ridge {
		stroke: var(--cat-2);
		stroke-width: 2;
		stroke-dasharray: 6 4;
		pointer-events: none;
	}
	.ld-pt {
		cursor: grab;
		outline: none;
	}
	.ld-pt:focus-visible .ld-dot {
		stroke: var(--accent);
		stroke-width: 3;
	}
	.ld-hit {
		fill: transparent;
	}
	.ld-dot {
		fill: var(--cat-1);
		stroke: var(--surface);
		stroke-width: 1.5;
	}
	.ld-hint {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT): q = points, k = ridge, v = loss curve */
	.ld.hl-q .ld-dot {
		stroke: var(--text);
		stroke-width: 2.5;
	}
	.ld.hl-k .ld-ridge {
		stroke-width: 4;
	}
	.ld.hl-v .ld-loss {
		stroke-width: 4;
	}

	/* Bottom panels */
	.ld-bottom {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-6) var(--space-8);
		margin-top: var(--space-6);
	}
	.ld-panel {
		min-width: 0;
	}
	.ld-title {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		margin-bottom: var(--space-2);
	}
	.ld-formula {
		margin-top: var(--space-2);
		color: var(--text);
		font-size: 13px;
		overflow-x: auto;
	}
	.ld-formula-ridge {
		margin-top: var(--space-1);
	}
	.ld-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-3);
	}
	.ld-stats dt {
		color: var(--text-muted);
		font-size: 12px;
	}
	.ld-stats dd {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.ld-loss {
		fill: none;
		stroke: var(--cat-3);
		stroke-width: 2;
	}
	.ld-ref {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 4 4;
	}
	.ld-axis {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.ld-note {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 12px;
	}
	.ld-warn {
		color: var(--warn);
	}

	@media (prefers-reduced-motion: reduce) {
		.ld *,
		.ld *::before,
		.ld *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.ld {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.ld-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.ld-range {
			width: 100%;
		}
		.ld-ctl {
			flex-wrap: nowrap;
		}
		.ld-bottom {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
