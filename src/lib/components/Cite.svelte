<script lang="ts">
	import { getContext } from 'svelte';
	import { CHAPTER_CONTEXT, type ChapterContext } from '../contracts/context';
	import type { CiteProps } from '../contracts/component-props';

	/** Inline citation of a chapter source: `[n]` linking to the sources list (`#src-<id>`). */
	let { id }: CiteProps = $props();

	const chapter = getContext<ChapterContext | undefined>(CHAPTER_CONTEXT);
	const number = $derived.by(() => {
		const index = (chapter?.sources ?? []).findIndex((s) => s.id === id);
		return index === -1 ? '?' : String(index + 1);
	});
</script>

<sup class="cite"><a href="#src-{id}" aria-label="Источник {number}">[{number}]</a></sup>

<style>
	.cite a {
		color: var(--topic);
		text-decoration: none;
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 600;
	}
	.cite a:hover {
		text-decoration: underline;
	}
</style>
