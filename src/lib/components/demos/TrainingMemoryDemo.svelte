<script lang="ts">
	import {
		BATCH_MAX,
		BATCH_MIN,
		CARD_COUNTS,
		CARD_GB_OPTIONS,
		DEFAULT_STATE,
		LAYERS_MAX,
		LAYERS_MIN,
		PARAMS_MAX,
		PARAMS_MIN,
		SEQ_OPTIONS,
		SHARD_LABELS,
		WIDTH_MAX,
		WIDTH_MIN,
		WIDTH_STEP,
		budget,
		explain,
		formatGb,
		sanitize,
		snapInt,
		snapStep,
		verdict,
		type ShardStage,
		type TrainingMemoryDemoState,
	} from '$lib/demos/training-memory';

	/** Memory calculator for one training step: weights, gradients, optimizer state, activations per card. */
	let { initial }: { initial?: Partial<TrainingMemoryDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let st = $state<TrainingMemoryDemoState>(sanitize(initial ?? {}));

	const b = $derived(budget(st));
	const seqIndex = $derived(SEQ_OPTIONS.indexOf(st.seqLen));
	const cardIndex = $derived(CARD_COUNTS.indexOf(st.cards));
	const causes = $derived(explain(st, b));
	const result = $derived(verdict(b));
	const shardOn = $derived(st.shard !== 0);

	/** Stacked parts from the bottom up, heights in percent of the chart scale. */
	const segments = $derived.by(() => {
		const defs = [
			{ key: 'weights', label: 'Веса', gb: b.weights, cls: 'tm-w' },
			{ key: 'grads', label: 'Градиенты', gb: b.grads, cls: 'tm-g' },
			{ key: 'optimizer', label: 'Оптимизатор', gb: b.optimizer, cls: 'tm-o' },
			{ key: 'activations', label: 'Активации', gb: b.activations, cls: 'tm-a' },
		];
		let acc = 0;
		return defs.map((d) => {
			const bottom = (acc / b.scaleMax) * 100;
			acc += d.gb;
			return { ...d, bottom, height: (d.gb / b.scaleMax) * 100 };
		});
	});
	const limitBottom = $derived((b.cardGb / b.scaleMax) * 100);

	function setSeq(i: number): void {
		st.seqLen = SEQ_OPTIONS[Math.min(SEQ_OPTIONS.length - 1, Math.max(0, i))] ?? st.seqLen;
	}

	function setCards(i: number): void {
		st.cards = CARD_COUNTS[Math.min(CARD_COUNTS.length - 1, Math.max(0, i))] ?? st.cards;
	}

	function setShard(v: number): void {
		if (v === 0 || v === 1 || v === 2 || v === 3) st.shard = v as ShardStage;
	}

	function reset(): void {
		Object.assign(st, DEFAULT_STATE);
	}
</script>

<figure class="tm" id="demo-training-memory" data-demo="training-memory">
	<div class="tm-controls">
		<label class="tm-ctl">
			<span class="tm-label">Параметры P, млрд</span>
			<input
				class="tm-range"
				type="range"
				min={PARAMS_MIN}
				max={PARAMS_MAX}
				step="1"
				value={st.params}
				oninput={(e) =>
					(st.params = snapInt(Number(e.currentTarget.value), PARAMS_MIN, PARAMS_MAX))}
			/>
			<output class="tm-val">{st.params}</output>
		</label>

		<label class="tm-ctl">
			<span class="tm-label">Слои L</span>
			<input
				class="tm-range"
				type="range"
				min={LAYERS_MIN}
				max={LAYERS_MAX}
				step="1"
				value={st.layers}
				oninput={(e) =>
					(st.layers = snapInt(Number(e.currentTarget.value), LAYERS_MIN, LAYERS_MAX))}
			/>
			<output class="tm-val">{st.layers}</output>
		</label>

		<label class="tm-ctl">
			<span class="tm-label">Ширина h</span>
			<input
				class="tm-range"
				type="range"
				min={WIDTH_MIN}
				max={WIDTH_MAX}
				step={WIDTH_STEP}
				value={st.width}
				oninput={(e) =>
					(st.width = snapStep(Number(e.currentTarget.value), WIDTH_MIN, WIDTH_MAX, WIDTH_STEP))}
			/>
			<output class="tm-val">{st.width}</output>
		</label>

		<label class="tm-ctl">
			<span class="tm-label">Длина s, токенов</span>
			<input
				class="tm-range"
				type="range"
				min="0"
				max={SEQ_OPTIONS.length - 1}
				step="1"
				value={seqIndex}
				oninput={(e) => setSeq(Number(e.currentTarget.value))}
			/>
			<output class="tm-val">{st.seqLen}</output>
		</label>

		<label class="tm-ctl">
			<span class="tm-label">Батч b, на карту</span>
			<input
				class="tm-range"
				type="range"
				min={BATCH_MIN}
				max={BATCH_MAX}
				step="1"
				value={st.batch}
				oninput={(e) => (st.batch = snapInt(Number(e.currentTarget.value), BATCH_MIN, BATCH_MAX))}
			/>
			<output class="tm-val">{st.batch}</output>
		</label>

		<label class="tm-ctl" class:is-disabled={!shardOn}>
			<span class="tm-label">Карты N (при шардировании)</span>
			<input
				class="tm-range"
				type="range"
				min="0"
				max={CARD_COUNTS.length - 1}
				step="1"
				value={cardIndex}
				disabled={!shardOn}
				oninput={(e) => setCards(Number(e.currentTarget.value))}
			/>
			<output class="tm-val">{st.cards}</output>
		</label>

		<div class="tm-ctl tm-ctl-wide">
			<span class="tm-label" id="tm-shard-label">Шардирование состояний</span>
			<div class="tm-group" role="group" aria-labelledby="tm-shard-label">
				{#each SHARD_LABELS as label, i (i)}
					<button
						type="button"
						class="tm-seg"
						aria-pressed={st.shard === i}
						onclick={() => setShard(i)}>{label}</button
					>
				{/each}
			</div>
		</div>

		<div class="tm-ctl">
			<span class="tm-label" id="tm-ckpt-label">Пересчёт активаций</span>
			<div class="tm-group" role="group" aria-labelledby="tm-ckpt-label">
				<button
					type="button"
					class="tm-seg"
					aria-pressed={!st.checkpoint}
					onclick={() => (st.checkpoint = false)}>Выкл</button
				>
				<button
					type="button"
					class="tm-seg"
					aria-pressed={st.checkpoint}
					onclick={() => (st.checkpoint = true)}>Вкл</button
				>
			</div>
		</div>

		<div class="tm-ctl">
			<span class="tm-label" id="tm-card-label">Память карты</span>
			<div class="tm-group" role="group" aria-labelledby="tm-card-label">
				{#each CARD_GB_OPTIONS as gb (gb)}
					<button
						type="button"
						class="tm-seg"
						aria-pressed={st.cardGb === gb}
						onclick={() => (st.cardGb = gb)}>{gb} ГБ</button
					>
				{/each}
			</div>
		</div>
	</div>

	<div class="tm-body">
		<div class="tm-chart" class:is-oom={!b.fits} aria-hidden="true">
			{#each segments as s (s.key)}
				<div
					class="tm-seg-bar {s.cls}"
					style="bottom: {s.bottom.toFixed(2)}%; height: {s.height.toFixed(2)}%"
				></div>
			{/each}
			<div class="tm-limit" style="bottom: {limitBottom.toFixed(2)}%"></div>
		</div>

		<dl class="tm-legend">
			<dt><span class="tm-sw tm-w"></span>Веса</dt>
			<dd>{formatGb(b.weights)} ГБ</dd>
			<dt><span class="tm-sw tm-g"></span>Градиенты</dt>
			<dd>{formatGb(b.grads)} ГБ</dd>
			<dt><span class="tm-sw tm-o"></span>Оптимизатор</dt>
			<dd>{formatGb(b.optimizer)} ГБ</dd>
			<dt class="tm-sum">Состояния</dt>
			<dd class="tm-sum">{formatGb(b.states)} ГБ</dd>
			<dt><span class="tm-sw tm-a"></span>Активации</dt>
			<dd>{formatGb(b.activations)} ГБ</dd>
			<dt class="tm-sum">Всего</dt>
			<dd class="tm-sum">{formatGb(b.total)} ГБ</dd>
			<dt><span class="tm-sw tm-limit-sw"></span>Лимит карты</dt>
			<dd>{b.cardGb} ГБ</dd>
		</dl>
	</div>

	<p class="tm-verdict" class:is-oom={!b.fits} aria-live="polite">
		<span class="tm-badge">{b.fits ? 'Помещается' : 'OOM'}</span>
		{result}
	</p>

	<ul class="tm-causes">
		{#each causes as c, i (i)}
			<li>{c}</li>
		{/each}
	</ul>

	<div class="tm-foot">
		<button type="button" class="tm-reset" onclick={reset}>Сбросить</button>
	</div>
</figure>

<style>
	.tm {
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
	}
	.tm :global(*),
	.tm :global(*::before),
	.tm :global(*::after) {
		box-sizing: border-box;
	}
	.tm dl,
	.tm dd,
	.tm dt,
	.tm p,
	.tm ul {
		margin: 0;
	}
	.tm button {
		font: inherit;
	}

	/* Controls */
	.tm-controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.tm-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		min-width: 0;
	}
	.tm-ctl-wide {
		grid-column: 1 / -1;
	}
	.tm-ctl.is-disabled {
		opacity: 0.5;
	}
	.tm-label {
		color: var(--text-muted);
		font-size: 13px;
	}
	.tm-range {
		flex: 1 1 120px;
		min-width: 0;
		max-width: 100%;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.tm-range:disabled {
		cursor: not-allowed;
	}
	.tm-val {
		min-width: 4ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: var(--text);
		text-align: right;
	}
	.tm-group {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		max-width: 100%;
	}
	.tm-seg {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: 13px;
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.tm-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.tm-seg:focus-visible,
	.tm-range:focus-visible,
	.tm-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Chart and legend */
	.tm-body {
		display: grid;
		grid-template-columns: 110px minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
		align-items: stretch;
	}
	.tm-chart {
		position: relative;
		height: 240px;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
	}
	.tm-chart.is-oom {
		border-color: var(--fail);
	}
	.tm-seg-bar {
		position: absolute;
		left: 12px;
		right: 12px;
		transition:
			height var(--dur) var(--ease),
			bottom var(--dur) var(--ease);
	}
	.tm-w {
		background: var(--cat-1);
	}
	.tm-g {
		background: var(--cat-2);
	}
	.tm-o {
		background: var(--cat-5);
	}
	.tm-a {
		background: var(--cat-3);
	}
	.tm-limit {
		position: absolute;
		left: 0;
		right: 0;
		border-top: 2px dashed var(--text);
		transition: bottom var(--dur) var(--ease);
	}
	.tm-legend {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-1) var(--space-4);
		align-content: start;
		font-size: 13px;
	}
	.tm-legend dt {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-muted);
	}
	.tm-legend dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
		color: var(--text);
	}
	.tm-legend .tm-sum {
		color: var(--text);
		font-weight: 600;
	}
	.tm-sw {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex: none;
	}
	.tm-limit-sw {
		width: 14px;
		height: 0;
		border-top: 2px dashed var(--text);
		border-radius: 0;
	}

	/* Verdict and causes */
	.tm-verdict {
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		font-size: var(--fs-base);
	}
	.tm-verdict.is-oom {
		border-color: var(--fail);
	}
	.tm-badge {
		display: inline-block;
		margin-right: var(--space-2);
		padding: 0 var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--ok);
		color: var(--surface);
		font-size: 13px;
		font-weight: 600;
	}
	.tm-verdict.is-oom .tm-badge {
		background: var(--fail);
	}
	.tm-causes {
		margin-top: var(--space-4);
		padding-left: var(--space-4);
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
	.tm-causes li + li {
		margin-top: var(--space-1);
	}
	.tm-foot {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-4);
	}
	.tm-reset {
		min-height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: 13px;
		cursor: pointer;
	}
	.tm-reset:hover {
		background: var(--surface-2);
	}

	@media (prefers-reduced-motion: reduce) {
		.tm *,
		.tm *::before,
		.tm *::after {
			transition: none !important;
		}
	}

	@media (max-width: 560px) {
		.tm {
			padding: var(--space-4);
		}
		.tm-body {
			grid-template-columns: 96px minmax(0, 1fr);
			gap: var(--space-4);
		}
		.tm-chart {
			height: 220px;
		}
		.tm-legend {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: var(--space-1) var(--space-3);
		}
	}
</style>
