<script lang="ts">
	import type { Component } from 'svelte';
	import ChapterPage from '$lib/components/ChapterPage.svelte';
	import { getGlossary } from '$lib/content/registry';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Chapter sources are compiled at build time; the glob is eager so that the chapter
	// renders during prerendering (component values cannot be serialized through `load`).
	const contentModules = import.meta.glob('/content/*/*/index.svx', {
		eager: true,
		import: 'default',
	}) as Record<string, Component>;

	const Content = $derived(contentModules[`/content/${data.chapter.id}/index.svx`] as Component);
	const glossary = getGlossary();
</script>

<svelte:head>
	<title>{data.chapter.title} · learning-site</title>
</svelte:head>

<ChapterPage
	chapter={data.chapter}
	topic={data.topic}
	prereqs={data.prereqs}
	prev={data.prev}
	next={data.next}
	{glossary}
	{Content}
/>
