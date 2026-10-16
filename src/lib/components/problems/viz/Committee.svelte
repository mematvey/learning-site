<script lang="ts">
	import { hypergeomPmf } from '$lib/prob/hypergeom';
	import { toNumber } from '$lib/prob/rational';

	/**
	 * Staff grid and committee draw: N employees, K of them managers, a committee of n.
	 * The bar chart shows the hypergeometric distribution of the number of managers, k = 0…n.
	 */
	let {
		N,
		K,
		n,
		k,
	}: {
		/** Staff size. */
		N: number;
		/** Managers among them. */
		K: number;
		/** Committee size. */
		n: number;
		/** Target number of managers (highlighted bar). */
		k: number;
	} = $props();

	/** Current draw, tied to the parameters it was made for: a change of N, K or n drops it. */
	let pick: { key: string; idx: number[] } = $state({ key: '', idx: [] });
	const paramsKey = $derived(`${N}/${K}/${n}`);
	const chosen = $derived(pick.key === paramsKey ? pick.idx : []);
	const cols = $derived(Math.max(1, Math.min(N, 10)));
	const cells = $derived(Array.from({ length: Math.max(0, N) }, (_, i) => i));
	const managersInCommittee = $derived(chosen.filter((i) => i < K).length);

	const bars = $derived(
		Array.from({ length: Math.max(0, n) + 1 }, (_, kk) => ({
			kk,
			p: toNumber(hypergeomPmf(N, K, n, kk)),
		})),
	);
	const maxP = $derived(Math.max(1e-9, ...bars.map((b) => b.p)));

	function choose(): void {
		// Partial Fisher–Yates: n distinct employees out of N.
		const a = Array.from({ length: N }, (_, i) => i);
		const out: number[] = [];
		for (let i = 0; i < n && i < N; i++) {
			const j = i + Math.floor(Math.random() * (N - i));
			const ai = a[i] ?? 0;
			a[i] = a[j] ?? 0;
			a[j] = ai;
			out.push(a[i] ?? 0);
		}
		pick = { key: paramsKey, idx: out };
	}
</script>

<div class="cm">
	<div class="cm-controls">
		<button type="button" class="cm-btn" onclick={choose}>Выбрать комиссию</button>
		<span class="cm-legend">
			<i class="cm-sw is-mgr" aria-hidden="true"></i> менеджер
			<i class="cm-sw is-picked" aria-hidden="true"></i> в комиссии
		</span>
	</div>

	<div
		class="cm-grid"
		role="group"
		aria-label="Сотрудники: {N}, менеджеров: {K}"
		style:--cols={cols}
	>
		{#each cells as i (i)}
			<span
				class="cm-cell"
				class:is-mgr={i < K}
				class:is-picked={chosen.includes(i)}
				aria-hidden="true"
			></span>
		{/each}
	</div>

	<p class="cm-status" aria-live="polite">
		{#if chosen.length === 0}
			Комиссия ещё не выбрана.
		{:else}
			В комиссии из {n}: менеджеров <b>{managersInCommittee}</b>, нужно ровно <b>{k}</b>.
		{/if}
	</p>

	<div class="cm-chart" role="list" aria-label="Распределение числа менеджеров в комиссии">
		{#each bars as b (b.kk)}
			<div
				class="cm-col"
				role="listitem"
				class:is-target={b.kk === k}
				class:is-sample={chosen.length > 0 && b.kk === managersInCommittee}
			>
				<span class="cm-val">{b.p.toFixed(3)}</span>
				<span class="cm-track">
					<span class="cm-fill" style:height="{(b.p / maxP) * 100}%"></span>
				</span>
				<span class="cm-idx">{b.kk}</span>
			</div>
		{/each}
	</div>
	<p class="cm-axis">По оси X: число менеджеров в комиссии k. Выделен столбец k = {k}.</p>
</div>

<style>
	.cm {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
	}
	.cm-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3) var(--space-4);
	}
	.cm-btn {
		font: inherit;
		font-size: var(--fs-sm);
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius);
		border: 1px solid var(--topic);
		background: var(--topic);
		color: var(--surface);
		cursor: pointer;
	}
	.cm-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.cm-legend {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-muted);
	}
	.cm-sw {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--surface-2);
	}
	.cm-sw.is-mgr {
		background: var(--topic);
		border-color: var(--topic);
	}
	.cm-sw.is-picked {
		outline: 2px solid var(--text);
		outline-offset: 1px;
	}

	.cm-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 4px;
	}
	.cm-cell {
		display: block;
		aspect-ratio: 1;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--surface-2);
		transition: background var(--dur-fast) var(--ease);
	}
	.cm-cell.is-mgr {
		background: var(--topic);
		border-color: var(--topic);
	}
	.cm-cell.is-picked {
		outline: 2px solid var(--text);
		outline-offset: 1px;
	}

	.cm-status,
	.cm-axis {
		margin: 0;
	}
	.cm-axis {
		color: var(--text-muted);
		font-size: 12px;
	}
	.cm-status b {
		font-family: var(--font-mono);
		font-weight: 500;
	}

	.cm-chart {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	.cm-col {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1);
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
	}
	.cm-col.is-sample {
		border-color: var(--text);
	}
	.cm-val,
	.cm-idx {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.cm-col.is-target .cm-val,
	.cm-col.is-target .cm-idx {
		color: var(--topic);
	}
	.cm-track {
		display: flex;
		align-items: flex-end;
		width: 100%;
		height: 110px;
	}
	.cm-fill {
		display: block;
		width: 100%;
		min-height: 0;
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		background: var(--border);
		transition: height var(--dur) var(--ease);
	}
	.cm-col.is-target .cm-fill {
		background: var(--topic);
	}

	@media (prefers-reduced-motion: reduce) {
		.cm-fill,
		.cm-cell {
			transition: none;
		}
	}
</style>
