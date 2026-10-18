<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import katex from 'katex';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		BATCHES,
		CONTEXTS,
		DEFAULT_STATE,
		DTYPES,
		H100_MEMORY,
		MODELS,
		type LlmInferenceDemoState,
		describeEstimate,
		estimate,
		findDtype,
		findModel,
		formatBinary,
		formatGB,
		formatMs,
		formatTps,
		snapBatch,
		snapContext,
	} from '$lib/demos/llm-inference';

	/** KV-cache and decode-bound calculator. Registers itself as demo `llm-inference`. */
	let { initial }: { initial?: Partial<LlmInferenceDemoState> } = $props();

	const TEX_MEM =
		'M_{\\mathrm{KV}} = 2 \\cdot L \\cdot n_{kv} \\cdot d_h \\cdot b \\cdot T \\cdot B';
	const TEX_SPEED = '\\text{tokens/s} \\le \\dfrac{B}{(P \\cdot b + M_{\\mathrm{KV}}) / \\beta}';

	/* The props only seed the initial state: the demo owns it afterwards. */
	/* svelte-ignore state_referenced_locally */
	let model = $state(findModel(initial?.model ?? DEFAULT_STATE.model).id);
	/* svelte-ignore state_referenced_locally */
	let dtype = $state(findDtype(initial?.dtype ?? DEFAULT_STATE.dtype).id);
	/* svelte-ignore state_referenced_locally */
	let context = $state(snapContext(initial?.context ?? DEFAULT_STATE.context));
	/* svelte-ignore state_referenced_locally */
	let batch = $state(snapBatch(initial?.batch ?? DEFAULT_STATE.batch));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const current = $derived<LlmInferenceDemoState>({ model, dtype, context, batch });
	const e = $derived(estimate(current));
	const dtypeCfg = $derived(findDtype(dtype));
	const live = $derived(describeEstimate(current, e));
	const kvShare = $derived(e.perStep > 0 ? (e.kvCache / e.perStep) * 100 : 0);
	const weightsShare = $derived(100 - kvShare);
	const isDefault = $derived(
		model === DEFAULT_STATE.model &&
			dtype === DEFAULT_STATE.dtype &&
			context === DEFAULT_STATE.context &&
			batch === DEFAULT_STATE.batch,
	);

	function apply(patch: Partial<LlmInferenceDemoState>): void {
		if (patch.model !== undefined) model = findModel(patch.model).id;
		if (patch.dtype !== undefined) dtype = findDtype(patch.dtype).id;
		if (typeof patch.context === 'number') context = snapContext(patch.context);
		if (typeof patch.batch === 'number') batch = snapBatch(patch.batch);
	}

	function reset(): void {
		apply(DEFAULT_STATE);
	}

	/** Renders a KaTeX formula into the node; without a successful render the fallback text stays. */
	function tex(node: HTMLElement, formula: string) {
		const render = (f: string) => {
			try {
				katex.render(f, node, { strict: 'ignore', throwOnError: false });
			} catch {
				/* keep fallback text */
			}
		};
		render(formula);
		return {
			update(f: string) {
				render(f);
			},
		};
	}

	onMount(() => {
		return demos?.register('llm-inference', {
			set: (patch) => apply(patch as Partial<LlmInferenceDemoState>),
		});
	});
</script>

