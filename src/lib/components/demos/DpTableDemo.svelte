<script lang="ts">
	import {
		type DpMode,
		type DpTableDemoState,
		type KnapItem,
		at,
		cellOf,
		editDp,
		greedyCoins,
		isDpMode,
		knapDp,
		minCoinsDp,
	} from '$lib/demos/dp-greedy';
	import { SvelteSet } from 'svelte/reactivity';

	/** Dynamic programming table demo: edit distance and knapsack, filled step by step. */
	let { initial }: { initial?: Partial<DpTableDemoState> } = $props();

	const EDIT_A = 'кот';
	const EDIT_B = 'кит';
	const KNAP_ITEMS: KnapItem[] = [
		{ value: 60, weight: 10 },
		{ value: 100, weight: 20 },
		{ value: 120, weight: 30 },
	];
	const KNAP_W = 50;
	const COINS = [1, 3, 4];
	const COIN_SUM = 6;

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let mode = $state<DpMode>(isDpMode(initial?.mode) ? initial.mode : 'edit');
	/* svelte-ignore state_referenced_locally */
	let step = $state(typeof initial?.step === 'number' ? Math.max(0, initial.step) : 0);

	const run = $derived(mode === 'edit' ? editDp(EDIT_A, EDIT_B) : knapDp(KNAP_ITEMS, KNAP_W));
	const total = $derived(run.steps.length);
	const fillCount = $derived(run.fillOrder.length);
	const clampedStep = $derived(Math.min(step, total));
	const current = $derived(clampedStep > 0 ? run.steps[clampedStep - 1] : null);
	const restoreShown = $derived(Math.max(0, clampedStep - fillCount));
	const rows = $derived(run.table.length);
	const cols = $derived(run.table[0]?.length ?? 0);

	/** Cells already filled: the base row and column are always shown. */
	const filled = $derived.by(() => {
		const set = new SvelteSet<string>();
		const n = run.fillOrder.length;
		const upto = Math.min(clampedStep, n);
		for (const c of run.fillOrder.slice(0, upto)) set.add(`${c.i},${c.j}`);
		return set;
	});

	const pathShown = $derived.by(() => {
		const set = new SvelteSet<string>();
		for (const p of run.path.slice(0, restoreShown)) set.add(`${p.i},${p.j}`);
		return set;
	});

	/** Cells read by the current fill step (its three neighbours). */
	const deps = $derived.by(() => {
		const set = new SvelteSet<string>();
		if (current?.phase !== 'fill') return set;
		const { i, j } = current.cell;
		if (mode === 'edit') {
			set.add(`${i - 1},${j}`);
			set.add(`${i},${j - 1}`);
			set.add(`${i - 1},${j - 1}`);
		} else {
			set.add(`${i - 1},${j}`);
			const w = at(KNAP_ITEMS, i - 1).weight;
			if (j - w >= 0) set.add(`${i - 1},${j - w}`);
		}
		return set;
	});

	const currentKey = $derived(current ? `${current.cell.i},${current.cell.j}` : '');

	const description = $derived.by(() => {
		if (clampedStep === 0) {
			return mode === 'edit'
				? 'Таблица пуста: заполнены только границы (пустой префикс). Нажмите «Далее».'
				: 'Таблица пуста: нулевая строка и нулевой столбец. Нажмите «Далее».';
		}
		if (clampedStep === total) {
			return `Готово. Ответ: ${run.answer}${mode === 'knap' ? ' (ценность)' : ''}.`;
		}
		return current ? current.text : '';
	});

	const greedy = $derived(greedyCoins(COINS, COIN_SUM));
	const optimal = $derived(minCoinsDp(COINS, COIN_SUM));

	function cellClass(i: number, j: number): string {
		const key = `${i},${j}`;
		const parts = ['dp-cell'];
		if (i === 0 || j === 0) parts.push('is-base');
		if (key === currentKey) parts.push('is-current');
		else if (deps.has(key)) parts.push('is-dep');
		if (pathShown.has(key)) parts.push('is-path');
		return parts.join(' ');
	}

	function show(i: number, j: number): string {
		if (i === 0 || j === 0 || filled.has(`${i},${j}`)) return String(cellOf(run.table, i, j));
		return '·';
	}

	function rowLabel(i: number): string {
		if (mode === 'edit') return i === 0 ? '∅' : (EDIT_A[i - 1] ?? '');
		return i === 0 ? '0' : `${i}`;
	}

	function colLabel(j: number): string {
		if (mode === 'edit') return j === 0 ? '∅' : (EDIT_B[j - 1] ?? '');
		return `${j}`;
	}

	function setMode(next: DpMode): void {
		mode = next;
		step = 0;
	}

	function reset(): void {
		step = 0;
	}

	function onKey(e: KeyboardEvent): void {
		if (e.key === 'ArrowRight') step = Math.min(total, clampedStep + 1);
		if (e.key === 'ArrowLeft') step = Math.max(0, clampedStep - 1);
	}
</script>

