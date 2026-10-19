<script lang="ts">
	import {
		COST_MIN,
		DEFAULT_ANSWERS,
		buildPlan,
		formatPercent,
		sanitizeAnswers,
		type DataKind,
		type DataSize,
		type StartTaskAnswers,
		type TaskKind,
		type TimeBudget,
	} from '$lib/demos/start-a-task';

	/** Planner for a new ML task. The props only seed the initial answers; the demo owns them afterwards. */
	let { initial }: { initial?: Partial<StartTaskAnswers> } = $props();

	/* svelte-ignore state_referenced_locally */
	let answers = $state<StartTaskAnswers>(sanitizeAnswers(initial));

	const plan = $derived(buildPlan(answers));
	const isClassification = $derived(answers.task === 'classification');

	const DATA_OPTIONS: { value: DataKind; label: string }[] = [
		{ value: 'tabular', label: 'Таблица' },
		{ value: 'timeseries', label: 'Временной ряд' },
	];
	const TASK_OPTIONS: { value: TaskKind; label: string }[] = [
		{ value: 'classification', label: 'Классификация' },
		{ value: 'regression', label: 'Регрессия' },
	];
	const TIME_OPTIONS: { value: TimeBudget; label: string }[] = [
		{ value: 'days', label: 'Дни' },
		{ value: 'weeks', label: 'Недели' },
		{ value: 'months', label: 'Месяцы' },
	];
	const SIZE_OPTIONS: { value: DataSize; label: string }[] = [
		{ value: 'small', label: 'Мало, до 10 тыс.' },
		{ value: 'medium', label: 'Средне, до миллиона' },
		{ value: 'large', label: 'Много, больше миллиона' },
	];

	const summary = $derived.by(() => {
		const head = isClassification
			? `Порог решения ${formatPercent(plan.threshold ?? 0.5)}`
			: 'Порога нет, оцениваем величину ошибки';
		const cost = plan.asymmetric
			? ' Ошибки разной цены: метрика становится главным решением.'
			: ' Ошибки примерно одной цены: порядок шагов тот же.';
		return `${head}. Шаги: ${plan.steps.map((s) => s.title.toLowerCase()).join(', ')}.${cost}`;
	});

	function setCost(which: 'costFP' | 'costFN', raw: string): void {
		answers = sanitizeAnswers({ ...answers, [which]: Number(raw) });
	}

	function reset(): void {
		answers = sanitizeAnswers(DEFAULT_ANSWERS);
	}
</script>

