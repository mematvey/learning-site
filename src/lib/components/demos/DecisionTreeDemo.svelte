<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		CRITERIA,
		DATASET,
		DEFAULT_STATE,
		DEPTH_MAX,
		DEPTH_MIN,
		TEST_DATASET,
		accuracyByDepth,
		type Criterion,
		type DecisionTreeDemoState,
		type SplitLine,
		type TreeNode,
		buildTree,
		countOf,
		describeTree,
		impurity,
		impurityCurve,
		isCriterion,
		nodeText,
		partition,
		snapDepth,
	} from '$lib/demos/decision-trees';

	/** Decision tree demo on a fixed two-class dataset. Registers itself as demo `decision-trees`. */
	let { initial }: { initial?: Partial<DecisionTreeDemoState> } = $props();

	/** Start state from the props; «Сбросить» returns to it. */
	/* svelte-ignore state_referenced_locally */
	const start: DecisionTreeDemoState = {
		depth: snapDepth(initial?.depth ?? DEFAULT_STATE.depth),
		criterion: isCriterion(initial?.criterion) ? initial.criterion : DEFAULT_STATE.criterion,
	};

	// The props only seed the initial state: the demo owns it afterwards.
	let depth = $state(start.depth);
	let criterion = $state<Criterion>(start.criterion);
	let showTest = $state(true);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	/* Plane geometry: data space [0, 1]², y grows upwards, drawn in a square viewBox. */
	const VB = 320;
	const PAD = 14;
	const SIZE = VB - 2 * PAD;
	const H_VB = 336;
	const px = (x: number): string => (PAD + x * SIZE).toFixed(1);
	const py = (y: number): string => (PAD + (1 - y) * SIZE).toFixed(1);

	/* Impurity chart geometry. */
	const CW = 320;
	const CH = 220;
	const C_LEFT = 30;
	const C_RIGHT = 10;
	const C_TOP = 10;
	const C_BOTTOM = 26;
	const cx = (p: number): string => (C_LEFT + p * (CW - C_LEFT - C_RIGHT)).toFixed(1);
	const cy = (v: number): string => (C_TOP + (1 - v) * (CH - C_TOP - C_BOTTOM)).toFixed(1);

	const byDepth = $derived(accuracyByDepth(criterion));
	/* Accuracy-by-depth chart: y from 0.4 to 1. */
	const A_MIN = 0.4;
	const ax = (d: number): string => (C_LEFT + (d / DEPTH_MAX) * (CW - C_LEFT - C_RIGHT)).toFixed(1);
	const ay = (v: number): string =>
		(C_TOP + (1 - (v - A_MIN) / (1 - A_MIN)) * (CH - C_TOP - C_BOTTOM)).toFixed(1);
	const trainPath = $derived(
		byDepth.map((r, i) => `${i === 0 ? 'M' : 'L'}${ax(r.depth)} ${ay(r.train)}`).join(' '),
	);
	const testPath = $derived(
		byDepth.map((r, i) => `${i === 0 ? 'M' : 'L'}${ax(r.depth)} ${ay(r.test)}`).join(' '),
	);
	const curAcc = $derived(byDepth[depth]);

	const tree = $derived<TreeNode>(buildTree(DATASET, depth, criterion));
	const parts = $derived(partition(tree));
	const desc = $derived(describeTree(tree, DATASET, criterion, TEST_DATASET));
	const critName = $derived(criterion === 'gini' ? 'Джини' : 'энтропия');

	const cells = $derived(
		parts.cells.map((c) => ({
			x: px(c.box.x0),
			y: py(c.box.y1),
			w: ((c.box.x1 - c.box.x0) * SIZE).toFixed(1),
			h: ((c.box.y1 - c.box.y0) * SIZE).toFixed(1),
			prediction: c.prediction,
		})),
	);

	function lineCoords(l: SplitLine): { x1: string; y1: string; x2: string; y2: string } {
		if (l.feature === 0) {
			return {
				x1: px(l.threshold),
				y1: py(l.box.y1),
				x2: px(l.threshold),
				y2: py(l.box.y0),
			};
		}
		return {
			x1: px(l.box.x0),
			y1: py(l.threshold),
			x2: px(l.box.x1),
			y2: py(l.threshold),
		};
	}
	const lines = $derived(
		parts.lines.map((l) => ({ key: `${l.feature}-${l.threshold}-${l.depth}`, ...lineCoords(l) })),
	);

	/* Curves: impurity of a two-class node versus the share p of class 1. */
	const curve = impurityCurve(100);
	const giniPath = curve.map((c, i) => `${i === 0 ? 'M' : 'L'}${cx(c.p)} ${cy(c.gini)}`).join(' ');
	const entropyPath = curve
		.map((c, i) => `${i === 0 ? 'M' : 'L'}${cx(c.p)} ${cy(c.entropy)}`)
		.join(' ');
	const rootCounts = countOf(DATASET);
	const rootShare = rootCounts[1] / DATASET.length;
	const rootGini = impurity(rootCounts, 'gini');
	const rootEntropy = impurity(rootCounts, 'entropy');

	function apply(patch: Partial<DecisionTreeDemoState>): void {
		if (typeof patch.depth === 'number') depth = snapDepth(patch.depth);
		if (isCriterion(patch.criterion)) criterion = patch.criterion;
	}

	function reset(): void {
		depth = start.depth;
		criterion = start.criterion;
	}

	const CRIT_LABEL: Record<Criterion, string> = { gini: 'Джини', entropy: 'Энтропия' };

	onMount(() => {
		return demos?.register('decision-trees', {
			set: (patch) => apply(patch as Partial<DecisionTreeDemoState>),
		});
	});
