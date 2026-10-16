<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		DEFAULT_STATE,
		POPULATION,
		PREV_MAX,
		PREV_MIN,
		PREV_STEP,
		SENS_MAX,
		SENS_MIN,
		SENS_STEP,
		SPEC_MAX,
		SPEC_MIN,
		SPEC_STEP,
		type BayesDemoState,
		computeBayes,
		describeBayes,
		formatCount,
		formatPercent,
		mosaicRects,
		positiveSplitWidth,
		snapPrevalence,
		snapSensitivity,
		snapSpecificity,
	} from '$lib/demos/bayes';

	/** Bayes demo: a diagnostic test as a probability tree and a 100-person frequency box. Registers as demo `bayes`. */
	let { initial }: { initial?: Partial<BayesDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let prevalence = $state(snapPrevalence(initial?.prevalence ?? DEFAULT_STATE.prevalence));
	/* svelte-ignore state_referenced_locally */
	let sensitivity = $state(snapSensitivity(initial?.sensitivity ?? DEFAULT_STATE.sensitivity));
	/* svelte-ignore state_referenced_locally */
	let specificity = $state(snapSpecificity(initial?.specificity ?? DEFAULT_STATE.specificity));
	/** Real width of the chart area in px; 320 until the first measurement. */
	let wBox = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const current: BayesDemoState = $derived({ prevalence, sensitivity, specificity });
	const r = $derived(computeBayes(current));
	const plotW = $derived(wBox >= 120 ? wBox : 320);
	const BOX_H = 170;
	const TREE_H = 200;
	const rects = $derived(mosaicRects(current, plotW, BOX_H));
	const posSplit = $derived(positiveSplitWidth(current, plotW));
	const note = $derived(describeBayes(current));
	const isDefault = $derived(
		prevalence === DEFAULT_STATE.prevalence &&
			sensitivity === DEFAULT_STATE.sensitivity &&
			specificity === DEFAULT_STATE.specificity,
	);

	/** Node positions of the probability tree, in px inside the SVG. */
	const tree = $derived({
		root: { x: 8, y: TREE_H / 2 },
		sick: { x: plotW * 0.36, y: TREE_H * 0.3 },
		healthy: { x: plotW * 0.36, y: TREE_H * 0.75 },
		sickPos: { x: plotW * 0.7, y: TREE_H * 0.12 },
		sickNeg: { x: plotW * 0.7, y: TREE_H * 0.38 },
		healthyPos: { x: plotW * 0.7, y: TREE_H * 0.62 },
		healthyNeg: { x: plotW * 0.7, y: TREE_H * 0.88 },
	});

	function reset(): void {
		prevalence = DEFAULT_STATE.prevalence;
		sensitivity = DEFAULT_STATE.sensitivity;
		specificity = DEFAULT_STATE.specificity;
	}

	function apply(patch: Partial<BayesDemoState>): void {
		if (typeof patch.prevalence === 'number') prevalence = snapPrevalence(patch.prevalence);
		if (typeof patch.sensitivity === 'number') sensitivity = snapSensitivity(patch.sensitivity);
		if (typeof patch.specificity === 'number') specificity = snapSpecificity(patch.specificity);
	}

	onMount(() => {
		return demos?.register('bayes', {
			set: (patch) => apply(patch as Partial<BayesDemoState>),
		});
	});
</script>

<figure class="by" id="demo-bayes" data-demo="bayes" class:by-hl={hl !== null}>
	<div class="by-controls">
		<label class="by-ctl">
			<span class="by-label"><span class="by-sym">P(H)</span> распространённость</span>
			<input
				class="by-range"
				type="range"
				min={PREV_MIN}
				max={PREV_MAX}
				step={PREV_STEP}
				value={prevalence}
				oninput={(e) => (prevalence = snapPrevalence(Number(e.currentTarget.value)))}
			/>
			<output class="by-val">{prevalence.toFixed(1)}%</output>
		</label>

		<label class="by-ctl">
			<span class="by-label"><span class="by-sym">P(+|H)</span> чувствительность</span>
			<input
				class="by-range"
				type="range"
				min={SENS_MIN}
				max={SENS_MAX}
				step={SENS_STEP}
				value={sensitivity}
				oninput={(e) => (sensitivity = snapSensitivity(Number(e.currentTarget.value)))}
			/>
			<output class="by-val">{sensitivity.toFixed(0)}%</output>
		</label>

		<label class="by-ctl">
			<span class="by-label"><span class="by-sym">P(−|не H)</span> специфичность</span>
			<input
				class="by-range"
				type="range"
				min={SPEC_MIN}
				max={SPEC_MAX}
				step={SPEC_STEP}
				value={specificity}
				oninput={(e) => (specificity = snapSpecificity(Number(e.currentTarget.value)))}
			/>
			<output class="by-val">{specificity.toFixed(0)}%</output>
		</label>

		<button type="button" class="by-reset" onclick={reset} disabled={isDefault}>Сбросить</button>
	</div>

	<div class="by-plots">
		<div class="by-panel">
			<p class="by-panel-t">Дерево вероятностей <span class="by-muted">на 100 человек</span></p>
			<svg
				class="by-svg by-tree"
				viewBox="0 0 {plotW} {TREE_H}"
				width={plotW}
				height={TREE_H}
				role="img"
				aria-labelledby="by-tree-title by-tree-desc"
			>
				<title id="by-tree-title">Дерево: больные и здоровые, затем результат теста</title>
				<desc id="by-tree-desc">
					Больных {formatCount(r.people.sick)} из {POPULATION}. Тест положителен у
					{formatCount(r.people.positive)}, из них больных {formatCount(r.people.truePositive)}.
				</desc>
				<g class="by-edge">
					<line x1={tree.root.x} y1={tree.root.y} x2={tree.sick.x} y2={tree.sick.y} />
					<line x1={tree.root.x} y1={tree.root.y} x2={tree.healthy.x} y2={tree.healthy.y} />
					<line x1={tree.sick.x} y1={tree.sick.y} x2={tree.sickPos.x} y2={tree.sickPos.y} />
					<line x1={tree.sick.x} y1={tree.sick.y} x2={tree.sickNeg.x} y2={tree.sickNeg.y} />
					<line
						x1={tree.healthy.x}
						y1={tree.healthy.y}
						x2={tree.healthyPos.x}
						y2={tree.healthyPos.y}
					/>
					<line
						x1={tree.healthy.x}
						y1={tree.healthy.y}
						x2={tree.healthyNeg.x}
						y2={tree.healthyNeg.y}
					/>
				</g>
				<g class="by-edge is-focus">
					<line x1={tree.root.x} y1={tree.root.y} x2={tree.sick.x} y2={tree.sick.y} />
					<line x1={tree.sick.x} y1={tree.sick.y} x2={tree.sickPos.x} y2={tree.sickPos.y} />
				</g>
				<text class="by-node" x={tree.root.x} y={tree.root.y - 8}>все {POPULATION}</text>
				<text class="by-node" x={tree.sick.x} y={tree.sick.y - 8}>
					больны {formatCount(r.people.sick)}
				</text>
				<text class="by-node" x={tree.healthy.x} y={tree.healthy.y + 16}>
					здоровы {formatCount(r.people.healthy)}
				</text>
				<text class="by-leaf is-focus" x={tree.sickPos.x + 8} y={tree.sickPos.y + 4}>
					+ {formatCount(r.people.truePositive)}
				</text>
				<text class="by-leaf" x={tree.sickNeg.x + 8} y={tree.sickNeg.y + 4}>
					− {formatCount(r.people.falseNegative)}
				</text>
				<text class="by-leaf" x={tree.healthyPos.x + 8} y={tree.healthyPos.y + 4}>
					+ {formatCount(r.people.falsePositive)}
				</text>
				<text class="by-leaf" x={tree.healthyNeg.x + 8} y={tree.healthyNeg.y + 4}>
					− {formatCount(r.people.trueNegative)}
				</text>
			</svg>
		</div>

		<div class="by-panel">
			<p class="by-panel-t">Частотный ящик <span class="by-muted">площадь = доля людей</span></p>
			<div class="by-box-wrap" bind:clientWidth={wBox}>
				<svg
					class="by-svg"
					viewBox="0 0 {plotW} {BOX_H}"
					width={plotW}
					height={BOX_H}
					role="img"
					aria-labelledby="by-box-title by-box-desc"
				>
					<title id="by-box-title">Ящик 100 человек, разбитый на больных и здоровых</title>
					<desc id="by-box-desc">
						Слева больные, справа здоровые. Верхняя часть каждой колонки тест положителен, нижняя
						отрицателен.
					</desc>
					<rect
						class="by-cell by-cell-tp"
						x={rects.truePositive.x}
						y={rects.truePositive.y}
						width={rects.truePositive.width}
						height={rects.truePositive.height}
					/>
					<rect
						class="by-cell by-cell-fn"
						x={rects.falseNegative.x}
						y={rects.falseNegative.y}
						width={rects.falseNegative.width}
						height={rects.falseNegative.height}
					/>
					<rect
						class="by-cell by-cell-fp"
						x={rects.falsePositive.x}
						y={rects.falsePositive.y}
						width={rects.falsePositive.width}
						height={rects.falsePositive.height}
					/>
					<rect
						class="by-cell by-cell-tn"
						x={rects.trueNegative.x}
						y={rects.trueNegative.y}
						width={rects.trueNegative.width}
						height={rects.trueNegative.height}
					/>
				</svg>
			</div>

			<p class="by-panel-t by-sub">Только положительные результаты</p>
			<svg
				class="by-svg by-pos"
				viewBox="0 0 {plotW} 36"
				width={plotW}
				height="36"
				role="img"
				aria-labelledby="by-pos-title by-pos-desc"
			>
				<title id="by-pos-title">Положительные результаты: больные и здоровые</title>
				<desc id="by-pos-desc">Доля больных среди положительных: {formatPercent(r.posterior)}.</desc
				>
				<rect class="by-cell by-cell-tp" x="0" y="0" width={posSplit} height="36" />
				<rect
					class="by-cell by-cell-fp"
					x={posSplit}
					y="0"
					width={Math.max(0, plotW - posSplit)}
					height="36"
				/>
			</svg>
		</div>
	</div>

	<dl class="by-stats">
		<dt>Величина</dt>
		<dd class="by-h">значение</dd>
		<dt>P(H) до теста</dt>
		<dd>{formatPercent(r.prior)}</dd>
		<dt>P(+)</dt>
		<dd>{formatPercent(r.pPositive)}</dd>
		<dt>P(H | +)</dt>
		<dd class="by-key">{formatPercent(r.posterior)}</dd>
		<dt>P(H | −)</dt>
		<dd>{formatPercent(r.posteriorNegative)}</dd>
	</dl>

	<p class="by-note" aria-live="polite">{note}</p>

	<p class="by-notice">
		<strong>Что заметить.</strong> При малой распространённости даже хороший тест даёт в основном ложные
		срабатывания: здоровых людей много, и 10% от них тоже набирается заметное число. Поднимите распространённость
		до 20% при тех же 90% и доля больных среди положительных вырастет примерно до 69%.
	</p>
</figure>

<style>
	.by {
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
	.by :global(*),
	.by :global(*::before),
	.by :global(*::after) {
		box-sizing: border-box;
	}
	.by dl,
	.by dd,
	.by dt,
	.by p {
		margin: 0;
	}
	.by button {
		font: inherit;
	}
	.by-muted {
		color: var(--text-muted);
	}
	.by-sym {
		font-family: var(--font-serif);
		font-size: 15px;
		color: var(--text);
	}

	/* Controls */
	.by-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.by-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.by-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.by-range {
		width: 140px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.by-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.by-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.by-reset:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.by-range:focus-visible,
	.by-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Charts */
	.by-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.by-panel {
		min-width: 0;
	}
	.by-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.by-sub {
		margin-top: var(--space-4);
	}
	.by-box-wrap {
		width: 100%;
	}
	.by-svg {
		display: block;
		max-width: 100%;
		height: auto;
		overflow: visible;
	}
	.by-tree {
		height: 200px;
	}
	.by-edge line {
		stroke: var(--text-muted);
		stroke-width: 1.2;
		opacity: 0.6;
	}
	.by-edge.is-focus line {
		stroke: var(--cat-1);
		stroke-width: 2.5;
		opacity: 1;
	}
	.by-node,
	.by-leaf {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.by-leaf {
		fill: var(--text);
	}
	.by-leaf.is-focus {
		fill: var(--cat-1);
		font-weight: 600;
	}
	.by-cell {
		transition: opacity var(--dur) var(--ease);
		stroke: var(--surface);
		stroke-width: 1;
	}
	.by-cell-tp {
		fill: var(--cat-1);
	}
	.by-cell-fn {
		fill: var(--cat-1);
		opacity: 0.3;
	}
	.by-cell-fp {
		fill: var(--cat-2);
	}
	.by-cell-tn {
		fill: var(--cat-2);
		opacity: 0.3;
	}
	.by-pos {
		height: 36px;
	}

	/* Statistics */
	.by-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.by-stats dt {
		color: var(--text-muted);
	}
	.by-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.by-stats .by-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-size: 12px;
	}
	.by-stats .by-key {
		color: var(--cat-1);
		font-weight: 600;
	}

	.by-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.by-notice {
		margin-top: var(--space-4);
		padding-left: var(--space-3);
		border-left: 3px solid var(--topic);
		color: var(--text);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT): dims the demo while another entity is hovered */
	.by.by-hl .by-plots {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.by *,
		.by *::before,
		.by *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.by {
			padding: var(--space-4);
		}
		.by-plots {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (max-width: 559px) {
		.by-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.by-ctl {
			flex-wrap: wrap;
		}
		.by-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
