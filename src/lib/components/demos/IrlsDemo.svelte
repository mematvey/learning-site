<script lang="ts">
	import { linearScale } from '$lib/charts/scales';
	import { locationIrls, mScale, mean, median, type IrlsStep } from '$lib/demos/robust-core';
	import { SAMPLE_OUTLIERS, SAMPLE_TWO_CLUSTERS, fmt } from './robust/plot';

	/** Location M-estimate by IRLS, step by step. Maths: $lib/demos/robust-core. */
	type PsiChoice = 'huber' | 'bisquare';
	type StartMode = 'median' | 'mean' | 'manual';
	type Dataset = 'outliers' | 'clusters';

	let { initial }: { initial?: { psi?: PsiChoice; dataset?: Dataset } } = $props();

	const PSI_C: Record<PsiChoice, number> = { huber: 1.5, bisquare: 4.685 };
	const PSI_LABEL: Record<PsiChoice, string> = {
		huber: 'Huber, c = 1,5',
		bisquare: 'bisquare, c = 4,685',
	};
	const SCALE_C = 1.54764;
	const SCALE_B = 0.5;
	const DOMAIN: [number, number] = [-3, 13];
	const TICKS = [-3, 0, 3, 6, 9, 12];
	const H = 150;
	const PAD_B = 22;
	const POINT_Y = 72;

	/* svelte-ignore state_referenced_locally */
	let psiKind = $state<PsiChoice>(initial?.psi ?? 'bisquare');
	/* svelte-ignore state_referenced_locally */
	let dataset = $state<Dataset>(initial?.dataset ?? 'outliers');
	/* svelte-ignore state_referenced_locally */
	let xs = $state<number[]>(
		initial?.dataset === 'clusters' ? [...SAMPLE_TWO_CLUSTERS] : [...SAMPLE_OUTLIERS],
	);
	let startMode = $state<StartMode>('median');
	let manual = $state(6);
	let step = $state(0);
	let wrap = $state(0);
	let drag = $state<number | null>(null);

	const plotW = $derived(wrap >= 240 ? wrap : 280);
	const sx = $derived(linearScale(DOMAIN, [0, plotW]));

	const c = $derived(PSI_C[psiKind]);
	const sigma = $derived(mScale(xs, { kind: 'bisquare', c: SCALE_C, b: SCALE_B }));
	const startValue = $derived(
		startMode === 'median' ? median(xs) : startMode === 'mean' ? mean(xs) : manual,
	);
	const run = $derived(locationIrls(xs, sigma, { kind: psiKind, c, start: startValue }));
	const lastStep = $derived(run.trace.length - 1);
	const k = $derived(Math.min(step, lastStep));
	const cur: IrlsStep = $derived(run.trace[k] ?? run.trace[0]!);
	const muPath = $derived(run.trace.slice(0, k + 1).map((t) => t.mu));
	const converged = $derived(k === lastStep);

	const medianRun = $derived(locationIrls(xs, sigma, { kind: psiKind, c, start: median(xs) }));
	const trapped = $derived(Math.abs(run.mu - medianRun.mu) > 1);

	const desc = $derived(
		converged
			? `Оценка сошлась за ${run.iterations} итераций: μ = ${fmt(run.mu, 4)}.`
			: `Шаг ${k} из ${lastStep}: μ_${k} = ${fmt(cur.mu, 4)}; следующий шаг пересчитает веса.`,
	);

	function setStep(next: number): void {
		step = Math.max(0, Math.min(lastStep, next));
	}
	function resetRun(): void {
		step = 0;
	}
	function chooseDataset(d: Dataset): void {
		dataset = d;
		xs = d === 'clusters' ? [...SAMPLE_TWO_CLUSTERS] : [...SAMPLE_OUTLIERS];
		step = 0;
	}
	function clampPos(v: number): number {
		const r = Math.round(v * 10) / 10;
		return Math.max(DOMAIN[0], Math.min(DOMAIN[1], r));
	}

	function onPointerDown(i: number, e: PointerEvent): void {
		drag = i;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		e.preventDefault();
	}
	function onPointerMove(e: PointerEvent): void {
		if (drag === null) return;
		const svg = e.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const px = ((e.clientX - rect.left) * plotW) / rect.width;
		xs[drag] = clampPos(sx.invert(px));
	}
	function onPointerUp(): void {
		drag = null;
	}
	function onKey(i: number, e: KeyboardEvent): void {
		const big = e.shiftKey ? 1 : 0.1;
		const down = e.key === 'ArrowLeft' || e.key === 'ArrowDown';
		const up = e.key === 'ArrowRight' || e.key === 'ArrowUp';
		if (!down && !up) return;
		e.preventDefault();
		xs[i] = clampPos((xs[i] ?? 0) + (down ? -big : big));
	}
</script>

