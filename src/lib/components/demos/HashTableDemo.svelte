<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		DEFAULT_COUNT,
		DEFAULT_HASH,
		DEFAULT_STRATEGY,
		N_MAX,
		buildTable,
		describeTable,
		formatLoad,
		isHashKind,
		isStrategy,
		snapCount,
		type HashKind,
		type HashTableDemoState,
		type Strategy,
	} from '$lib/demos/hash-tables';

	/** Hash table demo: keys are inserted one by one; collisions, load factor and rehashing. Registers itself as demo `hash-tables`. */
	let { initial }: { initial?: Partial<HashTableDemoState> } = $props();

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const start: HashTableDemoState = {
		strategy: isStrategy(initial?.strategy) ? initial.strategy : DEFAULT_STRATEGY,
		hash: isHashKind(initial?.hash) ? initial.hash : DEFAULT_HASH,
		count: snapCount(initial?.count ?? DEFAULT_COUNT),
	};

	/* The props only seed the initial state: the demo owns it afterwards. */
	let strategy = $state<Strategy>(start.strategy);
	let hash = $state<HashKind>(start.hash);
	let count = $state(start.count);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const tableState: HashTableDemoState = $derived({ strategy, hash, count });
	const table = $derived(buildTable(tableState));
	const note = $derived(describeTable(tableState, table));
	const isChain = $derived(strategy === 'chain');
	const hashFormula = $derived(
		hash === 'division' ? 'h(k) = k mod m' : 'h(k) = ⌊m · frac(k · A)⌋, A = (√5 − 1) / 2',
	);
	const lastText = $derived(
		table.lastKey === null
			? 'нет'
			: `${table.lastKey} → ячейка ${table.lastIndex} (сравнений: ${table.lastCost})`,
	);

	function apply(patch: Partial<HashTableDemoState>): void {
		if (isStrategy(patch.strategy)) strategy = patch.strategy;
		if (isHashKind(patch.hash)) hash = patch.hash;
		if (typeof patch.count === 'number') count = snapCount(patch.count);
	}

	function addKey(): void {
		count = snapCount(count + 1);
	}

	function reset(): void {
		strategy = start.strategy;
		hash = start.hash;
		count = start.count;
	}

	onMount(() =>
		demos?.register('hash-tables', {
			set: (patch) => apply(patch as Partial<HashTableDemoState>),
		}),
	);
</script>

