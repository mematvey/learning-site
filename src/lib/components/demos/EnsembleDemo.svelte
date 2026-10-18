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
		GRID_N,
		NU_MAX,
		NU_MIN,
		NU_STEP,
		ROUNDS_MAX,
		ROUNDS_MIN,
		TREES_MAX,
		TREES_MIN,
		TREE_DEPTH,
		type EnsembleDemoState,
		type GridCell,
		type Vec2,
		describeEnsembles,
		describeModel,
		fitForestWithBags,
		fitGradientBoost,
		fitTree,
		forestProba,
		gbProba,
		gridCells,
		makeDataset,
		oobAccuracy,
		percent,
		predictTree,
		scoreModel,
		snapNu,
		snapRounds,
		snapTrees,
	} from '$lib/demos/ensembles';

	/** Ensembles demo: one tree, a forest and boosting on the same 2D data. Registers as demo `ensembles`. */
	let { initial }: { initial?: Partial<EnsembleDemoState> } = $props();

	/** Square size of one board in px (drawn at this size, no viewBox scaling of the text). */
	const S = 240;

	// Everything below is computed once: the sliders only choose how many members are used.
	const data = makeDataset();
	const singleTree = fitTree(data.train, { maxDepth: TREE_DEPTH, minLeaf: 1 });
	const forest = fitForestWithBags(data.train, TREES_MAX);
	const forestTrees = forest.trees;

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let trees = $state(snapTrees(initial?.trees ?? DEFAULT_STATE.trees));
	/* svelte-ignore state_referenced_locally */
	let rounds = $state(snapRounds(initial?.rounds ?? DEFAULT_STATE.rounds));
	/* svelte-ignore state_referenced_locally */
	let nu = $state(snapNu(initial?.nu ?? DEFAULT_STATE.nu));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const treeProba = (v: Vec2): number => predictTree(singleTree, v);
	const forestProbaFn = $derived((v: Vec2): number => forestProba(forestTrees, trees, v));
	// The stumps depend on the shrinkage, so the model is refit when nu changes.
	const model = $derived(fitGradientBoost(data.train, ROUNDS_MAX, nu));
	const boostProbaFn = $derived((v: Vec2): number => gbProba(model, rounds, v));
	const oob = $derived(oobAccuracy(data.train, forestTrees, forest.inBag, trees));

	const treeScores = scoreModel(treeProba, data);
	const treeCells = gridCells(treeProba);
	const forestScores = $derived(scoreModel(forestProbaFn, data));
	const forestCells = $derived(gridCells(forestProbaFn));
	const boostScores = $derived(scoreModel(boostProbaFn, data));
	const boostCells = $derived(gridCells(boostProbaFn));
	const boostApplied = $derived(Math.min(rounds, model.stumps.length));
	const summary = $derived(
		describeEnsembles(
			{ trees, rounds, nu },
			boostApplied,
			{ tree: treeScores, forest: forestScores, boost: boostScores },
			oob,
		),
	);

	function apply(patch: Partial<EnsembleDemoState>): void {
		if (patch.trees !== undefined) trees = snapTrees(patch.trees);
		if (patch.rounds !== undefined) rounds = snapRounds(patch.rounds);
		if (patch.nu !== undefined) nu = snapNu(patch.nu);
	}

	function reset(): void {
		trees = DEFAULT_STATE.trees;
		rounds = DEFAULT_STATE.rounds;
		nu = DEFAULT_STATE.nu;
	}

	function cellFill(c: GridCell): number {
		return 0.1 + 0.3 * Math.abs(2 * c.p - 1);
	}

	const cellSize = S / GRID_N + 0.5;

	onMount(() => {
		return demos?.register('ensembles', {
			set: (patch) => apply(patch as Partial<EnsembleDemoState>),
		});
	});
</script>

