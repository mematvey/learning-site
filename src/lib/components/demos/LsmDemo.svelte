<script lang="ts">
	import {
		BLOOM_BITS,
		BTREE_KEYS,
		PRESET_KEYS,
		bloomPositions,
		buildBTree,
		emptyLsm,
		getKey,
		layoutBTree,
		leafRange,
		putKey,
		searchBTree,
		type BTreeLookup,
		type LookupStep,
		type LsmLookup,
		type LsmState,
	} from '$lib/demos/databases-indexes';

	/** LSM write/read path and B-tree search demo. The prop is accepted for the placeholder contract and ignored. */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let { initial }: { initial?: Record<string, unknown> } = $props();

	/** Keys written by the "Ещё 6 ключей" button: enough to trigger a flush and a compaction. */
	const MORE_KEYS = [64, 3, 88, 12, 29, 71];

	function presetState(): LsmState {
		return PRESET_KEYS.reduce((s, k) => putKey(s, k), emptyLsm());
	}

	const tree = buildBTree(BTREE_KEYS);
	const BOX_W = 40;
	const BOX_H = 30;
	const TREE_W = 340;
	const TREE_H = 190;
	const boxes = layoutBTree(tree, TREE_W, TREE_H, BOX_W, BOX_H);

	let lsm = $state<LsmState>(presetState());
	let writeInput = $state('');
	let searchInput = $state('');
	let lsmLookup = $state<LsmLookup | null>(null);
	let btLookup = $state<BTreeLookup | null>(null);
	/** How many steps of the search are revealed; each step reveals one LSM step and one B-tree node. */
	let shown = $state(0);
	let status = $state('Введите ключ и нажмите «Найти»: поиск покажет путь в LSM и в B-дереве.');

	/** The memtable step is always the first one of a lookup. */
	const memHit = $derived.by(() => {
		const first = lsmLookup?.steps[0];
		return shown >= 1 && first?.kind === 'memtable' && first.found;
	});

	const totalSteps = $derived(
		lsmLookup ? Math.max(lsmLookup.steps.length, btLookup?.path.length ?? 0) : 0,
	);

	function parseKey(raw: string): number | null {
		const n = Number(raw.trim());
		return raw.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 999 ? n : null;
	}

	function write(keys: readonly number[]): void {
		let s = lsm;
		for (const k of keys) s = putKey(s, k);
		lsm = s;
		lsmLookup = null;
		btLookup = null;
		shown = 0;
		status = `Записано ключей: ${keys.length}. ${s.log.at(-1) ?? ''}`;
	}

	function onWrite(e: SubmitEvent): void {
		e.preventDefault();
		const k = parseKey(writeInput);
		if (k === null) {
			status = 'Ключ должен быть целым числом от 0 до 999.';
			return;
		}
		write([k]);
		writeInput = '';
	}

	function onSearch(e: SubmitEvent): void {
		e.preventDefault();
		const k = parseKey(searchInput);
		if (k === null) {
			status = 'Ключ должен быть целым числом от 0 до 999.';
			return;
		}
		lsmLookup = getKey(lsm, k);
		btLookup = searchBTree(tree, k);
		shown = 0;
		status = `Поиск ключа ${k}. Нажмите «Следующий шаг».`;
	}

	function nextStep(): void {
		if (!lsmLookup || !btLookup) return;
		shown = Math.min(totalSteps, shown + 1);
		if (shown === totalSteps) {
			status = lsmLookup.found
				? `Ключ ${lsmLookup.key} найден в LSM. Файлов прочитано: ${lsmLookup.filesRead}, отсеяно фильтром: ${lsmLookup.filesSkipped}.`
				: `Ключа ${lsmLookup.key} в LSM нет. Файлов прочитано: ${lsmLookup.filesRead}, отсеяно фильтром: ${lsmLookup.filesSkipped}.`;
		}
	}

	function reset(): void {
		lsm = presetState();
		lsmLookup = null;
		btLookup = null;
		shown = 0;
		status = 'Состояние сброшено к начальному.';
	}

	/** The revealed lookup step that touches this SSTable, if any. */
	function stepFor(tableId: number): LookupStep | null {
		if (!lsmLookup) return null;
		for (let i = 0; i < shown && i < lsmLookup.steps.length; i++) {
			const st = lsmLookup.steps[i];
			if (st && 'tableId' in st && st.tableId === tableId) return st;
		}
		return null;
	}

	/** Bit positions of the query key in this SSTable's filter, when the table is part of the revealed steps. */
	function checkedBits(tableId: number): Set<number> {
		return lsmLookup && stepFor(tableId) ? new Set(bloomPositions(lsmLookup.key)) : new Set();
	}

	function zeroBitFor(tableId: number): number {
		const st = stepFor(tableId);
		return st && st.kind === 'skip' ? st.bit : -1;
	}

	function nodeShown(id: number): boolean {
		return btLookup !== null && btLookup.path.indexOf(id) >= 0 && btLookup.path.indexOf(id) < shown;
	}

	const boxById = new Map(boxes.map((b) => [b.id, b]));
	const pathEdges = $derived.by(() => {
		if (!btLookup) return [] as Array<{ x1: number; y1: number; x2: number; y2: number }>;
		const out: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
		for (let i = 0; i < Math.min(shown, btLookup.path.length) - 1; i++) {
			const ai = btLookup.path[i];
			const bi = btLookup.path[i + 1];
			const a = ai === undefined ? undefined : boxById.get(ai);
			const b = bi === undefined ? undefined : boxById.get(bi);
			if (a && b) {
				out.push({ x1: a.x + a.w / 2, y1: a.y + a.h, x2: b.x + b.w / 2, y2: b.y });
			}
		}
		return out;
	});
