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
		BETA_MAX,
		BETA_MIN,
		BETA_STEP,
		GAMMA_MAX,
		GAMMA_MIN,
		GAMMA_STEP,
		type LayerNormDemoState,
		type NormKind,
		barLayout,
		describeNorm,
		domainMax,
		isNormKind,
		makeToken,
		normalize,
		snapBeta,
		snapGamma,
		valueY,
		vectorStats,
	} from '$lib/demos/layer-norm';

	/** LayerNorm / RMSNorm demo on one token's activations. Registers itself as demo `layer-norm`. */
	let { initial }: { initial?: Partial<LayerNormDemoState> } = $props();

	const x = makeToken();

	/** Formulas for KaTeX. The static text inside each span is the fallback. */
	const TEX: Record<NormKind, string> = {
		layer: 'y_i = \\gamma\\,\\dfrac{x_i - \\mu}{\\sqrt{\\sigma^2 + \\varepsilon}} + \\beta',
		rms: 'y_i = \\gamma\\,\\dfrac{x_i}{\\sqrt{\\dfrac{1}{d}\\sum_j x_j^2 + \\varepsilon}}',
	};

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let norm = $state<NormKind>(isNormKind(initial?.norm) ? initial.norm : 'layer');
	/* svelte-ignore state_referenced_locally */
	let gamma = $state(snapGamma(initial?.gamma ?? 1));
	/* svelte-ignore state_referenced_locally */
	let beta = $state(snapBeta(initial?.beta ?? 0));
	/** Real widths of the two charts in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wBefore = $state(0);
	let wAfter = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const y = $derived(normalize(norm, x, gamma, beta));
	const sx = $derived(vectorStats(x));
	const sy = $derived(vectorStats(y));
	const domain = $derived(domainMax(x, y));
	/** Chart widths in px; 320 until the first measurement. */
	const plotWBefore = $derived(wBefore >= 120 ? wBefore : 320);
	const plotWAfter = $derived(wAfter >= 120 ? wAfter : 320);
	const layoutBefore = $derived(barLayout(x, plotWBefore, domain));
	const layoutAfter = $derived(barLayout(y, plotWAfter, domain));
	const isLayer = $derived(norm === 'layer');
	const descBefore = $derived(
		`Значения ${x.length} признаков одного токена; μ = ${sx.mean.toFixed(2)}, σ = ${sx.std.toFixed(2)}.`,
	);
	const descAfter = $derived(
		`Значения после ${isLayer ? 'LayerNorm' : 'RMSNorm'} с γ = ${gamma.toFixed(1)}` +
			(isLayer ? `, β = ${beta.toFixed(1)}` : '') +
			`; μ = ${sy.mean.toFixed(2)}, RMS = ${sy.rms.toFixed(2)}.`,
	);
	const note = $derived(describeNorm(norm, x, y, gamma, beta));
	const meanBeforeY = $derived(valueY(sx.mean, layoutBefore));
	const meanAfterY = $derived(valueY(sy.mean, layoutAfter));

	function apply(patch: Partial<LayerNormDemoState>): void {
		if (isNormKind(patch.norm)) norm = patch.norm;
		if (typeof patch.gamma === 'number') gamma = snapGamma(patch.gamma);
		if (typeof patch.beta === 'number') beta = snapBeta(patch.beta);
	}

	/** Renders a KaTeX formula into the node; without a successful render the fallback text stays. */
	function tex(node: HTMLElement, key: NormKind) {
		const render = (k: NormKind) => {
			try {
				katex.render(TEX[k], node, { strict: 'ignore', throwOnError: false });
			} catch {
				/* keep fallback text */
			}
		};
		render(key);
		return {
			update(k: NormKind) {
				render(k);
			},
		};
	}

	onMount(() => {
		return demos?.register('layer-norm', {
			set: (patch) => apply(patch as Partial<LayerNormDemoState>),
		});
	});
</script>

