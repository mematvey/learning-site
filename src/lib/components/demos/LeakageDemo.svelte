<script lang="ts">
	import {
		CHANCE,
		K_DEFAULT,
		K_MAX,
		K_MIN,
		SEED_COUNT,
		type Scope,
		average,
		clampK,
		clampSeed,
		cvScores,
		describeLeak,
		formatAcc,
		isScope,
		makeDataset,
		sweep,
	} from '$lib/demos/data-preparation';

	/** Preprocessing leakage demo: fitting a scaler and feature selection on all rows vs training folds only. */
	let { initial }: { initial?: Partial<{ scope: Scope; k: number; seed: number }> } = $props();

	/* svelte-ignore state_referenced_locally */
	let scope = $state<Scope>(isScope(initial?.scope) ? initial.scope : 'all');
	/* svelte-ignore state_referenced_locally */
	let k = $state(clampK(initial?.k ?? K_DEFAULT));
	/* svelte-ignore state_referenced_locally */
	let seed = $state(clampSeed(initial?.seed ?? 1));

	const data = $derived(makeDataset(seed));
	const current = $derived({
		all: cvScores(data, k, 'all'),
		train: cvScores(data, k, 'train'),
	});
	const strip = $derived({
		all: sweep(k, 'all'),
		train: sweep(k, 'train'),
	});
	const allMean = $derived(average(strip.all));
	const trainMean = $derived(average(strip.train));
	const chosen = $derived(current[scope]);
	const note = $derived(describeLeak(allMean, trainMean, k));
	const scopeLabel = $derived(scope === 'all' ? 'на всей выборке' : 'только на train');
	const liveText = $derived(
		`Схема ${scopeLabel}: оценка кросс-валидацией ${formatAcc(chosen.mean)} для набора ${seed}. ` +
			`Честное значение для шума ${formatAcc(CHANCE)}.`,
	);

	function pct(v: number): string {
		return `${(v * 100).toFixed(2)}%`;
	}

	function nextDataset(): void {
		seed = seed >= SEED_COUNT ? 1 : seed + 1;
	}

	function reset(): void {
		scope = 'all';
		k = K_DEFAULT;
		seed = 1;
	}
</script>

