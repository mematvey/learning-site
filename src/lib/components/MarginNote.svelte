<script lang="ts">
	import type { MarginNoteProps } from '../contracts/component-props';
	import { formatAgo } from './notes/notes-format';

	/** Note card in the margin. */
	const {
		note,
		resolution,
		layerHidden = false,
		onSelect,
		onShowLayer,
		onDelete,
	}: MarginNoteProps = $props();

	const tagLine = $derived(
		[note.tags?.join(', ') || 'заметка', formatAgo(note.updated)].join(' · '),
	);
</script>

<article
	class="note-card"
	data-note-status={resolution}
	class:is-shifted={resolution === 'shifted'}
	class:is-orphaned={resolution === 'orphaned'}
	class:is-hidden={layerHidden}
>
	<button type="button" class="note-body" onclick={() => onSelect?.(note.id)}>
		<span class="note-tag">{tagLine}</span>
		{#if resolution === 'orphaned'}
			<span class="note-quote">«{note.anchor.exact}»</span>
		{/if}
		<p class="note-text">{note.text}</p>
		<span class="note-meta">
			<span class="note-status">{note.status}</span>
			{#if resolution === 'shifted'}
				<span class="note-hint">текст изменился, якорь обновлён</span>
			{:else if resolution === 'orphaned'}
				<span class="note-hint">фрагмент не найден</span>
			{/if}
		</span>
	</button>
	{#if layerHidden}
		<button type="button" class="note-show" onclick={() => onShowLayer?.(note.id)}>
			Показать слой
		</button>
	{/if}
	{#if onDelete}
		<button
			type="button"
			class="note-del"
			aria-label="Удалить заметку"
			onclick={() => onDelete(note.id)}
		>
			×
		</button>
	{/if}
</article>

<style>
	.note-card {
		position: relative;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		font-size: var(--fs-sm);
		line-height: 1.5;
		color: var(--text);
	}
	.note-card.is-orphaned {
		border-style: dashed;
		color: var(--text-muted);
	}
	.note-card.is-hidden {
		opacity: 0.85;
	}
	.note-body {
		display: block;
		width: 100%;
		padding: var(--space-4);
		text-align: left;
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;
		border-radius: var(--radius);
	}
	.note-body:focus-visible,
	.note-show:focus-visible,
	.note-del:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.note-tag {
		display: inline-block;
		font-size: 12px;
		color: var(--topic);
		background: var(--topic-soft);
		padding: 1px 8px;
		border-radius: 999px;
		margin-bottom: var(--space-2);
	}
	.note-quote {
		display: block;
		font-style: italic;
		color: var(--text-muted);
		margin-bottom: var(--space-2);
	}
	.note-text {
		margin: 0 0 var(--space-3);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.note-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.note-status {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--warn);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 0 6px;
	}
	.note-hint {
		font-size: 12px;
		color: var(--text-muted);
	}
	.note-show {
		margin: 0 var(--space-4) var(--space-3);
		font: inherit;
		font-size: 12px;
		color: var(--topic);
		background: none;
		border: 1px solid var(--topic);
		border-radius: var(--radius-sm);
		padding: 2px 8px;
		cursor: pointer;
	}
	.note-del {
		position: absolute;
		top: 4px;
		right: 6px;
		font: inherit;
		line-height: 1;
		color: var(--text-muted);
		background: none;
		border: 0;
		cursor: pointer;
		padding: 4px;
	}
	.note-del:hover {
		color: var(--text);
	}
</style>