<figure class="hs" id="demo-hash-tables" data-demo="hash-tables" data-hl={hl ?? undefined}>
	<div class="hs-controls">
		<div class="hs-group" role="group" aria-label="Разрешение коллизий">
			<button
				type="button"
				class="hs-seg"
				aria-pressed={isChain}
				onclick={() => (strategy = 'chain')}>Цепочки</button
			>
			<button
				type="button"
				class="hs-seg"
				aria-pressed={!isChain}
				onclick={() => (strategy = 'probe')}>Открытая адресация</button
			>
		</div>

		<div class="hs-group" role="group" aria-label="Хеш-функция">
			<button
				type="button"
				class="hs-seg"
				aria-pressed={hash === 'division'}
				onclick={() => (hash = 'division')}>Деление</button
			>
			<button
				type="button"
				class="hs-seg"
				aria-pressed={hash === 'multiplicative'}
				onclick={() => (hash = 'multiplicative')}>Умножение</button
			>
		</div>

		<label class="hs-ctl">
			<span class="hs-label">n (ключей)</span>
			<input
				class="hs-range"
				type="range"
				min="0"
				max={N_MAX}
				step="1"
				value={count}
				oninput={(e) => (count = snapCount(Number(e.currentTarget.value)))}
			/>
			<output class="hs-val">{count}</output>
		</label>

		<div class="hs-btns">
			<button type="button" class="hs-btn" onclick={addKey} disabled={count >= N_MAX}
				>Добавить ключ</button
			>
			<button type="button" class="hs-btn" onclick={reset}>Сбросить</button>
		</div>
	</div>

	<p class="hs-formula" aria-hidden="true">{hashFormula}</p>

	<div class="hs-table">
		<p class="hs-panel-t">
			{isChain ? 'Корзины с цепочками' : 'Ячейки массива'}
			<span class="hs-muted">, m = {table.size}</span>
		</p>
		{#if isChain}
			<ol class="hs-buckets" aria-label="Корзины хеш-таблицы">
				{#each table.cells as cell, i (i)}
					<li
						class="hs-bucket"
						class:hs-last={i === table.lastIndex}
						aria-label="корзина {i}: {cell.length === 0 ? 'пусто' : cell.join(', ')}"
					>
						<span class="hs-idx">{i}</span>
						<span class="hs-chain">
							{#each cell as key, j (j)}
								<span
									class="hs-key"
									class:hs-key-last={i === table.lastIndex && j === cell.length - 1}>{key}</span
								>
							{/each}
						</span>
					</li>
				{/each}
			</ol>
		{:else}
			<ol class="hs-slots" aria-label="Ячейки хеш-таблицы">
				{#each table.cells as cell, i (i)}
					<li
						class="hs-slot"
						class:hs-used={cell.length > 0}
						class:hs-last={i === table.lastIndex}
						aria-label="ячейка {i}: {cell.length === 0 ? 'пусто' : cell[0]}"
					>
						<span class="hs-idx">{i}</span>
						<span class="hs-slot-key">{cell[0] ?? ''}</span>
					</li>
				{/each}
			</ol>
		{/if}
	</div>

	<dl class="hs-stats">
		<dt>Коэффициент заполнения α = n / m</dt>
		<dd>{formatLoad(table.load)}</dd>
		<dt>Коллизии при вставке</dt>
		<dd>{table.collisions}</dd>
		<dt>Перехеширований</dt>
		<dd>{table.rehashes}</dd>
		<dt>{isChain ? 'Самая длинная цепочка' : 'Самый длинный занятый участок'}</dt>
		<dd>{table.longest}</dd>
		<dt>Сравнений при успешном поиске, среднее</dt>
		<dd>{table.avgProbes.toFixed(2)}</dd>
		<dt>По теории при этом α</dt>
		<dd>{table.theoryProbes.toFixed(2)}</dd>
		<dt>Последний вставленный ключ</dt>
		<dd>{lastText}</dd>
	</dl>

	<p class="hs-note" aria-live="polite">{note}</p>

	<div class="hs-notice">
		<p class="hs-h2">Что заметить</p>
		<ul>
			<li>Пока α мал, почти все ключи попадают в пустые места и поиск занимает одно сравнение.</li>
			<li>
				С ростом α коллизии учащаются: в цепочках растут корзины, при открытой адресации занятые
				участки сливаются в кластеры, и поиск замедляется заметнее.
			</li>
			<li>
				Когда α переходит порог 0,75, таблица перестраивается с бо́льшим простым размером: ключи
				переставляются заново, а α падает. Это амортизированная цена вставки.
			</li>
			<li>
				Деление зависит от m: с простым m распределение обычно ровное. Умножение с числом Кнута
				работает при любом m.
			</li>
		</ul>
	</div>
</figure>

<style>
	.hs {
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
	.hs :global(*),
	.hs :global(*::before),
	.hs :global(*::after) {
		box-sizing: border-box;
	}
	.hs dl,
	.hs dd,
	.hs dt,
	.hs p,
	.hs ul,
	.hs ol {
		margin: 0;
	}
	.hs ul,
	.hs ol {
		padding: 0;
	}
	.hs ul {
		padding-left: var(--space-4);
	}
	.hs button {
		font: inherit;
	}
	.hs-muted {
		color: var(--text-muted);
	}

	/* Controls */
	.hs-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.hs-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.hs-seg,
	.hs-btn {
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
	.hs-btn {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.hs-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.hs-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.hs-seg:focus-visible,
	.hs-btn:focus-visible,
	.hs-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.hs-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.hs-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.hs-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.hs-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.hs-btns {
		display: flex;
		gap: var(--space-2);
	}

	.hs-formula {
		margin-top: var(--space-4);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
	}

	/* Table */
	.hs-table {
		margin-top: var(--space-4);
	}
	.hs-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.hs-buckets {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
		gap: var(--space-2);
		list-style: none;
	}
	.hs-bucket,
	.hs-slot {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		min-height: 52px;
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}
	.hs-slots {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
		gap: var(--space-2);
		list-style: none;
	}
	.hs-slot {
		align-items: center;
		justify-content: center;
		min-height: 56px;
	}
	.hs-used {
		background: var(--topic-soft);
		border-color: var(--topic);
	}
	.hs-idx {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	.hs-chain {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 2px;
	}
	.hs-key,
	.hs-slot-key {
		display: block;
		padding: 1px 4px;
		border-radius: 3px;
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		text-align: center;
		min-height: 1.4em;
	}
	.hs-key-last,
	.hs-last {
		border-color: var(--cat-1);
		box-shadow: inset 0 0 0 1px var(--cat-1);
	}

	/* Statistics */
	.hs-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.hs-stats dt {
		color: var(--text-muted);
	}
	.hs-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
		overflow-wrap: anywhere;
	}
	.hs-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* What to notice */
	.hs-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.hs-h2 {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.hs-notice li + li {
		margin-top: var(--space-1);
	}

	@media (prefers-reduced-motion: reduce) {
		.hs-seg,
		.hs-btn,
		.hs-bucket,
		.hs-slot {
			transition: none;
		}
	}

	@media (max-width: 559px) {
		.hs {
			padding: var(--space-4);
		}
		.hs-range {
			width: 120px;
		}
		.hs-buckets {
			grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
		}
		.hs-slots {
			grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
		}
		.hs-stats {
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}
</style>
