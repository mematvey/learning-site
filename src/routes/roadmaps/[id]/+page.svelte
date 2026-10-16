<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import RoadmapTrack from '$lib/components/RoadmapTrack.svelte';
	import { ensureProgress } from '$lib/shell.svelte';
	import {
		chaptersLabel,
		continuePoint,
		EMPTY_SNAPSHOT,
		formatMinutes,
		roadmapProgress,
		snapshotFrom,
		type ProgressSnapshot,
	} from '../status';
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
				// No readable progress: everything shows as not started.
			});
	});

	const progress = $derived(roadmapProgress(data.roadmap, snapshot));
	const percent = $derived(Math.round(progress.fraction * 100));
	const current = $derived(continuePoint(data.roadmap, snapshot));
	const target = $derived(current ? data.chapters[current.chapter] : undefined);
	const started = $derived(
		data.roadmap.steps.some((s) => s.chapters.some((id) => id in snapshot.chapters)),
	);
</script>

<svelte:head>
	<title>{data.roadmap.title} · Маршруты · learning-site</title>
</svelte:head>

<main class="wrap">
	<nav class="crumbs" aria-label="Навигация">
		<a href={resolve('/')}>Главная</a> <span aria-hidden="true">/</span>
		<a href={resolve('/roadmaps')}>Маршруты</a> <span aria-hidden="true">/</span>
		<span>{data.roadmap.title}</span>
	</nav>

	<header class="head">
		<h1>{data.roadmap.title}</h1>
		<p class="lead">{data.roadmap.summary}</p>
		<dl class="facts">
			<div>
				<dt>Для кого</dt>
				<dd>{data.roadmap.audience}</dd>
			</div>
			<div>
				<dt>Результат</dt>
				<dd>{data.roadmap.goal}</dd>
			</div>
		</dl>
		<p class="summary">
			{chaptersLabel(data.roadmap.chapterCount)} · ~{formatMinutes(data.roadmap.estimatedMinutes)}
			· пройдено {progress.done} из {progress.total}
		</p>
		<div
			class="bar"
			role="progressbar"
			aria-label="Прогресс по маршруту"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={percent}
		>
			<i style="width: {percent}%"></i>
		</div>
		{#if current && target}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- registry href: not a typed route; resolve() adds the site base -->
			<a class="btn" href={resolve(target.href as '/')}>
				{started ? 'Продолжить' : 'Начать'} с этапа {current.step + 1}
				<span aria-hidden="true">→</span>
			</a>
		{:else}
			<p class="finished">Маршрут пройден. Можно вернуться к любой главе ниже.</p>
		{/if}
	</header>

	<RoadmapTrack
		roadmap={data.roadmap}
		chapters={data.chapters}
		labs={data.labs}
		{snapshot}
		{current}
	/>
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
		border-left: 4px solid var(--accent);
	}
	h1 {
		font-family: var(--font-serif);
		font-size: 40px;
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
	}
	@media (max-width: 520px) {
		h1 {
			font-size: 30px;
		}
	}
	.lead {
		margin-top: var(--space-3);
		color: var(--text-muted);
		line-height: 1.6;
		max-width: 620px;
	}
	.facts {
		margin: var(--space-4) 0 0;
		display: grid;
		gap: var(--space-2);
		font-size: var(--fs-sm);
		max-width: 620px;
	}
	.facts dt {
		display: inline;
		font-weight: 600;
	}
	.facts dt::after {
		content: ': ';
	}
	.facts dd {
		display: inline;
		margin: 0;
		color: var(--text-muted);
	}
	.summary {
		margin-top: var(--space-4);
		font-size: var(--fs-sm);
		color: var(--accent);
		font-weight: 600;
	}
	.bar {
		margin-top: var(--space-2);
		height: 6px;
		max-width: 620px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-6);
		background: var(--accent);
		color: var(--bg);
		font-weight: 600;
		border-radius: var(--radius);
		text-decoration: none;
	}
	.btn:hover {
		filter: brightness(1.1);
	}
	.btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.finished {
		margin-top: var(--space-4);
		color: var(--ok);
		font-weight: 600;
	}
</style>
