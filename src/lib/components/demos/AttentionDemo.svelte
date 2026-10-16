<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import katex from 'katex';
	import type { AttentionDemoProps } from '$lib/contracts/component-props';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type AttentionDemoState,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		ARC_VB_H,
		ARC_VB_W,
		TOKENS,
		TOKEN_COUNT,
		arcLabelPos,
		arcPath,
		attentionWeights,
		describeRow,
		isQueryIndex,
		makeVectors,
		rowOrder,
		snapD,
		sumOf,
	} from '$lib/demos/attention';

	/** Attention arcs demo. Registers itself as demo `attention`. */
	let { initial }: AttentionDemoProps = $props();

	const vectors = makeVectors();

	/** Formulas for KaTeX. `trust` is needed for `\htmlClass` (entity colours). */
	const TEX: Record<string, string> = {
		fOn: '\\alpha_{ij} = \\mathrm{softmax}_j\\!\\left(\\dfrac{\\htmlClass{ent-q}{q_i}\\cdot\\htmlClass{ent-k}{k_j}}{\\sqrt{d}}\\right)',
		fOff: '\\alpha_{ij} = \\mathrm{softmax}_j\\!\\left(\\htmlClass{ent-q}{q_i}\\cdot\\htmlClass{ent-k}{k_j}\\right)',
		alpha: '\\alpha_{ij}',
		alphaQ: '\\alpha_{qj}\\,\\htmlClass{ent-v}{v_j}',
		qRows: '\\htmlClass{ent-q}{Q}',
		kCols: '\\htmlClass{ent-k}{K}',
		out: 'O',
		sqrtd: '1/\\sqrt{d}',
		d: 'd',
	};

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let scaled = $state(initial?.scaled ?? true);
	/* svelte-ignore state_referenced_locally */
	let query = $state(isQueryIndex(initial?.query) ? initial.query : 1);
	/* svelte-ignore state_referenced_locally */
	let d = $state(snapD(initial?.d ?? 64));
	let hover = $state<{ i: number; j: number } | null>(null);
	let root: HTMLElement | undefined = $state();

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const A = $derived(attentionWeights(vectors, d, scaled));
	const row = $derived<number[]>(A[query] ?? []);
	const rowAt = (j: number): number => row[j] ?? 0;
	const order = $derived(rowOrder(row));
	const top3 = $derived(order.slice(0, 3));
	const sideSum = $derived(sumOf(row).toFixed(2));
	const note = $derived(describeRow(query, row, d, scaled));
	const grid = $derived(Array.from({ length: TOKEN_COUNT }, (_, i) => i));

	function apply(patch: Partial<AttentionDemoState>): void {
		if (typeof patch.scaled === 'boolean') scaled = patch.scaled;
		if (isQueryIndex(patch.query)) query = patch.query;
		if (typeof patch.d === 'number') d = snapD(patch.d);
	}

	onMount(() => {
		// Renders KaTeX formulas; without a successful render the static fallback text stays.
		root?.querySelectorAll<HTMLElement>('.ad-tex[data-key]').forEach((el) => {
			const src = TEX[el.dataset.key ?? ''];
			if (!src) return;
			try {
				katex.render(src, el, { trust: true, strict: 'ignore', throwOnError: false });
			} catch {
				/* keep fallback text */
			}
		});
		return demos?.register('attention', {
			set: (patch) => apply(patch as Partial<AttentionDemoState>),
		});
	});

	function onRangeInput(e: Event): void {
		d = snapD(Number((e.currentTarget as HTMLInputElement).value));
	}
</script>

<figure
	class="ad"
	id="demo-attention"
	data-demo="attention"
	class:is-off={!scaled}
	class:hl-q={hl === 'q'}
	class:hl-k={hl === 'k'}
	class:hl-v={hl === 'v'}
	bind:this={root}
