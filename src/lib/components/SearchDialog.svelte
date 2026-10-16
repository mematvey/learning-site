<script lang="ts">
	import { resolve } from '$app/paths';
	import KbdHint from './KbdHint.svelte';
	import { loadPagefind, type PagefindApi } from '$lib/search/pagefind';
	import { debounce, nextIndex, toSearchHit, type SearchHit } from '$lib/search/search';

	/** Debounce for the Pagefind query, ms. */
	const DEBOUNCE_MS = 150;
	/** Deployment base path without trailing slash: '' in dev, '/learning-site' on Pages. */
	const base = resolve('/').replace(/\/$/, '');
	/** Hits rendered at most. */
	const MAX_HITS = 10;

	type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable';

	let dialog: HTMLDialogElement | undefined = $state();
	let input: HTMLInputElement | undefined = $state();
	let query = $state('');
	let hits = $state<SearchHit[]>([]);
	let active = $state(-1);
	let status = $state<Status>('idle');

	let pagefindPromise: Promise<PagefindApi | null> | null = null;
	let runId = 0;

	function getPagefind(): Promise<PagefindApi | null> {
		pagefindPromise ??= loadPagefind(base);
		return pagefindPromise;
	}

	async function run(term: string): Promise<void> {
		const id = ++runId;
		const q = term.trim();
		if (!q) {
			hits = [];
			active = -1;
			status = 'idle';
			return;
		}
		status = 'loading';
		const pf = await getPagefind();
		if (id !== runId) return;
		if (!pf) {
			hits = [];
			status = 'unavailable';
			return;
		}
		const res = await pf.search(q);
		const data = await Promise.all(res.results.slice(0, MAX_HITS).map((r) => r.data()));
		if (id !== runId) return;
		hits = data.map((d) => toSearchHit(d, base));
		active = hits.length > 0 ? 0 : -1;
		status = hits.length > 0 ? 'ready' : 'empty';
	}

	const debouncedRun = debounce(run, DEBOUNCE_MS);

	function open(): void {
		if (!dialog || dialog.open) return;
		query = '';
		hits = [];
		active = -1;
		status = 'idle';
		dialog.showModal();
		input?.focus();
	}

	function close(): void {
		debouncedRun.cancel();
		runId++;
		dialog?.close();
	}

	function choose(hit: SearchHit): void {
		close();
		// Pagefind URLs are not typed routes; a full load of a static page is fine here.
		window.location.href = hit.url;
	}

	function onInput(): void {
		debouncedRun(query);
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			active = nextIndex(active, event.key === 'ArrowDown' ? 1 : -1, hits.length);
		} else if (event.key === 'Enter') {
			const hit = hits[active];
			if (hit) {
				event.preventDefault();
				choose(hit);
			}
		}
		// Escape is handled by the native <dialog> (closes it).
	}

	function onBackdropClick(event: MouseEvent): void {
		if (event.target === dialog) close();
	}

	const statusText: Record<Status, string> = {
		idle: '',
		loading: 'Ищем…',
		ready: '',
		empty: 'Ничего не найдено',
		unavailable: 'Поиск доступен после сборки',
	};
</script>

<button type="button" class="search-field" data-search onclick={open} aria-haspopup="dialog">
	<svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
		<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
		<path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
	</svg>
	<span class="search-label">Поиск</span>
	<KbdHint keys="mod+k" />
</button>

<dialog
	bind:this={dialog}
	class="search-dialog"
	aria-labelledby="search-title"
	onclick={onBackdropClick}
	onclose={() => (runId++, debouncedRun.cancel())}
>
	<div class="search-panel">
		<h2 id="search-title" class="sr-only">Поиск по курсу</h2>
		<input
			bind:this={input}
			bind:value={query}
			oninput={onInput}
			onkeydown={onKeydown}
			type="search"
			class="search-input"
			placeholder="Поиск по курсу"
			autocomplete="off"
			role="combobox"
			aria-expanded={hits.length > 0}
			aria-controls="search-results"
			aria-autocomplete="list"
			aria-activedescendant={active >= 0 ? `search-opt-${active}` : undefined}
		/>
		<p class="search-status" aria-live="polite">{statusText[status]}</p>
		<ul id="search-results" class="search-results" role="listbox" aria-label="Результаты">
			{#each hits as hit, i (hit.url)}
				<li role="presentation">
					<button
						type="button"
						id="search-opt-{i}"
						role="option"
						class="search-hit"
						class:is-active={i === active}
						aria-selected={i === active}
						tabindex="-1"
						onmousemove={() => (active = i)}
						onclick={() => choose(hit)}
					>
						<span class="hit-head">
							<span class="hit-title">{hit.title}</span>
							{#if hit.levelLabel}
								<span class="hit-level">{hit.levelLabel}</span>
							{/if}
						</span>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- excerptHtml is escaped by sanitizeExcerpt; only <mark> survives -->
						<span class="hit-excerpt">{@html hit.excerptHtml}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
</dialog>

<style>
	.search-field {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		width: 250px;
		max-width: 100%;
		height: 34px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text-muted);
		font: inherit;
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.search-field:hover,
	.search-field:focus-visible {
		border-color: var(--topic);
		outline: none;
	}
	.search-label {
		flex: 1;
		text-align: left;
	}

	.search-dialog {
		margin: 12vh auto auto;
		padding: 0;
		width: min(640px, calc(100vw - 32px));
		max-height: 70vh;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow);
	}
	.search-dialog::backdrop {
		background: color-mix(in srgb, var(--bg) 70%, transparent);
		backdrop-filter: blur(4px);
	}

	.search-panel {
		display: flex;
		flex-direction: column;
		max-height: 70vh;
	}
	.search-input {
		margin: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: var(--fs-base);
	}
	.search-input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 1px;
	}
	.search-status {
		margin: 0 var(--space-4) var(--space-2);
		min-height: 1.4em;
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
	.search-results {
		margin: 0;
		padding: 0 var(--space-2) var(--space-2);
		list-style: none;
		overflow-y: auto;
	}
	.search-hit {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		width: 100%;
		padding: var(--space-3);
		border: 0;
		border-radius: var(--radius);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.search-hit.is-active {
		background: var(--surface-2);
		box-shadow: inset 2px 0 0 var(--topic);
	}
	.hit-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}
	.hit-title {
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: var(--fs-base);
	}
	.hit-level {
		padding: 1px var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--topic-soft);
		color: var(--topic);
		font-size: 12px;
	}
	.hit-excerpt {
		color: var(--text-muted);
		font-size: var(--fs-sm);
		line-height: 1.5;
	}
	.hit-excerpt :global(mark) {
		background: color-mix(in srgb, var(--topic) 16%, transparent);
		color: var(--text);
		border-radius: 2px;
	}

	.search-icon {
		display: none;
		flex: none;
	}

	@media (max-width: 640px) {
		/* Icon-only trigger on narrow screens; the label stays in the DOM for the accessible name. */
		.search-field {
			width: 34px;
			justify-content: center;
			padding: 0;
		}
		.search-field :global(kbd) {
			display: none;
		}
		.search-icon {
			display: block;
		}
		.search-label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
