<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { ensureProgress } from '$lib/shell.svelte';
	import type { ChapterId, LabId, TopicId } from '$lib/contracts/ids';
	import type { ChapterEntry, TopicEntry } from '$lib/contracts/registry';
	import ContinueCard from '$lib/components/ContinueCard.svelte';
	import PrereqGraph from '$lib/components/PrereqGraph.svelte';
	import SiteMap from '$lib/components/SiteMap.svelte';
	import TopicCard from '$lib/components/TopicCard.svelte';
	import TopicTabs from '$lib/components/TopicTabs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const chapterById = $derived(
		new SvelteMap<ChapterId, ChapterEntry>(data.chapters.map((c) => [c.id, c])),
	);
	const topicById = $derived(new SvelteMap<TopicId, TopicEntry>(data.topics.map((t) => [t.id, t])));

	let activeTopic = $state<TopicId | ''>('');
	const current = $derived<TopicEntry | undefined>(
		topicById.get(activeTopic as TopicId) ?? data.topics[0],
	);
	const shownTopic = $derived(current?.id ?? '');

	/* ---------- Progress (client only; IndexedDB is not available at prerender) ---------- */

	type ContinueState = {
		chapter: ChapterEntry;
		progress: number;
		labState?: 'not-started' | 'passed' | 'failed';
	};

	let doneIds = $state<ChapterId[]>([]);
	let cont = $state<ContinueState | null>(null);

	async function loadProgress(): Promise<void> {
		const store = await ensureProgress();
		const { chapters, labs } = await store.list();

		doneIds = chapters.filter((c) => c.done).map((c) => c.id);

		const visited = chapters
			.filter((c) => c.visited !== null && !c.done)
			.sort((a, b) => (b.lastVisit ?? b.updated).localeCompare(a.lastVisit ?? a.updated));
		const last = visited[0];
		const chapter = last ? chapterById.get(last.id) : undefined;
		if (!last || !chapter) return;

		const sections = Math.max(1, chapter.sections.length);
		const labId: LabId | undefined = chapter.labs?.[0];
		const lab = labId ? labs.find((l) => l.labId === labId) : undefined;
		cont = {
			chapter,
			progress: Math.min(1, last.sectionsReached.length / sections),
			labState: labId ? (lab?.passed ? 'passed' : 'not-started') : undefined,
		};
	}

	onMount(() => {
		loadProgress().catch(() => {
			// No readable progress: the continue card stays hidden, the page still works.
			cont = null;
		});
	});

	const doneSet = $derived(new Set<ChapterId>(doneIds));

	function topicProgress(t: TopicEntry): number {
		if (t.chapterIds.length === 0) return 0;
		const done = t.chapterIds.filter((id) => doneSet.has(id)).length;
		return done / t.chapterIds.length;
	}

	/* ---------- Keyboard: 1-5 switch the map topic ---------- */

	function onKey(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		const el = e.target as HTMLElement | null;
		if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
		const n = Number.parseInt(e.key, 10);
		if (n >= 1 && n <= data.topics.length) {
			const t = data.topics[n - 1];
			if (t) activeTopic = t.id;
		}
	}

	function openMap(id: TopicId) {
		activeTopic = id;
		document.getElementById('map')?.scrollIntoView({ block: 'start' });
	}

	/** Chapters shown on a topic card: featured first, then reading order, at most three. */
	function cardChapters(t: TopicEntry) {
		const ids = (t.featured?.length ? t.featured : t.chapterIds).slice(0, 3);
		return ids.flatMap((id) => {
			const c = chapterById.get(id);
			return c ? [{ id: c.id, title: c.title, href: c.href }] : [];
		});
	}
</script>

<svelte:window onkeydown={onKey} />

<svelte:head>
	<title>learning-site: главная</title>
</svelte:head>

