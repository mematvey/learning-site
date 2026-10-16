<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		BINOM_N_MAX,
		BINOM_N_MIN,
		BINOM_P_MAX,
		BINOM_P_MIN,
		BINOM_P_STEP,
		DEFAULT_STATE,
		LAMBDA_MAX,
		LAMBDA_MIN,
		LAMBDA_STEP,
		MU_MAX,
		MU_MIN,
		NORM_AXIS,
		NORM_STEP,
		SEG_K_MAX,
		SEG_X_MAX,
		SEG_X_MIN,
		SEG_X_STEP,
		SIGMA_MAX,
		SIGMA_MIN,
		type DistributionsDemoState,
		type PmfBar,
		binomBars,
		describeBinomial,
		describeNormal,
		describePoisson,
		formatNumber,
		mergeState,
		normalCurve,
		normalPdf,
		normalSegmentProb,
		poissonBars,
	} from '$lib/demos/distributions';

	/** Binomial, Poisson and normal distributions side by side. Registers itself as demo `distributions`. */
	let { initial }: { initial?: Partial<DistributionsDemoState> } = $props();

	// The props only seed the starting state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	const start = mergeState(DEFAULT_STATE, initial ?? {});
	let s = $state<DistributionsDemoState>(start);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	// Chart geometry in viewBox units (320 x 190).
	const W = 320;
	const L = 34;
	const R = 312;
	const T = 12;
	const B = 168;
	const plotW = R - L;
	const plotH = B - T;

	interface Rect {
		k: number;
		x: number;
		y: number;
		w: number;
		h: number;
		inside: boolean;
	}

	/** Bars for a PMF; the tallest bar takes 90% of the plot height. */
	function barRects(bars: PmfBar[]): { rects: Rect[]; sum: number; tickStep: number } {
		const top = Math.max(0.01, ...bars.map((b) => b.p)) * 1.1;
		const slot = plotW / bars.length;
		const w = slot * 0.8;
		const rects = bars.map((b, i) => {
			const h = (b.p / top) * plotH;
			return { k: b.k, x: L + i * slot + (slot - w) / 2, y: B - h, w, h, inside: b.inside };
		});
		const sum = bars.reduce((acc, b) => acc + b.p, 0);
		return { rects, sum, tickStep: Math.ceil(bars.length / 10) };
	}

	const binom = $derived(barRects(binomBars(s.n, s.p, s.binomLo, s.binomHi)));
	const poisson = $derived(barRects(poissonBars(s.lambda, s.poisLo, s.poisHi)));

	const normYMax = $derived(normalPdf(s.mu, s.mu, s.sigma) * 1.1);
	const normProb = $derived(normalSegmentProb(s.mu, s.sigma, s.normLo, s.normHi));
	const xToPx = (x: number) => L + ((x + NORM_AXIS) / (2 * NORM_AXIS)) * plotW;
	const yToPx = (y: number) => B - (y / normYMax) * plotH;

	const normCurve = $derived(
		normalCurve(s.mu, s.sigma).map((pt) => `${xToPx(pt.x).toFixed(1)},${yToPx(pt.y).toFixed(1)}`),
	);
	/** Filled area under the density between the segment ends. */
	const normArea = $derived.by(() => {
		const pts: string[] = [`${xToPx(s.normLo).toFixed(1)},${B}`];
		pts.push(
			`${xToPx(s.normLo).toFixed(1)},${yToPx(normalPdf(s.normLo, s.mu, s.sigma)).toFixed(1)}`,
		);
		for (const pt of normalCurve(s.mu, s.sigma)) {
			if (pt.x > s.normLo && pt.x < s.normHi) {
				pts.push(`${xToPx(pt.x).toFixed(1)},${yToPx(pt.y).toFixed(1)}`);
			}
		}
		pts.push(
			`${xToPx(s.normHi).toFixed(1)},${yToPx(normalPdf(s.normHi, s.mu, s.sigma)).toFixed(1)}`,
		);
		pts.push(`${xToPx(s.normHi).toFixed(1)},${B}`);
		return pts.join(' ');
	});
	const normTicks = [-10, -5, 0, 5, 10];

	const binomMean = $derived(s.n * s.p);
	const binomVar = $derived(s.n * s.p * (1 - s.p));

	/** Applies a patch from the sliders or from the text (`DemoLink`). Keeps the state clamped and ordered. */
	function update(patch: Partial<DistributionsDemoState>): void {
		s = mergeState(s, patch);
	}

	function reset(): void {
		s = start;
	}

	onMount(() => {
		return demos?.register('distributions', {
			set: (patch) => update(patch as Partial<DistributionsDemoState>),
		});
	});
</script>

