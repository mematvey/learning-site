<script lang="ts">
	import { getContext, mount, onMount, setContext, unmount, type Component } from 'svelte';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
	import '$lib/styles/prose.css';
	import { provideLevels } from '$lib/levels';
	import {
		CHAPTER_CONTEXT,
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		LEVELS_CONTEXT,
		type ChapterContext,
		type DemoHandle,
		type DemosContext,
		type EntityId,
		type HighlightContext,
		type LevelsContext,
	} from '$lib/contracts/context';
	import type { ChapterEntry, GlossaryRegistry } from '$lib/contracts/registry';
	import type { Source } from '$lib/contracts/chapter';
	import type { ChapterId, ChapterProgress, Note } from '$lib/contracts';
	import type { AnchorResolution, NotesStore, ProgressStore } from '$lib/contracts/interfaces';
	import type { LevelState } from '$lib/contracts/levels';
	import { getPrereqGraph, resolveChapterId } from '$lib/content/registry';
	import PrereqGraph from './PrereqGraph.svelte';
	import {
		anchorFromSelection,
		chapterTextIndex,
		clearHighlights,
		createNotesStore,
		highlightRange,
		persistReanchors,
		rangeInBlock,
		resolveAnchor,
	} from '$lib/notes';
	import { countSectionsDone, trackChapter } from '$lib/progress';
	import { scrollToHashTarget } from '$lib/nav';
	import SectionCheck from './SectionCheck.svelte';
	import { applyTopic } from '$lib/theme/theme';
	import { ensureProgress, progressState, shell } from '$lib/shell.svelte';
	import type { ChapterLink } from '../../routes/[topic]/[slug]/chapter-data';
	import { formatMinutes } from '../../routes/[topic]/[slug]/chapter-data';
	import NotesLayer from './notes/NotesLayer.svelte';
	import BookmarkLayer from './my/BookmarkLayer.svelte';
	import NotesNotice from './notes/NotesNotice.svelte';
	import Toc from './Toc.svelte';
	import AddSituationButton from './my/AddSituationButton.svelte';

	/** Chapter page: header, title block, prose, footer. The chapter body is the compiled `.svx`. */
	interface Props {
		chapter: ChapterEntry;
		topic: { id: string; title: string } | null;
		prereqs: ChapterLink[];
		prev: ChapterLink | null;
		next: ChapterLink | null;
		glossary: GlossaryRegistry;
		Content: Component;
		onMarkDone?: (done: boolean) => void;
	}

	let { chapter, topic, prereqs, prev, next, glossary, Content, onMarkDone }: Props = $props();

	// Levels: store and URL sync live in $lib/levels (V3). Saved levels go through the progress
	// store, which opens lazily on the client only (no IndexedDB while prerendering).
	provideLevels({
		progress:
			typeof window !== 'undefined'
				? {
						getSettings: () => ensureProgress().then((store) => store.getSettings()),
						update: (patch) => ensureProgress().then((store) => store.update(patch)),
					}
				: null,
	});
	const levelsCtx = getContext<LevelsContext>(LEVELS_CONTEXT);

	// Mini-graph: shown only when the chapter has prerequisites or dependents.
	const prereqGraph = getPrereqGraph();
	const hasNeighbours = $derived(
		prereqGraph.edges.some(
			(e) => e.kind === 'prereq' && (e.from === chapter.id || e.to === chapter.id),
		),
	);

	// Chapter data for Term, Cite, Figure numbering.
	// A plain Map on purpose: numbers are assigned while figures render (inside deriveds), where
	// writing reactive state is not allowed. Numbering follows the render order.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const figureIds = new Map<string, number>();
	const chapterContext: ChapterContext = {
		get id() {
			return chapter.id;
		},
		get topic() {
			return chapter.topic;
		},
		get sources() {
			return chapter.sources ?? [];
		},
		get glossary() {
			return glossary;
		},
		figureNumber(figureId: string) {
			let n = figureIds.get(figureId);
			if (n === undefined) {
				n = figureIds.size + 1;
				figureIds.set(figureId, n);
			}
			return n;
		},
	};
	setContext(CHAPTER_CONTEXT, chapterContext);

	// Entity highlight: Ref sets it, body mirrors it as data-hl for CSS dimming.
	let hl = $state<EntityId | null>(null);
	const highlight: HighlightContext = {
		get hl() {
			return hl;
		},
		set(entity) {
			hl = entity;
		},
	};
	setContext(HIGHLIGHT_CONTEXT, highlight);
	$effect(() => {
		if (hl) document.body.dataset.hl = hl;
		else delete document.body.dataset.hl;
	});

	// Demos register themselves; DemoLink calls `set`.
	const demoHandles = new SvelteMap<string, DemoHandle>();
	const demos: DemosContext = {
		register(name, handle) {
			demoHandles.set(name, handle);
			return () => {
				if (demoHandles.get(name) === handle) demoHandles.delete(name);
			};
		},
		set(name, patch) {
			const handle = demoHandles.get(name);
			if (!handle) return;
			handle.set(patch);
			const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
			document
				.querySelector<HTMLElement>(`[data-demo="${name}"]`)
				?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
		},
	};
	setContext(DEMOS_CONTEXT, demos);

	// The site header lives in the root layout: this page only supplies breadcrumbs and levels.
	const crumbs = $derived([
		...(topic ? [{ label: topic.title, href: resolve(`/${topic.id}/` as '/') }] : []),
		{ label: chapter.title },
	]);
	$effect(() => {
		shell.crumbs = crumbs;
		shell.levels = {
			applied: levelsCtx.applied,
			onApply: (state: LevelState) => {
				levelsCtx.setDraft(state);
				levelsCtx.apply();
			},
		};
		applyTopic(chapter.topic);
		return () => {
			shell.crumbs = [];
			shell.levels = null;
			applyTopic(undefined);
		};
	});

	// Progress key: the canonical id, so records under an old alias id are not split from the
	// chapter. Notes resolve aliases the same way.
	const progressKey = $derived(resolveChapterId(chapter.id) as ChapterId);
	const sectionIds = $derived(chapter.sections.map((s) => s.id));

	// Stored progress of this chapter. `sectionsDone` is the manual mark; `done` is the chapter flag.
	let record = $state<ChapterProgress | undefined>();
	let progressError = $state<string | null>(null);
	const sectionsDone = $derived(record?.sectionsDone ?? []);
	const done = $derived(record?.done ?? false);
	const sectionCount = $derived(countSectionsDone(sectionIds, sectionsDone));
	const readOnly = $derived(progressState.store?.readOnly ?? false);

	function describe(e: unknown): string {
		return e instanceof Error ? e.message : String(e);
	}

	async function reload(store: ProgressStore) {
		try {
			record = await store.getChapter(progressKey);
			progressError = null;
		} catch (e) {
			progressError = `Не удалось прочитать прогресс: ${describe(e)}`;
		}
	}

	// Load the record and follow changes (other tabs, resets from the topic page).
	$effect(() => {
		const store = progressState.store;
		if (!store) return;
		let alive = true;
		void reload(store);
		const unsubscribe = store.subscribe((change) => {
			if (!alive) return;
			if (change.kind === 'reset' || (change.kind === 'chapter' && change.id === progressKey)) {
				void reload(store);
			}
		});
		return () => {
			alive = false;
			unsubscribe();
		};
	});

	/** Runs one write; a failure is shown to the reader, never swallowed. */
	async function writeProgress(action: (store: ProgressStore) => Promise<void>) {
		progressError = null;
		try {
			const store = await ensureProgress();
			if (store.readOnly) {
				progressError =
					'Прогресс доступен только для чтения: данные записаны более новой версией сайта.';
				return;
			}
			await action(store);
		} catch (e) {
			progressError = `Не удалось сохранить прогресс: ${describe(e)}`;
		}
	}

	function setSection(sectionId: string, checked: boolean) {
		void writeProgress((store) => store.setSectionDone(progressKey, sectionId, checked));
	}

	function markWholeChapter() {
		const next = !done;
		onMarkDone?.(next);
		void writeProgress((store) =>
			store.update({
				chapters: [
					next
						? { id: progressKey, done: true, sectionsDone: sectionIds }
						: { id: progressKey, done: false },
				],
			}),
		);
	}

	function resetChapter() {
		const ok = window.confirm(
			'Сбросить прогресс этой главы? Галочки разделов, отметка пройденности и позиция чтения будут удалены. Заметки и лабы не затрагиваются.',
		);
		if (!ok) return;
		onMarkDone?.(false);
		void writeProgress((store) => store.resetChapter(progressKey));
	}

	// Manual section marks: a checkbox mounted at the end of every section heading. The mount
	// reads state through getters, so a change of the marks needs no remount.
	let textEl = $state<HTMLElement | undefined>();
	$effect(() => {
		const root = textEl;
		if (!root) return;
		const mounted = Array.from(root.querySelectorAll<HTMLElement>('section.sec > h2[id]')).map(
			(heading) => {
				const host = document.createElement('span');
				host.className = 'section-check-host';
				heading.appendChild(host);
				const id = heading.id;
				const component = mount(SectionCheck, {
					target: host,
					props: {
						sectionId: id,
						title: heading.textContent?.trim() || id,
						get checked() {
							return sectionsDone.includes(id);
						},
						get disabled() {
							return readOnly;
						},
						onToggle: setSection,
					},
				});
				return () => {
					void unmount(component);
					host.remove();
				};
			},
		);
		return () => {
			for (const cleanup of mounted) cleanup();
		};
	});

	// Reading progress: sections reached and position (after the content is mounted).
	$effect(() => {
		const store = progressState.store;
		if (!store || !textEl) return;
		return trackChapter(store, progressKey, { root: textEl });
	});

	// `#block-id` and `~q=` links: scroll below the header, flash the block, highlight the quote.
	$effect(() => {
		if (!textEl) return;
		return scrollToHashTarget(textEl);
	});

	// Notes: store, anchor resolution and highlighting of the quotes.
	let notesStore = $state<NotesStore | undefined>();
	let resolutions = $state<Record<string, AnchorResolution>>({});
	let notesError = $state<string | undefined>();
	onMount(() => {
		let closed = false;
		let close: (() => void) | undefined;
		createNotesStore({ resolveChapter: (id) => resolveChapterId(id) as ChapterId })
			.then((opened) => {
				if (closed) return opened.close();
				notesStore = opened;
				close = () => opened.close();
			})
			.catch((e: unknown) => {
				// Notes stay off, reading works; the reader is told why.
				const reason = e instanceof Error ? e.message : String(e);
				notesError = `Заметки недоступны: браузер не открыл хранилище (${reason}). Чтение работает без них.`;
			});
		return () => {
			closed = true;
			close?.();
		};
	});

	let chapterNotes = $state<Note[]>([]);
	$effect(() => {
		const store = notesStore;
		if (!store) return;
		const id = chapter.id as ChapterId;
		const load = () =>
			store
				.listByChapter(id)
				.then((list) => (chapterNotes = list))
				.catch(() => {});
		void load();
		return store.subscribe((changed) => {
			if (changed === id) void load();
		});
	});
	$effect(() => {
		const root = textEl;
		if (!root) return;
		const notes = chapterNotes;
		const store = notesStore;
		clearHighlights(root);
		const index = chapterTextIndex(root);
		const next: Record<string, AnchorResolution> = {};
		for (const note of notes) {
			const resolution = resolveAnchor(note.anchor, index);
			next[note.id] = resolution;
			if (resolution.status === 'orphaned') continue;
			const { blockId, start, end } = resolution.range;
			const esc = CSS.escape(blockId);
			const block = root.querySelector<HTMLElement>(
				`[data-block][id="${esc}"], [data-figure-id="${esc}"]`,
			);
			const range = block ? rangeInBlock(block, start, end) : null;
			if (range) highlightRange(range);
		}
		resolutions = next;
		// Confident re-anchors (same block) are saved, so the next visit finds them in place.
		if (store) void persistReanchors(store, notes, next);
		return () => clearHighlights(root);
	});
	function showLayer(noteId: string) {
		const layer = chapterNotes.find((n) => n.id === noteId)?.layer;
		if (!layer) return;
		levelsCtx.setDraft(layer);
		levelsCtx.apply();
	}

	const labCount = $derived(chapter.labs?.length ?? 0);
	const sources: Source[] = $derived(chapter.sources ?? []);
