<script lang="ts">
	import type { TopicTabsProps } from '$lib/contracts/component-props';

	/** Topic tabs above the prerequisite map. */
	const { topics, active, onSelect }: TopicTabsProps = $props();
</script>

<div class="map-tabs" role="group" aria-label="Топик карты">
	{#each topics as t, i (t.id)}
		<button
			class="map-tab"
			type="button"
			data-topic={t.id}
			aria-pressed={t.id === active ? 'true' : 'false'}
			onclick={() => onSelect(t.id)}
		>
			<span class="tab-dot" aria-hidden="true"></span>{t.title} <kbd>{i + 1}</kbd>
		</button>
	{/each}
</div>

<style>
	.map-tabs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}
	.map-tab {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: 500;
		cursor: pointer;
	}
	.map-tab:hover {
		border-color: var(--topic);
	}
	.map-tab[aria-pressed='true'] {
		background: var(--topic-soft);
		border-color: var(--topic);
		font-weight: 600;
	}
	.map-tab kbd {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-muted);
		background: none;
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 0 4px;
	}
	.tab-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--topic);
	}
</style>
