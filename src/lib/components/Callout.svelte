<script lang="ts">
	import type { CalloutProps } from '../contracts/component-props';

	/** Callout box: warn, note or tip. */
	let { kind, title, children }: CalloutProps = $props();

	const defaultTitle = { warn: 'Осторожно', note: 'Заметка', tip: 'Совет' } as const;
</script>

<aside class="callout callout-{kind}" role="note" aria-label={title ?? defaultTitle[kind]}>
	<p class="callout-title">{title ?? defaultTitle[kind]}</p>
	<div class="body">{@render children()}</div>
</aside>

<style>
	.callout {
		margin: var(--space-8) 0;
		padding: var(--space-4) var(--space-6);
		border-left: 3px solid var(--warn);
		background: var(--warn-bg);
		border-radius: var(--radius);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-base);
		line-height: 1.6;
	}
	.callout-note {
		--callout-color: var(--accent);
		border-left-color: var(--accent);
		background: var(--surface-2);
	}
	.callout-tip {
		--callout-color: var(--ok);
		border-left-color: var(--ok);
		background: var(--surface-2);
	}
	.callout-warn .callout-title {
		color: var(--warn);
	}
	.callout-note .callout-title {
		color: var(--accent);
	}
	.callout-tip .callout-title {
		color: var(--ok);
	}
	.callout-title {
		margin: 0 0 var(--space-2);
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: 17px;
	}
	.body :global(p) {
		margin: 0;
	}
	.body :global(p + p) {
		margin-top: var(--space-2);
	}
</style>
