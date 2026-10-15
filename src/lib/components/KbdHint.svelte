<script lang="ts">
	import { onMount } from 'svelte';
	import type { KbdHintProps } from '../contracts/component-props';
	import { detectPlatform, formatKbd, type Platform } from '../shortcuts/keys';

	/** kbd with platform-specific notation. */
	let { keys }: KbdHintProps = $props();

	// Start with the Windows notation so server and client markup match; switch on mount.
	let platform = $state<Platform>('win');
	onMount(() => {
		platform = detectPlatform();
	});

	const label = $derived(formatKbd(keys, platform));
</script>

<kbd data-kbd={keys}>{label}</kbd>

<style>
	kbd {
		display: inline-block;
		min-width: 1.5em;
		padding: 0 0.4em;
		margin: 0 0.1em;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.6;
		font-weight: 500;
		text-align: center;
		white-space: nowrap;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-bottom-width: 2px;
		border-radius: var(--radius-sm);
		vertical-align: 0.1em;
	}
</style>
