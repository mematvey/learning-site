<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		CHART_PAD,
		CHART_SIZE,
		DEFAULT_THRESHOLD,
		THRESHOLD_MAX,
		THRESHOLD_MIN,
		THRESHOLD_STEP,
		type MetricsDemoState,
		confusion,
		curvePath,
		describeState,
		makeSamples,
		metrics,
		prCurve,
		prevalence,
		rocAuc,
		rocCurve,
		snapThreshold,
		toPixel,
	} from '$lib/demos/metrics-validation';

	/** Threshold demo: confusion matrix, metrics, ROC and PR curves. Registers itself as demo `metrics-validation`. */
	let { initial }: { initial?: Partial<MetricsDemoState> } = $props();

	/** Fixed sample: the curves do not depend on the threshold, only the marker does. */
	const samples = makeSamples();
	const rocPts = rocCurve(samples);
	const prPts = prCurve(samples);
	const auc = rocAuc(samples);
	const base = prevalence(samples);

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let threshold = $state(snapThreshold(initial?.threshold ?? DEFAULT_THRESHOLD));

	const c = $derived(confusion(samples, threshold));
	const m = $derived(metrics(c));
	const description = $derived(describeState(c, m, threshold));

	const rocD = curvePath(rocPts);
	const prD = curvePath(prPts);
	const rocMark = $derived(toPixel({ x: m.fpr, y: m.recall }));
	const prMark = $derived(toPixel({ x: m.recall, y: m.precision }));
	const axis0 = CHART_PAD;
	const axis1 = CHART_SIZE - CHART_PAD;
	const span = axis1 - axis0;
	const baseY = toPixel({ x: 0, y: base }).py;
	const fmt = (v: number): string => v.toFixed(2);

	function apply(patch: Partial<MetricsDemoState>): void {
		if (typeof patch.threshold === 'number') threshold = snapThreshold(patch.threshold);
	}

	function reset(): void {
		threshold = DEFAULT_THRESHOLD;
	}

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	onMount(() => {
		return demos?.register('metrics-validation', {
			set: (patch) => apply(patch as Partial<MetricsDemoState>),
		});
	});
</script>