<main class="wrap">
	<section class="hero">
		<div class="hero-text">
			<h1>Машинное обучение по шагам</h1>
			<p class="hero-lead">
				Главы с интерактивными демо, лабораторными заданиями и вопросами для самопроверки. Прогресс
				и заметки остаются у вас.
			</p>
		</div>
		<svg class="hero-art" viewBox="0 0 280 220" aria-hidden="true">
			<path class="hero-line" d="M48 56 L140 110 L232 52 M140 110 L96 184 M140 110 L220 176" />
			<g data-topic="dl"><circle class="hero-fill" cx="48" cy="56" r="26" /></g>
			<g data-topic="classic-ml"
				><rect class="hero-fill" x="116" y="86" width="48" height="48" rx="10" /></g
			>
			<g data-topic="mlops"><polygon class="hero-fill" points="232,20 262,72 202,72" /></g>
			<g data-topic="cs"><circle class="hero-fill" cx="96" cy="184" r="18" /></g>
			<g data-topic="compute"
				><rect class="hero-fill" x="204" y="150" width="36" height="36" rx="8" /></g
			>
		</svg>
	</section>

	{#if cont}
		<ContinueCard
			topic={cont.chapter.topic}
			topicTitle={topicById.get(cont.chapter.topic)?.title ?? cont.chapter.topic}
			chapterId={cont.chapter.id}
			title={cont.chapter.title}
			description={cont.chapter.summary}
			progress={cont.progress}
			lab={cont.labState && cont.chapter.labs?.[0]
				? { id: cont.chapter.labs[0], state: cont.labState }
				: undefined}
			href={cont.chapter.href}
		/>
	{/if}

	<section class="topics" aria-labelledby="topics-title">
		<div class="section-head">
			<p class="eyebrow">Темы</p>
			<h2 id="topics-title">Что изучаем</h2>
		</div>
		<div class="topic-grid">
			{#each data.topics as t (t.id)}
				<TopicCard
					topic={t.id}
					title={t.title}
					description={t.description}
					chapterCount={t.chapterIds.length}
					chapters={cardChapters(t)}
					progress={topicProgress(t)}
					active={t.id === shownTopic}
					mapHref="#map"
					onSelect={openMap}
				/>
			{/each}
		</div>
	</section>

	<section class="sitemap-section" id="sitemap" aria-labelledby="sitemap-title">
		<div class="section-head">
			<p class="eyebrow">Всё содержание</p>
			<h2 id="sitemap-title">Карта сайта</h2>
			<p class="section-sub">
				Все темы и главы одним графом. Стрелка ведёт от того, что нужно знать, к тому, что на этом
				строится.
			</p>
		</div>
		<SiteMap topics={data.topics} chapters={data.chapters} graph={data.graph} />
	</section>

	{#if current}
		<section class="map" id="map" data-topic={current.id} aria-labelledby="map-title">
			<div class="section-head">
				<p class="eyebrow">Порядок чтения</p>
				<h2 id="map-title">Карта · {current.title}</h2>
				<p class="section-sub">
					Стрелка показывает, что нужно знать до темы. Закрашены пройденные узлы, обведён текущий.
				</p>
			</div>
			<TopicTabs
				topics={data.topics.map((t) => ({ id: t.id, title: t.title }))}
				active={current.id}
				onSelect={(id) => (activeTopic = id)}
			/>
			<PrereqGraph graph={data.graph} topic={current.id} focus={cont?.chapter.id} done={doneIds} />
		</section>
	{/if}
</main>

<footer class="site-footer">
	<div class="wrap footer-inner">
		<a href="https://github.com/mematvey/learning-site">GitHub: mematvey/learning-site</a>
		<p>Заметки и прогресс хранятся локально и в вашем приватном репозитории.</p>
		<p class="footer-hint">Нажмите <kbd>?</kbd> — все шорткаты</p>
	</div>
</footer>

<style>
	.wrap {
		max-width: 1080px;
		margin: 0 auto;
		padding: 0 var(--space-4);
	}
	@media (min-width: 720px) {
		.wrap {
			padding: 0 var(--space-8);
		}
	}
	.hero {
		padding: var(--space-12) 0;
		display: grid;
		gap: var(--space-8);
		align-items: center;
	}
	.hero-text {
		max-width: 620px;
	}
	.hero h1 {
		font-family: var(--font-serif);
		font-size: 40px;
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
	}
	.hero-lead {
		margin-top: var(--space-4);
		font-size: var(--fs-body);
		line-height: 1.6;
		color: var(--text-muted);
		max-width: 560px;
	}
	.hero-art {
		display: none;
		width: 100%;
		max-width: 280px;
		height: auto;
		justify-self: end;
	}
	.hero-line {
		fill: none;
		stroke: var(--border);
		stroke-width: 2;
	}
	.hero-fill {
		fill: var(--topic);
	}
	@media (min-width: 720px) {
		.hero {
			grid-template-columns: 1fr 280px;
			padding: var(--space-16) 0 var(--space-12);
		}
		.hero h1 {
			font-size: 56px;
		}
		.hero-art {
			display: block;
		}
	}
	.topics,
	.sitemap-section,
	.map {
		margin-top: var(--space-12);
	}
	.map {
		scroll-margin-top: 80px;
	}
	.eyebrow {
		font-size: var(--fs-sm);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
		font-weight: 600;
	}
	.section-head {
		display: grid;
		gap: var(--space-2);
		margin-bottom: var(--space-8);
	}
	.section-head h2 {
		font-family: var(--font-serif);
		font-size: var(--fs-h2);
		font-weight: 600;
		letter-spacing: -0.015em;
	}
	.section-sub {
		color: var(--text-muted);
		max-width: 600px;
	}
	.topic-grid {
		display: grid;
		gap: var(--space-6);
		grid-template-columns: 1fr;
	}
	@media (min-width: 640px) {
		.topic-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 980px) {
		.topic-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.site-footer {
		margin-top: var(--space-24);
		border-top: 1px solid var(--border);
		padding: var(--space-8) 0 var(--space-12);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.footer-inner {
		display: grid;
		gap: var(--space-2);
	}
	.site-footer a {
		color: var(--accent);
	}
	kbd {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-bottom-width: 2px;
		border-radius: 5px;
		padding: 0 5px;
	}
</style>
