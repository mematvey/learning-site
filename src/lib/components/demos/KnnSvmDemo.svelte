<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		C_VALUES,
		GAMMA_MAX,
		GAMMA_MIN,
		GAMMA_STEP,
		K_MAX,
		K_MIN,
		applyPatch,
		bestC,
		bestK,
		buildClassifier,
		classifyGrid,
		describeClassifier,
		levelLine,
		linearWeights,
		makeDataset,
		makeValidation,
		marginBandGrid,
		marginWidth,
		planeToPx,
		regionPath,
		type KnnSvmDemoState,
	} from '$lib/demos/knn-svm';

	/** kNN / SVM demo on a fixed two-class dataset. Registers itself as demo `knn-svm`. */
	let { initial }: { initial?: Partial<KnnSvmDemoState> } = $props();

	const DEFAULTS: KnnSvmDemoState = { model: 'knn', k: 5, C: 1, kernel: 'rbf', gamma: 2 };
	/** Start state: defaults with the props applied. Reset returns to it. */
	/* svelte-ignore state_referenced_locally */
	const START = applyPatch(DEFAULTS, initial ?? {});

	let st = $state<KnnSvmDemoState>({ ...START });

	/** Chart side in SVG units (the SVG is drawn at this size, scaled by CSS). */
	const SIZE = 360;
	/** Resolution of the decision-region grid. */
	const GRID_N = 40;
	const points = makeDataset();
	const validation = makeValidation();
	const C_INDEX_MAX = C_VALUES.length - 1;

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const clf = $derived(buildClassifier(st, points, validation));
	const grid = $derived(classifyGrid(clf.predict, GRID_N));
	const regions0 = $derived(regionPath(grid, GRID_N, 0, SIZE));
	const regions1 = $derived(regionPath(grid, GRID_N, 1, SIZE));
	const supportSet = $derived(new Set(clf.support));
	const isSvm = $derived(st.model === 'svm');
	const desc = $derived(describeClassifier(st, clf, points.length, validation.length));
	/** Margin band |f| < 1 of an SVM: the strip between the lines f = ±1. */
	const bandPath = $derived(
		clf.svm ? regionPath(marginBandGrid(clf.svm, GRID_N), GRID_N, 1, SIZE) : '',
	);
	const lin = $derived(clf.svm ? linearWeights(clf.svm) : null);
	const lines = $derived(
		lin
			? [-1, 0, 1].flatMap((level) => {
					const seg = levelLine(lin, level);
					if (!seg) return [];
					const a = planeToPx(seg[0].x, seg[0].y, SIZE);
					const b = planeToPx(seg[1].x, seg[1].y, SIZE);
					return [{ level, x1: a.px, y1: a.py, x2: b.px, y2: b.py }];
				})
			: [],
	);
	const width = $derived(clf.svm ? marginWidth(clf.svm) : null);
	/** Value of k (kNN) or C (SVM) with the fewest errors on the validation points. */
	const choice = $derived(
		isSvm ? bestC(points, validation, st.kernel, st.gamma) : bestK(points, validation),
	);
	const cIndex = $derived(C_VALUES.indexOf(st.C as (typeof C_VALUES)[number]));

	function apply(patch: Partial<KnnSvmDemoState>): void {
		st = applyPatch(st, patch);
	}

	function reset(): void {
		st = { ...START };
	}

	function pickBest(): void {
		apply(isSvm ? { C: choice.value } : { k: choice.value });
	}

	function onCIndex(e: Event): void {
		const i = Number((e.currentTarget as HTMLInputElement).value);
		const v = C_VALUES[i];
		if (v !== undefined) apply({ C: v });
	}

	onMount(() => {
		return demos?.register('knn-svm', {
			set: (patch) => apply(patch as Partial<KnnSvmDemoState>),
		});
	});
</script>

