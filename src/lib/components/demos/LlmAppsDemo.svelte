<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		APPROACH_TITLE,
		K_DEFAULT,
		K_MAX,
		K_MIN,
		K_STEP,
		NO_ANSWERS,
		RANKING,
		RELEVANT_TOTAL,
		type ChooserAnswers,
		chooseApproach,
		describeK,
		formatRecall,
		inputTokens,
		recallAtK,
		recallCurve,
		relevantInTopK,
		snapK,
	} from '$lib/demos/llm-apps';

	/** Retrieval recall@k and input size, plus the chooser between prompt, RAG, workflow and agent. Registers itself as demo `llm-apps`. */
	let { initial }: { initial?: { k?: number; answers?: Partial<ChooserAnswers> } } = $props();

	/* The props only seed the initial state: the demo owns it afterwards. */
	/* svelte-ignore state_referenced_locally */
	let k = $state(snapK(initial?.k ?? K_DEFAULT));
	/* svelte-ignore state_referenced_locally */
	let answers = $state<ChooserAnswers>({ ...NO_ANSWERS, ...initial?.answers });

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const found = $derived(relevantInTopK(k));
	const recall = $derived(recallAtK(k));
	const tokens = $derived(inputTokens(k));
	const maxTokens = inputTokens(K_MAX);
	const tokenShare = $derived((tokens / maxTokens) * 100);
	const curve = recallCurve();
	const descK = $derived(describeK(k));
	const choice = $derived(chooseApproach(answers));
	const noAnswers = $derived(
		!answers.externalFacts &&
			!answers.stepsFixed &&
			!answers.modelPicksSteps &&
			!answers.irreversible,
	);

	/** Chart geometry in viewBox units. */
	const CH = { w: 320, h: 130, left: 34, right: 12, top: 10, bottom: 24 };
	function xOf(kk: number): number {
		return CH.left + ((kk - K_MIN) / (K_MAX - K_MIN)) * (CH.w - CH.left - CH.right);
	}
	function yOf(r: number): number {
		return CH.top + (1 - r) * (CH.h - CH.top - CH.bottom);
	}
	const linePoints = curve
		.map((r, i) => `${xOf(i + K_MIN).toFixed(1)},${yOf(r).toFixed(1)}`)
		.join(' ');
	const ticksK = [1, 5, 10, 15, 20];

	const QUESTIONS: { key: keyof ChooserAnswers; label: string }[] = [
		{
			key: 'externalFacts',
			label: 'Ответ опирается на документы или факты вне модели, которые часто меняются',
		},
		{ key: 'stepsFixed', label: 'Порядок шагов известен заранее: извлечь, проверить, ответить' },
		{
			key: 'modelPicksSteps',
			label: 'Модель сама выбирает следующий шаг и инструмент, число шагов заранее неизвестно',
		},
		{ key: 'irreversible', label: 'Ошибка необратима: отправка письма, перевод денег, удаление' },
	];

	function resetK(): void {
		k = K_DEFAULT;
	}
	function resetAnswers(): void {
		answers = { ...NO_ANSWERS };
	}

	onMount(() => {
		return demos?.register('llm-apps', {
			set: (patch) => {
				const p = patch as { k?: number; answers?: Partial<ChooserAnswers> };
				if (typeof p.k === 'number') k = snapK(p.k);
				if (p.answers) answers = { ...answers, ...p.answers };
			},
		});
	});
</script>

<figure
	class="la"
	id="demo-llm-apps"
	data-demo="llm-apps"
	class:hl-q={hl === 'q'}
	class:hl-v={hl === 'v'}