{#snippet slider(
	label: string,
	min: number,
	max: number,
	step: number,
	value: number,
	shown: string,
	set: (v: number) => void,
)}
	<label class="dd-ctl">
		<span class="dd-label">{label}</span>
		<input
			class="dd-range"
			type="range"
			{min}
			{max}
			{step}
			{value}
			oninput={(e) => set(Number(e.currentTarget.value))}
		/>
		<output class="dd-val">{shown}</output>
	</label>
{/snippet}

<figure class="dd" id="demo-distributions" data-demo="distributions">
	<div class="dd-plots">
		<section class="dd-panel dd-binom" aria-labelledby="dd-binom-t">
			<h3 class="dd-panel-t" id="dd-binom-t">Биномиальное</h3>
			<p class="dd-formula">P(X = k) = C(n, k) p<sup>k</sup>(1 − p)<sup>n−k</sup></p>

			<div class="dd-controls">
				{@render slider('n', BINOM_N_MIN, BINOM_N_MAX, 1, s.n, String(s.n), (v) =>
					update({ n: v }),
				)}
				{@render slider(
					'p',
					BINOM_P_MIN,
					BINOM_P_MAX,
					BINOM_P_STEP,
					s.p,
					formatNumber(s.p, 2),
					(v) => update({ p: v }),
				)}
				{@render slider('от', 0, s.n, 1, s.binomLo, String(s.binomLo), (v) =>
					update({ binomLo: v }),
				)}
				{@render slider('до', 0, s.n, 1, s.binomHi, String(s.binomHi), (v) =>
					update({ binomHi: v }),
				)}
			</div>

			<svg
				class="dd-svg"
				viewBox="0 0 {W} 190"
				role="img"
				aria-labelledby="dd-binom-title dd-binom-desc"
			>
				<title id="dd-binom-title">Биномиальное распределение: столбцы P(X = k)</title>
				<desc id="dd-binom-desc">{describeBinomial(s)}</desc>
				<line class="dd-axis" x1={L} x2={R} y1={B} y2={B} />
				{#each binom.rects as r (r.k)}
					<rect
						class="dd-bar"
						class:dd-bar-in={r.inside}
						x={r.x.toFixed(1)}
						y={r.y.toFixed(1)}
						width={r.w.toFixed(1)}
						height={r.h.toFixed(1)}
						style="--bar: var(--cat-1)"
					/>
					{#if r.k % binom.tickStep === 0}
						<text class="dd-tick" x={(r.x + r.w / 2).toFixed(1)} y="182">{r.k}</text>
					{/if}
				{/each}
			</svg>

			<p class="dd-state" aria-live="polite">{describeBinomial(s)}</p>
			<p class="dd-sum">
				Сумма столбцов: {formatNumber(binom.sum, 3)}; среднее np = {formatNumber(binomMean, 2)},
				дисперсия np(1 − p) = {formatNumber(binomVar, 2)}
			</p>
		</section>

		<section class="dd-panel dd-pois" aria-labelledby="dd-pois-t">
			<h3 class="dd-panel-t" id="dd-pois-t">Пуассона</h3>
			<p class="dd-formula">P(X = k) = λ<sup>k</sup> e<sup>−λ</sup> / k!</p>

			<div class="dd-controls">
				{@render slider(
					'λ',
					LAMBDA_MIN,
					LAMBDA_MAX,
					LAMBDA_STEP,
					s.lambda,
					formatNumber(s.lambda, 1),
					(v) => update({ lambda: v }),
				)}
				{@render slider('от', 0, SEG_K_MAX, 1, s.poisLo, String(s.poisLo), (v) =>
					update({ poisLo: v }),
				)}
				{@render slider('до', 0, SEG_K_MAX, 1, s.poisHi, String(s.poisHi), (v) =>
					update({ poisHi: v }),
				)}
			</div>

			<svg
				class="dd-svg"
				viewBox="0 0 {W} 190"
				role="img"
				aria-labelledby="dd-pois-title dd-pois-desc"
			>
				<title id="dd-pois-title">Распределение Пуассона: столбцы P(X = k)</title>
				<desc id="dd-pois-desc">{describePoisson(s)}</desc>
				<line class="dd-axis" x1={L} x2={R} y1={B} y2={B} />
				{#each poisson.rects as r (r.k)}
					<rect
						class="dd-bar"
						class:dd-bar-in={r.inside}
						x={r.x.toFixed(1)}
						y={r.y.toFixed(1)}
						width={r.w.toFixed(1)}
						height={r.h.toFixed(1)}
						style="--bar: var(--cat-2)"
					/>
					{#if r.k % poisson.tickStep === 0}
						<text class="dd-tick" x={(r.x + r.w / 2).toFixed(1)} y="182">{r.k}</text>
					{/if}
				{/each}
			</svg>

			<p class="dd-state" aria-live="polite">{describePoisson(s)}</p>
			<p class="dd-sum">
				Сумма столбцов: {formatNumber(poisson.sum, 3)}; среднее и дисперсия равны λ = {formatNumber(
					s.lambda,
					1,
				)}
			</p>
		</section>

		<section class="dd-panel dd-norm" aria-labelledby="dd-norm-t">
			<h3 class="dd-panel-t" id="dd-norm-t">Нормальное</h3>
			<p class="dd-formula">f(x) = exp(−(x − μ)² / 2σ²) / (σ√(2π))</p>

			<div class="dd-controls">
				{@render slider('μ', MU_MIN, MU_MAX, NORM_STEP, s.mu, formatNumber(s.mu, 1), (v) =>
					update({ mu: v }),
				)}
				{@render slider(
					'σ',
					SIGMA_MIN,
					SIGMA_MAX,
					NORM_STEP,
					s.sigma,
					formatNumber(s.sigma, 1),
					(v) => update({ sigma: v }),
				)}
				{@render slider(
					'от',
					SEG_X_MIN,
					SEG_X_MAX,
					SEG_X_STEP,
					s.normLo,
					formatNumber(s.normLo, 1),
					(v) => update({ normLo: v }),
				)}
				{@render slider(
					'до',
					SEG_X_MIN,
					SEG_X_MAX,
					SEG_X_STEP,
					s.normHi,
					formatNumber(s.normHi, 1),
					(v) => update({ normHi: v }),
				)}
			</div>

			<svg
				class="dd-svg"
				viewBox="0 0 {W} 190"
				role="img"
				aria-labelledby="dd-norm-title dd-norm-desc"
			>
				<title id="dd-norm-title">Нормальное распределение: плотность и заливка отрезка</title>
				<desc id="dd-norm-desc">{describeNormal(s)}</desc>
				<line class="dd-axis" x1={L} x2={R} y1={B} y2={B} />
				<polygon class="dd-area" points={normArea} />
				<polyline class="dd-curve" points={normCurve.join(' ')} />
				{#each normTicks as t (t)}
					<text class="dd-tick" x={xToPx(t).toFixed(1)} y="182">{t}</text>
				{/each}
			</svg>

			<p class="dd-state" aria-live="polite">{describeNormal(s)}</p>
			<p class="dd-sum">
				Вероятность отрезка {formatNumber(normProb, 3)}; среднее μ и разброс σ задают форму кривой
			</p>
		</section>
	</div>

	<div class="dd-foot">
		<button type="button" class="dd-reset" onclick={reset}>Сбросить</button>
	</div>

	<p class="dd-notice">
		<strong>Что заметить:</strong> сумма высот столбцов и площадь под кривой равны единице при любых параметрах.
		Заливка или подсвеченные столбцы показывают часть этой единицы внутри отрезка.
	</p>
</figure>

<style>
	.dd {
		margin: 0;
		padding: var(--space-6) var(--space-6) var(--space-6);
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
	.dd :global(*),
	.dd :global(*::before),
	.dd :global(*::after) {
		box-sizing: border-box;
	}
	.dd p,
	.dd h3 {
		margin: 0;
	}
	.dd button {
		font: inherit;
	}

	.dd-plots {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--space-6);
	}
	.dd-panel {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.dd-panel-t {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.dd-formula {
		color: var(--text-muted);
		font-family: var(--font-serif);
		font-size: 13px;
		line-height: 1.4;
	}

	/* Controls */
	.dd-controls {
		display: grid;
		gap: var(--space-2);
	}
	.dd-ctl {
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 1fr) 3.5rem;
		align-items: center;
		gap: var(--space-2);
	}
	.dd-label {
		color: var(--text-muted);
		font-family: var(--font-serif);
		font-size: 15px;
	}
	.dd-range {
		width: 100%;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.dd-val {
		text-align: right;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.dd-range:focus-visible,
	.dd-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Charts */
	.dd-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		margin-top: var(--space-2);
	}
	.dd-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.dd-bar {
		fill: var(--bar);
		opacity: 0.3;
		transition: opacity var(--dur) var(--ease);
	}
	.dd-bar-in {
		opacity: 0.95;
	}
	.dd-curve {
		fill: none;
		stroke: var(--cat-3);
		stroke-width: 2;
	}
	.dd-area {
		fill: var(--cat-3);
		fill-opacity: 0.35;
	}
	.dd-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
		text-anchor: middle;
	}

	.dd-state {
		color: var(--text);
		font-size: 13px;
		font-family: var(--font-mono);
		word-break: break-word;
	}
	.dd-sum {
		color: var(--text-muted);
		font-size: 12px;
	}

	.dd-foot {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-4);
	}
	.dd-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: border-color var(--dur) var(--ease);
	}
	.dd-reset:hover {
		border-color: var(--topic);
	}

	.dd-notice {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.dd-bar,
		.dd-reset {
			transition: none;
		}
	}
</style>
