<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ensureProgress } from '$lib/shell.svelte';
	import PrereqGraph from '$lib/components/PrereqGraph.svelte';
	import TopicChapterList from '$lib/components/TopicChapterList.svelte';
	import type { ChapterId } from '$lib/contracts/ids';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let status = $state<Record<string, 'done' | 'progress' | 'new'>>({});
	let doneIds = $state<ChapterId[]>([]);

	onMount(() => {
		ensureProgress()
			.then((store) => store.list())
			.then(({ chapters }) => {
				const next: Record<string, 'done' | 'progress'> = {};
				for (const c of chapters) {
					if (c.done) next[c.id] = 'done';
					else if (c.visited !== null) next[c.id] = 'progress';
				}
				status = next;
				doneIds = chapters.filter((c) => c.done).map((c) => c.id);
			})
			.catch(() => {
				// No readable progress: statuses stay hidden.
			});
	});

	const total = $derived(data.chapters.length);
	const doneCount = $derived(data.chapters.filter((c) => status[c.id] === 'done').length);

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
		</p>
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
			<h2 id="map-title">Карта раздела</h2>
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
	.empty {
		padding: var(--space-8);
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg);
		color: var(--text-muted);
		text-align: center;
	}
</style>
