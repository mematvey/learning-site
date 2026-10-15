<script lang="ts">
	import { getContext, onMount, setContext, type Component } from 'svelte';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
	import { siteBase } from '../../routes/[topic]/[slug]/chapter-data';
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
	import type { Theme } from '$lib/contracts/progress';
	import type { LevelState } from '$lib/contracts/levels';
	import type { ChapterLink } from '../../routes/[topic]/[slug]/chapter-data';
	import { formatMinutes } from '../../routes/[topic]/[slug]/chapter-data';
	import SiteHeader from './SiteHeader.svelte';
	import LevelPopover from './LevelPopover.svelte';
	import Toc from './Toc.svelte';

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

	// Levels: store and URL sync live in $lib/levels (V3).
	provideLevels();
	const levelsCtx = getContext<LevelsContext>(LEVELS_CONTEXT);

	// Chapter data for Term, Cite, Figure numbering.
	const figureIds = new SvelteMap<string, number>();
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

	// Theme: local toggle on <html data-theme>; persistence belongs to the shell theme module (V4a).
	let themeChoice = $state<Theme | null>(null);
	const theme = $derived<Theme>(themeChoice ?? 'light');
	onMount(() => {
		themeChoice = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
	});
	function toggleTheme() {
		themeChoice = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = themeChoice;
	}

	let done = $state(false);
	function markDone() {
		done = !done;
		onMarkDone?.(done);
	}

	const crumbs = $derived([
		...(topic ? [{ label: topic.title, href: `${siteBase}/` }] : []),
		{ label: chapter.title },
	]);
	const labCount = $derived(chapter.labs?.length ?? 0);
	const sources: Source[] = $derived(chapter.sources ?? []);
</script>

<div class="chapter" data-topic={chapter.topic}>
	<SiteHeader {crumbs} {theme} onToggleTheme={toggleTheme}>
		{#snippet levels()}
			<LevelPopover
				applied={levelsCtx.applied}
				onApply={(state: LevelState) => {
					levelsCtx.setDraft(state);
					levelsCtx.apply();
				}}
			/>
		{/snippet}
	</SiteHeader>

	<div class="page">
		<div class="toc-col">
			<Toc items={chapter.sections} />
		</div>

		<main class="text prose">
			<header class="chapter-head">
				{#if topic}
					<p class="eyebrow">{topic.title}</p>
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
							<a class="chip" href={resolve(`${p.id}/` as `${string}/${string}/`)}>{p.title}</a>
						{/each}
					{/if}
				</div>
				<button
					class="btn-outline"
					class:is-done={done}
					type="button"
					aria-pressed={done ? 'true' : 'false'}
					data-mark-done
					onclick={markDone}
				>
					Отметить пройденным
				</button>
			</header>

			<Content />

			{#if sources.length > 0}
				<section id="sources" class="sources">
					<h2>Источники</h2>
					<ol>
						{#each sources as s (s.id)}
							<li id="src-{s.id}">
								{[s.authors, s.title, s.venue, s.year].filter(Boolean).join('. ')}.
								<a href={s.url} rel="external">{s.url}</a>
							</li>
						{/each}
					</ol>
				</section>
			{/if}

			<nav class="chapter-nav" aria-label="Соседние главы">
				{#if prev}
					<a
						href={resolve(`${prev.id}/` as `${string}/${string}/`)}
						class="chapter-nav-link"
						data-prev
					>
						<span class="chapter-nav-dir">← Предыдущая</span>
						<span class="chapter-nav-title">{prev.title}</span>
					</a>
				{:else}
					<span></span>
				{/if}
				{#if next}
					<a
						href={resolve(`${next.id}/` as `${string}/${string}/`)}
						class="chapter-nav-link next"
						data-next
					>
						<span class="chapter-nav-dir">Следующая →</span>
						<span class="chapter-nav-title">{next.title}</span>
					</a>
				{/if}
			</nav>
		</main>
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
	.toc-col {
		grid-column: 1;
		justify-self: end;
		width: 160px;
		margin-right: 40px;
		position: sticky;
		top: 88px;
	}
	.text {
		grid-column: 2;
		min-width: 0;
		font-size: var(--fs-body);
		line-height: var(--lh-body);
		color: var(--text);
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
	.sources a {
		color: var(--accent);
		word-break: break-all;
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

	@media (max-width: 1180px) {
		.page {
			grid-template-columns: minmax(0, var(--text-width));
			justify-content: center;
		}
		.toc-col {
			display: none;
		}
		.text {
			grid-column: 1;
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
