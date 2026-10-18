<script lang="ts">
	/** Plain message about notes (storage unavailable, failed action). Announced to screen readers. */
	interface Props {
		message: string;
		onDismiss?: () => void;
	}

	const { message, onDismiss }: Props = $props();
</script>

<div class="notes-notice" role="status">
	<p>{message}</p>
	{#if onDismiss}
		<button type="button" class="dismiss" aria-label="Скрыть сообщение" onclick={onDismiss}>
			×
		</button>
	{/if}
</div>

<style>
	.notes-notice {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		font-size: var(--fs-sm);
		color: var(--text-muted);
		background: var(--surface);
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		padding: var(--space-3);
		margin-bottom: var(--space-4);
	}
	.notes-notice p {
		margin: 0;
		flex: 1;
	}
	.dismiss {
		background: none;
		border: 0;
		color: var(--text-muted);
		font: inherit;
		cursor: pointer;
		line-height: 1;
	}
	.dismiss:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
</style>
