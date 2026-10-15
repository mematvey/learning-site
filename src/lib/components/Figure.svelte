<script lang="ts">
	import { getContext } from 'svelte';
	import { CHAPTER_CONTEXT, type ChapterContext } from '../contracts/context';
	import type { FigureProps } from '../contracts/component-props';

	/** Figure frame with number, caption, notice and text alternative. */
	let { id, alt, caption, notice, wide = true, children }: FigureProps = $props();

	const chapter = getContext<ChapterContext | undefined>(CHAPTER_CONTEXT);
	const number = $derived(chapter?.figureNumber(id) ?? 1);
</script>

<figure class="figure" class:fig-wide={wide} data-figure-id={id}>
	{@render children()}
	{#if notice}
		<p class="notice"><strong>Что заметить:</strong> {notice}</p>
	{/if}
	<details class="alt">
		<summary>Текстовая альтернатива</summary>
		<p>{alt}</p>
	</details>
	<figcaption class="caption">
		<span class="num">Рис. {number}.</span>
		{caption}
	</figcaption>
</figure>

<style>
	.figure {
		margin: var(--space-12) 0;
		padding: var(--space-6);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-base);
		line-height: 1.5;
	}
	.fig-wide {
		position: relative;
		left: 50%;
		transform: translateX(-50%);
		width: min(var(--wide-width), calc(100vw - 48px));
		max-width: none;
	}
	.caption {
		display: block;
		margin: var(--space-4) 0 0;
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.num {
		font-weight: 600;
		color: var(--text);
		margin-right: 4px;
	}
	.notice {
		margin: var(--space-3) 0 0;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.alt {
		margin-top: var(--space-3);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.alt summary {
		cursor: pointer;
		color: var(--topic);
	}
	.alt p {
		margin: var(--space-2) 0 0;
		color: var(--text-muted);
	}
	@media (max-width: 900px) {
		.fig-wide {
			width: calc(100vw - 32px);
		}
	}
</style>