<figure class="dp" id="demo-dp-table" data-demo="dp-table" onkeydown={onKey}>
	<div class="dp-controls">
		<div class="dp-group" role="group" aria-label="Задача">
			<button
				type="button"
				class="dp-seg"
				aria-pressed={mode === 'edit'}
				onclick={() => setMode('edit')}>Редакционное расстояние</button
			>
			<button
				type="button"
				class="dp-seg"
				aria-pressed={mode === 'knap'}
				onclick={() => setMode('knap')}>Рюкзак</button
			>
		</div>
	</div>

	<p class="dp-title">
		{#if mode === 'edit'}
			D[i][j] для «{EDIT_A}» и «{EDIT_B}»
		{:else}
			F(k, c): ценности и веса {KNAP_ITEMS.map((it) => `(${it.value}, ${it.weight})`).join(', ')}, W
			= {KNAP_W}
		{/if}
	</p>

	<div class="dp-table-wrap">
		<table class="dp-table">
			<caption class="dp-sr">
				Таблица динамического программирования: {rows} строк, {cols} столбцов
			</caption>
			<thead>
				<tr>
					<th scope="col" class="dp-corner">{mode === 'edit' ? '' : 'k\\c'}</th>
					{#each Array.from({ length: cols }, (_, j) => j) as j (j)}
						<th scope="col">{colLabel(j)}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
					<tr>
						<th scope="row">{rowLabel(i)}</th>
						{#each Array.from({ length: cols }, (_, j) => j) as j (j)}
							<td class={cellClass(i, j)}>
								{show(i, j)}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="dp-controls dp-steps">
		<button type="button" class="dp-btn" onclick={() => (step = Math.max(0, clampedStep - 1))}
			>Назад</button
		>
		<button
			type="button"
			class="dp-btn dp-btn-primary"
			onclick={() => (step = Math.min(total, clampedStep + 1))}
			disabled={clampedStep >= total}>Далее</button
		>
		<button type="button" class="dp-btn" onclick={reset}>Сброс</button>
		<label class="dp-ctl">
			<span class="dp-label">Шаг</span>
			<input
				class="dp-range"
				type="range"
				min="0"
				max={total}
				step="1"
				value={clampedStep}
				oninput={(e) => (step = Number(e.currentTarget.value))}
			/>
			<output class="dp-val">{clampedStep}/{total}</output>
		</label>
	</div>

	<p class="dp-desc" aria-live="polite">{description}</p>

	<div class="dp-greedy">
		<p class="dp-greedy-t">Жадность против динамики: монеты {COINS.join(', ')}, сумма {COIN_SUM}</p>
		<p>
			Жадно (самая крупная монета, которая помещается): {greedy
				? greedy.join(' + ')
				: 'не сходится'}
			= {greedy ? greedy.length : '—'} монет.
		</p>
		<p>
			Динамика по сумме: {optimal ? optimal.join(' + ') : 'не сходится'}
			= {optimal ? optimal.length : '—'} монеты.
		</p>
	</div>

	<p class="dp-note">
		<strong>Что заметить:</strong> каждая ячейка читает только соседей, уже заполненных раньше. Восстановление
		идёт от правого нижнего угла назад по тем же соседям.
	</p>
</figure>

<style>
	.dp {
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
	.dp dl,
	.dp p {
		margin: 0;
	}
	.dp button {
		font: inherit;
	}
	.dp-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.dp-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-6);
	}
	.dp-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.dp-seg,
	.dp-btn {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.dp-seg {
		border-color: transparent;
		background: none;
		color: var(--text-muted);
	}
	.dp-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.dp-btn-primary {
		border-color: var(--topic);
		color: var(--topic);
	}
	.dp-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.dp-seg:focus-visible,
	.dp-btn:focus-visible,
	.dp-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.dp-title {
		margin-top: var(--space-4);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}

	.dp-table-wrap {
		overflow-x: auto;
		margin-top: var(--space-4);
		padding-bottom: var(--space-1);
	}
	.dp-table {
		border-collapse: separate;
		border-spacing: 2px;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.dp-table th {
		min-width: 28px;
		padding: 2px 6px;
		color: var(--text-muted);
		font-weight: 500;
		text-align: center;
	}
	.dp-cell {
		min-width: 28px;
		height: 28px;
		padding: 0 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg);
		color: var(--text-muted);
		text-align: center;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.dp-cell.is-base {
		background: var(--surface-2);
		color: var(--text);
	}
	.dp-cell.is-dep {
		background: color-mix(in srgb, var(--cat-3) 22%, var(--surface));
	}
	.dp-cell.is-path {
		outline: 2px solid var(--cat-1);
		outline-offset: -2px;
	}
	.dp-cell.is-current {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}

	.dp-steps {
		margin-top: var(--space-4);
	}
	.dp-ctl {
		display: flex;
		flex: 1 1 220px;
		align-items: center;
		gap: var(--space-3);
	}
	.dp-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.dp-range {
		flex: 1;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.dp-val {
		min-width: 6ch;
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.dp-desc {
		min-height: 3em;
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.dp-greedy {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.dp-greedy-t {
		color: var(--text);
		font-weight: 600;
	}
	.dp-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.dp *,
		.dp *::before,
		.dp *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.dp {
			padding: var(--space-4);
		}
	}
</style>
