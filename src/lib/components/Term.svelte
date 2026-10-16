<script module lang="ts">
	// Unique tooltip ids per page; module scope keeps them stable across instances.
	let counter = 0;
	export function nextTermTipId(): string {
		counter += 1;
		return `term-tip-${counter}`;
	}
</script>

<script lang="ts">
	import { getContext } from 'svelte';
	import type { TermProps } from '../contracts/component-props';
	import { CHAPTER_CONTEXT, type ChapterContext } from '../contracts/context';

	/** Glossary term with a tooltip on hover and focus (keyboard accessible). */
	let { id, children }: TermProps = $props();

	const chapter = getContext<ChapterContext | undefined>(CHAPTER_CONTEXT);
	const entry = $derived(chapter?.glossary[id]);
	const tipId = nextTermTipId();
</script>

{#if entry}
	<!-- Focusable on purpose: the glossary tooltip must be reachable by keyboard. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- No whitespace between the nodes: the markup must not add spaces around the term text. -->
	<abbr class="term" tabindex="0" aria-describedby={tipId} data-term={id}
		>{#if children}{@render children()}{:else}{entry.term}{/if}<span
			role="tooltip"
			id={tipId}
			class="term-tip"
			>{#if entry.term_en}<span class="term-en">{entry.term_en}</span>{/if}{entry.definition}</span
		></abbr
	>
{:else}
	<!-- Unknown term id: the content linter reports it; render the text without a tooltip. -->
	<span class="term-missing" data-term={id}
		>{#if children}{@render children()}{:else}{id}{/if}</span
	>
{/if}

<style>
	.term {
		position: relative;
		text-decoration: underline dotted;
		text-underline-offset: 4px;
		cursor: help;
		border-radius: 2px;
	}
	.term:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.term-tip {
		position: absolute;
		left: 0;
		bottom: calc(100% + 8px);
		z-index: 5;
		display: none;
		width: max-content;
		max-width: 320px;
		padding: var(--space-2, 8px) var(--space-3, 12px);
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius, 8px);
		box-shadow: var(--shadow);
		font-size: 14px;
		font-style: normal;
		font-weight: 400;
		line-height: 1.45;
		text-decoration: none;
		white-space: normal;
	}
	.term:hover > .term-tip,
	.term:focus > .term-tip {
		display: block;
	}
	.term-en {
		display: block;
		font-size: 12px;
		color: var(--text-muted);
	}
</style>
