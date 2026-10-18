<script lang="ts">
	import { resolve } from '$app/paths';
	import { getChaptersByTopic } from '$lib/content/registry';
	import type { Situation, SituationStatus } from '$lib/contracts/my';
	import { getMyStore } from '$lib/my/store';
	import { my } from '$lib/my/state.svelte';
	import {
		SITUATION_STATUS_LABELS,
		groupSituations,
		situationDraftFromForm,
		validateSituationForm,
		type SituationFormValues,
	} from '$lib/my/situation-group';
	import ClarificationBox from './ClarificationBox.svelte';

	/** "Мои ситуации" of a topic: grouped by existing and wished chapters. */
	interface Props {
		topic: string;
	}

	const { topic }: Props = $props();

	const chapters = $derived(
		getChaptersByTopic(topic).map((c) => ({ id: c.id, title: c.title, href: c.href })),
	);
	const wishes = $derived(my.wishes.filter((w) => w.topic === topic));
	const situations = $derived(my.situations.filter((s) => s.topic === topic));
	const groups = $derived(groupSituations(situations, chapters, wishes));

	/** Situation being edited, or `null`. */
	let editingId = $state<string | null>(null);
	let form = $state<SituationFormValues>({ title: '', situation: '', goal: '' });
	let error = $state('');

	function startEdit(s: Situation) {
		form = { title: s.title, situation: s.situation, goal: s.goal };
		error = '';
		editingId = s.id;
	}

	function stopEdit() {
		editingId = null;
		error = '';
	}

	async function saveEdit(s: Situation, e: SubmitEvent) {
		e.preventDefault();
		const problem = validateSituationForm(form);
		if (problem) {
			error = problem;
			return;
		}
		try {
			const store = await getMyStore();
			const draft = situationDraftFromForm(topic, s.target, form);
			await store.situations.update(s.id, draft);
			stopEdit();
		} catch {
			error = 'Не удалось сохранить. Попробуйте ещё раз.';
		}
	}

	async function setStatus(s: Situation, status: SituationStatus) {
		try {
			const store = await getMyStore();
			await store.situations.update(s.id, { status });
		} catch {
			error = 'Не удалось изменить статус.';
		}
	}

	async function remove(s: Situation) {
		if (!confirm(`Удалить ситуацию «${s.title}»?`)) return;
		try {
			const store = await getMyStore();
			await store.situations.remove(s.id);
		} catch {
			error = 'Не удалось удалить.';
		}
	}
</script>

<section class="board" aria-labelledby="situation-board-title">
	<header>
		<h2 id="situation-board-title">Мои ситуации</h2>
		<p class="hint">
			«У меня такая ситуация, что делать». Сгруппированы по главам; новую ситуацию можно добавить в
			конце любой главы.
		</p>
	</header>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	{#if groups.length === 0}
		<p class="empty">Ситуаций пока нет.</p>
	{/if}

	{#each groups as group (group.key)}
		<div class="group">
			<h3>
				{#if group.kind === 'chapter'}
					{#if chapters.some((c) => c.id === group.id)}
						<a href={resolve(chapters.find((c) => c.id === group.id)?.href as '/')}>{group.title}</a
						>
					{:else}
						{group.title}
					{/if}
				{:else}
					<span class="wish-tag">Желаемая глава</span> {group.title}
				{/if}
			</h3>

			<ul class="list">
				{#each group.situations as s (s.id)}
					<li class="card" data-status={s.status}>
						{#if editingId === s.id}
							<form class="edit" onsubmit={(e) => saveEdit(s, e)}>
								<label class="field">
									<span>Название</span>
									<input type="text" bind:value={form.title} required maxlength="160" />
								</label>
								<label class="field">
									<span>Ситуация</span>
									<textarea bind:value={form.situation} rows="3" required></textarea>
								</label>
								<label class="field">
									<span>Что нужно понять или решить</span>
									<textarea bind:value={form.goal} rows="2"></textarea>
								</label>
								<div class="actions">
									<button type="submit" class="btn-primary">Сохранить</button>
									<button type="button" class="btn-outline" onclick={stopEdit}>Отмена</button>
								</div>
							</form>
						{:else}
							<div class="card-head">
								<h4>{s.title}</h4>
								<span class="badge">{SITUATION_STATUS_LABELS[s.status]}</span>
							</div>
							<p class="text">{s.situation}</p>
							{#if s.goal.trim()}
								<p class="goal"><span>Цель:</span> {s.goal}</p>
							{/if}
							<div class="actions">
								<button
									type="button"
									class="btn-outline"
									onclick={() => setStatus(s, s.status === 'open' ? 'answered' : 'open')}
								>
									{s.status === 'open' ? 'Отметить отвеченной' : 'Вернуть в открытые'}
								</button>
								<button type="button" class="btn-link" onclick={() => startEdit(s)}>Изменить</button
								>
								<button type="button" class="btn-link danger" onclick={() => remove(s)}>
									Удалить
								</button>
							</div>
							<div class="clar">
								<ClarificationBox
									target={{ kind: 'situation', situationId: s.id }}
									{topic}
									label="Уточнения к ситуации"
								/>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</section>

<style>
	.board {
		display: grid;
		gap: var(--space-5, 24px);
		font-size: var(--fs-sm);
		color: var(--text);
	}
	h2 {
		margin: 0;
		font-size: 1.25rem;
	}
	h3 {
		margin: 0 0 var(--space-2);
		font-size: 1rem;
	}
	h3 a {
		color: var(--text);
	}
	h4 {
		margin: 0;
		font-size: 1rem;
	}
	.hint,
	.empty,
	.goal span {
		color: var(--text-muted);
	}
	.hint,
	.empty,
	.goal {
		margin: 0;
	}
	.wish-tag {
		font-size: 12px;
		color: var(--text-muted);
		border: 1px dashed var(--border);
		border-radius: 999px;
		padding: 1px 8px;
		margin-right: var(--space-1);
	}
	.group + .group {
		margin-top: var(--space-4);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 3px solid var(--topic);
		border-radius: var(--radius);
		padding: var(--space-4);
		display: grid;
		gap: var(--space-2);
	}
	.card[data-status='answered'] {
		border-left-color: var(--ok);
	}
	.card-head {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		justify-content: space-between;
	}
	.badge {
		font-size: 12px;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 8px;
	}
	.text,
	.goal {
		margin: 0;
		white-space: pre-line;
	}
	.clar {
		border-top: 1px solid var(--border);
		padding-top: var(--space-3);
	}
	.edit {
		display: grid;
		gap: var(--space-3);
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
	textarea {
		font: inherit;
		color: var(--text);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 6px 8px;
		width: 100%;
	}
	.error {
		margin: 0;
		color: var(--fail);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
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
	h3 a:focus-visible {
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
