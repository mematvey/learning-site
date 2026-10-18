<script lang="ts">
	import katex from 'katex';
	import {
		RANK_MAX,
		RANK_MIN,
		RANK_STEP,
		type LoraDemoState,
		type Scope,
		describeLora,
		formatCount,
		formatPercent,
		isScope,
		paramCounts,
		snapRank,
	} from '$lib/demos/finetuning-alignment';

	/** LoRA demo: trainable values of the low-rank update B·A against full fine-tuning. */
	let { initial }: { initial?: Partial<LoraDemoState> } = $props();

	/* The props only seed the initial state: the demo owns it afterwards. */
	/* svelte-ignore state_referenced_locally */
	let scope = $state<Scope>(isScope(initial?.scope) ? initial.scope : 'matrix');
	/* svelte-ignore state_referenced_locally */
	let rank = $state(snapRank(initial?.rank ?? 8));

	const counts = $derived(paramCounts(scope, rank));
	const desc = $derived(describeLora(scope, rank, counts));
	/** Share of trainable values in percent, drawn as a bar (the fill has a minimum width in CSS). */
	const barPct = $derived(counts.fraction * 100);

	/* Schematic of the update: W0 is d × k, B is d × r, A is r × k. Strip thickness follows r. */
	const W0 = { x: 10, y: 22, w: 130, h: 130 };
	const stripW = $derived(Math.max(3, (rank / RANK_MAX) * 40));
	const bX = 176;
	const aY = W0.y + W0.h + 10;

	const TEX = '\\text{доля} = \\dfrac{r\\,(d+k)}{d\\,k}';
	const TEX_FALLBACK = 'доля = r·(d + k) / (d·k)';

	/** Renders the formula with KaTeX; without a successful render the fallback text stays. */
	function tex(node: HTMLElement) {
		try {
			katex.render(TEX, node, { strict: 'ignore', throwOnError: false });
		} catch {
			/* keep fallback text */
		}
		return {};
	}
</script>

<figure class="lora" id="demo-lora" data-demo="lora">
	<div class="lora-controls">
		<div class="lora-group" role="group" aria-label="Что считаем">
			<button
				type="button"
				class="lora-seg"
				aria-pressed={scope === 'matrix'}
				onclick={() => (scope = 'matrix')}>Одна матрица</button
			>
			<button
				type="button"
				class="lora-seg"
				aria-pressed={scope === 'model'}
				onclick={() => (scope = 'model')}>32 слоя, q и v</button
			>
		</div>

		<label class="lora-ctl">
			<span class="lora-label"><span class="lora-sym">r</span> (ранг)</span>
			<input
				class="lora-range"
				type="range"
				min={RANK_MIN}
				max={RANK_MAX}
				step={RANK_STEP}
				value={rank}
				oninput={(e) => (rank = snapRank(Number(e.currentTarget.value)))}
			/>
			<output class="lora-val">{rank}</output>
		</label>
	</div>

	<div class="lora-formula">
		<span class="lora-tex" use:tex aria-hidden="true">{TEX_FALLBACK}</span>
	</div>

	<div class="lora-plot">
		<svg class="lora-svg" viewBox="0 0 300 190" role="img" aria-labelledby="lora-title lora-desc">
			<title id="lora-title">Схема обновления W₀ + B·A</title>
			<desc id="lora-desc">{desc}</desc>

			<rect class="lora-frozen" x={W0.x} y={W0.y} width={W0.w} height={W0.h} rx="4" />
			<text class="lora-in" x={W0.x + W0.w / 2} y={W0.y + W0.h / 2 - 4}>W₀</text>
			<text class="lora-sub" x={W0.x + W0.w / 2} y={W0.y + W0.h / 2 + 14}>заморожена</text>
			<text class="lora-dim" x={W0.x + W0.w / 2} y={W0.y - 6}>d × k</text>

			<text class="lora-op" x="152" y={W0.y + W0.h / 2 + 6}>+</text>

			<rect class="lora-b" x={bX} y={W0.y} width={stripW} height={W0.h} rx="2" />
			<text class="lora-dim" x={bX + stripW / 2} y={W0.y - 6}>B · d × r</text>

			<rect class="lora-a" x={W0.x} y={aY} width={W0.w} height={stripW} rx="2" />
			<text class="lora-dim lora-dim-start" x={W0.x + W0.w + 8} y={aY + stripW / 2 + 4}
				>A · r × k</text
			>
		</svg>
	</div>

	<div class="lora-bar" aria-hidden="true">
		<span class="lora-bar-fill" style="width: {barPct}%"></span>
	</div>

	<dl class="lora-stats">
		<dt>Матриц</dt>
		<dd>{counts.matrices}</dd>
		<dt>Обучается с LoRA</dt>
		<dd>{formatCount(counts.lora)}</dd>
		<dt>Обучается при полном дообучении</dt>
		<dd>{formatCount(counts.full)}</dd>
		<dt>Доля</dt>
		<dd>{formatPercent(counts.fraction)}%</dd>
	</dl>

	<p class="lora-note" aria-live="polite">{desc}</p>
	<p class="lora-note lora-note-2">
		В начале обучения B = 0, поэтому поправка BA равна нулю и модель ведёт себя как исходная.
	</p>
</figure>

<style>
	.lora {
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
	.lora :global(*),
	.lora :global(*::before),
	.lora :global(*::after) {
		box-sizing: border-box;
	}
	.lora dl,
	.lora dd,
	.lora dt,
	.lora p {
		margin: 0;
	}
	.lora button {
		font: inherit;
	}
	.lora-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.lora-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.lora-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.lora-seg {
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
	.lora-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.lora-seg:focus-visible,
	.lora-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.lora-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.lora-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.lora-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.lora-val {
		min-width: 3ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.lora-formula {
		margin-top: var(--space-4);
		color: var(--text);
		font-size: var(--fs-base);
		line-height: 1.3;
	}
	.lora-tex {
		white-space: nowrap;
	}

	/* Schematic */
	.lora-plot {
		margin-top: var(--space-6);
	}
	.lora-svg {
		display: block;
		width: 100%;
		max-width: 420px;
		height: auto;
		margin: 0 auto;
		overflow: visible;
	}
	.lora-frozen {
		fill: var(--surface-2);
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.lora-b {
		fill: var(--cat-1);
		transition: width var(--dur) var(--ease);
	}
	.lora-a {
		fill: var(--cat-3);
	}
	.lora-in {
		fill: var(--text);
		font-family: var(--font-serif);
		font-size: 18px;
		text-anchor: middle;
	}
	.lora-sub {
		fill: var(--text-muted);
		font-size: 12px;
		text-anchor: middle;
	}
	.lora-op {
		fill: var(--text);
		font-size: 22px;
		text-anchor: middle;
	}
	.lora-dim {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		text-anchor: middle;
	}
	.lora-dim-start {
		text-anchor: start;
	}

	.lora-bar {
		height: 8px;
		margin-top: var(--space-4);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}
	.lora-bar-fill {
		display: block;
		height: 100%;
		min-width: 2px;
		background: var(--topic);
		transition: width var(--dur) var(--ease);
	}

	/* Statistics */
	.lora-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.lora-stats dt {
		color: var(--text-muted);
	}
	.lora-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.lora-note {
		margin-top: var(--space-4);
		color: var(--text);
	}
	.lora-note-2 {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}

	@media (prefers-reduced-motion: reduce) {
		.lora *,
		.lora *::before,
		.lora *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.lora {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.lora-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.lora-ctl {
			flex-wrap: wrap;
		}
		.lora-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
