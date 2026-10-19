<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ChapterId } from '$lib/contracts/ids';
	import type { ExportFile } from '$lib/contracts/my';
	import type { Note } from '$lib/contracts/notes';
	import { resolveChapterId } from '$lib/content/registry';
	import { copyText, downloadText, downloadZipLike } from '$lib/export/download';
	import type { ExportContext } from '$lib/export/markdown';
	import { createNotesStore, type OpenNotesStore } from '$lib/notes';
	import { chapterBlockHref } from '$lib/nav/links';
	import { my, initMy } from '$lib/my/state.svelte';
	import { SITUATION_STATUS_LABELS } from '$lib/my/situation-group';
	import { WISH_STATUS_LABELS } from '$lib/my/wish-draft';
	import {
		MY_TABS,
		TAB_HINTS,
		TAB_LABELS,
		allMarkdown,
		buildScopeFiles,
		countTabs,
		filterScope,
		groupByChapter,
		newestFirst,
		tabMarkdown,
		targetTitle,
		type ChapterOption,
		type MyTab,
		type TopicOption,
	} from '$lib/my/views';
	import BookmarkList from './BookmarkList.svelte';
	import SituationBoard from './SituationBoard.svelte';
	import WishBank from './WishBank.svelte';

	interface Props {
		/** Set on a topic page; the screen then shows only this topic. */
		topic?: TopicOption;
		/** All topics: titles, and the filter chips on the general page. */
		topics: TopicOption[];
		/** Chapters in reading order: titles and the order of groups. */
		chapters: ChapterOption[];
		ctx: ExportContext;
	}

	const { topic, topics, chapters, ctx }: Props = $props();

	let tab = $state<MyTab>('notes');
	let selected = $state<string[]>([]);
	let notes = $state<Note[]>([]);
	let loadError = $state('');
	let actionMessage = $state('');

	let store: OpenNotesStore | undefined;

	async function reloadNotes(): Promise<void> {
		if (store) notes = await store.list();
	}

	onMount(() => {
		let alive = true;
		let unsubscribe: (() => void) | undefined;
		initMy().catch(() => undefined);
		createNotesStore({ resolveChapter: (id) => resolveChapterId(id) as ChapterId })
			.then(async (opened) => {
				if (!alive) {
					opened.close();
					return;
				}
				store = opened;
				unsubscribe = opened.subscribe(() => {
					reloadNotes().catch(() => undefined);
				});
				await reloadNotes();
			})
			.catch(() => {
				loadError = 'Заметки недоступны: браузер не открыл хранилище.';
			});
		return () => {
			alive = false;
			unsubscribe?.();
			store?.close();
			store = undefined;
		};
	});

	const chapterIds = $derived(chapters.map((c) => c.id));
	const chapterTitle = (id: string): string => ctx.chapterTitle(id);
	const topicTitle = (id: string): string => topics.find((t) => t.id === id)?.title ?? id;

	const scoped = $derived(
		filterScope(
			{
				notes,
				my: {
					bookmarks: my.bookmarks,
					wishes: my.wishes,
					situations: my.situations,
					clarifications: my.clarifications,
				},
			},
			topic ? [topic.id] : selected,
		),
	);
	const counts = $derived(countTabs(scoped));

	const noteGroups = $derived(
		topic
			? groupByChapter(scoped.notes, (n) => resolveChapterId(n.chapter), chapterIds)
			: [{ chapter: '', items: newestFirst(scoped.notes) }],
	);
	const bookmarkItems = $derived(newestFirst(scoped.my.bookmarks));
	const wishItems = $derived(newestFirst(scoped.my.wishes));
	const situationItems = $derived(newestFirst(scoped.my.situations));

	const scopeName = $derived(topic?.id ?? (selected.length === 0 ? 'all' : selected.join('-')));

	function toggleTopic(id: string) {
		selected = selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id];
	}

	function exportFiles(): ExportFile[] {
		return buildScopeFiles(scoped, ctx);
	}

	function flash(message: string) {
		actionMessage = message;
		setTimeout(() => {
			if (actionMessage === message) actionMessage = '';
		}, 2500);
	}

	async function copyTab() {
		const text = tabMarkdown(exportFiles(), tab);
		if (!text) return flash('В этой вкладке пока нечего копировать.');
		flash((await copyText(text)) ? 'Скопировано.' : 'Не удалось скопировать.');
	}

	async function copyAll() {
		const text = allMarkdown(exportFiles());
		if (!text) return flash('Пока нечего копировать.');
		flash((await copyText(text)) ? 'Скопировано.' : 'Не удалось скопировать.');
	}

	function downloadTab() {
		const text = tabMarkdown(exportFiles(), tab);
		if (!text) return flash('В этой вкладке пока нечего скачать.');
		downloadText(`my-${scopeName}-${tab}.md`, text);
	}

	function downloadAll() {
		downloadZipLike(exportFiles());
	}

	const day = (iso: string): string => iso.slice(0, 10);
</script>