<figure class="kn" id="demo-knn-svm" data-demo="knn-svm" class:hl-q={hl === 'q'}>
	<div class="kn-controls">
		<div class="kn-group" role="group" aria-label="Модель">
			<button
				type="button"
				class="kn-seg"
				aria-pressed={st.model === 'knn'}
				onclick={() => apply({ model: 'knn' })}>kNN</button
			>
			<button
				type="button"
				class="kn-seg"
				aria-pressed={st.model === 'svm'}
				onclick={() => apply({ model: 'svm' })}>SVM</button
			>
		</div>

		{#if isSvm}
			<label class="kn-ctl">
				<span class="kn-label"><span class="kn-sym">C</span> (штраф за ошибки)</span>
				<input
					class="kn-range"
					type="range"
					min="0"
					max={C_INDEX_MAX}
					step="1"
					value={cIndex}
					oninput={onCIndex}
				/>
				<output class="kn-val">{st.C}</output>
			</label>

			<div class="kn-group" role="group" aria-label="Ядро">
				<button
					type="button"
					class="kn-seg"
					aria-pressed={st.kernel === 'linear'}
					onclick={() => apply({ kernel: 'linear' })}>линейное</button
				>
				<button
					type="button"
					class="kn-seg"
					aria-pressed={st.kernel === 'rbf'}
					onclick={() => apply({ kernel: 'rbf' })}>RBF</button
				>
			</div>

			{#if st.kernel === 'rbf'}
				<label class="kn-ctl">
					<span class="kn-label"><span class="kn-sym">γ</span> (ширина RBF)</span>
					<input
						class="kn-range"
						type="range"
						min={GAMMA_MIN}
						max={GAMMA_MAX}
						step={GAMMA_STEP}
						value={st.gamma}
						oninput={(e) => apply({ gamma: Number(e.currentTarget.value) })}
					/>
					<output class="kn-val">{st.gamma.toFixed(1)}</output>
				</label>
			{/if}
		{:else}
			<label class="kn-ctl">
				<span class="kn-label"><span class="kn-sym">k</span> (соседи)</span>
				<input
					class="kn-range"
					type="range"
					min={K_MIN}
					max={K_MAX}
					step="1"
					value={st.k}
					oninput={(e) => apply({ k: Number(e.currentTarget.value) })}
				/>
				<output class="kn-val">{st.k}</output>
			</label>
		{/if}

		<button type="button" class="kn-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="kn-plot">
		<svg class="kn-svg" viewBox="0 0 {SIZE} {SIZE}" role="img" aria-labelledby="kn-title kn-desc">
			<title id="kn-title">Граница решения на плоскости</title>
			<desc id="kn-desc">{desc}</desc>
			<rect class="kn-frame" x="0" y="0" width={SIZE} height={SIZE} />
			<path class="kn-region kn-region-0" d={regions0} />
			<path class="kn-region kn-region-1" d={regions1} />
			{#if isSvm}
				<path class="kn-band" d={bandPath} />
				{#each lines as l (l.level)}
					<line
						class="kn-line"
						class:kn-line-0={l.level === 0}
						x1={l.x1.toFixed(1)}
						y1={l.y1.toFixed(1)}
						x2={l.x2.toFixed(1)}
						y2={l.y2.toFixed(1)}
					/>
				{/each}
			{/if}
			{#each points as p, i (i)}
				{@const pos = planeToPx(p.x, p.y, SIZE)}
				{@const isSv = supportSet.has(i)}
				{#if isSv}
					<circle class="kn-sv" cx={pos.px.toFixed(1)} cy={pos.py.toFixed(1)} r="8" />
				{/if}
				<circle
					class="kn-point kn-point-{p.label}"
					cx={pos.px.toFixed(1)}
					cy={pos.py.toFixed(1)}
					r="4.5"
				>
					<title>{p.label === 1 ? 'класс 2' : 'класс 1'}{isSv ? ', опорный вектор' : ''}</title>
				</circle>
			{/each}
		</svg>
	</div>

	<p class="kn-desc" aria-live="polite">{desc}</p>

	<dl class="kn-stats">
		<dt>Модель</dt>
		<dd>{isSvm ? 'SVM' : 'kNN'}</dd>
		<dt>Ошибок на обучении</dt>
		<dd>{clf.trainErrors} из {points.length}</dd>
		<dt>Ошибок на контроле</dt>
		<dd>{clf.valErrors} из {validation.length}</dd>
		<dt>Лучшее {isSvm ? 'C' : 'k'} по контролю</dt>
		<dd>
			{choice.value} ({choice.valErrors} ош.)
			<button
				type="button"
				class="kn-pick"
				onclick={pickBest}
				disabled={choice.value === (isSvm ? st.C : st.k)}>выбрать</button
			>
		</dd>
		{#if isSvm}
			<dt>Опорных векторов</dt>
			<dd>{clf.support.length}</dd>
			{#if width !== null}
				<dt>Ширина зазора 2/‖w‖</dt>
				<dd>{width.toFixed(2)}</dd>
			{/if}
		{/if}
	</dl>

	<div class="kn-note">
		<p class="kn-note-t">Что заметить</p>
		{#if isSvm}
			<p>
				Опорные векторы обведены кольцом: только они задают границу. Серая полоса это зазор |f| &lt;
				1, её края линии f = ±1 (для линейного ядра они нарисованы отрезками, для RBF видна только
				полоса). Большое C жёстче наказывает ошибки, полоса сужается, и граница подгоняется под
				обучающую выборку; малое C даёт более широкий зазор. RBF изгибает границу и обходит
				островок, линейное ядро не может. Сравните ошибки на обучении и на контроле и нажмите
				«выбрать», чтобы взять C с лучшим контролем.
			</p>
		{:else}
			<p>
				При k = 1 граница повторяет каждую точку, и ошибок на обучении нет: точка сама входит в
				число своих соседей. На контрольных точках ошибки есть при любом k. Чем больше k, тем
				граница глаже, но мелкие детали острова теряются. Подбирайте k по контролю, а не по
				обучению: кнопка «выбрать» берёт k с наименьшим числом ошибок на контроле.
			</p>
		{/if}
	</div>
</figure>

<style>
	.kn {
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
	.kn :global(*),
	.kn :global(*::before),
	.kn :global(*::after) {
		box-sizing: border-box;
	}
	.kn dl,
	.kn dd,
	.kn dt,
	.kn p {
		margin: 0;
	}
	.kn button {
		font: inherit;
	}
	.kn-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.kn-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.kn-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.kn-seg,
	.kn-reset {
		height: 32px;
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
	.kn-reset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.kn-reset:hover {
		background: var(--surface-2);
	}
	.kn-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.kn-seg:focus-visible,
	.kn-reset:focus-visible,
	.kn-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.kn-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.kn-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.kn-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.kn-val {
		min-width: 3ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Chart */
	.kn-plot {
		display: flex;
		justify-content: center;
		margin-top: var(--space-6);
	}
	.kn-svg {
		display: block;
		width: 100%;
		max-width: 400px;
		height: auto;
		overflow: visible;
	}
	.kn-frame {
		fill: none;
		stroke: var(--border);
		stroke-width: 1;
	}
	.kn-region {
		transition: opacity var(--dur) var(--ease);
	}
	.kn-region-0 {
		fill: var(--cat-1);
		fill-opacity: 0.14;
	}
	.kn-region-1 {
		fill: var(--cat-2);
		fill-opacity: 0.14;
	}
	.kn-point {
		stroke: var(--surface);
		stroke-width: 1.5;
		transition: opacity var(--dur) var(--ease);
	}
	.kn-point-0 {
		fill: var(--cat-1);
	}
	.kn-point-1 {
		fill: var(--cat-2);
	}
	.kn-band {
		fill: var(--text);
		fill-opacity: 0.1;
	}
	.kn-line {
		stroke: var(--text-muted);
		stroke-width: 1.2;
		stroke-dasharray: 5 4;
	}
	.kn-line-0 {
		stroke: var(--text);
		stroke-width: 1.6;
		stroke-dasharray: none;
	}
	.kn-pick {
		margin-left: var(--space-2);
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: 12px;
		cursor: pointer;
	}
	.kn-pick:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.kn-pick:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.kn-sv {
		fill: none;
		stroke: var(--text);
		stroke-width: 1.8;
	}

	.kn-desc {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* Statistics */
	.kn-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
		transition: opacity var(--dur) var(--ease);
	}
	.kn-stats dt {
		color: var(--text-muted);
	}
	.kn-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.kn-note {
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		color: var(--text-muted);
	}
	.kn-note-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.kn.hl-q .kn-stats {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.kn *,
		.kn *::before,
		.kn *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.kn {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.kn-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.kn-ctl {
			flex-wrap: wrap;
		}
		.kn-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
