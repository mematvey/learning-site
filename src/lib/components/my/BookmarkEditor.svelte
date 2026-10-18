<script lang="ts">
	import { untrack } from 'svelte';
	import type { BookmarkDraft } from '$lib/contracts/my';
	import { COMMENT_MAX, KIND_LABEL } from '$lib/my/bookmark-draft';

	interface Props {
		/** What is bookmarked. `draft.comment` is the initial text of the comment. */
		draft: BookmarkDraft;
		onSave: (comment: string) => void;
		onCancel: () => void;
		/** Shown only for an existing bookmark. */
		onDelete?: () => void;
	}

	const { draft, onSave, onCancel, onDelete }: Props = $props();

	const initial = untrack(() => draft.comment);
	let comment = $state(untrack(() => draft.comment));
	let textarea: HTMLTextAreaElement | undefined = $state();

	const dirty = $derived(comment !== initial);
	const quoteShown = $derived(
		draft.quote ? (draft.quote.length > 160 ? `${draft.quote.slice(0, 160)}…` : draft.quote) : '',
	);

	$effect(() => {
		textarea?.focus();
	});

	function save() {
		onSave(comment.slice(0, COMMENT_MAX));
	}

	function cancel() {
		if (dirty && !window.confirm('Закрыть без сохранения? Комментарий будет потерян.')) return;
		onCancel();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			cancel();
		} else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			save();
		}
	}

	function remove() {
		if (onDelete && window.confirm('Удалить закладку?')) onDelete();
	}
</script>

<!-- Keyboard: Ctrl+Enter saves, Esc closes (asks first when the comment is changed). -->
<form
	class="bm-editor"
	aria-label="Закладка"
	onsubmit={(e) => {
		e.preventDefault();
		save();
	}}
>
	<p class="bm-kind">{KIND_LABEL[draft.kind]}{draft.termId ? `: ${draft.termId}` : ''}</p>
	{#if quoteShown}
		<p class="bm-quote">«{quoteShown}»</p>
	{/if}
	<label class="bm-field">
		<span>Комментарий</span>
		<textarea
			bind:this={textarea}
			bind:value={comment}
			rows="3"
			maxlength={COMMENT_MAX}
			aria-describedby="bm-count"
			onkeydown={onKeydown}></textarea>
	</label>
	<p id="bm-count" class="bm-count">{comment.length}/{COMMENT_MAX}</p>
	<div class="bm-actions">
		<button type="submit" class="bm-btn bm-primary">Сохранить</button>
		<button type="button" class="bm-btn bm-outline" onclick={cancel}>Отмена</button>
		{#if onDelete}
			<button type="button" class="bm-btn bm-link" onclick={remove}>Удалить</button>
		{/if}
	</div>
</form>

<style>
	.bm-editor {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: var(--space-4);
		font-size: var(--fs-sm);
		display: grid;
		gap: var(--space-2);
		width: 280px;
		max-width: 100%;
	}
	.bm-kind {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--bookmark);
	}
	.bm-quote {
		margin: 0;
		font-style: italic;
		color: var(--text-muted);
	}
	.bm-field {
		display: grid;
		gap: var(--space-1);
	}
	.bm-field > span {
		font-size: 12px;
		color: var(--text-muted);
	}
	textarea {
		font: inherit;
		color: var(--text);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 6px 8px;
		width: 100%;
		resize: vertical;
	}
	.bm-count {
		margin: 0;
		font-size: 12px;
		color: var(--text-muted);
		text-align: right;
	}
	.bm-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.bm-btn {
		font: inherit;
		font-size: var(--fs-sm);
		border-radius: var(--radius-sm);
		padding: 6px 12px;
		cursor: pointer;
	}
	.bm-primary {
		background: var(--bookmark);
		color: var(--surface);
		border: 1px solid var(--bookmark);
	}
	.bm-outline {
		background: none;
		color: var(--text);
		border: 1px solid var(--border);
	}
	.bm-link {
		background: none;
		border: 0;
		color: var(--fail);
		margin-left: auto;
	}
	.bm-btn:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	@media (max-width: 640px) {
		.bm-editor {
			width: 100%;
		}
	}
</style>
