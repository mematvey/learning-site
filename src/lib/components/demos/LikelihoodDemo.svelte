<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import katex from 'katex';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DEFAULT_N,
		DEFAULT_S,
		N_MAX,
		N_MIN,
		N_STEP,
		type CurvePoint,
		type MleFisherDemoState,
		clampN,
		clampS,
		curvature,
		curve,
		describeFisher,
		mle,
		standardError,
		waldInterval,
	} from '$lib/demos/mle-fisher';

	/** Likelihood curve of a Bernoulli sample, with its Gaussian approximation. Registers as demo `mle-fisher`. */
	let { initial }: { initial?: Partial<MleFisherDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let n = $state(clampN(initial?.n ?? DEFAULT_N));
	/* svelte-ignore state_referenced_locally */
	let s = $state(clampS(initial?.s ?? DEFAULT_S, clampN(initial?.n ?? DEFAULT_N)));
	/** Real width of the chart in px; the SVG is drawn at this width (no viewBox scaling). */
	let width = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	/** Successes are kept in [1, n - 1] whenever n changes. */
	const sc = $derived(clampS(s, n));
	const phat = $derived(mle(sc, n));
	const se = $derived(standardError(sc, n));
	const kappa = $derived(curvature(sc, n));
	const ci = $derived(waldInterval(sc, n));
	const pts: CurvePoint[] = $derived(curve(sc, n));
	const note = $derived(describeFisher(sc, n));

	const H = 240;
	const M = { l: 40, r: 16, t: 14, b: 40 };
	const plotW = $derived(Math.max(120, (width || 520) - M.l - M.r));
	const plotH = H - M.t - M.b;

	const X = (p: number): number => M.l + p * plotW;
	const Y = (v: number): number => M.t + (1 - v) * plotH;

	function pathOf(points: CurvePoint[], key: 'exact' | 'approx'): string {
		return points
			.map((q, i) => `${i === 0 ? 'M' : 'L'}${X(q.p).toFixed(1)} ${Y(q[key]).toFixed(1)}`)
			.join(' ');
	}

	const exactD = $derived(pathOf(pts, 'exact'));
	const approxD = $derived(pathOf(pts, 'approx'));
	/** Wald interval clipped to the axis for drawing; the text keeps the unclipped numbers. */
	const bandX0 = $derived(X(Math.max(0, ci[0])));
	const bandX1 = $derived(X(Math.min(1, ci[1])));
	const ticks = [0, 0.25, 0.5, 0.75, 1];
	const tickLabel = (p: number): string => String(p).replace('.', ',');

	const TEX = String.raw`\mathrm{SE}(\hat p) = \dfrac{1}{\sqrt{n\, I(\hat p)}} = \sqrt{\dfrac{\hat p(1-\hat p)}{n}}`;

	/** Renders the KaTeX formula into the node; without a successful render the fallback text stays. */
	function tex(node: HTMLElement) {
		try {
			katex.render(TEX, node, { strict: 'ignore', throwOnError: false });
		} catch {
			/* keep fallback text */
		}
		return {};
	}

	function preset(pn: number, ps: number): void {
		n = pn;
		s = clampS(ps, pn);
	}

	function reset(): void {
		preset(DEFAULT_N, DEFAULT_S);
	}

	function apply(patch: Partial<MleFisherDemoState>): void {
		if (typeof patch.n === 'number') n = clampN(patch.n);
		if (typeof patch.s === 'number') s = clampS(patch.s, n);
	}

	onMount(() => {
		return demos?.register('mle-fisher', {
			set: (patch) => apply(patch as Partial<MleFisherDemoState>),
		});
	});
</script>

<figure class="mf" id="demo-mle-fisher" data-demo="mle-fisher">
	<div class="mf-controls">
		<div class="mf-presets" role="group" aria-label="Готовые примеры">
			<button type="button" class="mf-btn" onclick={() => preset(8, 6)}>6 из 8</button>
			<button type="button" class="mf-btn" onclick={() => preset(80, 49)}>49 из 80</button>
			<button type="button" class="mf-btn mf-reset" onclick={reset}>Сброс</button>
		</div>

		<label class="mf-ctl">
			<span class="mf-label"><span class="mf-sym">n</span> (число наблюдений)</span>
			<input
				class="mf-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step={N_STEP}
				value={n}
				oninput={(e) => (n = clampN(Number(e.currentTarget.value)))}
			/>
			<output class="mf-val">{n}</output>
		</label>

		<label class="mf-ctl">
			<span class="mf-label"><span class="mf-sym">s</span> (число успехов)</span>
			<input
				class="mf-range"
				type="range"
				min={1}
				max={n - 1}
				step={1}
				value={sc}
				oninput={(e) => (s = clampS(Number(e.currentTarget.value), n))}
			/>
			<output class="mf-val">{sc}</output>
		</label>
	</div>

	<div class="mf-chart" bind:clientWidth={width}>
		{#if width > 0}
			<svg
				class="mf-svg"
				{width}
				height={H}
				role="img"
				aria-label="Нормированное правдоподобие по θ: сплошная кривая точная, пунктир гауссова аппроксимация. Максимум в p̂ = {phat.toFixed(
					3,
				)}."
			>
				<line class="mf-axis" x1={M.l} x2={M.l + plotW} y1={Y(0)} y2={Y(0)} />
				<line class="mf-axis" x1={M.l} x2={M.l} y1={M.t} y2={Y(0)} />
				{#each ticks as t (t)}
					<line class="mf-grid" x1={X(t)} x2={X(t)} y1={M.t} y2={Y(0)} />
					<text class="mf-tick" x={X(t)} y={Y(0) + 16} text-anchor="middle">{tickLabel(t)}</text>
				{/each}
				<text class="mf-tick" x={M.l - 6} y={Y(1) + 4} text-anchor="end">1</text>
				<text class="mf-tick" x={M.l - 6} y={Y(0) + 4} text-anchor="end">0</text>
				<text class="mf-axis-label" x={M.l + plotW / 2} y={H - 4} text-anchor="middle">θ</text>

				<rect
					class="mf-band"
					x={bandX0}
					y={Y(0) + 4}
					width={Math.max(0, bandX1 - bandX0)}
					height="6"
				/>
				<line class="mf-mle" x1={X(phat)} x2={X(phat)} y1={M.t} y2={Y(0)} />
				<path class="mf-approx" d={approxD} fill="none" />
				<path class="mf-exact" d={exactD} fill="none" />
			</svg>
		{/if}
	</div>

	<dl class="mf-stats">
		<dt>Оценка</dt>
		<dd>p̂ = {phat.toFixed(4).replace('.', ',')}</dd>
		<dt>Кривизна (информация)</dt>
		<dd>{kappa.toFixed(0)}</dd>
		<dt>Стандартная ошибка</dt>
		<dd>SE = {se.toFixed(3).replace('.', ',')}</dd>
		<dt>95% интервал</dt>
		<dd>[{ci[0].toFixed(3).replace('.', ',')}; {ci[1].toFixed(3).replace('.', ',')}]</dd>
	</dl>

	<p class="mf-formula" use:tex>SE(p̂) = 1/√(n·I(p̂)) = √(p̂(1 − p̂)/n)</p>

	<p class="mf-note" aria-live="polite">{note}</p>
</figure>

<style>
	.mf {
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
	}

	.mf-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}

	.mf-presets {
		display: flex;
		gap: var(--space-2);
	}

	.mf-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-muted);
		font: inherit;
		cursor: pointer;
	}

	.mf-btn:hover {
		color: var(--text);
	}

	.mf-btn:focus-visible,
	.mf-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.mf-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: 1 1 220px;
		min-width: 0;
	}

	.mf-label {
		color: var(--text-muted);
		white-space: nowrap;
	}

	.mf-sym {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--text);
	}

	.mf-range {
		flex: 1;
		min-width: 0;
		accent-color: var(--topic);
	}

	.mf-val {
		min-width: 3ch;
		text-align: right;
		color: var(--text);
		font-family: var(--font-mono);
	}

	.mf-chart {
		margin-top: var(--space-4);
		width: 100%;
		overflow: hidden;
	}

	.mf-svg {
		display: block;
		max-width: 100%;
	}

	.mf-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
	}

	.mf-grid {
		stroke: var(--border);
		stroke-width: 1;
	}

	.mf-tick {
		fill: var(--text-muted);
		font-size: 11px;
		font-family: var(--font-mono);
	}

	.mf-axis-label {
		fill: var(--text-muted);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 13px;
	}

	.mf-exact {
		stroke: var(--topic);
		stroke-width: 2.5;
	}

	.mf-approx {
		stroke: var(--text-muted);
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
	}

	.mf-mle {
		stroke: var(--text);
		stroke-width: 1;
		stroke-dasharray: 2 3;
	}

	.mf-band {
		fill: var(--topic);
		fill-opacity: 0.35;
	}

	.mf-stats {
		display: grid;
		grid-template-columns: auto 1fr auto 1fr;
		gap: var(--space-2) var(--space-6);
		margin: var(--space-4) 0 0;
	}

	.mf-stats dt {
		color: var(--text-muted);
	}

	.mf-stats dd {
		margin: 0;
		color: var(--text);
		font-family: var(--font-mono);
	}

	.mf-formula {
		margin: var(--space-4) 0 0;
		color: var(--text);
		font-size: var(--fs-base);
		overflow-x: auto;
	}

	.mf-note {
		margin: var(--space-4) 0 0;
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.mf-btn {
			transition: none;
		}
	}

	@media (max-width: 559px) {
		.mf {
			padding: var(--space-4);
		}

		.mf-stats {
			grid-template-columns: 1fr 1fr;
		}

		.mf-stats dt {
			grid-column: span 2;
			margin-top: var(--space-2);
		}

		.mf-stats dd {
			grid-column: span 2;
		}
	}
</style>
