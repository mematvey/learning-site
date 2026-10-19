<script lang="ts">
	import {
		DEFAULT_TEXT,
		PRESETS,
		analyzeText,
		bytesHex,
		graphemesOf,
		utf8OfCodePoint,
	} from '$lib/demos/unicode-encoding';

	/** Text encoding demo: one string as code points, UTF-8 / UTF-16 bytes, graphemes and byte tokens. */
	let { initial }: { initial?: { text?: string } } = $props();

	/* svelte-ignore state_referenced_locally */
	const start = typeof initial?.text === 'string' ? initial.text : DEFAULT_TEXT;
	let text = $state(start);
	let selected = $state<number | null>(null);

	const a = $derived(analyzeText(text));
	const graphemes = $derived(graphemesOf(text));
	const description = $derived(
		`Строка: ${a.codePointCount} кодовых точек, ${a.graphemeCount} графем, ` +
			`${a.utf8Bytes} байт в UTF-8, ${a.utf16Bytes} байт в UTF-16, ${a.byteTokens} токенов при байтовой токенизации.`,
	);
	const picked = $derived(selected !== null ? a.points[selected] : undefined);

	function reset(): void {
		text = DEFAULT_TEXT;
		selected = null;
	}
</script>

<div class="enc" data-demo="unicode-encoding">
	<div class="enc-input">
		<label class="enc-label" for="enc-text">Введите строку</label>
		<textarea
			id="enc-text"
			class="enc-text"
			rows="2"
			spellcheck="false"
			bind:value={text}
			oninput={() => (selected = null)}></textarea>
		<div class="enc-row">
			{#each PRESETS as p (p.label)}
				<button
					type="button"
					class="enc-chip"
					onclick={() => {
						text = p.text;
						selected = null;
					}}>{p.label}</button
				>
			{/each}
			<button type="button" class="enc-chip enc-reset" onclick={reset}>Сбросить</button>
		</div>
	</div>

	<dl class="enc-stats">
		<div class="enc-stat">
			<dt>Кодовые точки</dt>
			<dd class="enc-num" data-testid="codepoints">{a.codePointCount}</dd>
		</div>
		<div class="enc-stat">
			<dt>len() в JS (UTF-16 единицы)</dt>
			<dd class="enc-num">{a.jsLength}</dd>
		</div>
		<div class="enc-stat">
			<dt>Графемы</dt>
			<dd class="enc-num" data-testid="graphemes">{a.graphemeCount}</dd>
		</div>
		<div class="enc-stat">
			<dt>Байты UTF-8</dt>
			<dd class="enc-num" data-testid="utf8">{a.utf8Bytes}</dd>
		</div>
		<div class="enc-stat">
			<dt>Байты UTF-16</dt>
			<dd class="enc-num">{a.utf16Bytes}</dd>
		</div>
		<div class="enc-stat">
			<dt>Токенов (по байту)</dt>
			<dd class="enc-num">{a.byteTokens}</dd>
		</div>
	</dl>

	<div class="enc-grid">
		<div class="enc-panel">
			<p class="enc-title">Кодовые точки</p>
			{#if a.points.length === 0}
				<p class="enc-muted">Строка пуста.</p>
			{:else}
				<ol class="enc-cps">
					{#each a.points as p, i (i)}
						<li>
							<button
								type="button"
								class="enc-cp"
								aria-pressed={selected === i}
								onclick={() => (selected = selected === i ? null : i)}
							>
								<span class="enc-ch">{p.ch === ' ' ? '␠' : p.ch}</span>
								<span class="enc-hex">{p.hex}</span>
							</button>
						</li>
					{/each}
				</ol>
				{#if a.truncated}
					<p class="enc-muted">Показаны первые {a.points.length} из {a.codePointCount}.</p>
				{/if}
			{/if}
		</div>

		<div class="enc-panel">
			<p class="enc-title">Байты UTF-8</p>
			{#if picked}
				<p class="enc-detail">
					<span class="enc-ch">{picked.ch}</span>
					{picked.hex}: {picked.utf8.length}
					{picked.utf8.length === 1 ? 'байт' : 'байта/байтов'}
					<span class="enc-mono">{bytesHex(picked.utf8)}</span>
				</p>
			{:else}
				<p class="enc-muted">Нажмите на кодовую точку, чтобы увидеть её байты.</p>
			{/if}
			<p class="enc-bytes" aria-label="Байты UTF-8 строки">
				{#each a.points as p, i (i)}
					{#each utf8OfCodePoint(p.cp) as b, j (j)}
						<span class="enc-byte" class:is-hl={selected === i}
							>{b.toString(16).toUpperCase().padStart(2, '0')}</span
						>
					{/each}
				{/each}
			</p>
			<p class="enc-muted">Графемы: {graphemes.map((g) => `«${g}»`).join(' ') || '—'}</p>
		</div>
	</div>

	<p class="enc-live" aria-live="polite">{description}</p>

	<div class="enc-notice">
		<p>
			<strong>Что заметить:</strong> «привет» дает 6 точек и 12 байтов, потому что каждая кириллическая
			буква занимает два байта. Строка «é» из e и U+0301 дает 2 точки и 1 графему. Семейный эмодзи дает
			5 точек и одну графему: длина в точках не совпадает с видимым числом знаков.
		</p>
	</div>
</div>

<style>
	.enc {
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
	.enc :global(*),
	.enc :global(*::before),
	.enc :global(*::after) {
		box-sizing: border-box;
	}
	.enc p,
	.enc dl,
	.enc dd,
	.enc dt {
		margin: 0;
	}
	.enc button {
		font: inherit;
	}
	.enc-label {
		display: block;
		color: var(--text-muted);
		margin-bottom: var(--space-2);
	}
	.enc-text {
		width: 100%;
		min-height: 3.2em;
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: 1rem;
		color: var(--text);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		resize: vertical;
	}
	.enc-text:focus-visible,
	.enc-chip:focus-visible,
	.enc-cp:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.enc-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.enc-chip {
		padding: var(--space-1) var(--space-3);
		color: var(--text);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 999px;
		cursor: pointer;
		transition: background var(--dur) var(--ease);
	}
	.enc-chip:hover {
		border-color: var(--topic);
	}
	.enc-reset {
		color: var(--text-muted);
	}
	.enc-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
		gap: var(--space-3);
		margin-top: var(--space-6);
	}
	.enc-stat {
		padding: var(--space-3);
		background: var(--surface-2);
		border-radius: var(--radius);
	}
	.enc-stat dt {
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.enc-num {
		font-family: var(--font-mono);
		font-size: 1.5rem;
		font-weight: 600;
	}
	.enc-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-4);
		margin-top: var(--space-6);
	}
	@media (min-width: 640px) {
		.enc-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.enc-panel {
		min-width: 0;
	}
	.enc-title {
		color: var(--text-muted);
		margin-bottom: var(--space-2);
	}
	.enc-cps {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.enc-cp {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 3.5rem;
		padding: var(--space-2);
		color: var(--text);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.enc-cp[aria-pressed='true'] {
		border-color: var(--topic);
	}
	.enc-ch {
		font-size: 1.25rem;
	}
	.enc-hex,
	.enc-mono {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.enc-bytes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-bottom: var(--space-2);
	}
	.enc-byte {
		padding: 0 var(--space-1);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		background: var(--surface-2);
		border-radius: var(--radius);
	}
	.enc-byte.is-hl {
		background: var(--topic);
		color: var(--surface);
	}
	.enc-detail {
		margin-bottom: var(--space-2);
	}
	.enc-muted {
		color: var(--text-muted);
	}
	.enc-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.enc-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--topic);
		background: var(--surface-2);
		border-radius: var(--radius);
	}
	@media (prefers-reduced-motion: reduce) {
		.enc-chip {
			transition: none;
		}
	}
</style>