</script>

{#snippet branch(node: TreeNode, label: string)}
	<li class="dt-node">
		<span class="dt-edge">{label}</span>
		<span
			class="dt-test"
			class:dt-leaf={!node.split}
			class:dt-c0={!node.split && node.prediction === 0}
			class:dt-c1={!node.split && node.prediction === 1}>{nodeText(node)}</span
		>
		<span class="dt-meta"
			>n = {node.n}, {node.counts[0]}/{node.counts[1]}, {critName} {node.impurity.toFixed(2)}</span
		>
		{#if node.split && node.left && node.right}
			<ul class="dt-tree">
				{@render branch(node.left, 'да')}
				{@render branch(node.right, 'нет')}
			</ul>
		{/if}
	</li>
{/snippet}

<figure class="dt" id="demo-decision-trees" data-demo="decision-trees">
	<div class="dt-controls">
		<label class="dt-ctl">
			<span class="dt-label">Глубина</span>
			<input
				class="dt-range"
				type="range"
				min={DEPTH_MIN}
				max={DEPTH_MAX}
				step="1"
				value={depth}
				oninput={(e) => (depth = snapDepth(Number(e.currentTarget.value)))}
			/>
			<output class="dt-val" aria-live="polite">{depth} из {DEPTH_MAX}</output>
		</label>

		<div class="dt-group" role="group" aria-label="Критерий разбиения">
			{#each CRITERIA as c (c)}
				<button
					type="button"
					class="dt-seg"
					aria-pressed={criterion === c}
					onclick={() => (criterion = c)}>{CRIT_LABEL[c]}</button
				>
			{/each}
		</div>

		<label class="dt-check">
			<input type="checkbox" bind:checked={showTest} />
			<span>Отложенные точки</span>
		</label>

		<button type="button" class="dt-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="dt-plots">
		<div class="dt-panel">
			<p class="dt-panel-t">Разбиение плоскости</p>
			<svg
				class="dt-svg dt-plane"
				viewBox="0 0 {VB} {H_VB}"
				role="img"
				aria-labelledby="dt-plane-title dt-plane-desc"
			>
				<title id="dt-plane-title">Разбиение плоскости деревом глубины {depth}</title>
				<desc id="dt-plane-desc">{desc}</desc>
				<rect class="dt-frame" x={PAD} y={PAD} width={SIZE} height={SIZE} />
				{#each cells as c, i (i)}
					<rect class="dt-cell dt-c{c.prediction}" x={c.x} y={c.y} width={c.w} height={c.h} />
				{/each}
				{#each lines as l (l.key)}
					<line class="dt-split" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
				{/each}
				{#each DATASET as p, i (i)}
					<circle class="dt-pt dt-c{p.c}" cx={px(p.x)} cy={py(p.y)} r="5">
						<title>x₁ = {p.x.toFixed(2)}, x₂ = {p.y.toFixed(2)}, класс {p.c}</title>
					</circle>
				{/each}
				{#if showTest}
					{#each TEST_DATASET as p, i (i)}
						<circle class="dt-test-pt dt-c{p.c}" cx={px(p.x)} cy={py(p.y)} r="3">
							<title
								>отложенная точка: x₁ = {p.x.toFixed(2)}, x₂ = {p.y.toFixed(2)}, класс {p.c}</title
							>
						</circle>
					{/each}
				{/if}
				<text class="dt-axis" x={PAD} y="11">x₂</text>
				<text class="dt-axis" x={VB - PAD} y={H_VB - 4} text-anchor="end">x₁</text>
			</svg>
		</div>

		<div class="dt-panel">
			<p class="dt-panel-t">Мера примеси от доли класса B</p>
			<svg
				class="dt-svg"
				viewBox="0 0 {CW} {CH}"
				role="img"
				aria-labelledby="dt-curve-title dt-curve-desc"
			>
				<title id="dt-curve-title">Джини и энтропия двух классов</title>
				<desc id="dt-curve-desc">
					Корень: доля класса B {rootShare.toFixed(2)}, Джини {rootGini.toFixed(2)}, энтропия {rootEntropy.toFixed(
						2,
					)}.
				</desc>
				<line class="dt-axis-line" x1={cx(0)} y1={cy(0)} x2={cx(1)} y2={cy(0)} />
				<line class="dt-axis-line" x1={cx(0)} y1={cy(0)} x2={cx(0)} y2={cy(1)} />
				<text class="dt-tick" x={cx(0)} y={CH - 8} text-anchor="middle">0</text>
				<text class="dt-tick" x={cx(0.5)} y={CH - 8} text-anchor="middle">0.5</text>
				<text class="dt-tick" x={cx(1)} y={CH - 8} text-anchor="middle">1</text>
				<text class="dt-tick" x={C_LEFT - 6} y={cy(1) + 4} text-anchor="end">1</text>
				<text class="dt-tick" x={C_LEFT - 6} y={cy(0.5) + 4} text-anchor="end">0.5</text>
				<text class="dt-tick" x={C_LEFT - 6} y={cy(0) + 4} text-anchor="end">0</text>
				<line class="dt-root" x1={cx(rootShare)} y1={cy(0)} x2={cx(rootShare)} y2={cy(1)} />
				<path class="dt-curve dt-gini" class:is-active={criterion === 'gini'} d={giniPath} />
				<path
					class="dt-curve dt-entropy"
					class:is-active={criterion === 'entropy'}
					d={entropyPath}
				/>
				<circle class="dt-dot dt-gini-dot" cx={cx(rootShare)} cy={cy(rootGini)} r="4" />
				<circle class="dt-dot dt-entropy-dot" cx={cx(rootShare)} cy={cy(rootEntropy)} r="4" />
			</svg>
			<p class="dt-legend">
				<span class="dt-sw dt-sw-gini"></span>Джини
				<span class="dt-sw dt-sw-entropy"></span>энтропия (бит), пунктир — корень
			</p>
		</div>
	</div>

	<div class="dt-acc">
		<p class="dt-panel-t">Точность по глубине: обучение и отложенные точки</p>
		<svg
			class="dt-svg"
			viewBox="0 0 {CW} {CH}"
			role="img"
			aria-labelledby="dt-acc-title dt-acc-desc"
		>
			<title id="dt-acc-title">Точность на обучении и на отложенных точках по глубине</title>
			<desc id="dt-acc-desc">
				{#each byDepth as r (r.depth)}глубина {r.depth}: обучение {r.train.toFixed(2)}, отложенные {r.test.toFixed(
						2,
					)}.
				{/each}
			</desc>
			<line class="dt-axis-line" x1={ax(0)} y1={ay(A_MIN)} x2={ax(DEPTH_MAX)} y2={ay(A_MIN)} />
			<line class="dt-axis-line" x1={ax(0)} y1={ay(A_MIN)} x2={ax(0)} y2={ay(1)} />
			{#each [0, 1, 2, 3, 4] as d (d)}
				<text class="dt-tick" x={ax(d)} y={CH - 8} text-anchor="middle">{d}</text>
			{/each}
			{#each [0.5, 0.75, 1] as v (v)}
				<text class="dt-tick" x={C_LEFT - 6} y={Number(ay(v)) + 4} text-anchor="end">{v}</text>
			{/each}
			<line class="dt-root" x1={ax(depth)} y1={ay(A_MIN)} x2={ax(depth)} y2={ay(1)} />
			<path class="dt-curve is-active dt-acc-train" d={trainPath} />
			<path class="dt-curve is-active dt-acc-test" d={testPath} />
			{#if curAcc}
				<circle class="dt-dot dt-acc-train-dot" cx={ax(depth)} cy={ay(curAcc.train)} r="4" />
				<circle class="dt-dot dt-acc-test-dot" cx={ax(depth)} cy={ay(curAcc.test)} r="4" />
			{/if}
		</svg>
		<p class="dt-legend">
			<span class="dt-sw dt-sw-train"></span>обучение
			<span class="dt-sw dt-sw-test"></span>отложенные точки ({TEST_DATASET.length} шт.), по оси x глубина
		</p>
	</div>

	<div class="dt-tree-wrap">
		<p class="dt-panel-t">Дерево</p>
		<ul class="dt-tree dt-tree-root">
			{@render branch(tree, 'корень')}
		</ul>
	</div>

	<p class="dt-status" aria-live="polite">{desc}</p>

	<div class="dt-watch">
		<p class="dt-watch-t">Что заметить</p>
		<p>
			Каждый уровень добавляет разбиений и не увеличивает взвешенную примесь листьев, но это не
			значит, что картина улучшается: для Джини точность на обучении на глубинах 3 и 4 одна и та же,
			около 97%, то есть четвёртый уровень ничего не даёт на обучении. Точность на отложенных точках
			(контур, их можно скрыть) растёт до глубины 1–2 и затем падает: дерево глубины 4 запоминает
			шум обучающих точек. Критерии Джини и энтропия на этих данных дают близкие разбиения, но не
			всегда одинаковые.
		</p>
	</div>
</figure>

<style>
	.dt {
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
	.dt :global(*),
	.dt :global(*::before),
	.dt :global(*::after) {
		box-sizing: border-box;
	}
	.dt p,
	.dt ul,
	.dt li {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.dt button {
		font: inherit;
	}

	/* Controls */
	.dt-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.dt-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.dt-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.dt-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.dt-val {
		min-width: 6ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.dt-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.dt-seg {
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
	.dt-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.dt-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.dt-range:focus-visible,
	.dt-seg:focus-visible,
	.dt-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Charts */
	.dt-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.dt-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.dt-svg {
		display: block;
		width: 100%;
		height: auto;
		max-width: 360px;
		overflow: visible;
	}
	.dt-frame {
		fill: none;
		stroke: var(--border);
		stroke-width: 1;
	}
	.dt-cell {
		fill-opacity: 0.14;
		transition: fill-opacity var(--dur) var(--ease);
	}
	.dt-cell.dt-c0 {
		fill: var(--cat-1);
	}
	.dt-cell.dt-c1 {
		fill: var(--cat-2);
	}
	.dt-split {
		stroke: var(--text);
		stroke-width: 1.5;
		opacity: 0.75;
	}
	.dt-pt {
		stroke: var(--surface);
		stroke-width: 1.5;
	}
	.dt-pt.dt-c0 {
		fill: var(--cat-1);
	}
	.dt-pt.dt-c1 {
		fill: var(--cat-2);
	}
	.dt-test-pt {
		fill: none;
		stroke-width: 1.5;
	}
	.dt-test-pt.dt-c0 {
		stroke: var(--cat-1);
	}
	.dt-test-pt.dt-c1 {
		stroke: var(--cat-2);
	}
	.dt-check {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-muted);
		cursor: pointer;
	}
	.dt-acc {
		margin-top: var(--space-6);
	}
	.dt-acc-train,
	.dt-sw-train,
	.dt-acc-train-dot {
		stroke: var(--cat-3);
	}
	.dt-acc-test,
	.dt-sw-test,
	.dt-acc-test-dot {
		stroke: var(--cat-5);
	}
	.dt-sw-train {
		background: var(--cat-3);
	}
	.dt-sw-test {
		background: var(--cat-5);
	}
	.dt-dot.dt-acc-train-dot {
		fill: var(--cat-3);
	}
	.dt-dot.dt-acc-test-dot {
		fill: var(--cat-5);
	}
	.dt-axis,
	.dt-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.dt-axis-line {
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.dt-root {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 4 3;
	}
	.dt-curve {
		fill: none;
		stroke-width: 1.5;
		opacity: 0.55;
		transition: opacity var(--dur) var(--ease);
	}
	.dt-curve.is-active {
		stroke-width: 2.5;
		opacity: 1;
	}
	.dt-gini {
		stroke: var(--topic);
	}
	.dt-entropy {
		stroke: var(--cat-4);
	}
	.dt-dot.dt-gini-dot {
		fill: var(--topic);
	}
	.dt-dot.dt-entropy-dot {
		fill: var(--cat-4);
	}
	.dt-legend {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.dt-sw {
		display: inline-block;
		width: 14px;
		height: 3px;
		margin: 0 var(--space-1) 3px var(--space-2);
		vertical-align: middle;
	}
	.dt-sw-gini {
		background: var(--topic);
	}
	.dt-sw-entropy {
		background: var(--cat-4);
	}

	/* Tree list */
	.dt-tree-wrap {
		margin-top: var(--space-6);
	}
	.dt-tree {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.dt-tree-root {
		overflow-x: auto;
	}
	.dt-tree .dt-tree {
		margin-top: var(--space-2);
		margin-left: var(--space-4);
		padding-left: var(--space-4);
		border-left: 1px dashed var(--border);
	}
	.dt-node {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-3);
	}
	.dt-edge {
		min-width: 3.5em;
		color: var(--text-muted);
		font-size: 12px;
	}
	.dt-test {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text);
	}
	.dt-test.dt-leaf {
		font-weight: 600;
	}
	.dt-test.dt-c0 {
		color: var(--cat-1);
	}
	.dt-test.dt-c1 {
		color: var(--cat-2);
	}
	.dt-meta {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	.dt-status {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.dt-watch {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.dt-watch-t {
		margin-bottom: var(--space-1);
		color: var(--text);
		font-weight: 600;
	}

	@media (prefers-reduced-motion: reduce) {
		.dt *,
		.dt *::before,
		.dt *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.dt {
			padding: var(--space-4);
		}
		.dt-plots {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (max-width: 559px) {
		.dt-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.dt-ctl {
			flex-wrap: wrap;
		}
		.dt-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.dt-tree .dt-tree {
			margin-left: var(--space-2);
			padding-left: var(--space-3);
		}
	}
</style>