<figure class="st" data-demo="start-a-task" id="demo-start-a-task">
	<div class="st-questions">
		<div class="st-q">
			<span class="st-qt" id="st-q-data">Какие данные?</span>
			<div class="st-group" role="group" aria-labelledby="st-q-data">
				{#each DATA_OPTIONS as o (o.value)}
					<button
						type="button"
						class="st-seg"
						aria-pressed={answers.data === o.value}
						onclick={() => (answers = { ...answers, data: o.value })}>{o.label}</button
					>
				{/each}
			</div>
		</div>

		<div class="st-q">
			<span class="st-qt" id="st-q-task">Какая задача?</span>
			<div class="st-group" role="group" aria-labelledby="st-q-task">
				{#each TASK_OPTIONS as o (o.value)}
					<button
						type="button"
						class="st-seg"
						aria-pressed={answers.task === o.value}
						onclick={() => (answers = { ...answers, task: o.value })}>{o.label}</button
					>
				{/each}
			</div>
		</div>

		<div class="st-q">
			<span class="st-qt" id="st-q-time">Сколько времени?</span>
			<div class="st-group" role="group" aria-labelledby="st-q-time">
				{#each TIME_OPTIONS as o (o.value)}
					<button
						type="button"
						class="st-seg"
						aria-pressed={answers.time === o.value}
						onclick={() => (answers = { ...answers, time: o.value })}>{o.label}</button
					>
				{/each}
			</div>
		</div>

		<div class="st-q">
			<span class="st-qt" id="st-q-size">Сколько данных?</span>
			<div class="st-group st-group-wrap" role="group" aria-labelledby="st-q-size">
				{#each SIZE_OPTIONS as o (o.value)}
					<button
						type="button"
						class="st-seg"
						aria-pressed={answers.size === o.value}
						onclick={() => (answers = { ...answers, size: o.value })}>{o.label}</button
					>
				{/each}
			</div>
		</div>

		{#if isClassification}
			<div class="st-q">
				<label class="st-ctl" for="st-cost-fn">
					<span class="st-qt">Цена пропуска</span>
					<input
						id="st-cost-fn"
						class="st-range"
						type="range"
						min={COST_MIN}
						max="100"
						step="1"
						value={answers.costFN}
						oninput={(e) => setCost('costFN', e.currentTarget.value)}
					/>
					<output class="st-val" for="st-cost-fn">{answers.costFN}</output>
				</label>
				<label class="st-ctl" for="st-cost-fp">
					<span class="st-qt">Цена ложной тревоги</span>
					<input
						id="st-cost-fp"
						class="st-range"
						type="range"
						min={COST_MIN}
						max="100"
						step="1"
						value={answers.costFP}
						oninput={(e) => setCost('costFP', e.currentTarget.value)}
					/>
					<output class="st-val" for="st-cost-fp">{answers.costFP}</output>
				</label>
			</div>
		{/if}
	</div>

	<div class="st-controls">
		<button type="button" class="st-reset" onclick={reset}>Сбросить ответы</button>
	</div>

	<p class="st-live" aria-live="polite">{summary}</p>

	<ol class="st-steps">
		{#each plan.steps as step, i (step.id)}
			<li class="st-step" class:is-main={step.main} data-step={step.id}>
				<span class="st-num" aria-hidden="true">{i + 1}</span>
				<div class="st-body">
					<p class="st-title">{step.title}</p>
					<p class="st-text">{step.text}</p>
					<p class="st-refs">
						Читать:
						{#each step.refs as ref, j (ref)}{#if j > 0},
							{/if}<code>{ref}</code>{/each}
					</p>
				</div>
			</li>
		{/each}
	</ol>

	{#if isClassification}
		<p class="st-note">
			Порог: p &gt; {answers.costFP} / ({answers.costFP} + {answers.costFN}) = {formatPercent(
				plan.threshold ?? 0,
			)}.
		</p>
	{/if}

	<p class="st-note">
		<strong>Что заметить:</strong> план меняется от ответов. Если ошибки дорогие, метрика и порог становятся
		главным решением, а не выбор модели.
	</p>
</figure>

<style>
	.st {
		margin: 0;
		color: var(--text);
	}
	.st-questions {
		display: grid;
		gap: var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.st-q {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
	}
	.st-qt {
		color: var(--text-muted);
		font-size: var(--fs-sm);
		white-space: nowrap;
	}
	.st-group {
		display: inline-flex;
		flex-wrap: wrap;
		max-width: 100%;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.st-seg {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.st-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.st-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.st-range {
		width: 150px;
		max-width: 100%;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.st-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.st-seg:focus-visible,
	.st-range:focus-visible,
	.st-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.st-controls {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-3);
	}
	.st-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.st-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
	.st-steps {
		display: grid;
		gap: var(--space-3);
		margin: var(--space-4) 0 0;
		padding: 0;
		list-style: none;
	}
	.st-step {
		display: grid;
		grid-template-columns: 32px minmax(0, 1fr);
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.st-step.is-main {
		border-color: var(--topic);
	}
	.st-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--surface-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.st-step.is-main .st-num {
		background: var(--topic);
		color: var(--surface);
	}
	.st-title {
		margin: 0;
		font-weight: 600;
	}
	.st-text,
	.st-refs,
	.st-note {
		margin: var(--space-1) 0 0;
		font-size: var(--fs-sm);
	}
	.st-refs {
		color: var(--text-muted);
	}
	.st-refs code {
		font-family: var(--font-mono);
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.st-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.st-seg {
			transition: none;
		}
	}
</style>