<figure class="mv" id="demo-metrics-validation" data-demo="metrics-validation">
	<div class="mv-controls">
		<label class="mv-ctl">
			<span class="mv-label"><span class="mv-sym">t</span> (порог)</span>
			<input
				class="mv-range"
				type="range"
				min={THRESHOLD_MIN}
				max={THRESHOLD_MAX}
				step={THRESHOLD_STEP}
				value={threshold}
				aria-describedby="mv-desc"
				oninput={(e) => (threshold = snapThreshold(Number(e.currentTarget.value)))}
			/>
			<output class="mv-val">{fmt(threshold)}</output>
		</label>
		<button type="button" class="mv-btn" onclick={reset}>Сброс</button>
	</div>

	<div class="mv-top">
		<table class="mv-table">
			<caption>Матрица ошибок при пороге {fmt(threshold)}</caption>
			<thead>
				<tr>
					<td></td>
					<th scope="col">Истина: 1</th>
					<th scope="col">Истина: 0</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row">Модель: 1</th>
					<td class="mv-cell mv-ok"><span class="mv-k">TP</span> {c.tp}</td>
					<td class="mv-cell mv-err"><span class="mv-k">FP</span> {c.fp}</td>
				</tr>
				<tr>
					<th scope="row">Модель: 0</th>
					<td class="mv-cell mv-err"><span class="mv-k">FN</span> {c.fn}</td>
					<td class="mv-cell mv-ok"><span class="mv-k">TN</span> {c.tn}</td>
				</tr>
			</tbody>
		</table>

		<dl class="mv-metrics">
			<div>
				<dt>Доля верных</dt>
				<dd>{fmt(m.accuracy)}</dd>
			</div>
			<div>
				<dt>Точность</dt>
				<dd>{fmt(m.precision)}</dd>
			</div>
			<div>
				<dt>Полнота</dt>
				<dd>{fmt(m.recall)}</dd>
			</div>
			<div>
				<dt>F1</dt>
				<dd>{fmt(m.f1)}</dd>
			</div>
			<div>
				<dt>FPR</dt>
				<dd>{fmt(m.fpr)}</dd>
			</div>
			<div class="mv-auc">
				<dt>ROC AUC</dt>
				<dd>{fmt(auc)}</dd>
			</div>
		</dl>
	</div>

	<div class="mv-plots">
		<div class="mv-panel">
			<p class="mv-panel-t">ROC-кривая</p>
			<svg
				class="mv-svg"
				viewBox="0 0 {CHART_SIZE} {CHART_SIZE}"
				role="img"
				aria-labelledby="mv-roc-title mv-roc-desc"
			>
				<title id="mv-roc-title">ROC-кривая: полнота от доли ложных срабатываний</title>
				<desc id="mv-roc-desc">
					Текущий порог: FPR {fmt(m.fpr)}, полнота {fmt(m.recall)}. ROC AUC {fmt(auc)} не зависит от порога.
				</desc>
				<rect class="mv-frame" x={axis0} y={axis0} width={span} height={span} />
				<line class="mv-chance" x1={axis0} y1={axis1} x2={axis1} y2={axis0} />
				<path class="mv-curve" d={rocD} />
				<circle class="mv-marker" cx={rocMark.px.toFixed(1)} cy={rocMark.py.toFixed(1)} r="5" />
				<text class="mv-tick" x={axis0} y={axis1 + 16} text-anchor="middle">0</text>
				<text class="mv-tick" x={axis1} y={axis1 + 16} text-anchor="middle">1</text>
				<text class="mv-tick" x={axis0 - 6} y={axis1} text-anchor="end">0</text>
				<text class="mv-tick" x={axis0 - 6} y={axis0 + 4} text-anchor="end">1</text>
				<text class="mv-axis" x={(axis0 + axis1) / 2} y={CHART_SIZE - 4} text-anchor="middle"
					>FPR</text
				>
				<text
					class="mv-axis"
					x={12}
					y={(axis0 + axis1) / 2}
					text-anchor="middle"
					transform="rotate(-90 12 {(axis0 + axis1) / 2})">TPR</text
				>
			</svg>
		</div>

		<div class="mv-panel">
			<p class="mv-panel-t">PR-кривая</p>
			<svg
				class="mv-svg"
				viewBox="0 0 {CHART_SIZE} {CHART_SIZE}"
				role="img"
				aria-labelledby="mv-pr-title mv-pr-desc"
			>
				<title id="mv-pr-title">PR-кривая: точность от полноты</title>
				<desc id="mv-pr-desc">
					Текущий порог: полнота {fmt(m.recall)}, точность {fmt(m.precision)}. Базовая линия {fmt(
						base,
					)} равна доле положительных.
				</desc>
				<rect class="mv-frame" x={axis0} y={axis0} width={span} height={span} />
				<line class="mv-chance" x1={axis0} y1={baseY} x2={axis1} y2={baseY} />
				<path class="mv-curve" d={prD} />
				<circle class="mv-marker" cx={prMark.px.toFixed(1)} cy={prMark.py.toFixed(1)} r="5" />
				<text class="mv-tick" x={axis0} y={axis1 + 16} text-anchor="middle">0</text>
				<text class="mv-tick" x={axis1} y={axis1 + 16} text-anchor="middle">1</text>
				<text class="mv-tick" x={axis0 - 6} y={axis1} text-anchor="end">0</text>
				<text class="mv-tick" x={axis0 - 6} y={axis0 + 4} text-anchor="end">1</text>
				<text class="mv-axis" x={(axis0 + axis1) / 2} y={CHART_SIZE - 4} text-anchor="middle"
					>полнота</text
				>
				<text
					class="mv-axis"
					x={12}
					y={(axis0 + axis1) / 2}
					text-anchor="middle"
					transform="rotate(-90 12 {(axis0 + axis1) / 2})">точность</text
				>
			</svg>
		</div>
	</div>

	<p class="mv-note" id="mv-desc" aria-live="polite">{description}</p>

	<div class="mv-watch">
		<p class="mv-watch-t">Что заметить</p>
		<ul>
			<li>
				При низком пороге полнота почти 1, но ложных срабатываний много. При высоком порог почти
				ничего не помечает: полнота падает, а доля верных ответов приближается к 0.8, то есть к доле
				отрицательных.
			</li>
			<li>
				Точность и полнота тянут порог в разные стороны. F1 показывает одно число, но скрывает,
				какая из двух величин проседает.
			</li>
			<li>
				ROC AUC на панели не меняется, когда двигается порог: меняется только отметка на кривой.
				Порог выбирают отдельно от качества ранжирования.
			</li>
			<li>
				Базовая линия PR-кривой равна доле положительных. Кривая выше неё лучше случайного
				угадывания, и при дисбалансе это различие видно лучше, чем на ROC-кривой.
			</li>
		</ul>
	</div>
