<script lang="ts">
	import { untrack } from 'svelte';
	import type { Note, NoteAnchor, NoteStatus } from '../../contracts';
	import { parseTags, type NotePatch } from './notes-format';

	interface Props {
		/** Existing note; absent when creating a note for `anchor`. */
		note?: Note;
		anchor?: NoteAnchor;
		onSave: (patch: NotePatch) => void;
		onCancel: () => void;
		onDelete?: () => void;
	}

	const { note, anchor, onSave, onCancel, onDelete }: Props = $props();

	let text = $state(untrack(() => note?.text ?? ''));
	let tags = $state(untrack(() => note?.tags?.join(', ') ?? ''));
	let status = $state<NoteStatus>(untrack(() => note?.status ?? 'open'));
	let textarea: HTMLTextAreaElement | undefined = $state();

	const canSave = $derived(text.trim().length > 0);

	$effect(() => {
		textarea?.focus();
	});

	function save() {
		if (!canSave) return;
		onSave({ text: text.trim(), tags: parseTags(tags), status });
	}

	function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		save();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		} else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			save();
		}
	}
</script>

<form class="note-editor" onsubmit={onSubmit}>
	{#if anchor}
		<p class="note-quote">«{anchor.exact}»</p>
	{/if}
	<label class="field">
		<span>Текст заметки</span>
		<textarea bind:this={textarea} bind:value={text} rows="4" required onkeydown={onKeydown}
		></textarea>
	</label>
	<label class="field">
		<span>Теги (через запятую)</span>
		<input type="text" bind:value={tags} onkeydown={onKeydown} />
	</label>
	<label class="field">
		<span>Статус</span>
		<select bind:value={status} onkeydown={onKeydown}>
			<option value="open">open</option>
			<option value="answered">answered</option>
		</select>
	</label>
	<div class="actions">
		<button type="submit" class="btn-primary" disabled={!canSave}>Сохранить</button>
		<button type="button" class="btn-outline" onclick={onCancel}>Отмена</button>
		{#if onDelete}
			<button type="button" class="btn-link" onclick={onDelete}>Удалить</button>
		{/if}
	</div>
</form>

<style>
	.note-editor {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: var(--space-4);
		font-size: var(--fs-sm);
		color: var(--text);
		display: grid;
		gap: var(--space-3);
	}
	.note-quote {
		margin: 0;
		font-style: italic;
		color: var(--text-muted);
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.field > span {
		font-size: 12px;
		color: var(--text-muted);
	}
	textarea,
	input,
	select {
		font: inherit;
		color: var(--text);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 6px 8px;
		width: 100%;
	}
	textarea:focus-visible,
	input:focus-visible,
	select:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.btn-primary,
	.btn-outline,
	.btn-link {
		font: inherit;
		font-size: var(--fs-sm);
		border-radius: var(--radius-sm);
		padding: 6px 12px;
		cursor: pointer;
	}
	.btn-primary {
		background: var(--topic);
		color: var(--surface);
		border: 1px solid var(--topic);
	}
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-outline {
		background: none;
		color: var(--text);
		border: 1px solid var(--border);
	}
	.btn-outline:hover {
		border-color: var(--topic);
	}
	.btn-link {
		background: none;
		border: 0;
		color: var(--fail);
		margin-left: auto;
	}
</style>