</script>

<figure class="db" data-demo="lsm-demo">
	<div class="db-controls">
		<form class="db-form" onsubmit={onWrite}>
			<label class="db-label" for="db-write">Записать ключ</label>
			<input
				id="db-write"
				class="db-input"
				type="text"
				inputmode="numeric"
				bind:value={writeInput}
				placeholder="0–999"
			/>
			<button class="db-btn db-btn-primary" type="submit">Записать</button>
		</form>
		<form class="db-form" onsubmit={onSearch}>
			<label class="db-label" for="db-search">Найти ключ</label>
			<input
				id="db-search"
				class="db-input"
				type="text"
				inputmode="numeric"
				bind:value={searchInput}
				placeholder="0–999"
			/>
			<button class="db-btn db-btn-primary" type="submit">Найти</button>
		</form>
		<div class="db-actions">
			<button class="db-btn" type="button" onclick={() => write(MORE_KEYS)}>Ещё 6 ключей</button>
			<button
				class="db-btn"
				type="button"
				disabled={!lsmLookup || shown >= totalSteps}
				onclick={nextStep}>Следующий шаг</button
			>
			<button class="db-btn" type="button" onclick={reset}>Сбросить</button>
		</div>
	</div>

	<p class="db-status" aria-live="polite">{status}</p>

	<div class="db-plots">
		<section class="db-panel" aria-labelledby="db-lsm-title">
			<h3 id="db-lsm-title" class="db-panel-t">LSM: запись и поиск</h3>

			<p class="db-row-t">Memtable в памяти ({lsm.memtable.length} из 4)</p>
			<div class="db-mem" class:is-hit={memHit}>
				{#if lsm.memtable.length === 0}
					<span class="db-muted">пусто</span>
				{:else}
					{#each lsm.memtable as k (k)}<span class="db-key">{k}</span>{/each}
				{/if}
			</div>

			<p class="db-row-t">SSTable на диске (новые справа)</p>
			{#if lsm.sstables.length === 0}
				<p class="db-muted">Пока ни одного файла.</p>
			{/if}
			<ul class="db-tables">
				{#each lsm.sstables as t (t.id)}
					{@const st = stepFor(t.id)}
					{@const checked = checkedBits(t.id)}
					{@const zero = zeroBitFor(t.id)}
					<li
						class="db-table"
						class:is-skip={st?.kind === 'skip'}
						class:is-read={st?.kind === 'read'}
					>
						<div class="db-table-h">
							<span class="db-table-id">SSTable #{t.id}</span>
							<span class="db-keys">{t.keys.join(', ')}</span>
						</div>
						<div class="db-bloom" aria-label={`Фильтр Блума SSTable #${t.id}`}>
							{#each t.bloom as bit, i (i)}
								<span
									class="db-bit"
									class:is-on={bit}
									class:is-checked={checked.has(i)}
									class:is-zero={i === zero}
								></span>
							{/each}
						</div>
						{#if st?.kind === 'skip'}
							<p class="db-tag db-tag-skip">фильтр: ключа точно нет, файл не читаем</p>
						{:else if st?.kind === 'read'}
							<p class="db-tag db-tag-read">фильтр: ключ возможен, файл читаем</p>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="db-note">
				Полоска — фильтр Блума ({BLOOM_BITS} бит): тёмные биты установлены, обводкой отмечены биты ключа.
			</p>

			<p class="db-log-t">Журнал</p>
			<ol class="db-log">
				{#each lsm.log.slice(-4) as line, i (i)}<li>{line}</li>{/each}
			</ol>
		</section>

		<section class="db-panel" aria-labelledby="db-bt-title">
			<h3 id="db-bt-title" class="db-panel-t">B-дерево: путь от корня к листу</h3>
			<svg
				class="db-tree"
				viewBox="0 0 {TREE_W} {TREE_H}"
				role="img"
				aria-labelledby="db-bt-svg-t db-bt-svg-d"
			>
				<title id="db-bt-svg-t">B-дерево индекса из 27 ключей</title>
				<desc id="db-bt-svg-d"
					>Три уровня: корень, три внутренних узла и девять листьев. Поиск идёт по одному пути от
					корня к листу.</desc
				>
				{#each pathEdges as e, i (i)}
					<line class="db-edge-hit" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
				{/each}
				{#each tree.nodes as n (n.id)}
					{@const b = boxById.get(n.id)}
					{#if b}
						<g
							class:is-hit={nodeShown(n.id)}
							class:is-current={btLookup !== null && shown > 0 && btLookup.path[shown - 1] === n.id}
						>
							<rect class="db-node" x={b.x} y={b.y} width={b.w} height={b.h} rx="4" />
							<text class="db-node-t" x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} text-anchor="middle">
								{n.level === 0 ? leafRange(n) : n.children.length + ' дет.'}
							</text>
						</g>
					{/if}
				{/each}
			</svg>
			<p class="db-note">
				{#if btLookup}
					Ключ {btLookup.key}: прочитано страниц {shown} из {btLookup.path.length}, {btLookup.found
						? 'ключ в листе есть'
						: 'в листе его нет'}.
				{:else}
					Один поиск читает по одной странице на каждый уровень: здесь три.
				{/if}
			</p>
		</section>
	</div>
</figure>

<style>
	.db {
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
	.db :global(*),
	.db :global(*::before),
	.db :global(*::after) {
		box-sizing: border-box;
	}
	.db p,
	.db ul,
	.db ol,
	.db h3 {
		margin: 0;
		padding: 0;
	}
	.db ul,
	.db ol {
		list-style: none;
	}
	.db-muted {
		color: var(--text-muted);
	}
	.db-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.db-form {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.db-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.db-input {
		width: 88px;
		height: 34px;
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.db-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.db-btn {
		height: 34px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}
	.db-btn-primary {
		border-color: var(--topic);
		color: var(--topic);
	}
	.db-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.db-input:focus-visible,
	.db-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.db-status {
		margin-top: var(--space-3);
		color: var(--text);
	}

	.db-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-5);
	}
	.db-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.db-row-t,
	.db-log-t {
		margin-top: var(--space-3);
		margin-bottom: var(--space-1);
		color: var(--text-muted);
	}
	.db-mem {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		min-height: 28px;
		padding: var(--space-1);
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
	}
	.db-mem.is-hit {
		border-color: var(--topic);
	}
	.db-key {
		padding: 0 6px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.db-tables {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.db-table {
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.db-table.is-skip {
		border-color: var(--cat-2);
	}
	.db-table.is-read {
		border-color: var(--topic);
	}
	.db-table-h {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: baseline;
	}
	.db-table-id {
		font-weight: 600;
	}
	.db-keys {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}
	.db-bloom {
		display: grid;
		grid-template-columns: repeat(32, 1fr);
		gap: 2px;
		margin-top: var(--space-2);
	}
	.db-bit {
		display: block;
		height: 6px;
		border-radius: 1px;
		background: var(--surface-2);
	}
	.db-bit.is-on {
		background: var(--text-muted);
	}
	.db-bit.is-checked {
		outline: 1px solid var(--topic);
	}
	.db-bit.is-zero {
		background: var(--cat-2);
		outline-color: var(--cat-2);
	}
	.db-tag {
		margin-top: var(--space-2);
		font-size: 12px;
	}
	.db-tag-skip {
		color: var(--cat-2);
	}
	.db-tag-read {
		color: var(--topic);
	}
	.db-note {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.db-log {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
		color: var(--text-muted);
	}

	.db-tree {
		display: block;
		width: 100%;
		height: auto;
		max-height: 220px;
	}
	.db-node {
		fill: var(--surface-2);
		stroke: var(--border);
	}
	.db-node-t {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.db-edge-hit {
		stroke: var(--topic);
		stroke-width: 2;
	}
	g.is-hit .db-node {
		fill: var(--surface);
		stroke: var(--topic);
		stroke-width: 2;
	}
	g.is-current .db-node {
		fill: var(--topic);
	}
	g.is-current .db-node-t {
		fill: var(--surface);
	}

	@media (max-width: 640px) {
		.db {
			padding: var(--space-4);
		}
		.db-plots {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.db * {
			transition: none !important;
		}
	}
</style>
