<script lang="ts">
	import { untrack } from 'svelte';
	import type { Note, NoteAnchor, NoteStatus } from '../../contracts';
	import { parseTags, type NotePatch } from './notes-format';

	interface Props {
		/** Existing note; absent when creating a note for `anchor`. */
		note?: Note;
		anchor?: NoteAnchor;
		/** Message about the last failed save. The editor stays open with the typed text. */
		error?: string;
		onSave: (patch: NotePatch) => void;
		onCancel: () => void;
		/** Asks the host to delete the note; the host confirms before deleting. */
		onDelete?: () => void;
	}

	const { note, anchor, error, onSave, onCancel, onDelete }: Props = $props();

	const initial = untrack(() => ({
		text: note?.text ?? '',
		tags: note?.tags?.join(', ') ?? '',
		status: (note?.status ?? 'open') as NoteStatus,
	}));

	let text = $state(initial.text);
	let tags = $state(initial.tags);
	let status = $state<NoteStatus>(initial.status);
	/** Shows the "discard changes?" question after Escape or «Отмена» with unsaved text. */
	let confirmDiscard = $state(false);
	let textarea: HTMLTextAreaElement | undefined = $state();

	const canSave = $derived(text.trim().length > 0);
	const dirty = $derived(
		text !== initial.text || tags !== initial.tags || status !== initial.status,
	);

	$effect(() => {
		textarea?.focus();
	});

	function save() {
		if (!canSave) return;
		onSave({ text: text.trim(), tags: parseTags(tags), status });
	}

	function requestCancel() {
		if (dirty) confirmDiscard = true;
		else onCancel();
	}

	function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		save();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			if (confirmDiscard) confirmDiscard = false;
			else requestCancel();
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
		<span>Статус: отмечается вручную</span>
		<select bind:value={status} onkeydown={onKeydown}>
			<option value="open">open: вопрос открыт</option>
			<option value="answered">answered: ответ получен</option>
		</select>
	</label>
	{#if error}
		<p class="note-error" role="alert">{error}</p>
	{/if}
	{#if confirmDiscard}
		<div class="note-confirm" role="group" aria-label="Отмена изменений">
			<p>Отменить несохранённые изменения?</p>
			<div class="actions">
				<button type="button" class="btn-danger" onclick={onCancel}>Отменить изменения</button>
				<button type="button" class="btn-outline" onclick={() => (confirmDiscard = false)}>
					Продолжить редактирование
				</button>
			</div>
		</div>
	{:else}
		<div class="actions">
			<button type="submit" class="btn-primary" disabled={!canSave}>Сохранить</button>
			<button type="button" class="btn-outline" onclick={requestCancel}>Отмена</button>
			{#if onDelete}
				<button type="button" class="btn-link" onclick={onDelete}>Удалить</button>
			{/if}
		</div>
	{/if}
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
	.note-error {
		margin: 0;
		color: var(--fail);
	}
	.note-confirm {
		display: grid;
		gap: var(--space-2);
	}
	.note-confirm p {
		margin: 0;
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
	.btn-link,
	.btn-danger {
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
	.btn-danger {
		background: var(--fail);
		color: var(--surface);
		border: 1px solid var(--fail);
	}
	.btn-link {
		background: none;
		border: 0;
		color: var(--fail);
		margin-left: auto;
	}
</style>
