<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		ALPHA_MAX,
		ALPHA_MIN,
		ALPHA_STEP,
		CI_DOMAIN,
		DEFAULT_SEED,
		DEFAULT_STATE,
		EFFECT_MAX,
		EFFECT_MIN,
		EFFECT_STEP,
		N_MAX,
		N_MIN,
		PEAK_MAX,
		REPS,
		type HypothesisTestDemoState,
		coverageShare,
		describeCoverage,
		describeTest,
		densityPath,
		makeScale,
		shadePath,
		simulateIntervals,
		snapAlpha,
		snapEffect,
		snapN,
		testDomain,
		testOutcome,
	} from '$lib/demos/estimation-testing';

	/** Confidence intervals and a z-test with errors I and II. Registers itself as demo `hypothesis-test`. */
	let { initial }: { initial?: Partial<HypothesisTestDemoState> } = $props();

	/* svelte-ignore state_referenced_locally */
	const start: HypothesisTestDemoState = {
		n: snapN(initial?.n ?? DEFAULT_STATE.n),
		alpha: snapAlpha(initial?.alpha ?? DEFAULT_STATE.alpha),
		effect: snapEffect(initial?.effect ?? DEFAULT_STATE.effect),
	};

	// The props only seed the initial state: the demo owns it afterwards.
	let n = $state(start.n);
	let alpha = $state(start.alpha);
	let effect = $state(start.effect);
	let seed = $state(DEFAULT_SEED);
	/** Real widths of the two charts in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wCi = $state(0);
	let wTest = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	/** Chart widths in px; 320 until the first measurement. */
	const plotWCi = $derived(wCi >= 120 ? wCi : 320);
	const plotWTest = $derived(wTest >= 120 ? wTest : 320);

	const CI_H = 240;
	const TEST_H = 180;
	const AXIS_H = 24;

	const intervals = $derived(simulateIntervals(n, alpha, 0, seed));
	const cov = $derived(coverageShare(intervals));
	const covText = $derived(describeCoverage(cov, alpha));

	const out = $derived(testOutcome(n, alpha, effect));
	const domain = $derived(testDomain(out.shift));
	const testText = $derived(describeTest(n, alpha, effect, out));

	/** Geometry of the interval chart: x in σ units around μ = 0. */
	const ciX = $derived(makeScale(-CI_DOMAIN, CI_DOMAIN, 0, plotWCi));
	const ciRow = (CI_H - 6) / REPS;
	const ciRows = $derived(
		intervals.map((iv, i) => ({
			y: 6 + ciRow * i + ciRow / 2,
			x1: ciX(iv.lo),
			x2: ciX(iv.hi),
			xm: ciX(iv.mean),
			ok: iv.covers,
		})),
	);

	/** Geometry of the test chart: density of Z under H0 (μ = 0) and under H1 (μ = δ√n). */
	const sy = makeScale(0, PEAK_MAX, TEST_H - AXIS_H, 10);
	const sx = $derived(makeScale(domain[0], domain[1], 0, plotWTest));
	const baseY = TEST_H - AXIS_H;
	const h0Line = $derived(densityPath(0, domain[0], domain[1], sx, sy));
	const h1Line = $derived(densityPath(out.shift, domain[0], domain[1], sx, sy));
	/** Type I error: H0 tails beyond ±z_crit. */
	const alphaArea = $derived(
		shadePath(0, domain[0], -out.zCrit, sx, sy, baseY) +
			' ' +
			shadePath(0, out.zCrit, domain[1], sx, sy, baseY),
	);
	/** Type II error: H1 mass inside (−z_crit, z_crit). */
	const betaArea = $derived(shadePath(out.shift, -out.zCrit, out.zCrit, sx, sy, baseY));
	const zPosX = $derived(sx(out.zCrit));
	const zNegX = $derived(sx(-out.zCrit));
	const zeroX = $derived(sx(0));
	const shiftX = $derived(sx(out.shift));

	const pct = (v: number) => `${Math.round(v * 100)}%`;

	function apply(patch: Partial<HypothesisTestDemoState>): void {
		if (typeof patch.n === 'number') n = snapN(patch.n);
		if (typeof patch.alpha === 'number') alpha = snapAlpha(patch.alpha);
		if (typeof patch.effect === 'number') effect = snapEffect(patch.effect);
	}

	function reset(): void {
		n = start.n;
		alpha = start.alpha;
		effect = start.effect;
		seed = DEFAULT_SEED;
	}

	onMount(() => {
		return demos?.register('hypothesis-test', {
			set: (patch) => apply(patch as Partial<HypothesisTestDemoState>),
		});
	});
</script>