>
	<div class="ad-controls">
		<div class="ad-ctl">
			<span class="ad-label">Масштаб <span class="ad-tex" data-key="sqrtd">1/√d</span></span>
			<button
				type="button"
				class="ad-switch"
				role="switch"
				aria-label="Масштаб 1/√d"
				aria-checked={scaled}
				onclick={() => (scaled = !scaled)}
			>
				<span class="ad-knob"></span>
			</button>
			<span class="ad-state">{scaled ? 'вкл' : 'выкл'}</span>
		</div>
		<label class="ad-ctl">
			<span class="ad-label">Размерность <span class="ad-tex" data-key="d"><i>d</i></span></span>
			<input
				class="ad-range"
				type="range"
				min="4"
				max="256"
				step="4"
				value={d}
				oninput={onRangeInput}
			/>
			<output class="ad-d"><span class="ad-tex" data-key="d"><i>d</i></span> = {d}</output>
		</label>
		<div class="ad-formula">
			<span class="ad-f ad-f-on" aria-hidden={!scaled}>
				<span class="ad-tex" data-key="fOn"
					>α<sub>ij</sub> = softmax<sub>j</sub>(q<sub>i</sub>·k<sub>j</sub> / √d)</span
				>
			</span>
			<span class="ad-f ad-f-off" aria-hidden={scaled}>
				<span class="ad-tex" data-key="fOff"
					>α<sub>ij</sub> = softmax<sub>j</sub>(q<sub>i</sub>·k<sub>j</sub>)</span
				>
			</span>
		</div>
	</div>

	<div class="ad-tokens">
		<svg
			class="ad-arcs"
			viewBox="0 0 {ARC_VB_W} {ARC_VB_H}"
			role="img"
			aria-labelledby="ad-arcs-title ad-arcs-desc"
		>
			<title id="ad-arcs-title">Дуги внимания</title>
			<desc id="ad-arcs-desc"
				>Веса от запроса «{TOKENS[query] ?? ''}» ко всем токенам предложения: чем толще дуга, тем
				больше внимание.</desc
			>
			{#each row as a, j (j)}
				{@const pair = hover !== null && hover.i === query && hover.j === j}
				<path
					class="ad-arc"
					d={arcPath(query, j)}
					style:stroke-width={(1 + 14 * a + (pair ? 2 : 0)).toFixed(2)}
					style:stroke-opacity={(0.12 + 0.88 * a).toFixed(2)}
				></path>
			{/each}
			{#each row as a, j (j)}
				{@const p = arcLabelPos(query, j)}
				<text
					class="ad-arc-l"
					x={p[0].toFixed(1)}
					y={p[1].toFixed(1)}
					style:opacity={a >= 0.05 ? 1 : 0}>{a.toFixed(2)}</text
				>
			{/each}
		</svg>

		<div class="ad-chips" role="group" aria-label="Токены предложения">
			{#each TOKENS as token, i (i)}
				<button
					type="button"
					class="ad-chip"
					class:is-q={i === query}
					class:is-hl={hover !== null && (hover.i === i || hover.j === i)}
					aria-pressed={i === query}
					onclick={() => (query = i)}
				>
					{token}
				</button>
			{/each}
		</div>

		<div class="ad-vbars">
			{#each row as a, j (j)}
				<div class="ad-vbar">
					<div class="ad-vbar-track">
						<div class="ad-vbar-fill" style:--a={a.toFixed(4)}></div>
					</div>
					<span class="ad-vbar-num">{a.toFixed(2)}</span>
				</div>
			{/each}
		</div>
		<p class="ad-vnote">
			Столбцы — вклад значений: <span class="ad-tex" data-key="alphaQ"
				>α<sub>qj</sub>·v<sub>j</sub></span
			>. Их сумма и есть выход <span class="ad-tex" data-key="out">O</span> для запроса.
		</p>
	</div>

	<div class="ad-bottom">
		<div class="ad-map">
			<p class="ad-map-t">
				Веса <span class="ad-tex" data-key="alpha">α<sub>ij</sub></span>: строки — запросы
				<span class="ad-tex" data-key="qRows">Q</span>, столбцы — ключи
				<span class="ad-tex" data-key="kCols">K</span>
			</p>
			<div
				class="ad-grid"
				role="presentation"
				onmouseleave={() => (hover = null)}
				onfocusout={() => (hover = null)}
			>
				<div class="ad-row ad-head">
					<span></span>
					{#each TOKENS as token, j (j)}
						<span class="ad-h">{token}</span>
					{/each}
					<span class="ad-sum-h">Σ</span>
				</div>
				{#each grid as i (i)}
					<div class="ad-row" class:is-q={i === query}>
						<button type="button" class="ad-rl" onclick={() => (query = i)}
							>{TOKENS[i] ?? ''}</button
						>
						{#each A[i] ?? [] as a, j (j)}
							<div
								class="ad-cell"
								class:mid={a >= 0.45}
								class:hi={a >= 0.6}
								class:is-hover={hover !== null && hover.i === i && hover.j === j}
								tabindex="0"
								role="gridcell"
								aria-label="{TOKENS[i] ?? ''} → {TOKENS[j] ?? ''}: {a.toFixed(2)}"
								data-a={a.toFixed(2)}
								style:background="color-mix(in srgb, var(--seq-1) {(a * 100).toFixed(1)}%,
								var(--seq-0))"
								onmouseenter={() => (hover = { i, j })}
								onfocusin={() => (hover = { i, j })}
							>
								{a.toFixed(2)}
							</div>
						{/each}
						<span class="ad-sum">{sumOf(A[i] ?? []).toFixed(2)}</span>
					</div>
				{/each}
			</div>
			<div class="ad-legend">
				<span>0</span><span class="ad-ramp"></span><span>1</span>
			</div>
		</div>

		<div class="ad-side">
			<p class="ad-side-t">Три сильнейших ключа для «{TOKENS[query] ?? ''}»</p>
			<ol class="ad-side-list">
				{#each top3 as j (j)}
					<li>
						<span class="ad-top-k">{TOKENS[j] ?? ''}</span>
						<span class="ad-side-bar">
							<span class="ad-side-fill" style:--a={rowAt(j).toFixed(4)}></span>
						</span>
						<span class="ad-top-v">{rowAt(j).toFixed(2)}</span>
					</li>
				{/each}
			</ol>
			<p class="ad-side-sum">
				Сумма по строке: <b>{sideSum}</b>. Softmax нормирует каждую строку, поэтому сумма всегда 1.
			</p>
		</div>
	</div>

	<!-- Caption, number and text alternative come from the enclosing Figure; this line only describes the current row. -->
	<p class="ad-note">{note}</p>
</figure>

<style>
	.ad {
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
	.ad :global(*),
	.ad :global(*::before),
	.ad :global(*::after) {
		box-sizing: border-box;
	}
	.ad ol,
	.ad li,
	.ad details,
	.ad summary {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ad sub {
		font-size: 0.75em;
		line-height: 0;
	}
	.ad p {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
	}
	.ad button {
		font: inherit;
	}
	.ad-tex {
		white-space: nowrap;
	}

	/* Controls */
	.ad-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ad-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.ad-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.ad-state,
	.ad-d {
		white-space: nowrap;
		min-width: 6ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.ad-switch {
		position: relative;
		width: 40px;
		height: 22px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}
	.ad-switch[aria-checked='true'] {
		background: var(--accent);
		border-color: var(--accent);
	}
	.ad-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--surface);
		transition: transform var(--dur) var(--ease);
	}
	.ad-switch[aria-checked='true'] .ad-knob {
		transform: translateX(18px);
	}
	.ad-range {
		width: 180px;
		accent-color: var(--accent);
		cursor: pointer;
	}
	/* Two formula versions share one grid cell and cross-fade */
	.ad-formula {
		margin-left: auto;
		display: grid;
		color: var(--text);
		font-size: var(--fs-body);
		line-height: 1.2;
	}
	.ad-f {
		grid-area: 1 / 1;
		justify-self: end;
		white-space: nowrap;
		transition: opacity var(--dur) var(--ease);
	}
	.ad-f-off {
		opacity: 0;
		pointer-events: none;
	}
	.ad.is-off .ad-f-on {
		opacity: 0;
	}
	.ad.is-off .ad-f-off {
		opacity: 1;
	}

	/* Tokens, arcs, value contributions */
	.ad-tokens {
		margin-top: var(--space-4);
	}
	.ad-arcs {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.ad-arc {
		fill: none;
		stroke: var(--cat-1);
		stroke-linecap: round;
		transition:
			stroke-width var(--dur) var(--ease),
			stroke-opacity var(--dur) var(--ease);
	}
	.ad-arc-l {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 14px;
		text-anchor: middle;
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 5px;
		stroke-linejoin: round;
		transition: opacity var(--dur) var(--ease);
	}
	.ad-chips,
	.ad-vbars {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
	}
	.ad-chip {
		justify-self: center;
		width: calc(100% - 12px);
		min-width: 0;
		height: 40px;
		padding: 0 var(--space-2);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-base);
		white-space: nowrap;
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease),
			border-color var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}
	.ad-chip:hover {
		border-color: var(--cat-1);
	}
	.ad-chip:focus-visible {
		outline: 2px solid var(--cat-1);
		outline-offset: 2px;
	}
	.ad-chip.is-q {
		background: var(--cat-1);
		border-color: var(--cat-1);
		color: var(--surface);
		font-weight: 600;
	}
	.ad-chip.is-hl {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--cat-2) 45%, transparent);
	}
	.ad-vbars {
		margin-top: var(--space-3);
	}
	.ad-vbar {
		justify-self: center;
		width: calc(100% - 12px);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.ad-vbar-track {
		position: relative;
		width: 100%;
		height: 64px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		overflow: hidden;
	}
	.ad-vbar-fill {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: calc(var(--a, 0) * 100%);
		background: var(--cat-3);
		transition: height var(--dur) var(--ease);
	}
	.ad-vbar-num {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
	.ad-vnote {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
		text-align: center;
	}

	/* Heatmap and row summary */
	.ad-bottom {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: var(--space-8);
		margin-top: var(--space-8);
		align-items: start;
	}
	.ad-map-t {
		margin: 0 0 var(--space-3);
		color: var(--text-muted);
	}
	.ad-side-t {
		margin: 0 0 var(--space-3);
		font-family: var(--font-serif);
		font-size: 17px;
		font-weight: 600;
		color: var(--text);
	}
	.ad-grid {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ad-row {
		display: grid;
		grid-template-columns: 72px repeat(6, minmax(0, 1fr)) 48px;
		align-items: center;
		gap: 4px;
		padding: 3px;
		border-radius: var(--radius);
		transition:
			opacity var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}
	.ad-row.is-q {
		box-shadow: 0 0 0 2px var(--cat-1);
	}
	.ad-row.ad-head {
		padding-top: 0;
	}
	.ad-h {
		overflow: hidden;
		color: var(--cat-2);
		font-family: var(--font-mono);
		font-size: 12px;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ad-sum-h {
		color: var(--text-muted);
		font-size: 12px;
		text-align: right;
	}
	.ad-rl {
		justify-self: start;
		padding: 2px 6px;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--cat-1);
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	.ad-row.is-q .ad-rl {
		font-weight: 600;
	}
	.ad-cell {
		position: relative;
		min-width: 0;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		transition:
			background-color var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}
	.ad-cell.mid,
	.ad-cell.hi {
		color: var(--surface);
	}
	:global([data-theme='dark']) .ad-cell.mid:not(.hi) {
		color: var(--text);
	}
	.ad-cell:hover,
	.ad-cell:focus-visible {
		z-index: 3;
		outline: none;
	}
	.ad-cell.is-hover {
		box-shadow: inset 0 0 0 2px var(--text);
	}
	.ad-cell:hover::after,
	.ad-cell:focus-visible::after {
		content: 'α = ' attr(data-a);
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		background: var(--text);
		color: var(--surface);
		font-family: var(--font-sans);
		font-size: 12px;
		white-space: nowrap;
		pointer-events: none;
	}
	.ad-sum {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		text-align: right;
		padding-right: 6px;
	}
	.ad-legend {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-6);
		padding-bottom: var(--space-2);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.ad-ramp {
		width: 160px;
		height: 8px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: linear-gradient(to right, var(--seq-0), var(--seq-1));
	}
	.ad-side {
		padding: var(--space-4) var(--space-6);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.ad-side-list {
		display: grid;
		gap: var(--space-3);
	}
	.ad-side-list li {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr) 48px;
		align-items: center;
		gap: var(--space-3);
	}
	.ad-top-k {
		color: var(--cat-2);
		font-family: var(--font-mono);
		font-weight: 600;
	}
	.ad-side-bar {
		height: 8px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.ad-side-fill {
		display: block;
		height: 100%;
		width: calc(var(--a, 0) * 100%);
		background: var(--cat-2);
		transition: width var(--dur) var(--ease);
	}
	.ad-top-v {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.ad-side-sum {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 13px;
	}
	.ad-side-sum b {
		color: var(--text);
		font-family: var(--font-mono);
	}

	/* Row description under the chart */
	.ad-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.ad.hl-q .ad-row:not(.is-q),
	.ad.hl-q .ad-chip:not(.is-q) {
		opacity: 0.45;
	}
	.ad.hl-k .ad-h {
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.ad.hl-k .ad-chip {
		box-shadow: 0 0 0 2px var(--cat-2);
	}
	.ad.hl-v .ad-vbars {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
		border-radius: var(--radius);
	}

	@media (prefers-reduced-motion: reduce) {
		.ad *,
		.ad *::before,
		.ad *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.ad {
			padding: var(--space-4);
		}
		.ad-formula {
			margin-left: 0;
		}
		.ad-f {
			justify-self: start;
		}
		.ad-bottom {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
		.ad-chip {
			padding: 0;
			font-size: 13px;
		}
		.ad-row {
			grid-template-columns: 56px repeat(6, minmax(0, 1fr)) 40px;
			gap: 2px;
		}
		.ad-cell {
			font-size: 11px;
		}
	}
</style>