{#snippet board(id: string, title: string, cells: GridCell[], desc: string)}
	<div class="en-panel">
		<p class="en-panel-t">{title}</p>
		<svg class="en-svg" viewBox="0 0 {S} {S}" role="img" aria-labelledby="{id}-title {id}-desc">
			<title id="{id}-title">{title}</title>
			<desc id="{id}-desc">{desc}</desc>
			{#each cells as c, i (i)}
				<rect
					class="en-cell"
					class:en-c1={c.p > 0.5}
					class:en-c0={c.p <= 0.5}
					x={(c.x * S).toFixed(1)}
					y={(c.y * S).toFixed(1)}
					width={cellSize.toFixed(1)}
					height={cellSize.toFixed(1)}
					fill-opacity={cellFill(c).toFixed(3)}
				/>
			{/each}
			{#each data.train as p, i (i)}
				<circle
					class="en-pt en-pt-{p.label}"
					cx={(p.x * S).toFixed(1)}
					cy={((1 - p.y) * S).toFixed(1)}
					r="3"
				/>
			{/each}
			{#each data.test as p, i (i)}
				<circle
					class="en-pt-test en-pt-{p.label}"
					cx={(p.x * S).toFixed(1)}
					cy={((1 - p.y) * S).toFixed(1)}
					r="3"
				/>
			{/each}
		</svg>
	</div>
{/snippet}

<figure class="en" id="demo-ensembles" data-demo="ensembles" class:hl-on={hl !== null}>
	<div class="en-controls">
		<label class="en-ctl">
			<span class="en-label">Деревьев в лесу</span>
			<input
				class="en-range"
				type="range"
				min={TREES_MIN}
				max={TREES_MAX}
				step="1"
				value={trees}
				oninput={(e) => (trees = snapTrees(Number(e.currentTarget.value)))}
			/>
			<output class="en-val">{trees}</output>
		</label>

		<label class="en-ctl">
			<span class="en-label">Итераций бустинга</span>
			<input
				class="en-range"
				type="range"
				min={ROUNDS_MIN}
				max={ROUNDS_MAX}
				step="1"
				value={rounds}
				oninput={(e) => (rounds = snapRounds(Number(e.currentTarget.value)))}
			/>
			<output class="en-val">{rounds}</output>
		</label>

		<label class="en-ctl">
			<span class="en-label">Сжатие ν</span>
			<input
				class="en-range"
				type="range"
				min={NU_MIN}
				max={NU_MAX}
				step={NU_STEP}
				value={nu}
				oninput={(e) => (nu = snapNu(Number(e.currentTarget.value)))}
			/>
			<output class="en-val">{nu.toFixed(2)}</output>
		</label>

		<button type="button" class="en-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="en-panels">
		{@render board(
			'en-tree',
			`Одно дерево (глубина ${TREE_DEPTH})`,
			treeCells,
			describeModel('Одно дерево', treeScores),
		)}
		{@render board(
			'en-forest',
			`Лес: ${trees} деревьев`,
			forestCells,
			describeModel(`Лес из ${trees} деревьев`, forestScores),
		)}
		{@render board(
			'en-boost',
			`Градиентный бустинг: ${rounds} итераций, ν = ${nu.toFixed(2)}`,
			boostCells,
			describeModel(`Бустинг из ${boostApplied} итераций`, boostScores),
		)}
	</div>

	<p class="en-legend">
		<span class="en-key"><span class="en-sw en-sw-1"></span>класс 1</span>
		<span class="en-key"><span class="en-sw en-sw-0"></span>класс 0</span>
		<span class="en-key">● обучение</span>
		<span class="en-key">○ контроль</span>
	</p>

	<table class="en-table">
		<thead>
			<tr>
				<th scope="col">Модель</th>
				<th scope="col">Обучение</th>
				<th scope="col">Контроль</th>
				<th scope="col">Out-of-bag</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<th scope="row">Одно дерево</th>
				<td>{percent(treeScores.train)}</td>
				<td>{percent(treeScores.test)}</td>
				<td>—</td>
			</tr>
			<tr>
				<th scope="row">Лес</th>
				<td>{percent(forestScores.train)}</td>
				<td>{percent(forestScores.test)}</td>
				<td
					>{oob.covered > 0
						? `${percent(oob.accuracy)} (${oob.covered} из ${data.train.length})`
						: '—'}</td
				>
			</tr>
			<tr>
				<th scope="row">Бустинг</th>
				<td>{percent(boostScores.train)}</td>
				<td>{percent(boostScores.test)}</td>
				<td>—</td>
			</tr>
		</tbody>
	</table>

	<p class="en-live" aria-live="polite">{summary}</p>

	<div class="en-notice">
		<p class="en-notice-t">Что заметить</p>
		<ul>
			<li>
				Одно глубокое дерево запоминает шум обучения: точность на обучении высокая, на контроле
				заметно ниже.
			</li>
			<li>
				Лес усредняет деревья, каждое учится на своей выборке. Граница становится глаже, и точность
				на контроле растёт, пока деревьев мало.
			</li>
			<li>
				Градиентный бустинг добавляет пни, подогнанные под остатки, с множителем ν. Малое ν даёт
				гладкую траекторию, но нужно больше итераций; большое ν и много итераций подгоняют шум.
				Сравни контроль при разных ν и числе итераций.
			</li>
			<li>
				Out-of-bag оценка леса считается по обучающим примерам, но каждый пример предсказывают
				только деревья, которые его не видели: она близка к точности на контроле без отдельной
				выборки. При малом числе деревьев часть примеров ещё не покрыта.
			</li>
		</ul>
	</div>
</figure>

<style>
	.en {
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
	.en :global(*),
	.en :global(*::before),
	.en :global(*::after) {
		box-sizing: border-box;
	}
	.en p,
	.en ul {
		margin: 0;
	}
	.en button {
		font: inherit;
	}

	/* Controls */
	.en-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.en-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.en-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.en-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.en-val {
		min-width: 3ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.en-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: border-color var(--dur) var(--ease);
	}
	.en-reset:hover {
		border-color: var(--topic);
	}
	.en-range:focus-visible,
	.en-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Boards */
	.en-panels {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.en-panel {
		min-width: 0;
	}
	.en-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.en-svg {
		display: block;
		width: 100%;
		height: auto;
		max-width: 260px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
	}
	.en-cell {
		stroke: none;
		transition: fill-opacity var(--dur) var(--ease);
	}
	.en-c1 {
		fill: var(--cat-1);
	}
	.en-c0 {
		fill: var(--cat-2);
	}
	.en-pt {
		stroke: var(--surface);
		stroke-width: 0.8;
	}
	.en-pt-1 {
		fill: var(--cat-1);
	}
	.en-pt-0 {
		fill: var(--cat-2);
	}
	.en-pt-test {
		fill: none;
		stroke-width: 1.2;
	}
	.en-pt-test.en-pt-1 {
		stroke: var(--cat-1);
	}
	.en-pt-test.en-pt-0 {
		stroke: var(--cat-2);
	}

	.en-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-size: 12px;
	}
	.en-key {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.en-sw {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 3px;
		opacity: 0.4;
	}
	.en-sw-1 {
		background: var(--cat-1);
	}
	.en-sw-0 {
		background: var(--cat-2);
	}

	/* Scores */
	.en-table {
		width: 100%;
		margin-top: var(--space-6);
		border-collapse: collapse;
		font-size: 13px;
		transition: opacity var(--dur) var(--ease);
	}
	.en-table th,
	.en-table td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border);
		text-align: left;
	}
	.en-table thead th {
		color: var(--text-muted);
		font-weight: 500;
	}
	.en-table td {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.en-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	.en-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
	}
	.en-notice-t {
		margin-bottom: var(--space-2);
		font-weight: 600;
		color: var(--text);
	}
	.en-notice ul {
		padding-left: var(--space-4);
	}
	.en-notice li + li {
		margin-top: var(--space-1);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT): dims the scores */
	.en.hl-on .en-table {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.en *,
		.en *::before,
		.en *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.en {
			padding: var(--space-4);
		}
		.en-panels {
			grid-template-columns: minmax(0, 1fr);
		}
		.en-svg {
			max-width: 100%;
		}
	}

	@media (max-width: 559px) {
		.en-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.en-ctl {
			flex-wrap: wrap;
		}
		.en-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
