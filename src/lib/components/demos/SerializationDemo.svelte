<script lang="ts">
	import {
		COLUMNS_MAX,
		COLUMNS_MIN,
		NAME_MAX,
		ROWS_MAX,
		ROWS_MIN,
		WIDTHS,
		bytesPerRecord,
		bytesScanned,
		cellRead,
		clampInt32,
		clampName,
		encodeVarint,
		jsonBytes,
		normalizeState,
		protoBytes,
		protoFields,
		recordJson,
		toBits,
		toHex,
		type Layout,
		type SerializationDemoState,
	} from '$lib/demos/serialization-formats';

	/** Serialization demo: varint, one record in JSON and protobuf, row and column layouts. */
	let { initial }: { initial?: Partial<SerializationDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let s = $state<SerializationDemoState>(normalizeState(initial ?? {}));

	const DEFAULTS = normalizeState({});
	const PRESETS = [0, 127, 128, 150, 300, 16384];
	/** Records drawn in the storage strips; the byte totals use the full table. */
	const SAMPLE_ROWS = [0, 1, 2];
	const LAYOUTS: Layout[] = ['row', 'column'];
	const columnIdx = $derived(Array.from({ length: s.columns }, (_, i) => i));

	const varint = $derived(encodeVarint(s.varintN));
	const json = $derived(recordJson(s.id, s.name));
	const jsonN = $derived(jsonBytes(s.id, s.name));
	const fields = $derived(protoFields(s.id, s.name));
	const protoN = $derived(protoBytes(s.id, s.name).length);

	const rowPer = $derived(bytesPerRecord(s.columns, s.width, 'row', s.wanted));
	const colPer = $derived(bytesPerRecord(s.columns, s.width, 'column', s.wanted));
	const rowAll = $derived(bytesScanned(s.rows, s.columns, s.width, 'row', s.wanted));
	const colAll = $derived(bytesScanned(s.rows, s.columns, s.width, 'column', s.wanted));
	const ratio = $derived(s.columns / s.wanted);
	const ratioText = $derived(Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(2));

	/** Russian plural for the word «байт». */
	function bytesWord(n: number): string {
		const m10 = n % 10;
		const m100 = n % 100;
		if (m10 === 1 && m100 !== 11) return 'байт';
		if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'байта';
		return 'байтов';
	}

	function fmt(n: number): string {
		return n.toLocaleString('ru-RU');
	}

	function set(patch: Partial<SerializationDemoState>): void {
		s = normalizeState({ ...s, ...patch });
	}

	function num(e: Event): number {
		return Number((e.currentTarget as HTMLInputElement).value);
	}

	function reset(): void {
		s = normalizeState({});
	}

	const isDefault = $derived(
		s.varintN === DEFAULTS.varintN &&
			s.id === DEFAULTS.id &&
			s.name === DEFAULTS.name &&
			s.rows === DEFAULTS.rows &&
			s.columns === DEFAULTS.columns &&
			s.wanted === DEFAULTS.wanted &&
			s.width === DEFAULTS.width,
	);

	const varintText = $derived(
		`Число ${fmt(s.varintN)} в varint занимает ${varint.length} ${bytesWord(varint.length)}: ${toHex(varint)}.`,
	);
	const recordText = $derived(
		`JSON: ${jsonN} ${bytesWord(jsonN)}, protobuf: ${protoN} ${bytesWord(protoN)}.`,
	);
	const layoutText = $derived(
		`На запись: строчная читает ${rowPer} ${bytesWord(rowPer)}, колоночная ${colPer} ${bytesWord(colPer)}. ` +
			`Вся таблица из ${fmt(s.rows)} строк: строчная ${fmt(rowAll)} ${bytesWord(rowAll)}, колоночная ${fmt(colAll)} ${bytesWord(colAll)}.`,
	);

	function strip(layout: Layout): string {
		return layout === 'row' ? 'Строчная раскладка' : 'Колоночная раскладка';
	}
</script>

<div class="sf" data-demo="serialization-formats">
	<div class="sf-top">
		<p class="sf-intro">
			Один и тот же набор байт разложен по-разному. Меняйте значения и смотрите, сколько байт
			выходит.
		</p>
		<button type="button" class="sf-reset" onclick={reset} disabled={isDefault}>Сбросить</button>
	</div>

	<section class="sf-block" aria-labelledby="sf-varint-h">
		<h3 id="sf-varint-h" class="sf-h">Varint: число в байтах</h3>
		<div class="sf-row">
			<label class="sf-ctl">
				<span class="sf-label">n</span>
				<input
					class="sf-input sf-input-num"
					type="number"
					min="0"
					max={2147483647}
					step="1"
					value={s.varintN}
					oninput={(e) => set({ varintN: clampInt32(num(e)) })}
				/>
			</label>
			<div class="sf-presets" role="group" aria-label="Примеры чисел">
				{#each PRESETS as p (p)}
					<button
						type="button"
						class="sf-chip-btn"
						aria-pressed={s.varintN === p}
						onclick={() => set({ varintN: p })}>{p}</button
					>
				{/each}
			</div>
		</div>
		<div class="sf-bytes" aria-label="Байты varint">
			{#each varint as b, i (i)}
				<div class="sf-byte">
					<span class="sf-bits"
						><span class="sf-flag" title="Флаг продолжения">{b & 0x80 ? '1' : '0'}</span><span
							class="sf-val">{toBits(b).slice(1)}</span
						></span
					>
					<span class="sf-hex">{b.toString(16).padStart(2, '0')}</span>
				</div>
			{/each}
		</div>
		<p class="sf-note" aria-live="polite">{varintText}</p>
		<p class="sf-hint">
			Первый бит каждого байта (флаг) равен 1, если за ним идёт ещё один байт. Оставшиеся семь бит
			несут значение, младшие первыми.
		</p>
	</section>

	<section class="sf-block" aria-labelledby="sf-record-h">
		<h3 id="sf-record-h" class="sf-h">Одна запись: JSON и protobuf</h3>
		<div class="sf-row">
			<label class="sf-ctl">
				<span class="sf-label">id</span>
				<input
					class="sf-input sf-input-num"
					type="number"
					min="0"
					max={2147483647}
					step="1"
					value={s.id}
					oninput={(e) => set({ id: clampInt32(num(e)) })}
				/>
			</label>
			<label class="sf-ctl">
				<span class="sf-label">name</span>
				<input
					class="sf-input sf-input-text"
					type="text"
					maxlength={NAME_MAX}
					value={s.name}
					oninput={(e) => set({ name: clampName((e.currentTarget as HTMLInputElement).value) })}
				/>
			</label>
		</div>

		<h4 class="sf-h4">JSON, {jsonN} {bytesWord(jsonN)}</h4>
		<pre class="sf-json"><code>{json}</code></pre>
		<p class="sf-hint">В JSON имена полей записаны в каждой записи, числа идут текстом.</p>

		<h4 class="sf-h4">protobuf, {protoN} {bytesWord(protoN)}</h4>
		<ul class="sf-fields">
			{#each fields as f (f.field)}
				<li class="sf-field">
					<span class="sf-field-name">{f.field === 'id' ? 'id (поле 1)' : 'name (поле 2)'}</span>
					<span class="sf-part"><span class="sf-part-l">ключ</span> {toHex(f.key)}</span>
					{#if f.length.length > 0}
						<span class="sf-part"><span class="sf-part-l">длина</span> {toHex(f.length)}</span>
					{/if}
					<span class="sf-part"><span class="sf-part-l">значение</span> {toHex(f.value)}</span>
				</li>
			{:else}
				<li class="sf-field">Все поля равны значениям по умолчанию: proto3 их не пишет.</li>
			{/each}
		</ul>
		<p class="sf-note" aria-live="polite">{recordText}</p>
		<p class="sf-hint">
			Имена полей живут в схеме, в байтах остаются номера полей. Поле с нулём или пустой строкой не
			записывается.
		</p>
	</section>

	<section class="sf-block" aria-labelledby="sf-layout-h">
		<h3 id="sf-layout-h" class="sf-h">Строчная и колоночная раскладка</h3>
		<div class="sf-grid">
			<label class="sf-ctl">
				<span class="sf-label">строк</span>
				<input
					class="sf-input sf-input-num"
					type="number"
					min={ROWS_MIN}
					max={ROWS_MAX}
					step="1"
					value={s.rows}
					oninput={(e) => set({ rows: num(e) })}
				/>
			</label>
			<label class="sf-ctl">
				<span class="sf-label">колонок C</span>
				<input
					class="sf-range"
					type="range"
					min={COLUMNS_MIN}
					max={COLUMNS_MAX}
					step="1"
					value={s.columns}
					oninput={(e) => set({ columns: num(e) })}
				/>
				<output class="sf-val-out">{s.columns}</output>
			</label>
			<label class="sf-ctl">
				<span class="sf-label">нужно c</span>
				<input
					class="sf-range"
					type="range"
					min={COLUMNS_MIN}
					max={s.columns}
					step="1"
					value={s.wanted}
					oninput={(e) => set({ wanted: num(e) })}
				/>
				<output class="sf-val-out">{s.wanted}</output>
			</label>
			<label class="sf-ctl">
				<span class="sf-label">байт в значении</span>
				<select class="sf-input" value={s.width} onchange={(e) => set({ width: num(e) })}>
					{#each WIDTHS as w (w)}
						<option value={w}>{w}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="sf-storage">
			{#each LAYOUTS as layout (layout)}
				<div class="sf-panel">
					<p class="sf-panel-t">{strip(layout)}</p>
					<div class="sf-strip" role="img" aria-label="{strip(layout)}: {layoutText}">
						{#if layout === 'row'}
							{#each SAMPLE_ROWS as r (r)}
								<div class="sf-group">
									{#each columnIdx as c (c)}
										<span class="sf-cell" class:is-read={cellRead('row', c, s.wanted)}>{c + 1}</span
										>
									{/each}
								</div>
							{/each}
						{:else}
							{#each columnIdx as c (c)}
								<div class="sf-group" class:is-read={cellRead('column', c, s.wanted)}>
									{#each SAMPLE_ROWS as r (r)}
										<span class="sf-cell" class:is-read={cellRead('column', c, s.wanted)}
											>{c + 1}</span
										>
									{/each}
								</div>
							{/each}
						{/if}
					</div>
					<p class="sf-panel-n">
						Читается
						{layout === 'row' ? rowPer : colPer}
						{bytesWord(layout === 'row' ? rowPer : colPer)} на запись
					</p>
				</div>
			{/each}
		</div>
		<p class="sf-legend">
			<span class="sf-swatch"></span> читается запросом; на полосках показаны 3 записи из {fmt(
				s.rows,
			)}, номер в клетке — колонка
		</p>
		<p class="sf-note" aria-live="polite">{layoutText}</p>
		<p class="sf-hint">
			Модель упрощённая: без сжатия, заголовков и пропуска блоков. Отношение байтов C / c = {ratioText}.
		</p>
	</section>

	<div class="sf-learn">
		<p class="sf-learn-t">Что заметить</p>
		<ul>
			<li>
				Число {fmt(s.varintN)} занимает {varint.length}
				{bytesWord(varint.length)}. Граница 127 и 128 отделяет один байт от двух.
			</li>
			<li>
				Запись весит {jsonN}
				{bytesWord(jsonN)} в JSON и {protoN}
				{bytesWord(protoN)} в protobuf: имена полей против номеров.
			</li>
			<li>
				При запросе по {s.wanted} из {s.columns} колонок колоночная раскладка читает в {ratioText} раз
				меньше байт. Если нужны все колонки, выигрыша по байтам нет.
			</li>
		</ul>
	</div>
</div>

<style>
	.sf {
		padding: var(--space-6) var(--space-6) var(--space-6);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
		text-align: left;
		min-width: 0;
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.sf * {
		box-sizing: border-box;
	}
	.sf p,
	.sf h3,
	.sf h4,
	.sf ul {
		margin: 0;
		padding: 0;
	}
	.sf button,
	.sf input,
	.sf select {
		font: inherit;
	}
	.sf :focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.sf-top {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.sf-intro {
		color: var(--text-muted);
		max-width: 60ch;
	}
	.sf-reset {
		min-height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		cursor: pointer;
	}
	.sf-reset:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.sf-block {
		padding: var(--space-6) 0;
		border-bottom: 1px solid var(--border);
	}
	.sf-h {
		font-family: var(--font-serif);
		font-size: 17px;
		font-weight: 600;
		margin-bottom: var(--space-3);
	}
	.sf-h4 {
		margin-top: var(--space-4);
		margin-bottom: var(--space-2);
		font-size: 14px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.sf-row,
	.sf-grid {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-6);
	}
	.sf-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	}
	.sf-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.sf-label {
		color: var(--text-muted);
		font-size: 13px;
	}
	.sf-input {
		min-height: 36px;
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		max-width: 100%;
	}
	.sf-input-num {
		width: 9.5rem;
	}
	.sf-input-text {
		width: 11rem;
	}
	.sf-range {
		width: 120px;
		max-width: 100%;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.sf-val-out {
		min-width: 2ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.sf-presets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.sf-chip-btn {
		min-height: 36px;
		min-width: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
		cursor: pointer;
	}
	.sf-chip-btn[aria-pressed='true'] {
		border-color: var(--topic);
		background: var(--topic-soft);
		color: var(--text);
		font-weight: 600;
	}
	.sf-bytes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.sf-byte {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		border: 1px solid var(--topic);
		border-radius: var(--radius-sm);
		background: var(--topic-soft);
		overflow: hidden;
	}
	.sf-bits {
		display: flex;
		font-family: var(--font-mono);
		font-size: 13px;
		padding: var(--space-2);
	}
	.sf-flag {
		color: var(--cat-1);
		font-weight: 700;
		padding-right: 2px;
	}
	.sf-val {
		color: var(--text);
	}
	.sf-hex {
		padding: 2px var(--space-2);
		border-top: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
		text-align: center;
	}
	.sf-json {
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		font-family: var(--font-mono);
		font-size: 13px;
		white-space: pre-wrap;
		word-break: break-all;
	}
	.sf-fields {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.sf-field {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2) var(--space-3);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.sf-field-name {
		font-family: var(--font-sans);
		font-weight: 600;
	}
	.sf-part-l {
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: 12px;
	}
	.sf-note {
		margin-top: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--topic);
		background: var(--surface-2);
		color: var(--text);
	}
	.sf-hint {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.sf-storage {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.sf-panel-t {
		font-weight: 600;
		margin-bottom: var(--space-2);
	}
	.sf-panel-n {
		margin-top: var(--space-2);
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-muted);
	}
	.sf-strip {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.sf-group {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 2px;
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
	}
	.sf-group.is-read {
		border-color: var(--topic);
	}
	.sf-cell {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		transition: background var(--dur) var(--ease);
	}
	.sf-cell.is-read {
		background: var(--topic-soft);
		border-color: var(--topic);
		color: var(--text);
		font-weight: 600;
	}
	.sf-legend {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}
	.sf-swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 1px solid var(--topic);
		background: var(--topic-soft);
		border-radius: 2px;
	}
	.sf-learn {
		padding-top: var(--space-4);
	}
	.sf-learn-t {
		font-weight: 600;
		margin-bottom: var(--space-2);
	}
	.sf-learn ul {
		list-style: disc;
		padding-left: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	@media (prefers-reduced-motion: reduce) {
		.sf * {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
