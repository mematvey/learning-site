<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		API_MAX,
		API_MIN,
		API_STEP,
		BATCH_OPTIONS,
		DEFAULTS,
		GPU_MAX,
		GPU_MIN,
		GPU_STEP,
		LOAD_CURVE,
		LOAD_MAX,
		LOAD_MIN,
		LOAD_STEP,
		OUT_TOKENS,
		type LlmServingDemoState,
		breakEvenShare,
		costCurve,
		costPerMillion,
		describeState,
		formatPercent,
		formatPrice,
		latencySeconds,
		logDomain,
		snapApi,
		snapBatch,
		snapGpu,
		snapLoad,
		stepTimeMs,
		tokensPerSecond,
		tokensPerSecondFull,
		ttftSeconds,
		verdict,
	} from '$lib/demos/llm-serving';

	/**
	 * Cost per token and latency from GPU load and batch size. Registers itself as demo `llm-serving`.
	 * All prices are illustrative units (у. е.).
	 */
	let { initial }: { initial?: Partial<LlmServingDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let batch = $state(snapBatch(initial?.batch ?? DEFAULTS.batch));
	/* svelte-ignore state_referenced_locally */
	let load = $state(snapLoad(initial?.load ?? DEFAULTS.load));
	/* svelte-ignore state_referenced_locally */
	let gpuPrice = $state(snapGpu(initial?.gpuPrice ?? DEFAULTS.gpuPrice));
	/* svelte-ignore state_referenced_locally */
	let apiPrice = $state(snapApi(initial?.apiPrice ?? DEFAULTS.apiPrice));
	/** Real widths of the two charts in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wCost = $state(0);
	let wBatch = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const current = $derived<LlmServingDemoState>({ batch, load, gpuPrice, apiPrice });
	const step = $derived(stepTimeMs(batch));
	const full = $derived(tokensPerSecondFull(batch));
	const delivered = $derived(tokensPerSecond(batch, load));
	const selfCost = $derived(costPerMillion(gpuPrice, delivered));
	const share = $derived(breakEvenShare(gpuPrice, full, apiPrice));
	const ttft = $derived(ttftSeconds(load));
	const latency = $derived(latencySeconds(ttft, step, OUT_TOKENS));
	const curve = $derived(costCurve(gpuPrice, batch, LOAD_CURVE));
	const domain = $derived(logDomain([...curve.map((p) => p.cost), apiPrice]));
	const verdictText = $derived(verdict(current));
	const live = $derived(describeState(current));

	/** Chart geometry in px; 320 until the first measurement. */
	const costW = $derived(wCost >= 160 ? wCost : 320);
	const batchW = $derived(wBatch >= 160 ? wBatch : 320);
	const CH = 190;
	const PAD = { l: 48, r: 10, t: 10, b: 28 };

	const costX = (l: number) =>
		PAD.l + ((l - LOAD_MIN) / (LOAD_MAX - LOAD_MIN)) * (costW - PAD.l - PAD.r);
	const costY = (v: number) => {
		const lv = Math.log10(Math.max(v, 1e-9));
		return PAD.t + ((domain.hi - lv) / (domain.hi - domain.lo)) * (CH - PAD.t - PAD.b);
	};
	const costPath = $derived(
		curve
			.map(
				(p, i) => `${i === 0 ? 'M' : 'L'}${costX(p.load).toFixed(1)},${costY(p.cost).toFixed(1)}`,
			)
			.join(' '),
	);
	const costTicks = $derived(
		Array.from({ length: domain.hi - domain.lo + 1 }, (_, i) => domain.lo + i),
	);

	const batchMax = $derived(tokensPerSecondFull(Math.max(...BATCH_OPTIONS)));
	const barSlot = $derived((batchW - PAD.l - PAD.r) / BATCH_OPTIONS.length);
	const batchY = (v: number) => PAD.t + (1 - v / batchMax) * (CH - PAD.t - PAD.b);

	const notice =
		'Цена за токен падает при росте загрузки: GPU меньше простаивает. Рост батча увеличивает выход в секунду, но и время между токенами у каждого пользователя. Точка безубыточности показывает, с какой загрузкой свой GPU начинает стоить меньше API.';

	function apply(patch: Partial<LlmServingDemoState>): void {
		if (typeof patch.batch === 'number') batch = snapBatch(patch.batch);
		if (typeof patch.load === 'number') load = snapLoad(patch.load);
		if (typeof patch.gpuPrice === 'number') gpuPrice = snapGpu(patch.gpuPrice);
		if (typeof patch.apiPrice === 'number') apiPrice = snapApi(patch.apiPrice);
	}

	function reset(): void {
		apply(DEFAULTS);
	}

	onMount(() => {
		return demos?.register('llm-serving', {
			set: (patch) => apply(patch as Partial<LlmServingDemoState>),
		});
	});
</script>

<figure class="ls" id="demo-llm-serving" data-demo="llm-serving">
	<div class="ls-controls">
		<label class="ls-ctl">
			<span class="ls-label">Батч (запросов за шаг)</span>
			<input
				class="ls-range"
				type="range"
				min="0"
				max={BATCH_OPTIONS.length - 1}
				step="1"
				value={BATCH_OPTIONS.indexOf(batch as (typeof BATCH_OPTIONS)[number])}
				oninput={(e) => (batch = snapBatch(BATCH_OPTIONS[Number(e.currentTarget.value)] ?? batch))}
			/>
			<output class="ls-val">{batch}</output>
		</label>

		<label class="ls-ctl">
			<span class="ls-label">Загрузка GPU</span>
			<input
				class="ls-range"
				type="range"
				min={LOAD_MIN}
				max={LOAD_MAX}
				step={LOAD_STEP}
				value={load}
				oninput={(e) => (load = snapLoad(Number(e.currentTarget.value)))}
			/>
			<output class="ls-val">{load}%</output>
		</label>

		<label class="ls-ctl">
			<span class="ls-label">GPU, у. е. в час</span>
			<input
				class="ls-range"
				type="range"
				min={GPU_MIN}
				max={GPU_MAX}
				step={GPU_STEP}
				value={gpuPrice}
				oninput={(e) => (gpuPrice = snapGpu(Number(e.currentTarget.value)))}
			/>
			<output class="ls-val">{formatPrice(gpuPrice)}</output>
		</label>

		<label class="ls-ctl">
			<span class="ls-label">API, у. е. за млн выходных</span>
			<input
				class="ls-range"
				type="range"
				min={API_MIN}
				max={API_MAX}
				step={API_STEP}
				value={apiPrice}
				oninput={(e) => (apiPrice = snapApi(Number(e.currentTarget.value)))}
			/>
			<output class="ls-val">{formatPrice(apiPrice)}</output>
		</label>
	</div>

	<p class="ls-caveat">
		Цены условные: подставьте свои. Считается только GPU, без людей, резерва и простоя.
	</p>

	<div class="ls-plots">
		<div class="ls-panel" bind:clientWidth={wCost}>
			<p class="ls-panel-t">
				Цена миллиона токенов, у. е. <span class="ls-muted">(лог. шкала)</span>
			</p>
			<svg
				class="ls-svg"
				viewBox="0 0 {costW} {CH}"
				role="img"
				aria-labelledby="ls-cost-title ls-cost-desc"
			>
				<title id="ls-cost-title">Цена миллиона токенов на своём GPU по загрузке</title>
				<desc id="ls-cost-desc">{live}</desc>
				{#each costTicks as e (e)}
					<line
						class="ls-grid"
						x1={PAD.l}
						x2={costW - PAD.r}
						y1={costY(10 ** e)}
						y2={costY(10 ** e)}
					/>
					<text class="ls-tick" x={PAD.l - 6} y={costY(10 ** e) + 4} text-anchor="end"
						>{formatPrice(10 ** e)}</text
					>
				{/each}
				<line
					class="ls-api"
					x1={PAD.l}
					x2={costW - PAD.r}
					y1={costY(apiPrice)}
					y2={costY(apiPrice)}
				/>
				<text class="ls-tick ls-api-t" x={costW - PAD.r} y={costY(apiPrice) - 4} text-anchor="end"
					>API</text
				>
				<path class="ls-line" d={costPath} fill="none" />
				<circle class="ls-dot" cx={costX(load)} cy={costY(selfCost)} r="4.5" />
				{#each [LOAD_MIN, 50, LOAD_MAX] as l (l)}
					<text class="ls-tick" x={costX(l)} y={CH - 8} text-anchor="middle">{l}%</text>
				{/each}
			</svg>
		</div>

		<div class="ls-panel" bind:clientWidth={wBatch}>
			<p class="ls-panel-t">Выход GPU при полной загрузке, ток/с</p>
			<svg
				class="ls-svg"
				viewBox="0 0 {batchW} {CH}"
				role="img"
				aria-labelledby="ls-batch-title ls-batch-desc"
			>
				<title id="ls-batch-title">Пропускная способность по размеру батча</title>
				<desc id="ls-batch-desc">
					Батч {batch}: {full.toFixed(0)} токенов в секунду при полной загрузке, время шага {step.toFixed(
						1,
					)} мс.
				</desc>
				<line class="ls-zero" x1={PAD.l} x2={batchW - PAD.r} y1={CH - PAD.b} y2={CH - PAD.b} />
				{#each BATCH_OPTIONS as b, i (b)}
					{@const v = tokensPerSecondFull(b)}
					<rect
						class="ls-bar"
						class:is-sel={b === batch}
						x={PAD.l + i * barSlot + barSlot * 0.15}
						y={batchY(v).toFixed(1)}
						width={(barSlot * 0.7).toFixed(1)}
						height={(CH - PAD.b - batchY(v)).toFixed(1)}
					>
						<title>батч {b}: {v.toFixed(0)} ток/с, шаг {stepTimeMs(b).toFixed(1)} мс</title>
					</rect>
					<text
						class="ls-tick"
						x={(PAD.l + i * barSlot + barSlot / 2).toFixed(1)}
						y={CH - 8}
						text-anchor="middle">{b}</text
					>
				{/each}
			</svg>
		</div>
	</div>

	<dl class="ls-stats">
		<dt>Показатель</dt>
		<dd class="ls-h">значение</dd>
		<dt>TPOT (время на выходной токен)</dt>
		<dd>{step.toFixed(1)} мс</dd>
		<dt>Выход GPU при загрузке {load}%</dt>
		<dd>{delivered.toFixed(0)} ток/с</dd>
		<dt>Свой GPU, цена млн токенов</dt>
		<dd>{formatPrice(selfCost)} у. е.</dd>
		<dt>API, цена млн токенов</dt>
		<dd>{formatPrice(apiPrice)} у. е.</dd>
		<dt>Безубыточность по загрузке</dt>
		<dd>{formatPercent(share)}</dd>
		<dt>TTFT (до первого токена)</dt>
		<dd>{ttft.toFixed(2)} с</dd>
		<dt>Ответ из {OUT_TOKENS} токенов</dt>
		<dd>{latency.toFixed(1)} с</dd>
	</dl>

	<p class="ls-verdict">{verdictText}</p>
	<p class="ls-sr" aria-live="polite">{live}</p>

	<div class="ls-foot">
		<p class="ls-note"><strong>Что заметить.</strong> {notice}</p>
		<button type="button" class="ls-reset" onclick={reset}>Сбросить</button>
	</div>
</figure>

<style>
	.ls {
		position: relative;
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
	.ls :global(*),
	.ls :global(*::before),
	.ls :global(*::after) {
		box-sizing: border-box;
	}
	.ls dl,
	.ls dd,
	.ls dt,
	.ls p {
		margin: 0;
	}
	.ls button {
		font: inherit;
	}
	.ls-muted {
		color: var(--text-muted);
	}

	/* Controls */
	.ls-controls {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ls-ctl {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 150px 4.5ch;
		align-items: center;
		gap: var(--space-3);
	}
	.ls-label {
		color: var(--text-muted);
	}
	.ls-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.ls-val {
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.ls-range:focus-visible,
	.ls-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.ls-caveat {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 12px;
	}

	/* Charts */
	.ls-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-5);
	}
	.ls-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
	}
	.ls-svg {
		display: block;
		width: 100%;
		height: 190px;
		overflow: visible;
	}
	.ls-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.ls-zero {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.ls-line {
		stroke: var(--cat-1);
		stroke-width: 2.5;
	}
	.ls-dot {
		fill: var(--cat-1);
		stroke: var(--surface);
		stroke-width: 2;
	}
	.ls-api {
		stroke: var(--cat-2);
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
	}
	.ls-api-t {
		fill: var(--cat-2);
	}
	.ls-bar {
		fill: var(--cat-5);
		opacity: 0.45;
		transition: opacity var(--dur) var(--ease);
	}
	.ls-bar.is-sel {
		fill: var(--cat-1);
		opacity: 1;
	}
	.ls-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}

	/* Statistics */
	.ls-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-5);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.ls-stats dt {
		color: var(--text-muted);
	}
	.ls-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.ls-stats .ls-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-size: 12px;
	}
	.ls-verdict {
		margin-top: var(--space-4);
		color: var(--text);
		font-weight: 600;
	}
	.ls-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.ls-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.ls-note {
		flex: 1 1 360px;
		color: var(--text-muted);
	}
	.ls-note strong {
		color: var(--text);
	}
	.ls-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.ls-reset:hover {
		border-color: var(--topic);
	}

	@media (max-width: 720px) {
		.ls {
			padding: var(--space-4);
		}
		.ls-controls {
			grid-template-columns: minmax(0, 1fr);
		}
		.ls-plots {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 559px) {
		.ls-ctl {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.ls-range {
			grid-column: 1 / -1;
			grid-row: 2;
			width: 100%;
			min-width: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ls *,
		.ls *::before,
		.ls *::after {
			transition: none !important;
		}
	}
</style>
