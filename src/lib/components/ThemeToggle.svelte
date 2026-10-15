<script lang="ts">
	import type { ThemeToggleProps } from '$lib/contracts/component-props';

	/** Light/dark theme toggle button. */
	let { theme, onToggle }: ThemeToggleProps = $props();

	const isDark = $derived(theme === 'dark');
</script>

<button
	type="button"
	class="theme-toggle"
	data-theme-toggle
	aria-label="Сменить тему"
	title="Сменить тему (T)"
	onclick={() => onToggle()}
>
	{#if isDark}
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
			<path
				d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linejoin="round"
			/>
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
			<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" />
			<path
				d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			/>
		</svg>
	{/if}
</button>

<style>
	.theme-toggle {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		flex: none;
		background: var(--surface);
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		transition:
			color var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}

	.theme-toggle:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	.theme-toggle:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
