<script lang="ts">
	import katex from 'katex';
	import type { Bookmark, BookmarkDraft } from '$lib/contracts/my';
	import { bookmarkHref } from '$lib/nav/links';
	import { getMyStore } from '$lib/my/store';
	import { KIND_LABEL, commitBookmark } from '$lib/my/bookmark-draft';
	import BookmarkEditor from './BookmarkEditor.svelte';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		items: Bookmark[];
		/** Adds a heading per chapter; the heading text comes from `resolveTitle`. */
		groupByChapter: boolean;
		resolveTitle: (chapterId: string) => string;
	}

	const { items, groupByChapter, resolveTitle }: Props = $props();

	let editingId = $state<string | null>(null);
	let error = $state('');

	const groups = $derived.by(() => {
		if (!groupByChapter) return [{ chapter: '', list: items }];
		const map = new SvelteMap<string, Bookmark[]>();
		for (const b of items) {
			const list = map.get(b.chapter) ?? [];
			list.push(b);
			map.set(b.chapter, list);
		}
		return [...map].map(([chapter, list]) => ({ chapter, list }));
	});

	function draftOf(b: Bookmark): BookmarkDraft {
		const draft: BookmarkDraft = {
			kind: b.kind,
			topic: b.topic,
			chapter: b.chapter,
			blockId: b.blockId,
			comment: b.comment,
		};
		if (b.quote !== undefined) draft.quote = b.quote;
		if (b.prefix !== undefined) draft.prefix = b.prefix;
		if (b.suffix !== undefined) draft.suffix = b.suffix;
		if (b.termId !== undefined) draft.termId = b.termId;
		return draft;
	}

	/** KaTeX markup for a saved TeX fragment; KaTeX escapes its input, and bad TeX shows as red source. */
	function renderTex(tex: string): string {
		return katex.renderToString(tex, { displayMode: true, throwOnError: false, strict: 'ignore' });
	}

	function label(b: Bookmark): string {
		if (b.kind === 'term' && b.termId) return `${KIND_LABEL.term}: ${b.termId}`;
		return KIND_LABEL[b.kind];
	}

	async function save(b: Bookmark, comment: string) {
		error = '';
		try {
			const store = await getMyStore();
			await commitBookmark(store, draftOf(b), comment, b);
			editingId = null;
		} catch {
			error = 'Не удалось сохранить комментарий. Попробуйте ещё раз.';
		}
	}

	async function remove(b: Bookmark) {
		if (!window.confirm('Удалить закладку?')) return;
		error = '';
		try {
			const store = await getMyStore();
			await store.bookmarks.remove(b.id);
		} catch {
			error = 'Не удалось удалить закладку.';
		}
	}
</script>

{#if error}
	<p class="bml-error" role="alert">{error}</p>
{/if}

{#each groups as group (group.chapter)}
	<section class="bml-group" aria-label={group.chapter ? resolveTitle(group.chapter) : 'Закладки'}>
		{#if groupByChapter}
			<h3 class="bml-heading">{resolveTitle(group.chapter)}</h3>
		{/if}
		<ul class="bml-list">
			{#each group.list as b (b.id)}
				<li class="bml-card">
					{#if editingId === b.id}
						<BookmarkEditor
							draft={draftOf(b)}
							onSave={(comment) => save(b, comment)}
							onCancel={() => (editingId = null)}
							onDelete={() => remove(b)}
						/>
					{:else}
						<p class="bml-kind">{label(b)}</p>
						{#if b.quote && b.kind === 'formula'}
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- KaTeX output escapes its input -->
							<div class="bml-formula">{@html renderTex(b.quote)}</div>
						{:else if b.quote}
							<blockquote class="bml-quote">{b.quote}</blockquote>
						{/if}
						{#if b.comment}
							<p class="bml-comment">{b.comment}</p>
						{/if}
						<div class="bml-actions">
							<a class="bml-link" href={resolve(bookmarkHref(b) as '/')}> Открыть </a>
							<button type="button" class="bml-btn" onclick={() => (editingId = b.id)}
								>Изменить</button
							>
							<button type="button" class="bml-btn bml-danger" onclick={() => remove(b)}
								>Удалить</button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/each}

<style>
	.bml-group {
		display: grid;
		gap: var(--space-3);
	}
	.bml-heading {
		font-size: var(--fs-sm);
		color: var(--text-muted);
		font-weight: 600;
		margin: var(--space-4) 0 0;
	}
	.bml-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}
	.bml-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 3px solid var(--bookmark);
		border-radius: var(--radius);
		padding: var(--space-3) var(--space-4);
		display: grid;
		gap: var(--space-2);
		font-size: var(--fs-sm);
		color: var(--text);
		overflow-wrap: anywhere;
	}
	.bml-kind {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--bookmark);
	}
	.bml-quote {
		margin: 0;
		font-style: italic;
		color: var(--text-muted);
	}
	/* A saved formula is stored as TeX: rendered by KaTeX; wide formulas scroll inside the card. */
	.bml-formula {
		max-width: 100%;
		overflow-x: auto;
		padding: var(--space-1) 0;
	}
	.bml-comment {
		margin: 0;
	}
	.bml-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		align-items: center;
	}
	.bml-link,
	.bml-btn {
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--topic);
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.bml-danger {
		color: var(--fail);
	}
	.bml-error {
		color: var(--fail);
		font-size: var(--fs-sm);
		margin: 0;
	}
	.bml-link:focus-visible,
	.bml-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
</style>
