<script lang="ts">
	import { getContext } from 'svelte';
	import type { DemoLinkProps } from '../contracts/component-props';
	import { DEMOS_CONTEXT, type DemosContext } from '../contracts/context';

	/** Link that puts a registered demo into the given state and scrolls to it. */
	let { demo, state, children }: DemoLinkProps = $props();

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	function activate(event: MouseEvent) {
		event.preventDefault();
		demos?.set(demo, state);
	}
</script>

<a class="demo-link" href={`#demo-${demo}`} data-demo-link={demo} onclick={activate}
	>{@render children()}</a
>

<style>
	.demo-link {
		color: var(--topic);
		text-decoration: underline dotted;
		text-decoration-thickness: 1.5px;
		text-underline-offset: 4px;
		cursor: pointer;
	}
	.demo-link:hover {
		text-decoration-style: solid;
	}
	.demo-link:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
		border-radius: 2px;
	}
</style>
