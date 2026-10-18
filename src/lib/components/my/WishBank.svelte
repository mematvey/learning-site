<script lang="ts">
	import type { Wish, WishStatus } from '$lib/contracts/my';
	import { getMyStore } from '$lib/my/store';
	import { my } from '$lib/my/state.svelte';
	import {
		WISH_STATUS_LABELS,
		buildWishTask,
		validateWishForm,
		wishDraftFromForm,
		wishFileName,
		wishFormFromWish,
		type WishFormValues,
	} from '$lib/my/wish-draft';

	/** "Хочу разобрать": the idea bank of a topic. */
	interface Props {
		topic: string;
	}

	const { topic }: Props = $props();

	const STATUSES: WishStatus[] = ['idea', 'drafting', 'covered'];

	const wishes = $derived(
		my.wishes
			.filter((w) => w.topic === topic)
			.sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0)),
	);

	/** `null` closed, `'new'` creating, or the wish being edited. */
	let editing = $state<Wish | 'new' | null>(null);
	let form = $state<WishFormValues>(wishFormFromWish());
	let error = $state('');
	let notice = $state('');

	function openNew() {
		form = wishFormFromWish();
		error = '';
		editing = 'new';
	}

	function openEdit(wish: Wish) {
		form = wishFormFromWish(wish);
		error = '';
		editing = wish;
	}

	function closeForm() {
		editing = null;
		error = '';
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		const problem = validateWishForm(form);
		if (problem) {
			error = problem;
			return;
		}
		const draft = wishDraftFromForm(topic, form);
		try {
			const store = await getMyStore();
			if (editing && editing !== 'new') {
				await store.wishes.update(editing.id, draft);
			} else {
				await store.wishes.add(draft);
			}
			closeForm();
		} catch {
			error = 'Не удалось сохранить. Попробуйте ещё раз.';
		}
	}

	async function remove(wish: Wish) {
		if (!confirm(`Удалить «${wish.title}» из банка идей?`)) return;
		try {
			const store = await getMyStore();
			await store.wishes.remove(wish.id);
		} catch {
			notice = 'Не удалось удалить.';
		}
	}

	async function copyTask(wish: Wish) {
		const text = buildWishTask(wish);
		try {
			await navigator.clipboard.writeText(text);
			notice = `Задание «${wish.title}» скопировано.`;
		} catch {
			notice = 'Браузер не разрешил копирование.';
		}
	}

	function downloadTask(wish: Wish) {
		const blob = new Blob([buildWishTask(wish)], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = wishFileName(wish.title);
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}
</script>

<section class="wish-bank" aria-labelledby="wish-bank-title">
	<header class="head">
		<div>
			<h2 id="wish-bank-title">Хочу разобрать</h2>
			<p class="hint">Темы будущих глав. Черновик можно передать агенту как задание.</p>
		</div>
		{#if editing === null}
			<button type="button" class="btn-primary" onclick={openNew}>+ Хочу разобрать</button>
		{/if}
	</header>

	{#if editing !== null}
		<form class="wish-form" onsubmit={save}>
			<label class="field">
				<span>Название будущей главы</span>
				<input type="text" bind:value={form.title} required maxlength="160" />
			</label>
			<label class="field">
				<span>Что непонятно или что хочу понять</span>
				<textarea bind:value={form.question} rows="3"></textarea>
			</label>
			<label class="field">
				<span>Желаемые разделы (по одному в строке)</span>
				<textarea bind:value={form.sections} rows="3"></textarea>
			</label>
			<label class="field">
				<span>Желаемые термины (по одному в строке)</span>
				<textarea bind:value={form.terms} rows="2"></textarea>
			</label>
			<label class="field">
				<span>Заметки</span>
				<textarea bind:value={form.notes} rows="2"></textarea>
			</label>
			<label class="field">
				<span>Статус</span>
				<select bind:value={form.status}>
					{#each STATUSES as status (status)}
						<option value={status}>{WISH_STATUS_LABELS[status]}</option>
					{/each}
				</select>
			</label>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<div class="actions">
				<button type="submit" class="btn-primary">Сохранить</button>
				<button type="button" class="btn-outline" onclick={closeForm}>Отмена</button>
			</div>
		</form>
	{/if}

	{#if wishes.length === 0 && editing === null}
		<p class="empty">Пока нет желаемых глав. Добавьте тему, которую хотите разобрать.</p>
	{:else}
		<ul class="list">
			{#each wishes as wish (wish.id)}
				<li class="item">
					<div class="item-head">
						<h3>{wish.title}</h3>
						<span class="badge">{WISH_STATUS_LABELS[wish.status]}</span>
					</div>
					{#if wish.question.trim()}
						<p class="question">{wish.question}</p>
					{/if}
					{#if wish.wantedSections.length > 0 || wish.wantedTerms.length > 0}
						<p class="meta">
							{#if wish.wantedSections.length > 0}
								Разделы: {wish.wantedSections.join(', ')}
							{/if}
							{#if wish.wantedTerms.length > 0}
								{wish.wantedSections.length > 0 ? ' · ' : ''}Термины: {wish.wantedTerms.join(', ')}
							{/if}
						</p>
					{/if}
					<div class="actions">
						<button type="button" class="btn-outline" onclick={() => copyTask(wish)}>
							Скопировать как задание агенту
						</button>
						<button type="button" class="btn-outline" onclick={() => downloadTask(wish)}>
							Скачать .md
						</button>
						<button type="button" class="btn-link" onclick={() => openEdit(wish)}>Изменить</button>
						<button type="button" class="btn-link danger" onclick={() => remove(wish)}>
							Удалить
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	{#if notice}
		<p class="notice" role="status" aria-live="polite">{notice}</p>
	{/if}
</section>

<style>
	.wish-bank {
		display: grid;
		gap: var(--space-4);
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: flex-start;
		justify-content: space-between;
	}
	h2 {
		margin: 0;
		font-size: 1.25rem;
	}
	h3 {
		margin: 0;
		font-size: 1rem;
	}
	.hint,
	.meta,
	.empty {
		margin: 0;
		color: var(--text-muted);
	}
	.wish-form,
	.item {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: var(--space-4);
		display: grid;
		gap: var(--space-3);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}
	.item-head {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		justify-content: space-between;
	}
	.question {
		margin: 0;
		white-space: pre-line;
	}
	.badge {
		font-size: 12px;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 8px;
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.field > span {
		font-size: 12px;
		color: var(--text-muted);
	}
	input,
	textarea,
	select {
		font: inherit;
		color: var(--text);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 6px 8px;
		width: 100%;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.error {
		margin: 0;
		color: var(--fail);
	}
	.notice {
		margin: 0;
		color: var(--text-muted);
	}
	button {
		font: inherit;
		font-size: var(--fs-sm);
		border-radius: var(--radius-sm);
		padding: 6px 12px;
		cursor: pointer;
	}
	button:focus-visible,
	input:focus-visible,
	textarea:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.btn-primary {
		background: var(--topic);
		color: var(--surface);
		border: 1px solid var(--topic);
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
		color: var(--topic);
		padding: 6px 4px;
	}
	.btn-link.danger {
		color: var(--fail);
	}
</style>
