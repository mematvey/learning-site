<script lang="ts">
	import {
		BLOCK,
		DEFAULT_STATE,
		LENGTH_DEFAULT,
		LENGTH_MAX,
		LENGTH_MIN,
		PREFIX_MAX,
		PREFIX_MIN,
		REQUESTS_MAX,
		REQUESTS_MIN,
		STATIC_RESERVE,
		STEP,
		TAIL_MAX,
		TAIL_MIN,
		blocksFor,
		buildLayout,
		describeChange,
		emptySlots,
		makeState,
		singleBlocks,
		snapLength,
		statsFor,
		staticIdle,
		stepState,
		type PagingState,
		type StateKey,
	} from '$lib/demos/kv-cache-paging';

	/** KV-cache paging demo: blocks of 16 tokens, block tables, prefix sharing. */
	let { initial }: { initial?: Partial<PagingState> & { length?: number } } = $props();

	/* svelte-ignore state_referenced_locally */
	let cfg = $state<PagingState>(makeState(initial));
	/* svelte-ignore state_referenced_locally */
	let length = $state(snapLength(initial?.length ?? LENGTH_DEFAULT));
	/** Cause and effect of the last change; read out by the live region. */
	let message = $state('');

	const layout = $derived(buildLayout(cfg));
	const stats = $derived(statsFor(cfg));
	const single = $derived(singleBlocks(length));
	const singleEmpty = $derived(emptySlots(length));
	const singleIdle = $derived(Math.round(staticIdle(length) * 100));
	const modeName = $derived(cfg.share ? 'с разделением префикса' : 'без разделения префикса');
	const summary = $derived(
		`Запросов: ${cfg.requests}. Занято блоков: ${layout.blocks.length} (${modeName}). ` +
			`Без разделения понадобилось бы ${stats.withoutShare}, с разделением ${stats.withShare}.`,
	);

	function apply(next: PagingState): void {
		message = describeChange(cfg, next);
		cfg = next;
	}

	function step(key: StateKey, dir: 1 | -1): void {
		const next = stepState(cfg, key, dir);
		if (next[key] === cfg[key]) {
			message = 'Достигнут предел.';
			return;
		}
		apply(next);
	}

	function setKey(key: StateKey, value: number): void {
		apply({ ...cfg, [key]: value } as PagingState);
	}

	function toggleShare(): void {
		apply({ ...cfg, share: !cfg.share });
	}

	function reset(): void {
		cfg = { ...DEFAULT_STATE };
		length = LENGTH_DEFAULT;
		message = 'Вернули значения по умолчанию.';
	}

	const rowLabel = (i: number) => `Запрос ${i + 1}`;
</script>