<figure class="ht" id="demo-hypothesis-test" data-demo="hypothesis-test" class:hl-q={hl === 'q'}>
	<div class="ht-controls">
		<label class="ht-ctl">
			<span class="ht-label"><span class="ht-sym">n</span> (объём выборки)</span>
			<input
				class="ht-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step="1"
				value={n}
				oninput={(e) => (n = snapN(Number(e.currentTarget.value)))}
			/>
			<output class="ht-val">{n}</output>
		</label>

		<label class="ht-ctl">
			<span class="ht-label"><span class="ht-sym">α</span> (уровень значимости)</span>
			<input
				class="ht-range"
				type="range"
				min={ALPHA_MIN}
				max={ALPHA_MAX}
				step={ALPHA_STEP}
				value={alpha}
				oninput={(e) => (alpha = snapAlpha(Number(e.currentTarget.value)))}
			/>
			<output class="ht-val">{alpha.toFixed(2)}</output>
		</label>

		<label class="ht-ctl">
			<span class="ht-label"><span class="ht-sym">δ</span> (эффект, в σ)</span>
			<input
				class="ht-range"
				type="range"
				min={EFFECT_MIN}
				max={EFFECT_MAX}
				step={EFFECT_STEP}
				value={effect}
				oninput={(e) => (effect = snapEffect(Number(e.currentTarget.value)))}
			/>
			<output class="ht-val">{effect.toFixed(2)}</output>
		</label>

		<div class="ht-buttons">
			<button type="button" class="ht-btn" onclick={() => (seed += 1)}>Новая серия</button>
			<button type="button" class="ht-btn" onclick={reset}>Сбросить</button>
		</div>
	</div>

	<section class="ht-part" aria-labelledby="ht-ci-title">
		<h3 id="ht-ci-title" class="ht-part-t">Доверительные интервалы: {REPS} серий по n = {n}</h3>
		<p class="ht-muted">
			Каждая строка — интервал для μ при уровне {pct(1 - alpha)}. Зелёный накрыл истинное μ = 0,
			красный нет.
		</p>
		<div class="ht-panel" bind:clientWidth={wCi}>
			<svg
				class="ht-svg"
				viewBox="0 0 {plotWCi} {CI_H}"
				height={CI_H}
				role="img"
				aria-labelledby="ht-ci-svg-title ht-ci-svg-desc"
			>
				<title id="ht-ci-svg-title">Доверительные интервалы для среднего</title>
				<desc id="ht-ci-svg-desc">{covText}</desc>
				<line class="ht-mu" x1={ciX(0)} x2={ciX(0)} y1="0" y2={CI_H} />
				{#each ciRows as r, i (i)}
					<line
						class="ht-ci"
						class:is-miss={!r.ok}
						x1={r.x1.toFixed(1)}
						x2={r.x2.toFixed(1)}
						y1={r.y.toFixed(1)}
						y2={r.y.toFixed(1)}
					/>
					<circle
						class="ht-pt"
						class:is-miss={!r.ok}
						cx={r.xm.toFixed(1)}
						cy={r.y.toFixed(1)}
						r="2"
					/>
				{/each}
			</svg>
		</div>
		<p class="ht-note" aria-live="polite">{covText}</p>
	</section>

	<section class="ht-part" aria-labelledby="ht-test-title">
		<h3 id="ht-test-title" class="ht-part-t">Проверка H₀: μ = 0 при δ = {effect.toFixed(2)}σ</h3>
		<p class="ht-muted">
			Статистика Z = x̄·√n. Под H₀ её распределение с центром в 0 (серая кривая), под H₁ сдвинуто на
			δ√n = {out.shift.toFixed(2)} (синяя кривая).
		</p>
		<div class="ht-panel" bind:clientWidth={wTest}>
			<svg
				class="ht-svg ht-svg-test"
				viewBox="0 0 {plotWTest} {TEST_H}"
				height={TEST_H}
				role="img"
				aria-labelledby="ht-test-svg-title ht-test-svg-desc"
			>
				<title id="ht-test-svg-title">Распределения статистики под H₀ и H₁</title>
				<desc id="ht-test-svg-desc">{testText}</desc>
				<path class="ht-area-alpha" d={alphaArea} />
				<path class="ht-area-beta" d={betaArea} />
				<line class="ht-axis" x1="0" x2={plotWTest} y1={baseY} y2={baseY} />
				<line class="ht-crit" x1={zNegX} x2={zNegX} y1="0" y2={baseY} />
				<line class="ht-crit" x1={zPosX} x2={zPosX} y1="0" y2={baseY} />
				<line class="ht-zero" x1={zeroX} x2={zeroX} y1="0" y2={baseY} />
				<path class="ht-curve ht-curve-h0" d={h0Line} />
				<path class="ht-curve ht-curve-h1" d={h1Line} />
				<line class="ht-shift" x1={shiftX} x2={shiftX} y1="0" y2={baseY} />
			</svg>
		</div>
		<dl class="ht-stats">
			<dt>z<sub>крит</sub> (два хвоста)</dt>
			<dd>{out.zCrit.toFixed(2)}</dd>
			<dt>Ошибка I рода α</dt>
			<dd>{out.alphaErr.toFixed(2)}</dd>
			<dt>Ошибка II рода β</dt>
			<dd>{out.betaErr.toFixed(2)}</dd>
			<dt>Мощность 1 − β</dt>
			<dd>{out.power.toFixed(2)}</dd>
		</dl>
		<p class="ht-note" aria-live="polite">{testText}</p>
	</section>

	<div class="ht-legend" aria-hidden="true">
		<span class="ht-key ht-key-h0">H₀ верна</span>
		<span class="ht-key ht-key-h1">H₁: эффект δ</span>
		<span class="ht-key ht-key-alpha">ошибка I рода (α)</span>
		<span class="ht-key ht-key-beta">ошибка II рода (β)</span>
	</div>

	<div class="ht-insight">
		<p class="ht-insight-t">Что заметить</p>
		<ul>
			<li>Доля накрытых интервалов держится около 1 − α, но каждая серия немного отличается.</li>
			<li>Уменьшение α сдвигает критические линии наружу: ошибка I реже, ошибка II (β) растёт.</li>
			<li>Увеличение n сужает интервалы и сдвигает H₁ вправо: β падает, мощность растёт.</li>
		</ul>
	</div>
</figure>

<style>
	.ht {
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
	.ht :global(*),
	.ht :global(*::before),
	.ht :global(*::after) {
		box-sizing: border-box;
	}
	.ht dl,
	.ht dd,
	.ht dt,
	.ht p,
	.ht ul,
	.ht h3 {
		margin: 0;
	}
	.ht button {
		font: inherit;
	}
	.ht-muted {
		color: var(--text-muted);
	}
	.ht-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.ht-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ht-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.ht-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.ht-range {
		width: 130px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.ht-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.ht-range:focus-visible,
	.ht-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.ht-buttons {
		display: inline-flex;
		gap: var(--space-2);
	}
	.ht-btn {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.ht-btn:hover {
		border-color: var(--topic);
	}

	/* Parts */
	.ht-part {
		margin-top: var(--space-6);
	}
	.ht-part-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.ht-panel {
		margin-top: var(--space-3);
	}
	.ht-svg {
		display: block;
		width: 100%;
		overflow: hidden;
	}
	.ht-mu {
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.ht-ci {
		stroke: var(--cat-3);
		stroke-width: 2;
		stroke-linecap: round;
		transition: opacity var(--dur) var(--ease);
	}
	.ht-ci.is-miss {
		stroke: var(--cat-2);
		stroke-width: 2.5;
	}
	.ht-pt {
		fill: var(--text);
	}
	.ht-pt.is-miss {
		fill: var(--cat-2);
	}

	.ht-area-alpha {
		fill: var(--cat-2);
		opacity: 0.35;
	}
	.ht-area-beta {
		fill: var(--cat-4);
		opacity: 0.3;
	}
	.ht-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.ht-zero {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.4;
	}
	.ht-crit {
		stroke: var(--text);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.ht-shift {
		stroke: var(--topic);
		stroke-width: 1;
		stroke-dasharray: 2 2;
		opacity: 0.6;
	}
	.ht-curve {
		fill: none;
		stroke-width: 2;
	}
	.ht-curve-h0 {
		stroke: var(--text-muted);
	}
	.ht-curve-h1 {
		stroke: var(--topic);
	}

	.ht-note {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}

	/* Statistics */
	.ht-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.ht-stats dt {
		color: var(--text-muted);
	}
	.ht-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	/* Legend */
	.ht-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-6);
		font-size: 12px;
		color: var(--text-muted);
	}
	.ht-key::before {
		content: '';
		display: inline-block;
		width: 14px;
		height: 3px;
		margin-right: var(--space-2);
		vertical-align: middle;
		border-radius: 2px;
	}
	.ht-key-h0::before {
		background: var(--text-muted);
	}
	.ht-key-h1::before {
		background: var(--topic);
	}
	.ht-key-alpha::before {
		background: var(--cat-2);
		opacity: 0.6;
	}
	.ht-key-beta::before {
		background: var(--cat-4);
		opacity: 0.6;
	}

	/* Insight */
	.ht-insight {
		margin-top: var(--space-6);
		padding: var(--space-4);
		background: var(--surface-2);
		border-radius: var(--radius);
	}
	.ht-insight-t {
		margin-bottom: var(--space-2);
		font-weight: 600;
		color: var(--text);
	}
	.ht-insight ul {
		padding-left: var(--space-6);
		color: var(--text-muted);
	}

	/* Keep the interval chart readable on phones: labels wrap, sliders take full width. */
	@media (max-width: 720px) {
		.ht {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.ht-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.ht-ctl {
			flex-wrap: wrap;
		}
		.ht-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.ht-label {
			white-space: normal;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ht *,
		.ht *::before,
		.ht *::after {
			transition: none !important;
		}
	}
</style>
