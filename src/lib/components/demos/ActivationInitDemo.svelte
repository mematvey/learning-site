<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		ACT_KINDS,
		ACT_LABEL,
		CURVE_MAX,
		CURVE_MIN,
		DEFAULT_STATE,
		DEPTH,
		HIST_RANGE,
		INIT_LABEL,
		LOG_MAX,
		LOG_MIN,
		WIDTHS,
		type ActKind,
		type ActivationInitDemoState,
		type InitKind,
		curve,
		curveDomain,
		describeState,
		histogram,
		isActKind,
		isInitKind,
		logSecondMoment,
		noteFor,
		perLayerFactor,
		simulate,
		snapLayer,
		snapWidth,
	} from '$lib/demos/activations-init';

	/** Activations, their slopes, and layer statistics for Xavier and He. Registers as demo `activations-init`. */
	let { initial }: { initial?: Partial<ActivationInitDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	const start: ActivationInitDemoState = {
		act: isActKind(initial?.act) ? initial.act : DEFAULT_STATE.act,
		init: isInitKind(initial?.init) ? initial.init : DEFAULT_STATE.init,
		layer: snapLayer(initial?.layer ?? DEFAULT_STATE.layer),
		width: snapWidth(initial?.width ?? DEFAULT_STATE.width),
	};

	let act = $state<ActKind>(start.act);
	let init = $state<InitKind>(start.init);
	let layer = $state(start.layer);
	let width = $state(start.width);
	/** Real widths of the charts in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wCurve = $state(0);
	let wVar = $state(0);
	let wHist = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const plotCurve = $derived(wCurve >= 120 ? wCurve : 320);
	const plotVar = $derived(wVar >= 120 ? wVar : 320);
	const plotHist = $derived(wHist >= 120 ? wHist : 320);
	const H = 170;
	const PAD_L = 34;
	const PAD_R = 8;
	const PAD_T = 10;
	const PAD_B = 26;

	const samples = $derived(curve(act));
	const domLo = $derived(curveDomain(act)[0]);
	const domHi = $derived(curveDomain(act)[1]);

	/** Both initialisations are simulated with the same seed; only the weight scale differs. */
	const simX = $derived(simulate(act, 'xavier', width));
	const simH = $derived(simulate(act, 'he', width));
	const sim = $derived(init === 'xavier' ? simX : simH);
	const hist = $derived(histogram(sim.values[layer] ?? []));
	const note = $derived(noteFor(act, init));
	const live = $derived(describeState({ act, init, layer, width }, sim));

	/** Map helpers for the curve chart. */
	function xCurve(z: number, w: number): number {
		return PAD_L + ((z - CURVE_MIN) / (CURVE_MAX - CURVE_MIN)) * (w - PAD_L - PAD_R);
	}
	function yCurve(v: number): number {
		return PAD_T + ((domHi - v) / (domHi - domLo)) * (H - PAD_T - PAD_B);
	}
	const zeroCurveY = $derived(yCurve(0));

	/** Map helpers for the variance chart: x is the layer index 0..DEPTH. */
	function xLayer(l: number, w: number): number {
		return PAD_L + (l / DEPTH) * (w - PAD_L - PAD_R);
	}
	function yLog(v: number): number {
		return PAD_T + ((LOG_MAX - v) / (LOG_MAX - LOG_MIN)) * (H - PAD_T - PAD_B);
	}
	function linePath(stats: readonly { secondMoment: number }[], w: number): string {
		return stats
			.map(
				(s, l) =>
					`${l === 0 ? 'M' : 'L'}${xLayer(l, w).toFixed(1)},${yLog(logSecondMoment(s.secondMoment)).toFixed(1)}`,
			)
			.join(' ');
	}
	const pathX = $derived(linePath(simX.stats, plotVar));
	const pathH = $derived(linePath(simH.stats, plotVar));
	const layerMarkX = $derived(xLayer(layer, plotVar).toFixed(1));
	const factorX = $derived(perLayerFactor(simX.stats, layer));
	const factorH = $derived(perLayerFactor(simH.stats, layer));

	/** Histogram bars: fractions per bin over [-HIST_RANGE, HIST_RANGE]. */
	const HIST_TOP = PAD_T;
	const histMax = $derived(Math.max(0.05, ...hist.fractions));
	const histBars = $derived.by(() => {
		const n = hist.fractions.length;
		const inner = plotHist - PAD_L - PAD_R;
		const slot = inner / n;
		const usable = H - PAD_T - PAD_B;
		return hist.fractions.map((f, i) => {
			const h = (f / histMax) * usable;
			return {
				x: PAD_L + i * slot + slot * 0.12,
				w: slot * 0.76,
				y: H - PAD_B - h,
				h,
				f,
			};
		});
	});

	/** Reset returns the demo to the start values of the chapter. */
	function apply(patch: Partial<ActivationInitDemoState>): void {
		if (isActKind(patch.act)) act = patch.act;
		if (isInitKind(patch.init)) init = patch.init;
		if (typeof patch.layer === 'number') layer = snapLayer(patch.layer);
		if (typeof patch.width === 'number') width = snapWidth(patch.width);
	}

	function reset(): void {
		apply(start);
	}

	onMount(() => {
		return demos?.register('activations-init', {
			set: (patch) => apply(patch as Partial<ActivationInitDemoState>),
		});
	});
</script>

<figure
	class="ia"
	id="demo-activations-init"
	data-demo="activations-init"
	class:hl-q={hl === 'q'}
	class:hl-v={hl === 'v'}
>
	<div class="ia-controls">
		<div class="ia-group" role="group" aria-label="Активация">
			{#each ACT_KINDS as k (k)}
				<button type="button" class="ia-seg" aria-pressed={act === k} onclick={() => (act = k)}
					>{ACT_LABEL[k]}</button
				>
			{/each}
		</div>

		<div class="ia-group" role="group" aria-label="Инициализация весов">
			<button
				type="button"
				class="ia-seg"
				aria-pressed={init === 'xavier'}
				onclick={() => (init = 'xavier')}>Xavier</button
			>
			<button
				type="button"
				class="ia-seg"
				aria-pressed={init === 'he'}
				onclick={() => (init = 'he')}>He</button
			>
		</div>

		<label class="ia-ctl">
			<span class="ia-label">слой</span>
			<input
				class="ia-range"
				type="range"
				min="1"
				max={DEPTH}
				step="1"
				value={layer}
				oninput={(e) => (layer = snapLayer(Number(e.currentTarget.value)))}
			/>
			<output class="ia-val">{layer}</output>
		</label>

		<label class="ia-ctl">
			<span class="ia-label">ширина n</span>
			<input
				class="ia-range"
				type="range"
				min="0"
				max={WIDTHS.length - 1}
				step="1"
				value={WIDTHS.indexOf(width as (typeof WIDTHS)[number])}
				oninput={(e) => (width = WIDTHS[Number(e.currentTarget.value)] ?? width)}
			/>
			<output class="ia-val">{width}</output>
		</label>

		<button type="button" class="ia-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="ia-plots">
		<div class="ia-panel" bind:clientWidth={wCurve}>
			<p class="ia-panel-t">Активация и её производная</p>
			<svg
				class="ia-svg"
				viewBox="0 0 {plotCurve} {H}"
				role="img"
				aria-labelledby="ia-curve-title ia-curve-desc"
			>
				<title id="ia-curve-title">Функция {ACT_LABEL[act]} и её производная</title>
				<desc id="ia-curve-desc"
					>Сплошная линия: f(z) для {ACT_LABEL[act]}. Пунктир: производная f′(z). Диапазон z от −4
					до 4.</desc
				>
				<line class="ia-zero" x1={PAD_L} x2={plotCurve - PAD_R} y1={zeroCurveY} y2={zeroCurveY} />
				<path
					class="ia-line-f"
					d={samples
						.map(
							(p, i) =>
								`${i === 0 ? 'M' : 'L'}${xCurve(p.z, plotCurve).toFixed(1)},${yCurve(p.f).toFixed(1)}`,
						)
						.join(' ')}
				/>
				<path
					class="ia-line-d"
					d={samples
						.map(
							(p, i) =>
								`${i === 0 ? 'M' : 'L'}${xCurve(p.z, plotCurve).toFixed(1)},${yCurve(p.d).toFixed(1)}`,
						)
						.join(' ')}
				/>
				<text class="ia-tick" x={PAD_L - 4} y={yCurve(domHi).toFixed(1)} text-anchor="end"
					>{domHi.toFixed(1)}</text
				>
				<text class="ia-tick" x={PAD_L - 4} y={yCurve(domLo).toFixed(1)} text-anchor="end"
					>{domLo.toFixed(1)}</text
				>
				<text class="ia-tick" x={PAD_L} y={H - 6}>{CURVE_MIN}</text>
				<text class="ia-tick" x={plotCurve - PAD_R} y={H - 6} text-anchor="end">{CURVE_MAX}</text>
			</svg>
			<p class="ia-legend">
				<span class="ia-key ia-key-f"></span> f(z)
				<span class="ia-key ia-key-d"></span> f′(z)
			</p>
		</div>

		<div class="ia-panel" bind:clientWidth={wVar}>
			<p class="ia-panel-t">E[a²] по слоям</p>
			<svg
				class="ia-svg"
				viewBox="0 0 {plotVar} {H}"
				role="img"
				aria-labelledby="ia-var-title ia-var-desc"
			>
				<title id="ia-var-title">Второй момент активаций по слоям</title>
				<desc id="ia-var-desc"
					>Логарифмический масштаб. Xavier: {factorX.toFixed(2)} на слой. He: {factorH.toFixed(2)} на
					слой, для выбранного слоя {layer}.</desc
				>
				{#each [-4, -3, -2, -1, 0, 1] as t (t)}
					<line
						class="ia-grid"
						x1={PAD_L}
						x2={plotVar - PAD_R}
						y1={yLog(t).toFixed(1)}
						y2={yLog(t).toFixed(1)}
					/>
					<text class="ia-tick" x={PAD_L - 4} y={(yLog(t) + 3).toFixed(1)} text-anchor="end"
						>1e{t}</text
					>
				{/each}
				<line class="ia-marker" x1={layerMarkX} x2={layerMarkX} y1={PAD_T} y2={H - PAD_B} />
				<path class="ia-line-xavier" d={pathX} />
				<path class="ia-line-he" d={pathH} />
				{#each [0, 5, 10] as l (l)}
					<text class="ia-tick" x={xLayer(l, plotVar).toFixed(1)} y={H - 6} text-anchor="middle"
						>{l}</text
					>
				{/each}
			</svg>
			<p class="ia-legend">
				<span class="ia-key ia-key-x"></span> Xavier
				<span class="ia-key ia-key-h"></span> He
			</p>
		</div>
	</div>

	<div class="ia-hist" bind:clientWidth={wHist}>
		<p class="ia-panel-t">
			Гистограмма активаций слоя {layer}, {INIT_LABEL[init]}
			<span class="ia-muted">(за пределами ±{HIST_RANGE}: {(hist.outside * 100).toFixed(1)}%)</span>
		</p>
		<svg
			class="ia-svg"
			viewBox="0 0 {plotHist} {H}"
			role="img"
			aria-labelledby="ia-hist-title ia-hist-desc"
		>
			<title id="ia-hist-title">Гистограмма активаций</title>
			<desc id="ia-hist-desc">{live}</desc>
			<line class="ia-zero" x1={PAD_L} x2={plotHist - PAD_R} y1={H - PAD_B} y2={H - PAD_B} />
			{#each histBars as b, i (i)}
				<rect
					class="ia-bar"
					x={b.x.toFixed(1)}
					y={b.y.toFixed(1)}
					width={b.w.toFixed(1)}
					height={b.h.toFixed(1)}
				>
					<title>{(b.f * 100).toFixed(1)}% значений</title>
				</rect>
			{/each}
			<text class="ia-tick" x={PAD_L} y={H - 6}>−{HIST_RANGE}</text>
			<text class="ia-tick" x={(plotHist + PAD_L) / 2} y={H - 6} text-anchor="middle">0</text>
			<text class="ia-tick" x={plotHist - PAD_R} y={H - 6} text-anchor="end">{HIST_RANGE}</text>
			<text class="ia-tick" x={PAD_L - 4} y={HIST_TOP + 8} text-anchor="end"
				>{(histMax * 100).toFixed(0)}%</text
			>
		</svg>
	</div>

	<dl class="ia-stats">
		<dt>Слой {layer}</dt>
		<dd class="ia-h">Xavier</dd>
		<dd class="ia-h">He</dd>
		<dt>E[a²]</dt>
		<dd>{simX.stats[layer]?.secondMoment.toFixed(3) ?? '—'}</dd>
		<dd>{simH.stats[layer]?.secondMoment.toFixed(3) ?? '—'}</dd>
		<dt>среднее на слой</dt>
		<dd>×{factorX.toFixed(2)}</dd>
		<dd>×{factorH.toFixed(2)}</dd>
	</dl>

	<p class="ia-live" aria-live="polite">{live}</p>
	<p class="ia-note">{note}</p>

	<div class="ia-look">
		<p class="ia-look-t">Что заметить</p>
		<ul>
			<li>
				С ReLU инициализация Xavier даёт падение E[a²] примерно вдвое на слой, а He его сохраняет.
			</li>
			<li>
				Для tanh Xavier даёт заметно более слабый сигнал к глубине, чем He: сравните кривые на
				графике E[a²].
			</li>
			<li>Ширина n почти не меняет среднее на слой, но делает оценку точнее.</li>
		</ul>
	</div>
</figure>

<style>
	.ia {
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
	.ia :global(*),
	.ia :global(*::before),
	.ia :global(*::after) {
		box-sizing: border-box;
	}
	.ia dl,
	.ia dd,
	.ia dt,
	.ia p,
	.ia ul {
		margin: 0;
	}
	.ia ul {
		padding-left: var(--space-5);
	}
	.ia button {
		font: inherit;
	}
	.ia-muted {
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 400;
	}

	/* Controls */
	.ia-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ia-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.ia-seg {
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
	.ia-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.ia-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.ia-seg:focus-visible,
	.ia-reset:focus-visible,
	.ia-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.ia-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.ia-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.ia-range {
		width: 130px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.ia-val {
		min-width: 3ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Charts */
	.ia-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.ia-hist {
		margin-top: var(--space-6);
	}
	.ia-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.ia-svg {
		display: block;
		width: 100%;
		height: 170px;
		overflow: visible;
	}
	.ia-zero {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.ia-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.ia-marker {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.ia-line-f,
	.ia-line-xavier {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2;
	}
	.ia-line-d,
	.ia-line-he {
		fill: none;
		stroke: var(--cat-2);
		stroke-width: 2;
	}
	.ia-line-d {
		stroke-dasharray: 5 4;
	}
	.ia-line-he {
		stroke: var(--cat-3);
	}
	.ia-bar {
		fill: var(--topic);
	}
	.ia-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.ia-legend {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.ia-key {
		display: inline-block;
		width: 16px;
		height: 0;
		margin: 0 var(--space-1) 3px var(--space-2);
		vertical-align: middle;
		border-top: 2px solid var(--topic);
	}
	.ia-key-d {
		border-top-style: dashed;
		border-top-color: var(--cat-2);
	}
	.ia-key-x {
		border-top-color: var(--topic);
	}
	.ia-key-h {
		border-top-color: var(--cat-3);
	}

	/* Live text and notes */
	.ia-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.ia-stats dt {
		color: var(--text-muted);
	}
	.ia-stats dt:first-child {
		color: var(--text);
		font-weight: 600;
	}
	.ia-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.ia-stats .ia-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-size: 12px;
	}
	.ia-live {
		margin-top: var(--space-4);
		color: var(--text);
	}
	.ia-note {
		margin-top: var(--space-2);
		color: var(--text-muted);
	}
	.ia-look {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	.ia-look-t {
		margin-bottom: var(--space-2);
		font-weight: 600;
		color: var(--text);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.ia.hl-q .ia-stats {
		opacity: 0.45;
	}
	.ia.hl-v .ia-plots {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
		border-radius: var(--radius);
	}

	@media (prefers-reduced-motion: reduce) {
		.ia *,
		.ia *::before,
		.ia *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.ia {
			padding: var(--space-4);
		}
		.ia-plots {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (max-width: 559px) {
		.ia-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.ia-ctl {
			flex-wrap: wrap;
		}
		.ia-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
