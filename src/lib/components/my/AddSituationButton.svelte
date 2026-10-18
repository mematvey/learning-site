<script lang="ts">
	import { getChapter, getChaptersByTopic } from '$lib/content/registry';
	import { getMyStore } from '$lib/my/store';
	import { my } from '$lib/my/state.svelte';
	import {
		situationDraftFromForm,
		validateSituationForm,
		type SituationFormValues,
	} from '$lib/my/situation-group';
	import {
		TARGET_CHOICE_LABELS,
		resolveTarget,
		validateWishForm,
		type TargetChoice,
	} from '$lib/my/wish-draft';
	import ClarificationBox from './ClarificationBox.svelte';

	/** "+ Моя ситуация" at the end of a chapter. The form is bound to this chapter by default. */
	interface Props {
		chapterId: string;
		topic: string;
	}

	const { chapterId, topic }: Props = $props();

	/** The first press in this browser asks for the target; later presses go straight to the form. */
	const PICKED_KEY = 'my-situation-target-picked';

	const chapterTitle = $derived(getChapter(chapterId)?.title ?? chapterId);
	const otherChapters = $derived(getChaptersByTopic(topic).filter((c) => c.id !== chapterId));
	const wishes = $derived(my.wishes.filter((w) => w.topic === topic));

	let open = $state(false);
	/** `'pick'` asks for the target, `'form'` writes the situation. */
	let step = $state<'pick' | 'form'>('form');
	let choice = $state<TargetChoice>('this');
	let otherChapterId = $state('');
	let wishId = $state('');
	let newWishTitle = $state('');
	let form = $state<SituationFormValues>({ title: '', situation: '', goal: '' });
	let error = $state('');
	let saving = $state(false);
	let notice = $state('');

	function hasPicked(): boolean {
		try {
			return localStorage.getItem(PICKED_KEY) === '1';
		} catch {
			return false;
		}
	}

	function rememberPicked() {
		try {
			localStorage.setItem(PICKED_KEY, '1');
		} catch {
			// Storage can be blocked; the picker will simply show again.
		}
	}

	function reset() {
		choice = 'this';
		otherChapterId = '';
		wishId = '';
		newWishTitle = '';
		form = { title: '', situation: '', goal: '' };
		error = '';
	}

	function openPanel() {
		reset();
		notice = '';
		open = true;
		step = hasPicked() ? 'form' : 'pick';
	}

	function close() {
		open = false;
		reset();
	}

	function goToPicker() {
		error = '';
		step = 'pick';
	}

	/** Label of the chosen target, shown in the form header. */
	const targetLabel = $derived.by(() => {
		if (choice === 'this') return chapterTitle;
		if (choice === 'chapter') {
			return otherChapters.find((c) => c.id === otherChapterId)?.title ?? 'другая глава';
		}
		if (wishId) return wishes.find((w) => w.id === wishId)?.title ?? 'желаемая глава';
		return newWishTitle.trim() || 'новая желаемая глава';
	});

	function continueFromPicker(e: SubmitEvent) {
		e.preventDefault();
		if (choice === 'chapter' && !otherChapterId) {
			error = 'Выберите главу.';
			return;
		}
		if (choice === 'wish' && !wishId) {
			const problem = validateWishForm({ title: newWishTitle });
			if (problem) {
				error = problem;
				return;
			}
		}
		error = '';
		rememberPicked();
		step = 'form';
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		const problem = validateSituationForm(form);
		if (problem) {
			error = problem;
			return;
		}
		saving = true;
		error = '';
		try {
			const store = await getMyStore();
			let pickedWishId = wishId;
			if (choice === 'wish' && !pickedWishId) {
				// A wished chapter started from scratch: only its title is known yet.
				const wish = await store.wishes.add({
					topic,
					title: newWishTitle.trim(),
					question: '',
					wantedSections: [],
					wantedTerms: [],
					notes: '',
				});
				pickedWishId = wish.id;
			}
			const target = resolveTarget({ choice, chapterId, otherChapterId, wishId: pickedWishId });
			if (!target) {
				error = 'Не удалось определить, к чему относится ситуация.';
				return;
			}
			await store.situations.add(situationDraftFromForm(topic, target, form));
			notice = 'Ситуация добавлена.';
			close();
		} catch {
			error = 'Не удалось сохранить. Попробуйте ещё раз.';
		} finally {
			saving = false;
		}
	}

	const CHOICES: TargetChoice[] = ['this', 'chapter', 'wish'];
</script>