<figure class="ir" id="demo-irls" data-demo="irls">
	<div class="ir-controls">
		<div class="ir-group" role="group" aria-label="Функция ψ">
			<button
				type="button"
				class="ir-seg"
				aria-pressed={psiKind === 'huber'}
				onclick={() => {
					psiKind = 'huber';
					resetRun();
				}}>Huber, c = 1,5</button
			>
			<button
				type="button"
				class="ir-seg"
				aria-pressed={psiKind === 'bisquare'}
				onclick={() => {
					psiKind = 'bisquare';
					resetRun();
				}}>bisquare, c = 4,685</button
			>
		</div>

		<div class="ir-group" role="group" aria-label="Старт итераций">
			<button
				type="button"
				class="ir-seg"
				aria-pressed={startMode === 'median'}
				onclick={() => {
					startMode = 'median';
					resetRun();
				}}>из медианы</button
			>
			<button
				type="button"
				class="ir-seg"
				aria-pressed={startMode === 'mean'}
				onclick={() => {
					startMode = 'mean';
					resetRun();
				}}>из среднего</button
			>
			<button
				type="button"
				class="ir-seg"
				aria-pressed={startMode === 'manual'}
				onclick={() => {
					startMode = 'manual';
					resetRun();
				}}>вручную</button
			>
		</div>

		{#if startMode === 'manual'}
			<label class="ir-slider">
				<span>Старт μ₀ = {fmt(manual, 1)}</span>
				<input
					type="range"
					min={DOMAIN[0]}
					max={DOMAIN[1]}
					step="0.1"
					bind:value={manual}
					oninput={resetRun}
					aria-label="Стартовое значение μ₀"
				/>
			</label>
		{/if}

		<div class="ir-group" role="group" aria-label="Набор данных">
			<button
				type="button"
				class="ir-seg"
				aria-pressed={dataset === 'outliers'}
				onclick={() => chooseDataset('outliers')}>Выборка с выбросами</button
			>
			<button
				type="button"
				class="ir-seg"
				aria-pressed={dataset === 'clusters'}
				onclick={() => chooseDataset('clusters')}>Два кластера</button
			>
		</div>
	</div>

	<p class="ir-label">
		Точки можно перетаскивать мышью или пальцем, а также выбирать фокусом и двигать стрелками (с
		Shift — шаг 1). Размер и прозрачность точки отражают вес w<sub>i</sub> на текущем шаге.
	</p>

	<div class="ir-plot" bind:clientWidth={wrap}>
		<svg
			class="ir-svg"
			width="100%"
			height={H}
			viewBox="0 0 {plotW} {H}"
			role="group"
			aria-label="Точки выборки и текущая оценка μ"
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		>
			<line class="ir-axis" x1="0" x2={plotW} y1={H - PAD_B} y2={H - PAD_B} />
			{#each TICKS as t (t)}
				<text class="ir-tick" x={sx(t).toFixed(1)} y={H - 6} text-anchor="middle">{t}</text>
			{/each}

			{#each muPath.slice(0, -1) as m, j (j)}
				<circle class="ir-trail" cx={sx(m).toFixed(1)} cy={H - PAD_B} r="3" />
			{/each}

			<line
				class="ir-mu"
				x1={sx(cur.mu).toFixed(1)}
				x2={sx(cur.mu).toFixed(1)}
				y1="18"
				y2={H - PAD_B}
			/>
			<text class="ir-mu-label" x={sx(cur.mu).toFixed(1)} y="12" text-anchor="middle"
				>μ<tspan dy="3" font-size="9">{k}</tspan></text
			>

			{#each xs as x, i (i)}
				{@const w = cur.weights[i] ?? 0}
				<circle
					class="ir-pt"
					class:ir-pt-drag={drag === i}
					cx={sx(x).toFixed(1)}
					cy={POINT_Y}
					r={(4 + 6 * w).toFixed(1)}
					style:opacity={(0.25 + 0.75 * w).toFixed(2)}
					tabindex="0"
					role="slider"
					aria-label="Точка {i + 1}"
					aria-valuemin={DOMAIN[0]}
					aria-valuemax={DOMAIN[1]}
					aria-valuenow={x}
					aria-valuetext="значение {fmt(x, 1)}, вес {fmt(w, 2)}"
					onpointerdown={(e) => onPointerDown(i, e)}
					onkeydown={(e) => onKey(i, e)}
				/>
			{/each}
		</svg>
	</div>

	<dl class="ir-stats">
		<div>
			<dt>Текущая μ_{k}</dt>
			<dd>{fmt(cur.mu, 4)}</dd>
		</div>
		<div>
			<dt>σ̂ (M-scale, bisquare)</dt>
			<dd>{fmt(sigma, 3)}</dd>
		</div>
		<div>
			<dt>Функция ψ</dt>
			<dd>{PSI_LABEL[psiKind]}</dd>
		</div>
	</dl>

	<div class="ir-buttons">
		<button type="button" class="ir-btn" onclick={() => setStep(step + 1)} disabled={converged}
			>Шаг</button
		>
		<button type="button" class="ir-btn" onclick={() => setStep(lastStep)} disabled={converged}
			>Сходимость</button
		>
		<button type="button" class="ir-btn ir-btn-quiet" onclick={resetRun} disabled={k === 0}
			>Сброс</button
		>
	</div>

	<div class="ir-row">
		<p class="ir-label">Путь оценки: μ₀ … μ{k}</p>
		<ul class="ir-chips" aria-label="Значения μ по шагам">
			{#each muPath as m, j (j)}
				<li class="ir-chip">μ{j} = {fmt(m, 3)}</li>
			{/each}
		</ul>
	</div>

	<div class="ir-row">
		<p class="ir-label">Веса w<sub>i</sub> при μ{k}</p>
		<ul class="ir-chips" aria-label="Веса наблюдений на текущем шаге">
			{#each xs as x, i (i)}
				<li class="ir-chip">{fmt(x, 1)}: {fmt(cur.weights[i] ?? 0, 2)}</li>
			{/each}
		</ul>
	</div>

	{#if dataset === 'clusters'}
		<p class="ir-callout" class:ir-callout-warn={trapped}>
			{#if trapped}
				Старт {fmt(startValue, 2)} привёл к μ ≈ {fmt(run.mu, 2)}, а из медианы получается μ ≈ {fmt(
					medianRun.mu,
					2,
				)}. bisquare застрял в другом решении. Поэтому стартуем с медианы.
			{:else}
				Из медианы и среднего bisquare даёт μ ≈ {fmt(medianRun.mu, 2)} (левая группа). Попробуйте старт
				вручную около 6 и выше: оценка уйдёт в правую группу. Поэтому стартуем с медианы.
			{/if}
		</p>
	{/if}

	<p class="ir-live" aria-live="polite">{desc}</p>

	<p class="ir-note">
		<strong>Что заметить:</strong>
		Huber выпукла и даёт одно решение. У bisquare функция ψ не монотонна, и уравнение может иметь несколько
		корней: поэтому старт имеет значение.
	</p>
</figure>

<style>
	.ir {
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
	}
	.ir :global(*),
	.ir :global(*::before),
	.ir :global(*::after) {
		box-sizing: border-box;
	}
	.ir p,
	.ir dl,
	.ir dd,
	.ir dt,
	.ir ul {
		margin: 0;
	}
	.ir button {
		font: inherit;
	}
	.ir-controls {
		display: grid;
		gap: var(--space-3);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ir-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		max-width: 100%;
	}
	.ir-seg {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	.ir-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.ir-slider {
		display: grid;
		gap: var(--space-1);
		font-variant-numeric: tabular-nums;
	}
	.ir-slider input {
		width: 100%;
		accent-color: var(--topic);
	}
	.ir-label {
		color: var(--text-muted);
		margin-top: var(--space-3);
	}
	.ir-plot {
		margin-top: var(--space-3);
	}
	.ir-svg {
		display: block;
		overflow: visible;
		touch-action: none;
	}
	.ir-axis {
		stroke: var(--border);
		stroke-width: 1;
	}
	.ir-tick {
		font-size: 11px;
		fill: var(--text-muted);
	}
	.ir-pt {
		fill: var(--topic);
		stroke: var(--topic);
		stroke-width: 1;
		cursor: grab;
		transition:
			r var(--dur) var(--ease),
			opacity var(--dur) var(--ease);
	}
	.ir-pt-drag {
		cursor: grabbing;
	}
	.ir-pt:focus-visible {
		outline: none;
		stroke: var(--accent);
		stroke-width: 3;
	}
	.ir-trail {
		fill: var(--text-muted);
		opacity: 0.45;
	}
	.ir-mu {
		stroke: var(--accent);
		stroke-width: 2;
	}
	.ir-mu-label {
		font-size: 12px;
		fill: var(--accent);
		font-weight: 600;
	}
	.ir-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.ir-stats dt {
		color: var(--text-muted);
		font-size: 12px;
	}
	.ir-stats dd {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.ir-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.ir-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--topic);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--topic);
		cursor: pointer;
	}
	.ir-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.ir-btn-quiet {
		border-color: var(--border);
		color: var(--text-muted);
	}
	.ir-seg:focus-visible,
	.ir-btn:focus-visible,
	.ir-slider input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.ir-row {
		margin-top: var(--space-4);
	}
	.ir-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		list-style: none;
		padding: 0;
	}
	.ir-chip {
		padding: 2px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		font-variant-numeric: tabular-nums;
	}
	.ir-callout {
		margin-top: var(--space-4);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-left: 3px solid var(--topic);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.ir-callout-warn {
		border-left-color: var(--warn);
	}
	.ir-live {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.ir-note {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	@media (prefers-reduced-motion: reduce) {
		.ir-pt {
			transition: none;
		}
	}
	@media (max-width: 559px) {
		.ir {
			padding: var(--space-4);
		}
	}
</style>