<figure
	class="ln"
	id="demo-layer-norm"
	data-demo="layer-norm"
	class:hl-q={hl === 'q'}
	class:hl-v={hl === 'v'}
>
	<div class="ln-controls">
		<div class="ln-group" role="group" aria-label="Тип нормализации">
			<button
				type="button"
				class="ln-seg"
				aria-pressed={norm === 'layer'}
				onclick={() => (norm = 'layer')}>LayerNorm</button
			>
			<button
				type="button"
				class="ln-seg"
				aria-pressed={norm === 'rms'}
				onclick={() => (norm = 'rms')}>RMSNorm</button
			>
		</div>

		<label class="ln-ctl">
			<span class="ln-label"><span class="ln-sym">γ</span> (масштаб)</span>
			<input
				class="ln-range"
				type="range"
				min={GAMMA_MIN}
				max={GAMMA_MAX}
				step={GAMMA_STEP}
				value={gamma}
				oninput={(e) => (gamma = snapGamma(Number(e.currentTarget.value)))}
			/>
			<output class="ln-val">{gamma.toFixed(1)}</output>
		</label>

		<label class="ln-ctl" class:is-disabled={!isLayer}>
			<span class="ln-label"><span class="ln-sym">β</span> (сдвиг)</span>
			<input
				class="ln-range"
				type="range"
				min={BETA_MIN}
				max={BETA_MAX}
				step={BETA_STEP}
				value={beta}
				disabled={!isLayer}
				oninput={(e) => (beta = snapBeta(Number(e.currentTarget.value)))}
			/>
			<output class="ln-val">{isLayer ? beta.toFixed(1) : '—'}</output>
		</label>
	</div>

	<div class="ln-formula">
		{#if isLayer}
			<span class="ln-tex" use:tex={'layer'} aria-hidden="true"
				>y<sub>i</sub> = γ·(x<sub>i</sub> − μ)/√(σ² + ε) + β</span
			>
		{:else}
			<span class="ln-tex" use:tex={'rms'} aria-hidden="true"
				>y<sub>i</sub> = γ·x<sub>i</sub>/√(mean(x²) + ε)</span
			>
		{/if}
	</div>

	<div class="ln-plots">
		<div class="ln-panel ln-panel-before" bind:clientWidth={wBefore}>
			<p class="ln-panel-t">До нормализации <span class="ln-muted">x</span></p>
			<svg
				class="ln-svg"
				viewBox="0 0 {plotWBefore} 170"
				role="img"
				aria-labelledby="ln-before-title ln-before-desc"
			>
				<title id="ln-before-title">Активации до нормализации</title>
				<desc id="ln-before-desc">{descBefore}</desc>
				<line class="ln-zero" x1="0" x2="100%" y1={layoutBefore.zeroY} y2={layoutBefore.zeroY} />
				{#each layoutBefore.bars as b, i (i)}
					<rect
						class="ln-bar ln-bar-before"
						x={b.x.toFixed(1)}
						y={b.y.toFixed(1)}
						width={b.w.toFixed(1)}
						height={b.h.toFixed(1)}
					>
						<title>признак {i + 1}: {b.value.toFixed(2)}</title>
					</rect>
					<text class="ln-tick" x={(b.x + b.w / 2).toFixed(1)} y="164">{i + 1}</text>
				{/each}
				<line
					class="ln-mean"
					x1="0"
					x2="100%"
					y1={meanBeforeY.toFixed(1)}
					y2={meanBeforeY.toFixed(1)}
				/>
			</svg>
		</div>

		<div class="ln-panel ln-panel-after" bind:clientWidth={wAfter}>
			<p class="ln-panel-t">После нормализации <span class="ln-muted">y</span></p>
			<svg
				class="ln-svg"
				viewBox="0 0 {plotWAfter} 170"
				role="img"
				aria-labelledby="ln-after-title ln-after-desc"
			>
				<title id="ln-after-title">Активации после нормализации</title>
				<desc id="ln-after-desc">{descAfter}</desc>
				<line class="ln-zero" x1="0" x2="100%" y1={layoutAfter.zeroY} y2={layoutAfter.zeroY} />
				{#each layoutAfter.bars as b, i (i)}
					<rect
						class="ln-bar ln-bar-after"
						x={b.x.toFixed(1)}
						y={b.y.toFixed(1)}
						width={b.w.toFixed(1)}
						height={b.h.toFixed(1)}
					>
						<title>признак {i + 1}: {b.value.toFixed(2)}</title>
					</rect>
					<text class="ln-tick" x={(b.x + b.w / 2).toFixed(1)} y="164">{i + 1}</text>
				{/each}
				<line
					class="ln-mean"
					x1="0"
					x2="100%"
					y1={meanAfterY.toFixed(1)}
					y2={meanAfterY.toFixed(1)}
				/>
			</svg>
		</div>
	</div>

	<dl class="ln-stats">
		<dt>Статистика</dt>
		<dd class="ln-h">до</dd>
		<dd class="ln-h">после</dd>
		<dt>μ (среднее)</dt>
		<dd>{sx.mean.toFixed(2)}</dd>
		<dd>{sy.mean.toFixed(2)}</dd>
		<dt>σ (разброс)</dt>
		<dd>{sx.std.toFixed(2)}</dd>
		<dd>{sy.std.toFixed(2)}</dd>
		<dt>RMS</dt>
		<dd>{sx.rms.toFixed(2)}</dd>
		<dd>{sy.rms.toFixed(2)}</dd>
	</dl>

	<p class="ln-note">{note}</p>
</figure>

<style>
	.ln {
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
	.ln :global(*),
	.ln :global(*::before),
	.ln :global(*::after) {
		box-sizing: border-box;
	}
	.ln dl,
	.ln dd,
	.ln dt,
	.ln p {
		margin: 0;
	}
	.ln button {
		font: inherit;
	}
	.ln-muted {
		color: var(--text-muted);
	}
	.ln-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.ln-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ln-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.ln-seg {
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
	.ln-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.ln-seg:focus-visible,
	.ln-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.ln-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.ln-ctl.is-disabled {
		opacity: 0.5;
	}
	.ln-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.ln-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.ln-range:disabled {
		cursor: not-allowed;
	}
	.ln-val {
		min-width: 3ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.ln-formula {
		margin-top: var(--space-4);
		color: var(--text);
		font-size: var(--fs-base);
		line-height: 1.3;
	}
	.ln-tex {
		white-space: nowrap;
	}
	.ln-formula :global(sub) {
		font-size: 0.75em;
	}

	/* Charts */
	.ln-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.ln-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.ln-svg {
		display: block;
		width: 100%;
		height: 170px;
		overflow: visible;
	}
	.ln-zero {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.ln-mean {
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.ln-bar {
		transition: opacity var(--dur) var(--ease);
	}
	.ln-bar-before {
		fill: var(--cat-4);
	}
	.ln-bar-after {
		fill: var(--cat-1);
	}
	.ln-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		text-anchor: middle;
	}

	/* Statistics */
	.ln-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
		transition: opacity var(--dur) var(--ease);
	}
	.ln-stats dt {
		color: var(--text-muted);
	}
	.ln-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.ln-stats .ln-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-size: 12px;
	}
	.ln-stats dt:first-child {
		color: var(--text);
		font-weight: 600;
	}
	.ln-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.ln.hl-q .ln-stats {
		opacity: 0.45;
	}
	.ln.hl-v .ln-panel-after {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
		border-radius: var(--radius);
	}

	@media (prefers-reduced-motion: reduce) {
		.ln *,
		.ln *::before,
		.ln *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.ln {
			padding: var(--space-4);
		}
		.ln-plots {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
		.ln-range {
			width: 120px;
		}
	}

	@media (max-width: 559px) {
		.ln-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.ln-ctl {
			flex-wrap: wrap;
		}
		.ln-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
