<script lang="ts">
	import type { Clarification } from '$lib/contracts/my';
	import { getMyStore } from '$lib/my/store';
	import { my } from '$lib/my/state.svelte';
	import { clarificationsFor } from '$lib/my/situation-group';

	/** Short clarifications to a chapter, a wished chapter or a situation. */
	interface Props {
		target: Clarification['target'];
		topic: string;
		/** Accessible name of the list, e.g. "Уточнения к главе". */
		label?: string;
	}

	const { target, topic, label = 'Уточнения' }: Props = $props();

	const TEXT_MAX = 280;

	const items = $derived(clarificationsFor(my.clarifications, target));

	/** Short, id-safe suffix for the input id. */
	function targetSlug(t: Clarification['target']): string {
		if (t.kind === 'chapter') return t.chapter.replace(/[^a-z0-9]+/g, '-');
		if (t.kind === 'wish') return t.wishId.toLowerCase();
		return t.situationId.toLowerCase();
	}
	const inputId = $derived(`clar-${target.kind}-${targetSlug(target)}`);

	let text = $state('');
	let error = $state('');

	async function add(e: SubmitEvent) {
		e.preventDefault();
		const value = text.trim();
		if (!value) {
			error = 'Напишите уточнение.';
			return;
		}
		if (value.length > TEXT_MAX) {
			error = `Не длиннее ${TEXT_MAX} символов.`;
			return;
		}
		try {
			const store = await getMyStore();
			await store.clarifications.add({ topic, target, text: value });
			text = '';
			error = '';
		} catch {
			error = 'Не удалось сохранить. Попробуйте ещё раз.';
		}
	}

	async function remove(item: Clarification) {
		if (!confirm('Удалить уточнение?')) return;
		try {
			const store = await getMyStore();
			await store.clarifications.remove(item.id);
		} catch {
			error = 'Не удалось удалить.';
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			(e.currentTarget as HTMLElement).closest('form')?.requestSubmit();
		}
	}
</script>

<div class="clarifications">
	<h4>{label}</h4>
	{#if items.length > 0}
		<ul class="list" aria-label={label}>
			{#each items as item (item.id)}
				<li>
					<p>{item.text}</p>
					<button
						type="button"
						class="btn-link danger"
						aria-label="Удалить уточнение"
						onclick={() => remove(item)}>Удалить</button
					>
				</li>
			{/each}
		</ul>
	{/if}
	<form class="add" onsubmit={add}>
		<label class="sr-only" for={inputId}>Новое уточнение</label>
		<textarea
			id={inputId}
			rows="2"
			maxlength={TEXT_MAX}
			placeholder="Короткое уточнение"
			bind:value={text}
			onkeydown={onKeydown}></textarea>
		<div class="row">
			<span class="count">{text.length}/{TEXT_MAX}</span>
			<button type="submit" class="btn-outline">Добавить уточнение</button>
		</div>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
	</form>
</div>

<style>
	.clarifications {
		display: grid;
		gap: var(--space-2);
		font-size: var(--fs-sm);
		color: var(--text);
	}
	h4 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	.list li {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		justify-content: space-between;
	}
	.list p {
		margin: 0;
	}
	.add {
		display: grid;
		gap: var(--space-1);
	}
	textarea {
		font: inherit;
		color: var(--text);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 6px 8px;
		width: 100%;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
	}
	.count,
	.error {
		font-size: 12px;
		color: var(--text-muted);
		margin: 0;
	}
	.error {
		color: var(--fail);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	button {
		font: inherit;
		font-size: var(--fs-sm);
		border-radius: var(--radius-sm);
		padding: 4px 10px;
		cursor: pointer;
	}
	button:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.btn-outline {
		background: none;
		color: var(--text);
		border: 1px solid var(--border-control);
	}
	.btn-link {
		background: none;
		border: 0;
		color: var(--text-muted);
		padding: 2px 4px;
		flex-shrink: 0;
	}
	.btn-link.danger:hover {
		color: var(--fail);
	}
</style>