<div class="kp" data-demo="kv-cache-paging">
	<div class="kp-controls">
		<div class="kp-ctl">
			<span class="kp-label" id="kp-req-label">Запросы</span>
			<div class="kp-stepper" role="group" aria-labelledby="kp-req-label">
				<button
					type="button"
					class="kp-btn"
					aria-label="Убрать запрос"
					disabled={cfg.requests <= REQUESTS_MIN}
					onclick={() => step('requests', -1)}>−</button
				>
				<output class="kp-val" aria-live="off">{cfg.requests}</output>
				<button
					type="button"
					class="kp-btn"
					aria-label="Добавить запрос"
					disabled={cfg.requests >= REQUESTS_MAX}
					onclick={() => step('requests', 1)}>+</button
				>
			</div>
			<input
				class="kp-range"
				type="range"
				aria-labelledby="kp-req-label"
				min={REQUESTS_MIN}
				max={REQUESTS_MAX}
				step="1"
				value={cfg.requests}
				oninput={(e) => setKey('requests', Number(e.currentTarget.value))}
			/>
		</div>

		<div class="kp-ctl">
			<span class="kp-label" id="kp-prefix-label">Общий префикс, токенов</span>
			<div class="kp-stepper" role="group" aria-labelledby="kp-prefix-label">
				<button
					type="button"
					class="kp-btn"
					aria-label="Уменьшить общий префикс на {STEP}"
					disabled={cfg.prefix <= PREFIX_MIN}
					onclick={() => step('prefix', -1)}>−</button
				>
				<output class="kp-val" aria-live="off">{cfg.prefix}</output>
				<button
					type="button"
					class="kp-btn"
					aria-label="Увеличить общий префикс на {STEP}"
					disabled={cfg.prefix >= PREFIX_MAX}
					onclick={() => step('prefix', 1)}>+</button
				>
			</div>
			<input
				class="kp-range"
				type="range"
				aria-labelledby="kp-prefix-label"
				min={PREFIX_MIN}
				max={PREFIX_MAX}
				step={STEP}
				value={cfg.prefix}
				oninput={(e) => setKey('prefix', Number(e.currentTarget.value))}
			/>
		</div>

		<div class="kp-ctl">
			<span class="kp-label" id="kp-tail-label">Хвост каждого запроса, токенов</span>
			<div class="kp-stepper" role="group" aria-labelledby="kp-tail-label">
				<button
					type="button"
					class="kp-btn"
					aria-label="Уменьшить хвост на {STEP}"
					disabled={cfg.tail <= TAIL_MIN}
					onclick={() => step('tail', -1)}>−</button
				>
				<output class="kp-val" aria-live="off">{cfg.tail}</output>
				<button
					type="button"
					class="kp-btn"
					aria-label="Увеличить хвост на {STEP}"
					disabled={cfg.tail >= TAIL_MAX}
					onclick={() => step('tail', 1)}>+</button
				>
			</div>
			<input
				class="kp-range"
				type="range"
				aria-labelledby="kp-tail-label"
				min={TAIL_MIN}
				max={TAIL_MAX}
				step={STEP}
				value={cfg.tail}
				oninput={(e) => setKey('tail', Number(e.currentTarget.value))}
			/>
		</div>

		<div class="kp-actions">
			<button
				type="button"
				class="kp-switch"
				role="switch"
				aria-checked={cfg.share}
				onclick={toggleShare}
			>
				<span class="kp-track" aria-hidden="true"><span class="kp-knob"></span></span>
				Делить общий префикс
			</button>
			<button type="button" class="kp-reset" onclick={reset}>Сбросить</button>
		</div>
	</div>

	<p class="kp-live" aria-live="polite">
		<span class="kp-live-cause"
			>{message || 'Меняйте запросы, префикс и хвост: блоки пересчитаются.'}</span
		>
		<span class="kp-sr">{summary}</span>
	</p>

	<div class="kp-rows" role="group" aria-label="Блоки запросов по 16 токенов">
		{#each layout.tables as table, i (i)}
			<div class="kp-row">
				<div class="kp-row-head">
					<span class="kp-row-name">{rowLabel(i)}</span>
					<span class="kp-table">таблица блоков: [{table.join(', ')}]</span>
				</div>
				<div class="kp-blocks">
					{#each table as id (id)}
						{@const b = layout.blocks[id]}
						{#if b}
							<div class="kp-block" class:is-shared={b.shared} aria-hidden="true">
								{#each b.slots as kind, q (q)}
									<span class="kp-slot kp-{kind}"></span>
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<div class="kp-legend" aria-hidden="true">
		<span class="kp-key"><span class="kp-swatch kp-prefix"></span>префикс</span>
		<span class="kp-key"><span class="kp-swatch kp-tail"></span>хвост запроса</span>
		<span class="kp-key"><span class="kp-swatch kp-empty"></span>пустой слот</span>
		<span class="kp-key"><span class="kp-swatch kp-shared"></span>общий блок</span>
	</div>

	<dl class="kp-stats">
		<dt>Блоков с разделением</dt>
		<dd>{stats.withShare}</dd>
		<dt>Блоков без разделения</dt>
		<dd>{stats.withoutShare}</dd>
		<dt>Экономия</dt>
		<dd>{stats.saved} ({Math.round(stats.savedPct * 100)}%)</dd>
		<dt>Пустых слотов сейчас</dt>
		<dd>{stats.emptySlots}</dd>
	</dl>

	<div class="kp-single">
		<div class="kp-single-head">
			<label class="kp-label" for="kp-length">Один запрос: длина T, токенов</label>
			<output class="kp-val" for="kp-length">{length}</output>
		</div>
		<input
			id="kp-length"
			class="kp-range kp-range-wide"
			type="range"
			min={LENGTH_MIN}
			max={LENGTH_MAX}
			step="1"
			value={length}
			oninput={(e) => (length = snapLength(Number(e.currentTarget.value)))}
		/>
		<div class="kp-blocks" aria-hidden="true">
			{#each single as b (b.id)}
				<div class="kp-block">
					{#each b.slots as kind, q (q)}
						<span class="kp-slot kp-{kind}"></span>
					{/each}
				</div>
			{/each}
		</div>
		<p class="kp-single-note">
			{blocksFor(length)} блоков по {BLOCK} токенов, пустых слотов в последнем: {singleEmpty}.
			Статический резерв на {STATIC_RESERVE} позиций простаивает {singleIdle}%.
		</p>
	</div>
</div>

<style>
	.kp {
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
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.kp :global(*),
	.kp :global(*::before),
	.kp :global(*::after) {
		box-sizing: border-box;
	}
	.kp dl,
	.kp dd,
	.kp dt,
	.kp p {
		margin: 0;
	}
	.kp button {
		font: inherit;
	}

	/* Controls */
	.kp-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4) var(--space-8);
		align-items: flex-end;
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.kp-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		min-width: 0;
	}
	.kp-label {
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
	.kp-stepper {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		background: var(--surface-2);
		overflow: hidden;
	}
	.kp-btn {
		width: 32px;
		height: 32px;
		border: 0;
		background: none;
		color: var(--text);
		font-size: 16px;
		cursor: pointer;
	}
	.kp-btn:disabled {
		color: var(--text-muted);
		opacity: 0.5;
		cursor: not-allowed;
	}
	.kp-val {
		min-width: 3ch;
		padding: 0 var(--space-2);
		text-align: center;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.kp-range {
		width: 140px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.kp-range-wide {
		width: 100%;
		margin: var(--space-2) 0;
	}
	.kp-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
	}
	.kp-switch {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
	}
	.kp-switch[aria-checked='true'] {
		border-color: var(--topic);
		background: var(--topic-soft);
	}
	.kp-track {
		position: relative;
		width: 28px;
		height: 16px;
		border-radius: 999px;
		background: var(--surface-2);
		border: 1px solid var(--border-control);
		transition: background var(--dur) var(--ease);
	}
	.kp-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--text-muted);
		transition: transform var(--dur) var(--ease);
	}
	.kp-switch[aria-checked='true'] .kp-track {
		background: var(--topic);
		border-color: var(--topic);
	}
	.kp-switch[aria-checked='true'] .kp-knob {
		transform: translateX(12px);
		background: var(--surface);
	}
	.kp-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		cursor: pointer;
	}
	.kp button:focus-visible,
	.kp input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Live message */
	.kp-live {
		position: relative;
		min-height: 3em;
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--topic);
		background: var(--topic-soft);
		border-radius: var(--radius);
		font-size: var(--fs-sm);
		color: var(--text);
	}

	/* Blocks */
	.kp-rows {
		display: grid;
		gap: var(--space-4);
		margin-top: var(--space-6);
	}
	.kp-row-head {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		align-items: baseline;
		margin-bottom: var(--space-2);
	}
	.kp-row-name {
		font-weight: 600;
		color: var(--text);
	}
	.kp-table {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}
	.kp-blocks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.kp-block {
		display: grid;
		grid-template-columns: repeat(4, 11px);
		gap: 3px;
		padding: 4px;
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--bg);
	}
	.kp-block.is-shared {
		border-color: var(--cat-4);
		border-width: 2px;
		padding: 3px;
	}
	.kp-slot {
		display: block;
		width: 11px;
		height: 11px;
		border-radius: 2px;
	}
	.kp-prefix {
		background: var(--cat-4);
	}
	.kp-tail {
		background: var(--topic);
	}
	.kp-empty {
		background: var(--surface);
		outline: 1px dashed var(--border-control);
		outline-offset: -1px;
	}
	.kp-swatch.kp-shared {
		width: 12px;
		height: 12px;
		border: 2px solid var(--cat-4);
		background: var(--bg);
	}

	.kp-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-4);
		font-size: 12px;
		color: var(--text-muted);
	}
	.kp-key {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.kp-swatch {
		display: inline-block;
		width: 11px;
		height: 11px;
		border-radius: 2px;
	}

	/* Statistics */
	.kp-stats {
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
	.kp-stats dt {
		color: var(--text-muted);
	}
	.kp-stats dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}

	/* Single request */
	.kp-single {
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.kp-single-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--space-2);
		align-items: baseline;
	}
	.kp-single .kp-blocks {
		margin-top: var(--space-2);
	}
	.kp-single-note {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}

	.kp-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.kp *,
		.kp *::before,
		.kp *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.kp {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.kp-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.kp-ctl {
			flex-direction: column;
			align-items: stretch;
		}
		.kp-range {
			width: 100%;
		}
		.kp-stats {
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}
</style>