<section class="my" aria-label="Моё">
	{#if !topic}
		<div class="chips" role="group" aria-label="Фильтр по темам">
			<button
				type="button"
				class="chip"
				aria-pressed={selected.length === 0}
				onclick={() => (selected = [])}>Все темы</button
			>
			{#each topics as t (t.id)}
				<button
					type="button"
					class="chip"
					data-topic={t.id}
					aria-pressed={selected.includes(t.id)}
					onclick={() => toggleTopic(t.id)}>{t.title}</button
				>
			{/each}
		</div>
	{/if}

	<div class="tabs" role="group" aria-label="Вкладки">
		{#each MY_TABS as t (t)}
			<button
				type="button"
				class="tab"
				data-tab={t}
				aria-pressed={tab === t}
				onclick={() => (tab = t)}
			>
				{TAB_LABELS[t]} <span class="count">{counts[t]}</span>
			</button>
		{/each}
	</div>

	<div class="actions" aria-label="Экспорт">
		<button type="button" class="btn" onclick={copyTab}>Скопировать для агента</button>
		<button type="button" class="btn-quiet" onclick={copyAll}>Скопировать всё</button>
		<button type="button" class="btn-quiet" onclick={downloadTab}>Скачать .md</button>
		<button type="button" class="btn-quiet" onclick={downloadAll}>Скачать всё (all.md)</button>
		{#if actionMessage}
			<span class="flash" role="status">{actionMessage}</span>
		{/if}
	</div>

	{#if loadError}
		<p class="error" role="alert">{loadError}</p>
	{/if}

	{#if tab === 'notes'}
		{#if counts.notes === 0}
			<p class="empty">{TAB_HINTS.notes}</p>
		{:else}
			{#each noteGroups as group (group.chapter)}
				<section class="group" aria-label={group.chapter ? chapterTitle(group.chapter) : 'Заметки'}>
					{#if group.chapter}
						<h2>{chapterTitle(group.chapter)}</h2>
					{/if}
					<ul class="list">
						{#each group.items as n (n.id)}
							{@const chapter = resolveChapterId(n.chapter)}
							<li class="card" data-note-id={n.id}>
								<blockquote class="quote">{n.anchor.exact}</blockquote>
								{#if n.text.trim()}
									<p class="text">{n.text}</p>
								{/if}
								<p class="meta">
									<span>{n.status === 'open' ? 'Открыта' : 'Есть ответ'}</span> ·
									<span>{day(n.created)}</span>
									{#if !topic}
										· <span>{chapterTitle(chapter)}</span>
									{/if}
									{#if n.anchor.position === 'orphaned'}
										· <span>место не найдено</span>
									{/if}
									·
									<a href={resolve(chapterBlockHref(chapter, n.anchor.blockId) as '/')}
										>Открыть в главе</a
									>
								</p>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	{:else if tab === 'bookmarks'}
		{#if counts.bookmarks === 0}
			<p class="empty">{TAB_HINTS.bookmarks}</p>
		{:else}
			<BookmarkList items={bookmarkItems} groupByChapter resolveTitle={chapterTitle} />
		{/if}
	{:else if tab === 'wishes'}
		{#if topic}
			<WishBank topic={topic.id} />
		{:else if wishItems.length === 0}
			<p class="empty">{TAB_HINTS.wishes}</p>
		{:else}
			<ul class="list">
				{#each wishItems as w (w.id)}
					<li class="card" data-wish-id={w.id}>
						<p class="title">{w.title}</p>
						<p class="meta">
							<span>{WISH_STATUS_LABELS[w.status]}</span> · <span>{topicTitle(w.topic)}</span> ·
							<a href={resolve(`/${w.topic}/my/` as '/')}>Редактировать в теме</a>
						</p>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if topic}
		<SituationBoard topic={topic.id} />
	{:else if situationItems.length === 0}
		<p class="empty">{TAB_HINTS.situations}</p>
	{:else}
		<ul class="list">
			{#each situationItems as s (s.id)}
				<li class="card" data-situation-id={s.id}>
					<p class="title">{s.title}</p>
					<p class="meta">
						<span>{SITUATION_STATUS_LABELS[s.status]}</span> · <span>{topicTitle(s.topic)}</span> ·
						<span>{targetTitle(s.target, chapterTitle, my.wishes)}</span> ·
						<a href={resolve(`/${s.topic}/my/` as '/')}>Редактировать в теме</a>
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.my {
		display: grid;
		gap: var(--space-6);
	}
	.chips,
	.tabs,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.chip,
	.tab,
	.btn,
	.btn-quiet {
		font: inherit;
		font-size: var(--fs-sm);
		cursor: pointer;
		min-height: 36px;
		padding: 0 var(--space-3);
		border-radius: 999px;
		border: 1px solid var(--border-control);
		background: var(--surface);
		color: var(--text);
	}
	.chip[aria-pressed='true'],
	.tab[aria-pressed='true'] {
		background: var(--topic-soft);
		border-color: var(--topic);
		color: var(--topic);
		font-weight: 600;
	}
	.btn {
		background: var(--topic);
		color: var(--surface);
		border-color: var(--topic);
	}
	.btn-quiet {
		background: transparent;
		color: var(--text-muted);
	}
	.count {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}
	.flash {
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.group h2 {
		font-family: var(--font-serif);
		font-size: var(--fs-h3);
		margin-bottom: var(--space-3);
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-3);
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		display: grid;
		gap: var(--space-2);
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.quote {
		margin: 0;
		padding-left: var(--space-3);
		border-left: 3px solid var(--topic);
		color: var(--text-muted);
		font-family: var(--font-serif);
	}
	.text,
	.title {
		margin: 0;
		line-height: 1.5;
	}
	.title {
		font-weight: 600;
	}
	.meta {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.meta a {
		color: var(--accent);
	}
	.empty {
		padding: var(--space-8);
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg);
		color: var(--text-muted);
		text-align: center;
		line-height: 1.6;
	}
	.error {
		color: var(--fail);
		font-size: var(--fs-sm);
	}
</style>