<figure class="lli" id="demo-llm-inference" data-demo="llm-inference">
	<div class="lli-controls">
		<label class="lli-field">
			<span class="lli-label">Модель</span>
			<select class="lli-select" bind:value={model}>
				{#each MODELS as m (m.id)}
					<option value={m.id}>{m.title}</option>
				{/each}
			</select>
		</label>

		<label class="lli-field">
			<span class="lli-label">Формат</span>
			<select class="lli-select" bind:value={dtype}>
				{#each DTYPES as d (d.id)}
					<option value={d.id}>{d.title}</option>
				{/each}
			</select>
		</label>

		<label class="lli-field lli-range-field">
			<span class="lli-label">Контекст <span class="lli-sym">T</span></span>
			<input
				class="lli-range"
				type="range"
				min="0"
				max={CONTEXTS.length - 1}
				step="1"
				value={CONTEXTS.indexOf(context)}
				oninput={(ev) => (context = CONTEXTS[Number(ev.currentTarget.value)] ?? context)}
				aria-valuetext="{context} токенов"
			/>
			<output class="lli-val">{context}</output>
		</label>

		<label class="lli-field lli-range-field">
			<span class="lli-label">Батч <span class="lli-sym">B</span></span>
			<input
				class="lli-range"
				type="range"
				min="0"
				max={BATCHES.length - 1}
				step="1"
				value={BATCHES.indexOf(batch)}
				oninput={(ev) => (batch = BATCHES[Number(ev.currentTarget.value)] ?? batch)}
				aria-valuetext="{batch} запросов"
			/>
			<output class="lli-val">{batch}</output>
		</label>
	</div>

	<div class="lli-formulas">
		<div
			class="lli-formula"
			use:tex={TEX_MEM}
			role="img"
			aria-label="Память KV-кэша: два умножить на L, n_kv, d_h, b, T и B"
		>
			M<sub>KV</sub> = 2 · L · n<sub>kv</sub> · d<sub>h</sub> · b · T · B
		</div>
		<div
			class="lli-formula"
			use:tex={TEX_SPEED}
			role="img"
			aria-label="Предел токенов в секунду: B делить на время шага, которое равно весам плюс KV-кэшу, делённым на пропускную способность"
		>
			tokens/s ≤ B / ((P · b + M<sub>KV</sub>) / β)
		</div>
	</div>

	<dl class="lli-stats">
		<div class="lli-row">
			<dt>KV-кэш на один токен</dt>
			<dd>{formatBinary(e.kvPerToken)}</dd>
		</div>
		<div class="lli-row lli-row-main">
			<dt>KV-кэш при T = {context} и B = {batch}</dt>
			<dd>{formatBinary(e.kvCache)}</dd>
		</div>
		<div class="lli-row">
			<dt>Веса модели, {dtypeCfg.title.split(' (')[0]}</dt>
			<dd>{formatGB(e.weights)}</dd>
		</div>
		<div class="lli-row">
			<dt>Читается за один шаг декодирования</dt>
			<dd>{formatGB(e.perStep)}</dd>
		</div>
		<div class="lli-row">
			<dt>Нижняя граница времени шага</dt>
			<dd>{formatMs(e.stepSeconds)}</dd>
		</div>
		<div class="lli-row lli-row-main">
			<dt>Предел скорости, весь батч (H100, 3.35 TB/s)</dt>
			<dd>≤ {formatTps(e.tokensPerSecond)} ток/с</dd>
		</div>
		<div class="lli-row">
			<dt>Предел на один запрос</dt>
			<dd>≤ {formatTps(e.tokensPerSecondPerRequest)} ток/с</dd>
		</div>
	</dl>

	<div class="lli-bar-wrap">
		<p class="lli-bar-t">
			Что читается за шаг: веса {weightsShare.toFixed(0)}%, KV-кэш {kvShare.toFixed(0)}%
		</p>
		<div
			class="lli-bar"
			role="img"
			aria-label="Доля весов {weightsShare.toFixed(0)}% и KV-кэша {kvShare.toFixed(
				0,
			)}% в чтении за шаг"
		>
			<span class="lli-seg lli-seg-w" style="width: {weightsShare.toFixed(2)}%"></span>
			<span class="lli-seg lli-seg-kv" style="width: {kvShare.toFixed(2)}%"></span>
		</div>
		<p class="lli-legend">
			<span class="lli-sw lli-sw-w" aria-hidden="true"></span> веса
			<span class="lli-sw lli-sw-kv" aria-hidden="true"></span> KV-кэш
		</p>
	</div>

	<p class="lli-fit" class:is-over={!e.fits}>
		{#if e.fits}
			Веса и KV-кэш помещаются в {H100_MEMORY / 1e9} GB памяти H100.
		{:else}
			Веса и KV-кэш не помещаются в {H100_MEMORY / 1e9} GB памяти H100: нужны квантизация, несколько GPU
			или меньший контекст и батч.
		{/if}
	</p>

	<p class="lli-live" aria-live="polite">{live}</p>

	<div class="lli-foot">
		<p class="lli-note">
			Предел посчитан по пропускной способности памяти: вычисления и накладные расходы не учтены.
			Реальная скорость ниже. 1 GiB = 2³⁰ байт, GB = 10⁹ байт.
		</p>
		<button type="button" class="lli-reset" onclick={reset} disabled={isDefault}>Сбросить</button>
	</div>
</figure>

<style>
	.lli {
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
	.lli :global(*),
	.lli :global(*::before),
	.lli :global(*::after) {
		box-sizing: border-box;
	}
	.lli dl,
	.lli dd,
	.lli dt,
	.lli p {
		margin: 0;
	}
	.lli button {
		font: inherit;
	}

	/* Controls */
	.lli-controls {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.lli-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.lli-label {
		color: var(--text-muted);
	}
	.lli-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}
	.lli-select {
		height: 36px;
		padding: 0 var(--space-3);
		background: var(--surface-2);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font: inherit;
		cursor: pointer;
	}
	.lli-select:focus-visible,
	.lli-range:focus-visible,
	.lli-reset:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.lli-range-field {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
	}
	.lli-range-field .lli-label {
		flex: 1 1 100%;
	}
	.lli-range {
		flex: 1 1 auto;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.lli-val {
		min-width: 6ch;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Formulas */
	.lli-formulas {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-4);
		font-size: var(--fs-base);
		color: var(--text);
	}
	.lli-formula {
		overflow-wrap: anywhere;
	}

	/* Results */
	.lli-stats {
		display: grid;
		gap: var(--space-1) 0;
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.lli-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-4);
		padding: var(--space-1) 0;
	}
	.lli-row dt {
		color: var(--text-muted);
	}
	.lli-row dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.lli-row-main dt {
		color: var(--text);
		font-weight: 600;
	}
	.lli-row-main dd {
		color: var(--topic);
		font-weight: 600;
	}

	/* Bar: share of weights and cache in the bytes read per step */
	.lli-bar-wrap {
		margin-top: var(--space-4);
	}
	.lli-bar-t {
		margin-bottom: var(--space-2);
		color: var(--text-muted);
	}
	.lli-bar {
		display: flex;
		height: 14px;
		overflow: hidden;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.lli-seg {
		display: block;
		height: 100%;
		transition: width var(--dur) var(--ease);
	}
	.lli-seg-w {
		background: var(--cat-1);
	}
	.lli-seg-kv {
		background: var(--cat-2);
	}
	.lli-legend {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.lli-sw {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		margin-left: var(--space-2);
	}
	.lli-sw-w {
		background: var(--cat-1);
	}
	.lli-sw-kv {
		background: var(--cat-2);
	}

	.lli-fit {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.lli-fit.is-over {
		color: var(--warn);
		font-weight: 600;
	}

	.lli-live {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}

	.lli-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.lli-note {
		flex: 1 1 320px;
		color: var(--text-muted);
		font-size: 12px;
	}
	.lli-reset {
		height: 36px;
		padding: 0 var(--space-4);
		background: none;
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		transition: border-color var(--dur) var(--ease);
	}
	.lli-reset:hover:not(:disabled) {
		border-color: var(--topic);
	}
	.lli-reset:disabled {
		opacity: 0.5;
		cursor: default;
	}

	@media (prefers-reduced-motion: reduce) {
		.lli *,
		.lli *::before,
		.lli *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.lli {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.lli-formulas {
			font-size: 14px;
		}
		.lli-controls {
			grid-template-columns: minmax(0, 1fr);
		}
		.lli-row {
			flex-direction: column;
			gap: 0;
		}
		.lli-row dd {
			text-align: left;
		}
	}
</style>
