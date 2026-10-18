<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import katex from 'katex';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DEMO_SCORES,
		DEMO_VALUES,
		EMPTY_STATE,
		TILE_SIZES,
		clampStep,
		describeStep,
		fmt,
		isTileSize,
		naiveAttention,
		outputOf,
		rescaleFactor,
		walkRow,
		type FlashAttentionDemoState,
		type RowState,
		type TileSize,
	} from '$lib/demos/flash-attention';

	/** FlashAttention demo: one row of scores walked tile by tile with the online softmax. Registers as `flash-attention`. */
	let { initial }: { initial?: Partial<FlashAttentionDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let tileSize = $state<TileSize>(isTileSize(initial?.tileSize) ? initial.tileSize : 2);
	/* svelte-ignore state_referenced_locally */
	let rawStep = $state(typeof initial?.step === 'number' ? initial.step : 0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const TEX = 'm = \\max(m_A, m_B), \\qquad \\ell = \\ell_A\\,e^{m_A - m} + \\ell_B\\,e^{m_B - m}';

	const steps = $derived(walkRow(DEMO_SCORES, DEMO_VALUES, tileSize));
	const tileCount = $derived(steps.length);
	const step = $derived(clampStep(rawStep, tileCount));
	const cur = $derived(step > 0 ? steps[step - 1] : undefined);
	const acc: RowState = $derived(cur ? cur.after : EMPTY_STATE);
	const ref = naiveAttention(DEMO_SCORES, DEMO_VALUES);
	const out = $derived(outputOf(acc));
	const note = $derived(describeStep(steps, step, tileSize, ref));
	const maxChanged = $derived(
		cur !== undefined && cur.before.l !== 0 && cur.after.m !== cur.before.m,
	);
	const rescale = $derived(
		cur !== undefined && cur.before.l !== 0 ? rescaleFactor(cur.before.m, cur.after.m) : 1,
	);

	function setTileSize(size: TileSize): void {
		tileSize = size;
		rawStep = 0;
	}

	function apply(patch: Partial<FlashAttentionDemoState>): void {
		if (isTileSize(patch.tileSize)) {
			tileSize = patch.tileSize;
		}
		if (typeof patch.step === 'number') rawStep = patch.step;
	}

	/** Renders the merge formula with KaTeX; without a successful render the fallback text stays. */
	function tex(node: HTMLElement) {
		try {
			katex.render(TEX, node, { strict: 'ignore', throwOnError: false });
		} catch {
			/* keep fallback text */
		}
		return {};
	}

	onMount(() => {
		return demos?.register('flash-attention', {
			set: (patch) => apply(patch as Partial<FlashAttentionDemoState>),
		});
	});
</script>

<figure class="fa" id="demo-flash-attention" data-demo="flash-attention">
	<div class="fa-controls">
		<div class="fa-group" role="group" aria-label="Размер тайла">
			{#each TILE_SIZES as size (size)}
				<button
					type="button"
					class="fa-seg"
					aria-pressed={tileSize === size}
					onclick={() => setTileSize(size)}>по {size}</button
				>
			{/each}
		</div>

		<div class="fa-steps">
			<button
				type="button"
				class="fa-btn"
				disabled={step === 0}
				onclick={() => (rawStep = step - 1)}>Назад</button
			>
			<button
				type="button"
				class="fa-btn fa-btn-primary"
				disabled={step >= tileCount}
				onclick={() => (rawStep = step + 1)}>Далее</button
			>
			<button type="button" class="fa-btn" onclick={() => (rawStep = 0)}>Сброс</button>
			<span class="fa-count">Тайл {step} из {tileCount}</span>
		</div>
	</div>

	<div class="fa-formula">
		<span class="fa-tex" use:tex aria-hidden="true"
			>m = max(m<sub>A</sub>, m<sub>B</sub>), ℓ = ℓ<sub>A</sub>e<sup>m<sub>A</sub>−m</sup> + ℓ<sub
				>B</sub
			>e<sup>m<sub>B</sub>−m</sup></span
		>
	</div>

	<div class="fa-row" role="group" aria-label="Оценки строки по тайлам">
		{#each steps as s, t (t)}
			<div
				class="fa-tile"
				class:is-done={t < step}
				class:is-current={cur !== undefined && t === step - 1}
			>
				<p class="fa-tile-t">Тайл {t + 1}</p>
				<div
					class="fa-cells"
					style="grid-template-columns: repeat({s.indices.length}, minmax(0, 1fr));"
				>
					{#each s.indices as i (i)}
						<div class="fa-cell">
							<span class="fa-cell-k">x{i + 1}</span>
							<span class="fa-cell-x">{DEMO_SCORES[i]}</span>
							<span class="fa-cell-v">v={DEMO_VALUES[i]}</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<dl class="fa-stats">
		<dt>Величина</dt>
		<dd class="fa-h">сейчас</dd>
		<dt>m (максимум)</dt>
		<dd>{step > 0 ? fmt(acc.m, 0) : '—'}</dd>
		<dt>ℓ (сумма)</dt>
		<dd>{step > 0 ? fmt(acc.l, 4) : '—'}</dd>
		<dt>a (выход × сумма)</dt>
		<dd>{step > 0 ? fmt(acc.a, 4) : '—'}</dd>
		<dt>o = a / ℓ</dt>
		<dd class="fa-out">{step > 0 ? fmt(out) : '—'}</dd>
	</dl>

	<p class="fa-rescale" class:is-on={maxChanged}>
		{#if maxChanged}
			Максимум сменился: старые ℓ и a умножены на {fmt(rescale, 4)}.
		{:else if cur !== undefined && cur.before.l === 0}
			Первый тайл: пересчитывать пока нечего.
		{:else}
			Максимум не изменился: множитель равен 1.
		{/if}
	</p>

	{#if step > 0}
		<div class="fa-table-wrap">
			<table class="fa-table">
				<thead>
					<tr>
						<th scope="col">Тайл</th>
						<th scope="col">m</th>
						<th scope="col">ℓ</th>
						<th scope="col">o</th>
					</tr>
				</thead>
				<tbody>
					{#each steps.slice(0, step) as s (s.tile)}
						<tr>
							<td>{s.tile + 1}</td>
							<td>{fmt(s.after.m, 0)}</td>
							<td>{fmt(s.after.l, 4)}</td>
							<td>{fmt(outputOf(s.after))}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<p class="fa-note" aria-live="polite">{note}</p>

	<p class="fa-look">
		<strong>Что заметить.</strong> Когда новый тайл содержит оценку больше текущего максимума,
		накопленные сумма и выход умножаются на один коэффициент. В конце o = {fmt(out)}, а наивный
		softmax дает {fmt(ref)}.
	</p>
</figure>

<style>
	.fa {
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
	.fa :global(*),
	.fa :global(*::before),
	.fa :global(*::after) {
		box-sizing: border-box;
	}
	.fa dl,
	.fa dd,
	.fa dt,
	.fa p,
	.fa table {
		margin: 0;
	}
	.fa button {
		font: inherit;
	}

	/* Controls */
	.fa-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.fa-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.fa-seg,
	.fa-btn {
		height: 32px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.fa-seg {
		border: 0;
		background: none;
		color: var(--text-muted);
	}
	.fa-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.fa-steps {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.fa-btn {
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
	}
	.fa-btn-primary {
		border-color: var(--topic);
		color: var(--topic);
	}
	.fa-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.fa-seg:focus-visible,
	.fa-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.fa-count {
		margin-left: var(--space-2);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
		white-space: nowrap;
	}

	/* Formula */
	.fa-formula {
		margin-top: var(--space-4);
		font-size: var(--fs-base);
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
	.fa-formula :global(sub),
	.fa-formula :global(sup) {
		font-size: 0.75em;
	}

	/* Tiles and cells */
	.fa-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-6);
	}
	.fa-tile {
		flex: 1 1 0;
		min-width: 0;
		padding: var(--space-3);
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		background: var(--bg);
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}
	.fa-tile.is-done {
		background: var(--topic-soft);
		border-style: solid;
		border-color: var(--topic-soft);
	}
	.fa-tile.is-current {
		border: 2px solid var(--topic);
	}
	.fa-tile-t {
		margin-bottom: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.fa-cells {
		display: grid;
		gap: var(--space-2);
	}
	.fa-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 0;
		padding: var(--space-2) 2px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.fa-cell-k {
		color: var(--text-muted);
		font-size: 11px;
	}
	.fa-cell-x {
		color: var(--text);
		font-size: 15px;
		font-weight: 600;
	}
	.fa-cell-v {
		color: var(--cat-3);
		font-size: 11px;
	}

	/* Statistics */
	.fa-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.fa-stats dt {
		color: var(--text-muted);
	}
	.fa-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.fa-stats .fa-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-size: 12px;
	}
	.fa-stats .fa-out {
		color: var(--topic);
		font-weight: 600;
	}
	.fa-rescale {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.fa-rescale.is-on {
		color: var(--text);
		font-weight: 600;
	}

	/* Table of merged tiles */
	.fa-table-wrap {
		margin-top: var(--space-4);
	}
	.fa-table {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.fa-table th,
	.fa-table td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: right;
		overflow-wrap: anywhere;
	}
	.fa-table th {
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 12px;
	}

	.fa-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.fa-look {
		margin-top: var(--space-3);
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.fa *,
		.fa *::before,
		.fa *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.fa {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.fa-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.fa-steps {
			justify-content: space-between;
		}
		.fa-row {
			flex-direction: column;
		}
		.fa-tile {
			flex: none;
		}
	}
</style>