<figure class="lk" id="demo-leakage" data-demo="leakage">
	<div class="lk-controls">
		<div class="lk-group" role="group" aria-label="На каких данных подгоняется преобразование">
			<button
				type="button"
				class="lk-seg"
				aria-pressed={scope === 'all'}
				onclick={() => (scope = 'all')}>На всей выборке</button
			>
			<button
				type="button"
				class="lk-seg"
				aria-pressed={scope === 'train'}
				onclick={() => (scope = 'train')}>Только на train</button
			>
		</div>

		<label class="lk-ctl">
			<span class="lk-label"><span class="lk-sym">k</span> (признаков отобрано)</span>
			<input
				class="lk-range"
				type="range"
				min={K_MIN}
				max={K_MAX}
				step="1"
				value={k}
				oninput={(e) => (k = clampK(Number(e.currentTarget.value)))}
			/>
			<output class="lk-val">{k}</output>
		</label>
	</div>

	<div class="lk-actions">
		<button type="button" class="lk-btn" onclick={nextDataset}>Другой набор данных</button>
		<button type="button" class="lk-btn lk-btn-ghost" onclick={reset}>Сбросить</button>
		<span class="lk-muted">Набор {seed} из {SEED_COUNT}</span>
	</div>

	<div class="lk-plots">
		<section class="lk-panel" aria-labelledby="lk-bars-t">
			<p class="lk-panel-t" id="lk-bars-t">Оценка для одного набора</p>

			{#each [['all', 'На всей выборке'], ['train', 'Только на train']] as [key, label] (key)}
				<div class="lk-row" class:is-chosen={scope === key}>
					<span class="lk-row-label">{label}</span>
					<div
						class="lk-track"
						role="img"
						aria-label="{label}: {formatAcc(current[key as Scope].mean)}"
					>
						<div class="lk-fill lk-fill-{key}" style:width={pct(current[key as Scope].mean)}></div>
						<div class="lk-chance" aria-hidden="true"></div>
						{#each current[key as Scope].folds as f, i (i)}
							<span class="lk-dot" style:left={pct(f)} title="фолд {i + 1}: {formatAcc(f)}"></span>
						{/each}
					</div>
					<span class="lk-row-val">{formatAcc(current[key as Scope].mean)}</span>
				</div>
			{/each}

			<div class="lk-axis" aria-hidden="true">
				<span>0</span>
				<span class="lk-axis-mid">0,5 — честно для шума</span>
				<span>1</span>
			</div>
			<p class="lk-hint">Точки — пять фолдов. Сплошная полоса — среднее.</p>
		</section>

		<section class="lk-panel" aria-labelledby="lk-strip-t">
			<p class="lk-panel-t" id="lk-strip-t">{SEED_COUNT} разных наборов</p>

			{#each [['all', 'На всей выборке'], ['train', 'Только на train']] as [key, label] (key)}
				<div class="lk-srow" class:is-chosen={scope === key}>
					<span class="lk-row-label">{label}</span>
					<div class="lk-strip">
						<div class="lk-chance" aria-hidden="true"></div>
						{#each strip[key as Scope] as v, i (i)}
							<span
								class="lk-pt lk-pt-{key}"
								style:left={pct(v)}
								title="набор {i + 1}: {formatAcc(v)}"
							></span>
						{/each}
						<span
							class="lk-mean-mark lk-mean-{key}"
							style:left={pct(key === 'all' ? allMean : trainMean)}
						></span>
					</div>
				</div>
			{/each}

			<dl class="lk-stats">
				<dt>Среднее по наборам</dt>
				<dd class="lk-h">на всей выборке</dd>
				<dd class="lk-h">только на train</dd>
				<dd class="lk-num">{formatAcc(allMean)}</dd>
				<dd class="lk-num">{formatAcc(trainMean)}</dd>
			</dl>
		</section>
	</div>

	<p class="lk-live" aria-live="polite">{liveText}</p>

	<div class="lk-note">
		<p class="lk-note-t">Что заметить</p>
		<p>{note}</p>
	</div>
</figure>

<style>
	.lk {
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
	.lk :global(*),
	.lk :global(*::before),
	.lk :global(*::after) {
		box-sizing: border-box;
	}
	.lk dl,
	.lk dd,
	.lk dt,
	.lk p {
		margin: 0;
	}
	.lk button {
		font: inherit;
	}
	.lk-muted {
		color: var(--text-muted);
	}

	/* Controls */
	.lk-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.lk-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.lk-seg,
	.lk-btn {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.lk-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.lk-btn {
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text);
	}
	.lk-btn-ghost {
		background: none;
		color: var(--text-muted);
	}
	.lk-seg:focus-visible,
	.lk-btn:focus-visible,
	.lk-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.lk-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.lk-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.lk-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}
	.lk-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.lk-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.lk-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	/* Plots */
	.lk-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.lk-panel-t {
		margin-bottom: var(--space-3);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.lk-row,
	.lk-srow {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-1);
		margin-bottom: var(--space-4);
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		opacity: 0.55;
		transition: opacity var(--dur) var(--ease);
	}
	.lk-row.is-chosen,
	.lk-srow.is-chosen {
		opacity: 1;
	}
	.lk-row-label {
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
	.lk-track,
	.lk-strip {
		position: relative;
		height: 22px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.lk-strip {
		height: 28px;
	}
	.lk-fill {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		border-radius: var(--radius-sm);
		transition: width var(--dur) var(--ease);
	}
	.lk-fill-all {
		background: var(--topic);
		opacity: 0.35;
	}
	.lk-fill-train {
		background: var(--text-muted);
		opacity: 0.35;
	}
	.lk-chance {
		position: absolute;
		top: -3px;
		bottom: -3px;
		left: 50%;
		border-left: 1px dashed var(--text-muted);
	}
	.lk-dot {
		position: absolute;
		top: 50%;
		width: 9px;
		height: 9px;
		margin: -4.5px 0 0 -4.5px;
		border-radius: 50%;
		background: var(--text);
	}
	.lk-row-val {
		justify-self: end;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.lk-axis {
		display: flex;
		justify-content: space-between;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.lk-axis-mid {
		color: var(--text);
	}
	.lk-hint {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.lk-pt {
		position: absolute;
		top: 50%;
		width: 6px;
		height: 6px;
		margin: -3px 0 0 -3px;
		border-radius: 50%;
	}
	.lk-pt-all {
		background: var(--topic);
	}
	.lk-pt-train {
		background: var(--text-muted);
	}
	.lk-mean-mark {
		position: absolute;
		top: 2px;
		bottom: 2px;
		width: 3px;
		margin-left: -1.5px;
		border-radius: 2px;
	}
	.lk-mean-all {
		background: var(--topic);
	}
	.lk-mean-train {
		background: var(--text);
	}
	.lk-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		margin-top: var(--space-4);
		font-size: var(--fs-sm);
	}
	.lk-stats dt {
		color: var(--text-muted);
	}
	.lk-h {
		color: var(--text-muted);
		font-size: 12px;
	}
	.lk-num {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.lk-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-size: 12px;
	}
	.lk-note {
		margin-top: var(--space-4);
		padding: var(--space-4);
		border-left: 3px solid var(--topic);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.lk-note-t {
		margin-bottom: var(--space-1);
		font-weight: 600;
	}

	@media (max-width: 640px) {
		.lk {
			padding: var(--space-5) var(--space-4) var(--space-6);
		}
		.lk-plots {
			grid-template-columns: minmax(0, 1fr);
		}
		.lk-range {
			width: 100%;
			min-width: 0;
		}
		.lk-ctl {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.lk-fill,
		.lk-row,
		.lk-srow {
			transition: none;
		}
	}
</style>