</script>

<div class="chapter" data-topic={chapter.topic}>
	<div class="page">
		<div class="toc-col">
			<Toc items={chapter.sections} />
		</div>

		<main
			class="text prose"
			bind:this={textEl}
			data-pagefind-body
			data-pagefind-meta="title:{chapter.title}"
		>
			<header class="chapter-head">
				{#if topic}
					<!-- Pagefind: the topic is a page-level meta and filter. Level is per block, not per page. -->
					<p
						class="eyebrow"
						data-pagefind-meta="topic:{topic.title}"
						data-pagefind-filter="topic:{topic.title}"
					>
						{topic.title}
					</p>
				{/if}
				<h1>{chapter.title}</h1>
				<p class="lead">{chapter.summary}</p>
				<div class="meta">
					<span>{formatMinutes(chapter.minutes)}</span>
					{#if labCount > 0}
						<span class="dot" aria-hidden="true">·</span>
						<span>{labCount} лаб.</span>
					{/if}
					{#if prereqs.length > 0}
						<span class="dot" aria-hidden="true">·</span>
						<span>Пререквизиты</span>
						{#each prereqs as p (p.id)}
							<a class="chip" href={resolve(p.href as '/')}>{p.title}</a>
						{/each}
					{/if}
				</div>
				<div class="progress-bar-row">
					{#if sectionCount.total > 0}
						<p class="section-progress" aria-live="polite" data-section-progress>
							Разделов пройдено: {sectionCount.done} из {sectionCount.total}
						</p>
					{/if}
					<div class="progress-actions">
						<button
							class="btn-outline"
							class:is-done={done}
							type="button"
							aria-pressed={done ? 'true' : 'false'}
							data-mark-done
							disabled={readOnly}
							onclick={markWholeChapter}
						>
							{done ? 'Глава пройдена · снять отметку' : 'Отметить всю главу пройденной'}
						</button>
						<button
							class="btn-quiet"
							type="button"
							data-reset-chapter
							disabled={readOnly}
							onclick={resetChapter}
						>
							Сбросить прогресс главы
						</button>
					</div>
				</div>
				{#if progressError}
					<p class="progress-error" role="alert">{progressError}</p>
				{/if}
				{#if readOnly}
					<p class="progress-note">Прогресс доступен только для чтения.</p>
				{/if}
			</header>

			<Content />

			{#if hasNeighbours}
				<section class="neighbourhood" aria-labelledby="neighbourhood-title">
					<h2 id="neighbourhood-title">Что нужно знать и что открывает</h2>
					<PrereqGraph graph={prereqGraph} focus={chapter.id as ChapterId} depth={2} compact />
				</section>
			{/if}

			{#if sources.length > 0}
				<section id="sources" class="sources">
					<h2>Источники</h2>
					<ol>
						{#each sources as s (s.id)}
							<li id="src-{s.id}">
								{[s.authors, s.title, s.venue, s.year].filter(Boolean).join('. ')}.
								<a class="src-url" href={s.url} rel="external">{s.url}</a>
							</li>
						{/each}
					</ol>
				</section>
			{/if}

			<nav class="chapter-nav" aria-label="Соседние главы">
				{#if prev}
					<a href={resolve(prev.href as '/')} class="chapter-nav-link" data-prev>
						<span class="chapter-nav-dir">← Предыдущая</span>
						<span class="chapter-nav-title">{prev.title}</span>
					</a>
				{:else}
					<span></span>
				{/if}
				{#if next}
					<a href={resolve(next.href as '/')} class="chapter-nav-link next" data-next>
						<span class="chapter-nav-dir">Следующая →</span>
						<span class="chapter-nav-title">{next.title}</span>
					</a>
				{/if}
			</nav>

			<AddSituationButton chapterId={chapter.id} topic={chapter.topic} />
		</main>

		<aside class="notes-col" aria-label="Заметки">
			{#if notesStore}
				<NotesLayer
					store={notesStore}
					chapter={chapter.id as ChapterId}
					root={textEl}
					{anchorFromSelection}
					layer={levelsCtx.applied}
					{resolutions}
					onShowLayer={showLayer}
				/>
			{:else if notesError}
				<NotesNotice message={notesError} />
			{/if}
		</aside>
		<BookmarkLayer
			chapterId={chapter.id as ChapterId}
			topic={chapter.id.split('/')[0] ?? ''}
			root={textEl}
		/>
	</div>
</div>

<style>
	.page {
		max-width: 1320px;
		margin: 0 auto;
		padding: var(--space-16) var(--space-8) var(--space-24);
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, var(--text-width)) minmax(0, 1fr);
		align-items: start;
	}
	/* The TOC sits in the viewport margin, clear of the 1100px wide blocks (22px gap). */
	.toc-col {
		grid-column: 1;
		justify-self: end;
		width: 160px;
		margin-right: calc((var(--wide-width) - var(--text-width)) / 2 + 24px);
		position: sticky;
		top: 88px;
	}
	.notes-col {
		grid-column: 3;
		margin-left: 40px;
		min-width: 0;
	}
	.text {
		grid-column: 2;
		min-width: 0;
		font-size: var(--fs-body);
		line-height: var(--lh-body);
		color: var(--text);
	}
	.neighbourhood {
		margin-top: var(--space-12);
	}
	.neighbourhood h2 {
		font-family: var(--font-serif);
		font-size: var(--fs-h2);
		font-weight: 600;
		margin-bottom: var(--space-4);
	}
	.chapter-head {
		margin-bottom: var(--space-12);
	}
	.eyebrow {
		font-size: var(--fs-sm);
		color: var(--topic);
		font-weight: 600;
		letter-spacing: 0.02em;
		margin-bottom: var(--space-3);
	}
	h1 {
		font-family: var(--font-serif);
		font-size: 48px;
		line-height: 1.1;
		letter-spacing: -0.02em;
		font-weight: 600;
		margin: 0 0 var(--space-4);
	}
	.lead {
		font-size: 20px;
		line-height: 1.5;
		color: var(--text-muted);
		margin-bottom: var(--space-6);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		font-size: var(--fs-sm);
		color: var(--text-muted);
		margin-bottom: var(--space-6);
	}
	.dot {
		opacity: 0.6;
	}
	.chip {
		display: inline-block;
		padding: 3px 10px;
		border-radius: 999px;
		background: var(--topic-soft);
		color: var(--topic);
		text-decoration: none;
		font-weight: 550;
	}
	.chip:hover {
		text-decoration: underline;
	}
	.btn-outline {
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: 550;
		cursor: pointer;
		height: 36px;
		padding: 0 var(--space-4);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text);
		border: 1px solid var(--border);
		transition:
			background var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}
	.btn-outline:hover {
		border-color: var(--topic);
		color: var(--topic);
	}
	.btn-outline.is-done {
		background: var(--topic-soft);
		color: var(--topic);
		border-color: var(--topic);
	}
	.btn-outline:disabled,
	.btn-quiet:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.progress-bar-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3) var(--space-4);
		margin-top: var(--space-2);
	}
	.section-progress {
		font-size: var(--fs-sm);
		font-weight: 600;
		color: var(--topic);
		margin: 0;
	}
	.progress-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
	}
	.btn-quiet {
		font: inherit;
		font-size: var(--fs-sm);
		cursor: pointer;
		height: 36px;
		padding: 0 var(--space-3);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text-muted);
		border: 1px solid transparent;
	}
	.btn-quiet:hover {
		color: var(--fail);
		border-color: var(--border);
	}
	.progress-error {
		margin-top: var(--space-3);
		font-size: var(--fs-sm);
		color: var(--fail);
	}
	.progress-note {
		margin-top: var(--space-2);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.sources {
		margin-top: var(--space-16);
		font-size: var(--fs-sm);
		color: var(--text-muted);
		line-height: 1.6;
	}
	.sources h2 {
		font-family: var(--font-serif);
		font-size: var(--fs-h3);
		color: var(--text);
		margin: 0 0 var(--space-4);
	}
	.sources li {
		margin-bottom: var(--space-2);
	}
	/* Only the URL wraps anywhere; the rest of the entry keeps normal word wrapping. */
	.sources .src-url {
		color: var(--accent);
		overflow-wrap: anywhere;
	}
	.chapter-nav {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
		margin-top: var(--space-16);
	}
	.chapter-nav-link {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--space-4) var(--space-6);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		text-decoration: none;
		color: var(--text);
		transition: border-color var(--dur) var(--ease);
	}
	.chapter-nav-link:hover {
		border-color: var(--topic);
	}
	.chapter-nav-link.next {
		text-align: right;
		align-items: flex-end;
	}
	.chapter-nav-dir {
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.chapter-nav-title {
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: 18px;
	}

	@media (max-width: 1499px) {
		.toc-col {
			display: none;
		}
	}
	@media (max-width: 1180px) {
		.page {
			grid-template-columns: minmax(0, var(--text-width));
			justify-content: center;
		}
		.text {
			grid-column: 1;
		}
		.notes-col {
			grid-column: 1;
			margin-left: 0;
		}
	}
	@media (max-width: 900px) {
		.page {
			grid-template-columns: minmax(0, 1fr);
			padding: var(--space-12) 16px var(--space-16);
		}
		h1 {
			font-size: 34px;
		}
		.lead {
			font-size: var(--fs-body);
		}
		.chapter-nav {
			grid-template-columns: 1fr;
		}
	}
</style>
