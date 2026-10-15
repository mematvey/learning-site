<script lang="ts">
	import type { QuizProps } from '../contracts/component-props';

	/** Self-check question with a show-answer toggle. No scoring. */
	let { id, q, kind = 'self', level, children }: QuizProps = $props();

	let open = $state(false);
	const answerId = $derived(`quiz-a-${id}`);
</script>

<div class="quiz" data-quiz={id} data-kind={kind} data-level={level}>
	{#if kind === 'interview'}
		<span class="badge">Собеседование</span>
	{/if}
	<p class="quiz-q">{q}</p>
	<button
		class="quiz-btn"
		type="button"
		aria-expanded={open}
		aria-controls={answerId}
		onclick={() => (open = !open)}>{open ? 'Скрыть ответ' : 'Показать ответ'}</button
	>
	<div class="quiz-a" id={answerId} hidden={!open}>
		{@render children()}
	</div>
</div>

<style>
	.quiz {
		position: relative;
		margin: 0 0 var(--space-4, 16px);
		padding: var(--space-6, 24px);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 12px);
		background: var(--surface);
		box-shadow: var(--shadow);
	}
	.badge {
		position: absolute;
		top: var(--space-4, 16px);
		right: var(--space-4, 16px);
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600;
		color: var(--topic);
		background: var(--topic-soft);
	}
	.quiz-q {
		margin: 0 0 var(--space-4, 16px);
		font-weight: 600;
		padding-right: 8rem;
	}
	.quiz-btn {
		font: inherit;
		font-size: 14px;
		font-weight: 550;
		cursor: pointer;
		background: transparent;
		color: var(--topic);
		border: 1px solid var(--border);
		border-radius: var(--radius, 8px);
		padding: 6px 14px;
	}
	.quiz-btn:hover {
		border-color: var(--topic);
	}
	.quiz-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.quiz-a {
		margin-top: var(--space-4, 16px);
		padding: var(--space-4, 16px);
		background: var(--topic-soft);
		border-radius: var(--radius, 8px);
		font-size: 16px;
	}
	.quiz-a[hidden] {
		display: none;
	}
</style>
