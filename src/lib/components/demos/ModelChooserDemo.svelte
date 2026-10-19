<script lang="ts">
	import {
		DEFAULT_STATE,
		LATENCY_LABELS,
		NOISE_MAX,
		NOISE_MIN,
		NOISE_STEP,
		ROW_STEPS,
		type ChooserState,
		describeChoice,
		formatRows,
		normalizeState,
		recommend,
		rowsOf,
	} from '$lib/demos/tabular-vs-neural';

	/** Model chooser for a tabular task. Five answers give a recommendation with the reasons. */
	let { initial }: { initial?: Partial<ChooserState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let st = $state<ChooserState>(normalizeState(initial ?? DEFAULT_STATE));

	const rows = $derived(rowsOf(st.rowIndex));
	const rec = $derived(recommend(st));
	const liveText = $derived(describeChoice(st));

	function reset(): void {
		st = normalizeState(DEFAULT_STATE);
	}

	function toggleRaw(): void {
		st = { ...st, raw: !st.raw };
	}

	function toggleInterpret(): void {
		st = { ...st, interpret: !st.interpret };
	}
</script>

<figure class="mc" id="demo-model-chooser" data-demo="model-chooser">
	<div class="mc-controls">
		<div class="mc-ctl">
			<label class="mc-label" for="mc-rows">Строк в таблице</label>
			<input
				id="mc-rows"
				class="mc-range"
				type="range"
				min="0"
				max={ROW_STEPS.length - 1}
				step="1"
				bind:value={st.rowIndex}
			/>
			<span class="mc-val">{formatRows(rows)}</span>
		</div>

		<div class="mc-ctl">
			<span class="mc-label" id="mc-raw-label">Вход</span>
			<button
				type="button"
				class="mc-seg"
				aria-pressed={st.raw}
				aria-labelledby="mc-raw-label"
				onclick={toggleRaw}>{st.raw ? 'Сырой текст или изображения' : 'Таблица признаков'}</button
			>
		</div>

		<div class="mc-ctl">
			<span class="mc-label" id="mc-interp-label">Решения нужно объяснить</span>
			<button
				type="button"
				class="mc-seg"
				aria-pressed={st.interpret}
				aria-labelledby="mc-interp-label"
				onclick={toggleInterpret}>{st.interpret ? 'Да' : 'Нет'}</button
			>
		</div>

		<div class="mc-ctl">
			<label class="mc-label" for="mc-latency">Задержка ответа</label>
			<input
				id="mc-latency"
				class="mc-range"
				type="range"
				min="0"
				max="2"
				step="1"
				bind:value={st.latency}
				aria-valuetext={LATENCY_LABELS[st.latency]}
			/>
			<span class="mc-val mc-val-wide">{LATENCY_LABELS[st.latency]}</span>
		</div>

		<div class="mc-ctl">
			<label class="mc-label" for="mc-noise">Доля нерелевантных признаков</label>
			<input
				id="mc-noise"
				class="mc-range"
				type="range"
				min={NOISE_MIN}
				max={NOISE_MAX}
				step={NOISE_STEP}
				bind:value={st.noise}
			/>
			<span class="mc-val">{st.noise}%</span>
		</div>
	</div>

	<div class="mc-result" aria-live="polite" data-kind={rec.kind}>
		<p class="mc-sr">{liveText}</p>
		<p class="mc-kicker">Рекомендация</p>
		<h3 class="mc-title">{rec.title}</h3>
		<p class="mc-why-h">Почему</p>
		<ul class="mc-reasons">
			{#each rec.reasons as reason (reason)}
				<li>{reason}</li>
			{/each}
		</ul>
	</div>

	<p class="mc-note">
		Это ориентиры, а не законы. Пороги 10 тысяч строк (статья Nature о TabPFN) и 100 тысяч строк
		(верхняя граница отчёта TabPFN-2.5) задают, где правило меняется. Сравнение на ваших данных
		решает окончательно.
	</p>
	<p class="mc-note">
		Что заметить: при 2 000 строках рекомендация это табличная foundation-модель. При 200 000 тех же
		ответов она сменится на бустинг. Включите «Сырой текст или изображения», и вопрос о таблице
		перестанет быть главным.
	</p>

	<div class="mc-foot">
		<button type="button" class="mc-reset" onclick={reset}>Сбросить</button>
	</div>
</figure>

<style>
	.mc {
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
	}
	.mc :global(*),
	.mc :global(*::before),
	.mc :global(*::after) {
		box-sizing: border-box;
	}
	.mc p,
	.mc ul,
	.mc h3 {
		margin: 0;
	}
	.mc button {
		font: inherit;
	}

	.mc-controls {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.mc-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.mc-label {
		min-width: 13rem;
		color: var(--text-muted);
	}
	.mc-range {
		flex: 1 1 10rem;
		max-width: 16rem;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.mc-val {
		min-width: 6ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.mc-val-wide {
		min-width: 0;
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
	}
	.mc-seg {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.mc-seg[aria-pressed='true'] {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.mc-range:focus-visible,
	.mc-seg:focus-visible,
	.mc-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.mc-result {
		margin-top: var(--space-4);
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--border);
		border-left: 4px solid var(--topic);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.mc-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.mc-kicker,
	.mc-why-h {
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
	.mc-title {
		margin-top: var(--space-1);
		font-size: var(--fs-base);
		font-weight: 600;
		color: var(--text);
	}
	.mc-why-h {
		margin-top: var(--space-3);
	}
	.mc-reasons {
		margin-top: var(--space-2);
		padding-left: var(--space-5);
		display: grid;
		gap: var(--space-2);
	}

	.mc-note {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.mc-foot {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-4);
	}
	.mc-reset {
		height: 32px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}

	@media (prefers-reduced-motion: reduce) {
		.mc * {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.mc {
			padding: var(--space-4);
		}
		.mc-label {
			min-width: 0;
			flex-basis: 100%;
		}
		.mc-range {
			max-width: none;
		}
	}
</style>
