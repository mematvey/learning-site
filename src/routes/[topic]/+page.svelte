<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ensureProgress } from '$lib/shell.svelte';
	import PrereqGraph from '$lib/components/PrereqGraph.svelte';
	import TopicChapterList from '$lib/components/TopicChapterList.svelte';
	import { resolveChapterId } from '$lib/content/registry';
	import { countSectionsDone, sumCounts } from '$lib/progress';
	import type { ChapterId } from '$lib/contracts/ids';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let status = $state<Record<string, 'done' | 'progress' | 'new'>>({});
	let doneIds = $state<ChapterId[]>([]);
	let marks = $state<Record<string, string[]>>({});
	let progressError = $state<string | null>(null);

	/** Reads all records and keys them by the canonical chapter id (old alias ids are followed). */
	async function load() {
		const store = await ensureProgress();
		const { chapters } = await store.list();
		const next: Record<string, 'done' | 'progress'> = {};
		const byId: Record<string, string[]> = {};
		for (const c of chapters) {
			const key = resolveChapterId(c.id);
			if (c.done) next[key] = 'done';
			else if (c.visited !== null && next[key] === undefined) next[key] = 'progress';
			byId[key] = [...(byId[key] ?? []), ...c.sectionsDone];
		}
		status = next;
		marks = byId;
		doneIds = Object.keys(next).filter((id) => next[id] === 'done') as ChapterId[];
		progressError = null;
	}

	onMount(() => {
		let alive = true;
		load().catch((e: unknown) => {
			if (alive)
				progressError = `Не удалось прочитать прогресс: ${e instanceof Error ? e.message : String(e)}`;
		});
		return () => (alive = false);
	});

	async function resetTopic() {
		const ok = window.confirm(
			`Сбросить прогресс темы «${data.topic.title}»? Галочки разделов, пройденность и позиция чтения всех глав темы будут удалены. Заметки, лабы и настройки не затрагиваются.`,
		);
		if (!ok) return;
		try {
			const store = await ensureProgress();
			if (store.readOnly) {
				progressError =
					'Прогресс доступен только для чтения: данные записаны более новой версией сайта.';
				return;
			}
			await store.resetTopic(data.topic.id);
			await load();
		} catch (e) {
			progressError = `Не удалось сбросить прогресс: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	const total = $derived(data.chapters.length);
	const doneCount = $derived(data.chapters.filter((c) => status[c.id] === 'done').length);
	const sectionTotals = $derived(
		sumCounts(
			data.chapters.map((c) =>
				countSectionsDone(
					c.sections.map((s) => s.id),
					marks[c.id],
				),
			),
		),
	);

	function plural(n: number): string {
		const m10 = n % 10;
		const m100 = n % 100;
		if (m10 === 1 && m100 !== 11) return `${n} глава`;
		if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} главы`;
		return `${n} глав`;
	}
</script>

<svelte:head>
	<title>{data.topic.title} · learning-site</title>
</svelte:head>

<main class="wrap" data-topic={data.topic.id}>
	<nav class="crumbs" aria-label="Навигация">
		<a href={resolve('/')}>Главная</a> <span aria-hidden="true">/</span>
		<span>{data.topic.title}</span>
	</nav>

	<header class="head">
		<h1>{data.topic.title}</h1>
		<p class="lead">{data.topic.description}</p>
		<p class="summary">
			{plural(total)} · пройдено {doneCount} из {total}
			{#if sectionTotals.total > 0}
				· разделов {sectionTotals.done} из {sectionTotals.total}
			{/if}
		</p>
		{#if total > 0}
			<div class="reset-row">
				<button class="btn-quiet" type="button" data-reset-topic onclick={resetTopic}>
					Сбросить прогресс темы
				</button>
			</div>
		{/if}
		{#if progressError}
			<p class="progress-error" role="alert">{progressError}</p>
		{/if}
	</header>

	<section aria-labelledby="chapters-title">
		<h2 id="chapters-title">Главы</h2>
		{#if total === 0}
			<p class="empty">Главы скоро появятся.</p>
		{:else}
			<TopicChapterList chapters={data.chapters} titles={data.titles} {status} />
		{/if}
	</section>

	{#if total > 0}
		<section class="map" aria-labelledby="map-title">
			<h2 id="map-title">Карта глав</h2>
			<PrereqGraph graph={data.graph} topic={data.topic.id} done={doneIds} />
		</section>
	{/if}
</main>

<style>
	.wrap {
		max-width: 860px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4) var(--space-16);
	}
	@media (min-width: 720px) {
		.wrap {
			padding-inline: var(--space-8);
		}
	}
	.crumbs {
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.crumbs a {
		color: var(--accent);
	}
	.head {
		margin: var(--space-8) 0;
		padding-left: var(--space-4);
		border-left: 4px solid var(--topic);
	}
	h1 {
		font-family: var(--font-serif);
		font-size: 40px;
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
	}
	.lead {
		margin-top: var(--space-3);
		color: var(--text-muted);
		line-height: 1.6;
		max-width: 620px;
	}
	.summary {
		margin-top: var(--space-3);
		font-size: var(--fs-sm);
		color: var(--topic);
		font-weight: 600;
	}
	h2 {
		font-family: var(--font-serif);
		font-size: var(--fs-h2);
		font-weight: 600;
		margin-bottom: var(--space-6);
	}
	.map {
		margin-top: var(--space-12);
	}
	.reset-row {
		margin-top: var(--space-3);
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
		border: 1px solid var(--border);
	}
	.btn-quiet:hover {
		color: var(--fail);
	}
	.progress-error {
		margin-top: var(--space-3);
		font-size: var(--fs-sm);
		color: var(--fail);
	}
	.empty {
		padding: var(--space-8);
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg);
		color: var(--text-muted);
		text-align: center;
	}
</style>
