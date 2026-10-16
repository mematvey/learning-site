<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		DEFAULT_HEADS,
		HEAD_COUNTS,
		TOKENS,
		TOKEN_COUNT,
		argmaxRow,
		headWeights,
		isHeadCount,
		makeModel,
		shapeInfo,
		snapHeads,
	} from '$lib/demos/multi-head-attention';

	/** Multi-head attention demo. Registers itself as demo `multi-head-attention`. */
	interface MultiHeadState {
		/** Number of heads h (one of 1, 2, 4, 8). */
		h: number;
		/** Index of the selected head (0-based). */
		head: number;
	}

	let { initial }: { initial?: Partial<MultiHeadState> } = $props();

	const model = makeModel();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let heads = $state(snapHeads(initial?.h ?? DEFAULT_HEADS));
	/* svelte-ignore state_referenced_locally */
	let selected = $state(
		typeof initial?.head === 'number' ? Math.max(0, Math.round(initial.head)) : 0,
	);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const A = $derived(headWeights(model, heads));
	/** Selected head, clamped to the current head count. */
	const active = $derived(Math.min(selected, heads - 1));
	const info = $derived(shapeInfo(heads));
	const rangeIndex = $derived(HEAD_COUNTS.indexOf(heads as (typeof HEAD_COUNTS)[number]));
	const row = $derived(A[active] ?? []);
	const picks = $derived(row.map((r) => argmaxRow(r)));
	const grid = $derived(Array.from({ length: TOKEN_COUNT }, (_, i) => i));

	function apply(patch: Partial<MultiHeadState>): void {
		if (isHeadCount(patch.h)) heads = patch.h;
		else if (typeof patch.h === 'number') heads = snapHeads(patch.h);
		if (typeof patch.head === 'number' && Number.isInteger(patch.head) && patch.head >= 0) {
			selected = patch.head;
		}
	}

	onMount(() => {
		return demos?.register('multi-head-attention', {
			set: (patch) => apply(patch as Partial<MultiHeadState>),
		});
	});

	function onRangeInput(e: Event): void {
		const idx = Number((e.currentTarget as HTMLInputElement).value);
		heads = HEAD_COUNTS[idx] ?? heads;
	}

	function fmt(n: number): string {
		return n.toFixed(2);
	}
</script>

<figure
	class="mh"
	id="demo-multi-head-attention"
	data-demo="multi-head-attention"
	class:hl-q={hl === 'q'}
	class:hl-k={hl === 'k'}
	class:hl-v={hl === 'v'}
