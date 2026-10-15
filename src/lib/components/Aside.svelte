<script lang="ts">
	import type { AsideProps } from '../contracts/component-props';

	/** Collapsible side note. */
	let { title, open = false, children }: AsideProps = $props();
</script>

<details class="aside" {open}>
	<summary>{title}</summary>
	<div class="body">{@render children()}</div>
</details>

<style>
	.aside {
		margin: var(--space-8) 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-sans);
	}
	summary {
		cursor: pointer;
		padding: var(--space-3) var(--space-4);
		font-weight: 600;
		list-style: none;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::after {
		content: '+';
		color: var(--topic);
		font-size: 20px;
		line-height: 1;
	}
	.aside[open] summary::after {
		content: '\2212';
	}
	.body {
		padding: 0 var(--space-4) var(--space-4);
		font-size: var(--fs-base);
		line-height: 1.6;
	}
	.body :global(p) {
		margin: 0 0 var(--space-4);
	}
	.body :global(p:last-child) {
		margin-bottom: 0;
	}
</style>