>
	<section class="la-part" aria-labelledby="la-k-title">
		<div class="la-head">
			<h3 id="la-k-title" class="la-title">Число фрагментов k</h3>
			<button type="button" class="la-reset" onclick={resetK} disabled={k === K_DEFAULT}
				>Сбросить k</button
			>
		</div>

		<label class="la-ctl">
			<span class="la-label"><span class="la-sym">k</span> (найденные фрагменты)</span>
			<input
				class="la-range"
				type="range"
				min={K_MIN}
				max={K_MAX}
				step={K_STEP}
				value={k}
				oninput={(e) => (k = snapK(Number(e.currentTarget.value)))}
			/>
			<output class="la-val">{k}</output>
		</label>

		<div class="la-plots">
			<div class="la-panel">
				<p class="la-panel-t">Полнота поиска <span class="la-muted">recall@k</span></p>
				<svg
					class="la-svg"
					viewBox="0 0 {CH.w} {CH.h}"
					role="img"
					aria-labelledby="la-curve-title la-curve-desc"
				>
					<title id="la-curve-title">Полнота поиска по k</title>
					<desc id="la-curve-desc">{descK}</desc>
					<line class="la-axis" x1={CH.left} x2={CH.w - CH.right} y1={yOf(0)} y2={yOf(0)} />
					<line class="la-axis" x1={CH.left} x2={CH.left} y1={CH.top} y2={yOf(0)} />
					<text class="la-tick" x={CH.left - 6} y={yOf(1) + 4} text-anchor="end">1</text>
					<text class="la-tick" x={CH.left - 6} y={yOf(0) + 4} text-anchor="end">0</text>
					{#each ticksK as t (t)}
						<text class="la-tick" x={xOf(t)} y={CH.h - 6} text-anchor="middle">{t}</text>
					{/each}
					<line class="la-cursor" x1={xOf(k)} x2={xOf(k)} y1={CH.top} y2={yOf(0)} />
					<polyline class="la-line" points={linePoints} />
					<circle class="la-dot" cx={xOf(k)} cy={yOf(recall)} r="4" />
				</svg>
				<p class="la-panel-note">Полнота растёт, потом выходит на плато.</p>
			</div>

			<div class="la-panel">
				<p class="la-panel-t">Объём входа <span class="la-muted">токены</span></p>
				<div
					class="la-meter"
					role="img"
					aria-label="Объём входа: {tokens} токенов из {maxTokens} возможных"
				>
					<div class="la-meter-fill" style:width="{tokenShare.toFixed(1)}%"></div>
				</div>
				<p class="la-panel-note">
					k · 300 + 500 = <span class="la-mono">{tokens}</span> токенов
				</p>
			</div>
		</div>

		<div class="la-ranking" aria-label="Порядок фрагментов по релевантности">
			{#each RANKING as rel, i (i)}
				<span
					class="la-slot"
					class:is-rel={rel}
					class:is-in={i < k}
					title="ранг {i + 1}: {rel ? 'релевантный' : 'нерелевантный'}"
					aria-hidden="true"
				></span>
			{/each}
		</div>

		<dl class="la-stats">
			<dt>Найдено релевантных</dt>
			<dd>{found} из {RELEVANT_TOTAL}</dd>
			<dt>recall@{k}</dt>
			<dd>{formatRecall(recall)}</dd>
			<dt>Вход, токенов</dt>
			<dd>{tokens}</dd>
		</dl>

		<p class="la-status" role="status" aria-live="polite">{descK}</p>
	</section>

	<section class="la-part" aria-labelledby="la-choose-title">
		<div class="la-head">
			<h3 id="la-choose-title" class="la-title">Какой подход выбрать</h3>
			<button type="button" class="la-reset" onclick={resetAnswers} disabled={noAnswers}
				>Сбросить выбор</button
			>
		</div>

		<fieldset class="la-questions">
			<legend class="la-legend">Отметьте признаки задачи</legend>
			{#each QUESTIONS as q (q.key)}
				<label class="la-check">
					<input type="checkbox" bind:checked={answers[q.key]} />
					<span>{q.label}</span>
				</label>
			{/each}
		</fieldset>

		<div class="la-result" aria-live="polite">
			<p class="la-result-t">
				Рекомендация: <span class="la-result-name">{APPROACH_TITLE[choice.approach]}</span>
			</p>
			<p class="la-result-reason">{choice.reason}</p>
			{#if choice.warning}
				<p class="la-warn" role="note">{choice.warning}</p>
			{/if}
		</div>
	</section>

	<div class="la-what">
		<p class="la-what-t">Что заметить</p>
		<p>
			Полнота поднимается, пока в выдаче есть релевантные фрагменты, и после последнего из них почти
			не растёт. Объём входа растёт с каждым фрагментом, поэтому выбор k всегда компромисс между
			полнотой и ценой. Простой вариант сначала измеряют на эталонном наборе, и только потом
			переходят к более сложному.
		</p>
	</div>
</figure>

<style>
	.la {
		margin: 0;
		padding: var(--space-6) var(--space-8) var(--space-8);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
		text-align: left;
		letter-spacing: normal;
		text-transform: none;
	}
	.la :global(*),
	.la :global(*::before),
	.la :global(*::after) {
		box-sizing: border-box;
	}
	.la p,
	.la dl,
	.la dd,
	.la dt,
	.la h3 {
		margin: 0;
	}
	.la button {
		font: inherit;
	}
	.la-muted {
		color: var(--text-muted);
	}
	.la-mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.la-sym {
		font-family: var(--font-serif);
		font-size: 16px;
	}

	.la-part {
		padding-bottom: var(--space-6);
		margin-bottom: var(--space-6);
		border-bottom: 1px solid var(--border);
	}
	.la-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}
	.la-title {
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
	}
	.la-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.la-reset:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.la-reset:focus-visible,
	.la-range:focus-visible,
	.la-check input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Slider */
	.la-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.la-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.la-range {
		width: 180px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.la-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Charts */
	.la-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-5);
	}
	.la-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.la-panel-note {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.la-svg {
		display: block;
		width: 100%;
		height: 150px;
		overflow: visible;
	}
	.la-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.la-cursor {
		stroke: var(--text);
		stroke-width: 1;
		stroke-dasharray: 4 3;
		opacity: 0.6;
	}
	.la-line {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2;
		stroke-linejoin: round;
		transition: stroke var(--dur) var(--ease);
	}
	.la-dot {
		fill: var(--topic);
		stroke: var(--surface);
		stroke-width: 2;
	}
	.la-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.la-meter {
		height: 44px;
		margin-top: var(--space-2);
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
	}
	.la-meter-fill {
		height: 100%;
		border-radius: var(--radius-sm);
		background: var(--cat-3);
		transition: width var(--dur) var(--ease);
	}

	/* Ranking strip: one cell per fragment, in rank order */
	.la-ranking {
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		gap: 4px;
		margin-top: var(--space-5);
	}
	.la-slot {
		height: 18px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--surface-2);
		opacity: 0.45;
		transition:
			opacity var(--dur) var(--ease),
			background var(--dur) var(--ease);
	}
	.la-slot.is-in {
		opacity: 1;
	}
	.la-slot.is-rel {
		border-color: var(--topic);
	}
	.la-slot.is-rel.is-in {
		background: var(--topic);
	}

	.la-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-5);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.la-stats dt {
		color: var(--text-muted);
	}
	.la-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.la-status {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}

	/* Chooser */
	.la-questions {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	.la-legend {
		margin-bottom: var(--space-2);
		padding: 0;
		color: var(--text-muted);
	}
	.la-check {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		cursor: pointer;
	}
	.la-check input {
		margin-top: 4px;
		width: 16px;
		height: 16px;
		flex: none;
		accent-color: var(--topic);
	}
	.la-result {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-left: 3px solid var(--topic);
		border-radius: var(--radius);
	}
	.la-result-t {
		color: var(--text-muted);
	}
	.la-result-name {
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 600;
		color: var(--topic);
	}
	.la-result-reason {
		margin-top: var(--space-1);
	}
	.la-warn {
		margin-top: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--warn-bg);
		border-radius: var(--radius-sm);
		color: var(--warn);
	}

	.la-what {
		padding: var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.la-what-t {
		margin-bottom: var(--space-1);
		font-weight: 600;
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.la.hl-q .la-plots {
		opacity: 0.45;
	}
	.la.hl-v .la-part:last-of-type {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
		border-radius: var(--radius);
	}

	@media (prefers-reduced-motion: reduce) {
		.la *,
		.la *::before,
		.la *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.la {
			padding: var(--space-4);
		}
		.la-plots {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 559px) {
		.la-ctl {
			flex-wrap: wrap;
			align-items: stretch;
			flex-direction: column;
			gap: var(--space-2);
		}
		.la-range {
			width: 100%;
			min-width: 0;
		}
		.la-stats {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.la-ranking {
			grid-template-columns: repeat(10, minmax(0, 1fr));
		}
	}
</style>
