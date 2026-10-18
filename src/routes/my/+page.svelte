<script lang="ts">
	import { resolve } from '$app/paths';
	import MyScreen from '$lib/components/my/MyScreen.svelte';
	import { buildExportContext } from '$lib/my/views';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const ctx = $derived(buildExportContext(data.chapters, data.topics));
</script>

<svelte:head>
	<title>Моё · learning-site</title>
</svelte:head>

<main class="wrap">
	<nav class="crumbs" aria-label="Навигация">
		<a href={resolve('/')}>Главная</a> <span aria-hidden="true">/</span>
		<span>Моё</span>
	</nav>

	<header class="head">
		<h1>Моё</h1>
		<p class="lead">
			Личные данные по всем темам: заметки, закладки, идеи и ситуации. Всё хранится в этом браузере.
			Скопируйте Markdown и передайте агенту, или скачайте файлы.
		</p>
	</header>

	<MyScreen topics={data.topics} chapters={data.chapters} {ctx} />
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
		margin-bottom: var(--space-6);
	}
	.crumbs a {
		color: var(--accent);
	}
	.head {
		margin-bottom: var(--space-8);
		padding-left: var(--space-4);
		border-left: 4px solid var(--accent);
	}
	h1 {
		font-family: var(--font-serif);
		font-size: var(--fs-h1);
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}
	.lead {
		margin-top: var(--space-3);
		color: var(--text-muted);
		line-height: 1.6;
		max-width: 620px;
	}
</style>