>
	<div class="mh-controls">
		<label class="mh-ctl">
			<span class="mh-label">Число голов <i>h</i></span>
			<input
				class="mh-range"
				type="range"
				min="0"
				max={HEAD_COUNTS.length - 1}
				step="1"
				value={rangeIndex}
				aria-valuetext="h = {heads}"
				oninput={onRangeInput}
			/>
			<output class="mh-h">h = {heads}</output>
		</label>
		<p class="mh-dims">
			<span><i>d</i><sub>model</sub> = {info.dModel}</span>
			<span><i>d</i><sub>k</sub> = {info.dk}</span>
		</p>
	</div>

	<div class="mh-tiles" role="group" aria-label="Головы внимания">
		{#each A as H, t (t)}
			<button
				type="button"
				class="mh-tile"
				class:is-on={t === active}
				aria-pressed={t === active}
				aria-label="Голова {t + 1}"
				onclick={() => (selected = t)}
			>
				<span class="mh-tile-t">Голова {t + 1}</span>
				<span class="mh-map" role="img" aria-label="Веса головы {t + 1}">
					{#each grid as i (i)}
						{#each H[i] ?? [] as a, j (j)}
							<span
								class="mh-cell"
								style:background="color-mix(in srgb, var(--seq-1) {(a * 100).toFixed(1)}%,
								var(--seq-0))"
								title="{TOKENS[i] ?? ''} → {TOKENS[j] ?? ''}: {fmt(a)}"
							></span>
						{/each}
					{/each}
				</span>
			</button>
		{/each}
	</div>

	<div class="mh-bottom">
		<div class="mh-detail">
			<p class="mh-detail-t">Голова {active + 1}: куда смотрит каждый токен</p>
			<ol class="mh-picks">
				{#each TOKENS as tok, i (i)}
					<li>
						<span class="mh-q">{tok}</span>
						<span class="mh-arrow" aria-hidden="true">→</span>
						<span class="mh-k">{TOKENS[picks[i] ?? 0] ?? ''}</span>
						<span class="mh-w">{fmt(row[i]?.[picks[i] ?? 0] ?? 0)}</span>
					</li>
				{/each}
			</ol>
		</div>

		<dl class="mh-shapes">
			<div class="mh-row">
				<dt>X</dt>
				<dd>{info.n} × {info.dModel}</dd>
			</div>
			<div class="mh-row mh-row-q">
				<dt>Q, K, V</dt>
				<dd>{info.h} × {info.n} × {info.dk}</dd>
			</div>
			<div class="mh-row">
				<dt>α</dt>
				<dd>{info.h} × {info.n} × {info.n}</dd>
			</div>
			<div class="mh-row mh-row-v">
				<dt>O</dt>
				<dd>{info.n} × {info.dModel}</dd>
			</div>
			<div class="mh-row">
				<dt>Параметры</dt>
				<dd>4 · {info.dModel}² = {info.params.toLocaleString('ru-RU')}</dd>
			</div>
			<div class="mh-row">
				<dt>QKᵀ</dt>
				<dd>{info.scoreMacs.toLocaleString('ru-RU')} умножений</dd>
			</div>
		</dl>
	</div>

	<p class="mh-note">
		Разбиение меняет форму, а не объём: параметры и стоимость QKᵀ одинаковы при любом h. Каждая
		голова работает с {info.dk}-мерным подпространством, и её веса свои.
	</p>
</figure>

<style>
	.mh {
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
	.mh :global(*),
	.mh :global(*::before),
	.mh :global(*::after) {
		box-sizing: border-box;
	}
	.mh p,
	.mh dl,
	.mh dd,
	.mh dt,
	.mh ol,
	.mh li {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.mh button {
		font: inherit;
	}
	.mh sub {
		font-size: 0.75em;
		line-height: 0;
	}

	/* Controls */
	.mh-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.mh-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.mh-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.mh-range {
		width: 180px;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.mh-h {
		min-width: 6ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.mh-dims {
		display: flex;
		gap: var(--space-4);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
		white-space: nowrap;
	}

	/* Head tiles: one heatmap per head */
	.mh-tiles {
		margin-top: var(--space-4);
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
	}
	.mh-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		cursor: pointer;
		transition:
			border-color var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease),
			opacity var(--dur) var(--ease);
	}
	.mh-tile:hover {
		border-color: var(--cat-1);
	}
	.mh-tile:focus-visible {
		outline: 2px solid var(--cat-1);
		outline-offset: 2px;
	}
	.mh-tile.is-on {
		border-color: var(--cat-1);
		box-shadow: 0 0 0 2px var(--cat-1);
	}
	.mh-tile-t {
		color: var(--text-muted);
		font-size: 12px;
		white-space: nowrap;
	}
	.mh-tile.is-on .mh-tile-t {
		color: var(--cat-1);
		font-weight: 600;
	}
	.mh-map {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 1px;
		width: 100%;
		max-width: 180px;
		aspect-ratio: 1;
		padding: 1px;
		border-radius: var(--radius-sm);
		background: var(--border);
	}
	.mh-cell {
		display: block;
		min-width: 0;
		background: var(--seq-0);
		border-radius: 1px;
	}
	.mh.hl-q .mh-tile:not(.is-on),
	.mh.hl-k .mh-tile:not(.is-on) {
		opacity: 0.6;
	}

	/* Selected head details and shapes */
	.mh-bottom {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-8);
		margin-top: var(--space-6);
		align-items: start;
	}
	.mh-detail-t {
		margin: 0 0 var(--space-3);
		font-family: var(--font-serif);
		font-size: 17px;
		font-weight: 600;
		color: var(--text);
	}
	.mh-picks {
		display: grid;
		gap: var(--space-2);
	}
	.mh-picks li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 16px minmax(0, 1fr) 40px;
		align-items: center;
		gap: var(--space-2);
		font-size: 13px;
	}
	.mh-q {
		color: var(--cat-1);
		font-family: var(--font-mono);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mh-k {
		color: var(--cat-2);
		font-family: var(--font-mono);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mh-arrow {
		color: var(--text-muted);
		text-align: center;
	}
	.mh-w {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.mh-shapes {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-6);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.mh-row {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
		gap: var(--space-3);
		align-items: baseline;
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.mh-row:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}
	.mh-row dt {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.mh-row dd {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	.mh-row-q dt {
		color: var(--cat-1);
	}
	.mh-row-v dt {
		color: var(--cat-3);
	}
	.mh.hl-q .mh-row:not(.mh-row-q),
	.mh.hl-k .mh-row:not(.mh-row-q),
	.mh.hl-v .mh-row:not(.mh-row-v) {
		opacity: 0.45;
	}
	.mh.hl-q .mh-row-q,
	.mh.hl-k .mh-row-q {
		opacity: 1;
		box-shadow: inset 3px 0 0 var(--cat-1);
	}
	.mh.hl-v .mh-row-v {
		box-shadow: inset 3px 0 0 var(--cat-3);
	}

	.mh-note {
		margin-top: var(--space-6);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 13px;
	}

	@media (prefers-reduced-motion: reduce) {
		.mh *,
		.mh *::before,
		.mh *::after {
			transition: none !important;
		}
	}

	@media (min-width: 560px) {
		.mh-tiles {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (max-width: 720px) {
		.mh {
			padding: var(--space-4);
		}
		.mh-bottom {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (max-width: 559px) {
		.mh-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.mh-ctl {
			flex-wrap: wrap;
		}
		.mh-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.mh-dims {
			flex-wrap: wrap;
			gap: var(--space-2) var(--space-4);
		}
		.mh-picks li {
			grid-template-columns: minmax(0, 1fr) 14px minmax(0, 1fr) 36px;
			font-size: 12px;
		}
		.mh-row {
			grid-template-columns: minmax(0, 1fr);
			gap: 2px;
		}
	}
</style>
