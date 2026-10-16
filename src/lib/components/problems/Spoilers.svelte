<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ProblemDef, ProblemParams, Rational, SolutionStep } from '$lib/prob/types';
	import { formatDecimal, formatFraction } from './format';
	import { tex } from './tex';

	/**
	 * Hint, worked solution, answer and visualization as closed `<details>`. Depth 1 and 2: full solution. Depth 3: plus the alternative method. Opening «Разбор» or «Ответ» reports a reveal.
	 */
	let {
		problem,
		params,
		exact,
		valid,
		depth,
		onReveal,
		extra,
	}: {
		problem: ProblemDef;
		/** Last valid parameters (the card guarantees they pass `validate`). */
		params: ProblemParams;
		exact: Record<string, Rational>;
		valid: boolean;
		depth: number;
		onReveal: (part: 'solution' | 'answer') => void;
		/** Content of the «Визуализация» spoiler (picture and experiment); mounted on first open. */
		extra?: Snippet;
	} = $props();

	const pid = $derived(problem.id);
	const questions = $derived(problem.questions);
	const steps = $derived<Record<string, SolutionStep[]>>(valid ? problem.steps(params) : {});
	const altSteps = $derived<Record<string, SolutionStep[]> | null>(
		valid && problem.altSteps ? problem.altSteps(params) : null,
	);

	function firstFormula(list: SolutionStep[] | undefined): SolutionStep | undefined {
		return list?.find((s) => s.tex);
	}

	let extraOpened = $state(false);

	function reveal(part: 'solution' | 'answer', e: Event): void {
		if ((e.currentTarget as HTMLDetailsElement).open) onReveal(part);
	}
</script>

<div class="sp" data-spoilers>
	<details class="sp-item" data-spoiler="hint">
		<summary>Подсказка</summary>
		<p class="sp-body">{problem.hint}</p>
	</details>

	<details
		class="sp-item"
		id="{pid}-solution"
		data-block
		data-spoiler="solution"
		ontoggle={(e) => reveal('solution', e)}
	>
		<summary>Разбор</summary>
		{#if valid}
			{#each questions as q (q.key)}
				<div class="sp-q">
					<h4 class="sp-q-title">{q.key}) {q.label}</h4>
					<ol class="sp-steps">
						{#each steps[q.key] ?? [] as step, i (i)}
							<li>
								<p>{step.text}</p>
								{#if step.tex}
									<div class="sp-tex" use:tex={step.tex}></div>
								{/if}
							</li>
						{/each}
					</ol>
				</div>
			{/each}

			{#if depth >= 3 && altSteps}
				<div class="sp-alt">
					<h4 class="sp-alt-title">Другой способ</h4>
					{#each questions as q (q.key)}
						<div class="sp-q">
							<h5 class="sp-q-title">{q.key}) {q.label}</h5>
							<ol class="sp-steps">
								{#each altSteps[q.key] ?? [] as step, i (i)}
									<li>
										<p>{step.text}</p>
										{#if step.tex}
											<div class="sp-tex" use:tex={step.tex}></div>
										{/if}
									</li>
								{/each}
							</ol>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<p class="sp-body">Исправьте параметры, чтобы увидеть разбор.</p>
		{/if}
	</details>

	<details
		class="sp-item"
		id="{pid}-answer"
		data-block
		data-spoiler="answer"
		ontoggle={(e) => reveal('answer', e)}
	>
		<summary>Ответ</summary>
		{#if valid}
			{#each questions as q (q.key)}
				{@const r = exact[q.key]}
				<div class="sp-q">
					<p class="sp-body">
						{q.key}) {q.label}:
						{#if r}
							<strong class="sp-frac">{formatFraction(r)}</strong>
							<span class="sp-dec">≈ {formatDecimal(r)}</span>
						{/if}
					</p>
					{#if depth === 1 && firstFormula(steps[q.key])}
						{@const first = firstFormula(steps[q.key])}
						<p class="sp-body">{first?.text}</p>
						<div class="sp-tex" use:tex={first?.tex}></div>
					{/if}
				</div>
			{/each}
		{:else}
			<p class="sp-body">Исправьте параметры, чтобы увидеть ответ.</p>
		{/if}
	</details>

	{#if extra}
		<details
			class="sp-item"
			id="{pid}-viz"
			data-spoiler="viz"
			ontoggle={(e) => {
				if ((e.currentTarget as HTMLDetailsElement).open) extraOpened = true;
			}}
		>
			<summary>Визуализация и эксперимент</summary>
			{#if extraOpened}
				<div class="sp-extra">{@render extra()}</div>
			{/if}
		</details>
	{/if}
</div>

<style>
	.sp {
		display: grid;
		gap: var(--space-2);
		margin-block: var(--space-4);
	}
	.sp-item {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-4);
	}
	.sp-item[open] {
		padding-bottom: var(--space-4);
	}
	.sp-item summary {
		cursor: pointer;
		font-size: var(--fs-sm);
		font-weight: 600;
		color: var(--topic);
		padding: var(--space-1) 0;
	}
	.sp-item summary:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.sp-body {
		margin: var(--space-2) 0;
		font-size: var(--fs-base);
		line-height: 1.6;
	}
	.sp-q {
		margin-top: var(--space-3);
	}
	.sp-q-title,
	.sp-alt-title {
		margin: 0 0 var(--space-1);
		font-family: var(--font-serif);
		font-size: var(--fs-base);
		font-weight: 600;
	}
	.sp-alt {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px dashed var(--border);
	}
	.sp-steps {
		margin: 0;
		padding-left: var(--space-6);
		display: grid;
		gap: var(--space-2);
		font-size: var(--fs-base);
		line-height: 1.6;
	}
	.sp-steps p {
		margin: 0;
	}
	.sp-tex {
		overflow-x: auto;
		max-width: 100%;
		padding-block: var(--space-1);
	}
	.sp-extra {
		display: grid;
		gap: var(--space-4);
		min-width: 0;
		margin-top: var(--space-3);
	}
	.sp-frac {
		font-family: var(--font-mono);
		color: var(--text);
	}
	.sp-dec {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
</style>