</figure>

<style>
	.mv {
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
	.mv :global(*),
	.mv :global(*::before),
	.mv :global(*::after) {
		box-sizing: border-box;
	}
	.mv dl,
	.mv dd,
	.mv dt,
	.mv p,
	.mv ul {
		margin: 0;
	}
	.mv ul {
		padding-left: var(--space-6);
	}
	.mv button {
		font: inherit;
	}
	.mv-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.mv-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.mv-ctl {
		display: flex;
		flex: 1 1 260px;
		align-items: center;
		gap: var(--space-3);
	}
	.mv-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.mv-range {
		flex: 1 1 140px;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.mv-val {
		min-width: 4ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.mv-btn {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--dur) var(--ease);
	}
	.mv-btn:hover {
		background: var(--bg);
	}
	.mv-btn:focus-visible,
	.mv-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Confusion matrix and metrics */
	.mv-top {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
		align-items: start;
	}
	.mv-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 4px;
		font-size: var(--fs-sm);
	}
	.mv-table caption {
		margin-bottom: var(--space-2);
		text-align: left;
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.mv-table th {
		padding: var(--space-1) var(--space-2);
		color: var(--text-muted);
		font-weight: 400;
		font-size: 12px;
		text-align: center;
	}
	.mv-table tbody th {
		text-align: left;
		white-space: nowrap;
	}
	.mv-cell {
		height: 56px;
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		text-align: center;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: 15px;
	}
	.mv-k {
		display: block;
		font-family: var(--font-sans);
		font-size: 11px;
		opacity: 0.8;
	}
	.mv-ok {
		background: var(--topic-soft);
		color: var(--text);
	}
	.mv-err {
		background: var(--warn-bg);
		color: var(--warn);
	}
	.mv-metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3);
	}
	.mv-metrics dt {
		color: var(--text-muted);
		font-size: 12px;
	}
	.mv-metrics dd {
		margin-top: 2px;
		font-family: var(--font-mono);
		font-size: 18px;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.mv-metrics .mv-auc dd {
		color: var(--topic);
	}

	/* Charts */
	.mv-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.mv-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.mv-svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 300px;
		overflow: visible;
	}
	.mv-frame {
		fill: none;
		stroke: var(--border);
		stroke-width: 1;
	}
	.mv-chance {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.mv-curve {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2.5;
		stroke-linejoin: round;
	}
	.mv-marker {
		fill: var(--cat-1);
		stroke: var(--surface);
		stroke-width: 2;
		transition:
			cx var(--dur) var(--ease),
			cy var(--dur) var(--ease);
	}
	.mv-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.mv-axis {
		fill: var(--text-muted);
		font-size: 12px;
	}

	.mv-note {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.mv-watch {
		margin-top: var(--space-6);
		color: var(--text-muted);
	}
	.mv-watch-t {
		margin-bottom: var(--space-2);
		color: var(--text);
		font-weight: 600;
	}

	@media (prefers-reduced-motion: reduce) {
		.mv *,
		.mv *::before,
		.mv *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.mv {
			padding: var(--space-4);
		}
		.mv-top,
		.mv-plots {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 420px) {
		.mv-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.mv-ctl {
			flex-wrap: wrap;
		}
		.mv-metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
