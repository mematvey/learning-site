<script lang="ts">
	import { getContext } from 'svelte';
	import type { RefProps } from '../contracts/component-props';
	import { ENTITY_COLOR_VAR, HIGHLIGHT_CONTEXT, type HighlightContext } from '../contracts/context';

	/** Word colored by entity (Q/K/V); hover or focus sets the highlight context. */
	let { e, children }: RefProps = $props();

	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const dimmed = $derived(highlight?.hl != null && highlight.hl !== e);
	const active = $derived(highlight?.hl === e);
</script>

<!-- Hover only: the highlight is a pointer affordance, not a control. -->
<mark
	class="ref"
	class:is-active={active}
	class:is-dimmed={dimmed}
	style="--ref-color: var({ENTITY_COLOR_VAR[e]})"
	data-entity={e}
	onmouseenter={() => highlight?.set(e)}
	onmouseleave={() => highlight?.set(null)}>{@render children()}</mark
>

<style>
	.ref {
		color: var(--ref-color);
		font-weight: 600;
		padding: 0 3px;
		border-radius: var(--radius-sm, 4px);
		background: color-mix(in srgb, var(--ref-color) 12%, transparent);
		transition:
			background var(--dur-fast, 150ms) var(--ease, ease),
			opacity var(--dur-fast, 150ms) var(--ease, ease);
	}
	.ref.is-active {
		background: color-mix(in srgb, var(--ref-color) 22%, transparent);
	}
	.ref.is-dimmed {
		opacity: 0.45;
	}
	@media (prefers-reduced-motion: reduce) {
		.ref {
			transition: none;
		}
	}
</style>
