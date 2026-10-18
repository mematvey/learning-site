<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		CORPUS,
		MAX_INPUT_LENGTH,
		MAX_MERGES,
		baseAlphabet,
		corpusSymbolCount,
		corpusTokenCount,
		encodeWord,
		tokenColorIndex,
		tokenizeText,
		trainBpe,
		vocabSize,
	} from '$lib/demos/tokenization';

	/** Byte pair encoding demo: merges on the chapter corpus, token counts, and free text. Registers as `tokenization`. */
	let { initial }: { initial?: { merges?: number; text?: string } } = $props();

	/** All merges learned on the corpus; the slider shows the first `merges` of them. */
	const ALL = trainBpe(CORPUS, MAX_MERGES);
	const BASE = baseAlphabet(CORPUS).length;
	const SYMBOLS_TOTAL = corpusSymbolCount(CORPUS);

	const clampMerges = (n: number) => Math.min(MAX_MERGES, Math.max(0, Math.round(n)));

	/* svelte-ignore state_referenced_locally */
	let merges = $state(clampMerges(initial?.merges ?? MAX_MERGES));
	/* svelte-ignore state_referenced_locally */
	let text = $state((initial?.text ?? 'lowest newest').slice(0, MAX_INPUT_LENGTH));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const active = $derived(ALL.slice(0, merges));
	const nextMerge = $derived(merges < ALL.length ? ALL[merges] : null);
	const lastMerge = $derived(merges > 0 ? ALL[merges - 1] : null);
	const vocab = $derived(vocabSize(BASE, merges));
	const corpusTokens = $derived(corpusTokenCount(CORPUS, active));
	const corpusRows = $derived(
		CORPUS.map(({ word, freq }) => ({ word, freq, tokens: encodeWord(word, active) })),
	);
	const own = $derived(tokenizeText(text, active));

	const pairLabel = (l: string, r: string) => `${l} + ${r}`;

	const liveText = $derived(
		lastMerge
			? `Шаг ${merges}: слито ${pairLabel(lastMerge.left, lastMerge.right)} (частота ${lastMerge.count}). ` +
					`В корпусе ${corpusTokens} токенов, словарь ${vocab}.`
			: `Без слияний: каждый символ отдельный токен. В корпусе ${corpusTokens} токенов, словарь ${vocab}.`,
	);

	function apply(patch: { merges?: number; text?: string }): void {
		if (typeof patch.merges === 'number') merges = clampMerges(patch.merges);
		if (typeof patch.text === 'string') text = patch.text.slice(0, MAX_INPUT_LENGTH);
	}

	onMount(() => {
		return demos?.register('tokenization', {
			set: (patch) => apply(patch as { merges?: number; text?: string }),
		});
	});
</script>