<div class="add-situation">
	{#if !open}
		<button type="button" class="btn-primary" aria-expanded="false" onclick={openPanel}>
			+ Моя ситуация
		</button>
	{:else if step === 'pick'}
		<form class="panel" onsubmit={continueFromPicker}>
			<fieldset class="choices">
				<legend>К чему относится ситуация?</legend>
				{#each CHOICES as option (option)}
					<label class="choice">
						<input type="radio" name="situation-target" value={option} bind:group={choice} />
						<span>
							{#if option === 'this'}
								{TARGET_CHOICE_LABELS[option]}: {chapterTitle}
							{:else}
								{TARGET_CHOICE_LABELS[option]}
							{/if}
						</span>
					</label>
					{#if option === 'chapter' && choice === 'chapter'}
						<select class="sub" aria-label="Глава темы" bind:value={otherChapterId}>
							<option value="">Выберите главу</option>
							{#each otherChapters as c (c.id)}
								<option value={c.id}>{c.title}</option>
							{/each}
						</select>
					{/if}
					{#if option === 'wish' && choice === 'wish'}
						<select class="sub" aria-label="Желаемая глава" bind:value={wishId}>
							<option value="">Новая желаемая глава</option>
							{#each wishes as w (w.id)}
								<option value={w.id}>{w.title}</option>
							{/each}
						</select>
						{#if !wishId}
							<input
								class="sub"
								type="text"
								aria-label="Название желаемой главы"
								placeholder="Название будущей главы"
								maxlength="160"
								bind:value={newWishTitle}
							/>
						{/if}
					{/if}
				{/each}
			</fieldset>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<div class="actions">
				<button type="submit" class="btn-primary">Далее</button>
				<button type="button" class="btn-outline" onclick={close}>Отмена</button>
			</div>
		</form>
	{:else}
		<form class="panel" onsubmit={save}>
			<p class="target">
				Ситуация для: <strong>{targetLabel}</strong>
				<button type="button" class="btn-link" onclick={goToPicker}>Выбрать другую цель</button>
			</p>
			<label class="field">
				<span>Короткое название</span>
				<input type="text" bind:value={form.title} required maxlength="160" />
			</label>
			<label class="field">
				<span>Моя ситуация</span>
				<textarea bind:value={form.situation} rows="4" required></textarea>
			</label>
			<label class="field">
				<span>Что нужно понять или решить</span>
				<textarea bind:value={form.goal} rows="2"></textarea>
			</label>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<div class="actions">
				<button type="submit" class="btn-primary" disabled={saving}>Сохранить</button>
				<button type="button" class="btn-outline" onclick={close}>Отмена</button>
			</div>
		</form>
	{/if}

	{#if notice && !open}
		<p class="notice" role="status" aria-live="polite">{notice}</p>
	{/if}

	<details class="chapter-clar">
		<summary>Уточнения к главе</summary>
		<ClarificationBox
			target={{ kind: 'chapter', chapter: chapterId }}
			{topic}
			label="Уточнения к главе"
		/>
	</details>
</div>

<style>
	.add-situation {
		margin-top: var(--space-8, 32px);
		display: grid;
		gap: var(--space-3);
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.panel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: var(--space-4);
		display: grid;
		gap: var(--space-3);
	}
	.choices {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	.choices legend {
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: var(--space-1);
		padding: 0;
	}
	.choice {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.sub {
		margin-left: var(--space-6, 24px);
	}
	.target {
		margin: 0;
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.field > span {
		font-size: 12px;
		color: var(--text-muted);
	}
	input[type='text'],
	select,
	textarea {
		font: inherit;
		color: var(--text);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 6px 8px;
		width: calc(100% - var(--space-6, 24px));
	}
	.field textarea,
	.field input {
		width: 100%;
	}
	.error {
		margin: 0;
		color: var(--fail);
	}
	.notice {
		margin: 0;
		color: var(--text-muted);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.chapter-clar {
		border-top: 1px solid var(--border);
		padding-top: var(--space-3);
	}
	.chapter-clar summary {
		cursor: pointer;
		color: var(--text-muted);
		font-size: 12px;
	}
	.chapter-clar summary:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	button {
		font: inherit;
		font-size: var(--fs-sm);
		border-radius: var(--radius-sm);
		padding: 6px 12px;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	button:focus-visible,
	input:focus-visible,
	select:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.btn-primary {
		background: var(--topic);
		color: var(--surface);
		border: 1px solid var(--topic);
		justify-self: start;
	}
	.btn-outline {
		background: none;
		color: var(--text);
		border: 1px solid var(--border);
	}
	.btn-link {
		background: none;
		border: 0;
		color: var(--topic);
		padding: 0 4px;
		margin-left: var(--space-2);
	}
</style>
