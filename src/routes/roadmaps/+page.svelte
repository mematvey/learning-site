<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import RoadmapCard from '$lib/components/RoadmapCard.svelte';
	import { ensureProgress } from '$lib/shell.svelte';
	import { EMPTY_SNAPSHOT, snapshotFrom, type ProgressSnapshot } from './status';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let snapshot = $state<ProgressSnapshot>(EMPTY_SNAPSHOT);

	onMount(() => {
		ensureProgress()
			.then((store) => store.list())
			.then((list) => {
				snapshot = snapshotFrom(list);
			})
			.catch(() => {
				// No readable progress: bars stay empty.
			});
	});
</script>

<svelte:head>
	<title>Маршруты · learning-site</title>
</svelte:head>

<main class="wrap">
	<nav class="crumbs" aria-label="Навигация">
		<a href={resolve('/')}>Главная</a> <span aria-hidden="true">/</span>
		<span>Маршруты</span>
	</nav>

	<header class="head">
		<h1>Маршруты</h1>
		<p class="lead">
			Готовые пути обучения: главы в нужном порядке, с лабами и подсказкой, с чего продолжить.
		</p>
	</header>

	{#if data.roadmaps.length === 0}
		<p class="empty">Маршруты скоро появятся.</p>
	{:else}
		<ul class="grid">
			{#each data.roadmaps as roadmap (roadmap.id)}
				<li><RoadmapCard {roadmap} {snapshot} /></li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.wrap {
		max-width: 1040px;
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
		border-left: 4px solid var(--accent);
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
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-6);
		grid-template-columns: 1fr;
	}
	@media (min-width: 720px) {
		.grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.grid > li {
		display: flex;
	}
	.grid > li > :global(*) {
		flex: 1;
	}
	.empty {
		padding: var(--space-8);
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg);
		color: var(--text-muted);
		text-align: center;
	}
</style>