<figure class="tk" id="demo-tokenization" data-demo="tokenization">
	<div class="tk-controls">
		<label class="tk-ctl">
			<span class="tk-label">Шагов слияния</span>
			<input
				class="tk-range"
				type="range"
				min="0"
				max={MAX_MERGES}
				step="1"
				value={merges}
				oninput={(e) => (merges = clampMerges(Number(e.currentTarget.value)))}
			/>
			<output class="tk-val">{merges}</output>
		</label>
	</div>

	<p class="tk-live" aria-live="polite">{liveText}</p>

	<section class="tk-section" aria-labelledby="tk-corpus-t">
		<h3 class="tk-title" id="tk-corpus-t">Корпус: токены после {merges} шагов</h3>
		<ul class="tk-words">
			{#each corpusRows as row (row.word)}
				<li class="tk-word">
					<span class="tk-wname">{row.word} <span class="tk-muted">×{row.freq}</span></span>
					<span class="tk-chips" aria-label="токены слова {row.word}: {row.tokens.join(', ')}">
						{#each row.tokens as tok, i (i)}
							<span class="tk-chip tk-c{tokenColorIndex(tok)}">{tok}</span>
						{/each}
					</span>
					<span class="tk-count">{row.tokens.length}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="tk-section" aria-labelledby="tk-steps-t">
		<h3 class="tk-title" id="tk-steps-t">Слияния по шагам</h3>
		<ol class="tk-steps">
			{#each ALL as m, i (i)}
				<li class="tk-step" class:is-done={i < merges} class:is-next={i === merges}>
					<span class="tk-step-n">{i + 1}</span>
					<span class="tk-step-pair">{pairLabel(m.left, m.right)}</span>
					<span class="tk-step-freq"
						>частота {m.count}{m.ties > 0 ? `, ничья с ${m.ties}` : ''}</span
					>
				</li>
			{/each}
		</ol>
	</section>

	<section class="tk-section" aria-labelledby="tk-own-t">
		<h3 class="tk-title" id="tk-own-t">Свой текст</h3>
		<label class="tk-input-wrap">
			<span class="tk-label">Слова через пробел (до {MAX_INPUT_LENGTH} знаков)</span>
			<input
				class="tk-input"
				type="text"
				maxlength={MAX_INPUT_LENGTH}
				bind:value={text}
				autocomplete="off"
				spellcheck="false"
			/>
		</label>
		<p class="tk-muted tk-own-sum">Токенов: {own.total}, знаков: {text.length}</p>
		<ul class="tk-words">
			{#each own.words as w, i (i)}
				<li class="tk-word">
					<span class="tk-wname">{w.word}</span>
					<span class="tk-chips" aria-label="токены слова {w.word}: {w.tokens.join(', ')}">
						{#each w.tokens as tok, j (j)}
							<span class="tk-chip tk-c{tokenColorIndex(tok)}">{tok}</span>
						{/each}
					</span>
					<span class="tk-count">{w.tokens.length}</span>
				</li>
			{:else}
				<li class="tk-muted">Введите хотя бы одно слово.</li>
			{/each}
		</ul>
	</section>

	<dl class="tk-stats">
		<dt>Статистика</dt>
		<dd class="tk-h">сейчас</dd>
		<dd class="tk-h">без слияний</dd>
		<dt>Токенов в корпусе</dt>
		<dd>{corpusTokens}</dd>
		<dd>{SYMBOLS_TOTAL}</dd>
		<dt>Размер словаря</dt>
		<dd>{vocab}</dd>
		<dd>{BASE}</dd>
	</dl>

	<p class="tk-note">
		{#if nextMerge}
			Следующее слияние: {pairLabel(nextMerge.left, nextMerge.right)}, частота {nextMerge.count}.
			Каждое слияние уменьшает число токенов в корпусе на частоту своей пары, а словарь растёт на
			один токен.
		{:else}
			Все пять слияний применены. Каждое слияние уменьшало число токенов на свою частоту, а словарь
			вырос на один токен за шаг.
		{/if}
	</p>
</figure>

<style>
	.tk {
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
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.tk :global(*),
	.tk :global(*::before),
	.tk :global(*::after) {
		box-sizing: border-box;
	}
	.tk dl,
	.tk dd,
	.tk dt,
	.tk p,
	.tk h3,
	.tk ul,
	.tk ol,
	.tk li {
		margin: 0;
		padding: 0;
	}
	.tk ul,
	.tk ol {
		list-style: none;
	}
	.tk-muted {
		color: var(--text-muted);
	}
	.tk-label {
		color: var(--text-muted);
	}

	/* Controls */
	.tk-controls {
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.tk-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.tk-range {
		width: 180px;
		max-width: 100%;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.tk-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.tk-range:focus-visible,
	.tk-input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.tk-live {
		margin-top: var(--space-4);
		font-weight: 600;
	}

	/* Sections */
	.tk-section {
		margin-top: var(--space-6);
		min-width: 0;
	}
	.tk-title {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.tk-words {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.tk-word {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas:
			'name count'
			'chips chips';
		align-items: center;
		gap: var(--space-1) var(--space-3);
		padding: var(--space-2) var(--space-3);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.tk-wname {
		grid-area: name;
		font-family: var(--font-mono);
		font-size: 13px;
		min-width: 0;
	}
	.tk-count {
		grid-area: count;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}
	.tk-chips {
		grid-area: chips;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		min-width: 0;
	}
	.tk-chip {
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text);
		background: var(--surface);
		overflow-wrap: anywhere;
	}
	.tk-c1 {
		background: color-mix(in srgb, var(--cat-1) 22%, var(--surface));
	}
	.tk-c2 {
		background: color-mix(in srgb, var(--cat-2) 22%, var(--surface));
	}
	.tk-c3 {
		background: color-mix(in srgb, var(--cat-3) 22%, var(--surface));
	}
	.tk-c4 {
		background: color-mix(in srgb, var(--cat-4) 22%, var(--surface));
	}
	.tk-c5 {
		background: color-mix(in srgb, var(--cat-5) 22%, var(--surface));
	}
	.tk-c6 {
		background: color-mix(in srgb, var(--cat-6) 22%, var(--surface));
	}

	/* Merge steps */
	.tk-steps {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.tk-step {
		display: grid;
		grid-template-columns: 2ch minmax(0, auto) minmax(0, 1fr);
		align-items: baseline;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: opacity var(--dur) var(--ease);
	}
	.tk-step.is-done {
		color: var(--text);
	}
	.tk-step.is-next {
		outline: 1px dashed var(--topic);
		outline-offset: 0;
	}
	.tk-step-n {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.tk-step-pair {
		font-family: var(--font-mono);
		font-weight: 600;
	}
	.tk-step-freq {
		font-size: 13px;
		min-width: 0;
	}

	/* Own text */
	.tk-input-wrap {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
	}
	.tk-own-sum {
		margin-bottom: var(--space-2);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.tk-input {
		width: 100%;
		min-height: 36px;
		padding: var(--space-2) var(--space-3);
		background: var(--bg);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-mono);
		font-size: 14px;
	}

	/* Statistics */
	.tk-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.tk-stats dt {
		color: var(--text-muted);
	}
	.tk-stats dt:first-child {
		color: var(--text);
		font-weight: 600;
	}
	.tk-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.tk-stats .tk-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-size: 12px;
	}
	.tk-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.tk *,
		.tk *::before,
		.tk *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.tk {
			padding: var(--space-4);
		}
		.tk-stats {
			grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
			font-size: 12px;
		}
		.tk-step {
			grid-template-columns: 2ch minmax(0, 1fr);
		}
		.tk-step-freq {
			grid-column: 2;
		}
	}
</style>
