<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		BUDGET_MAX,
		BUDGET_MIN,
		DEFAULT_STATE,
		FULL_UNITS,
		HEAT_N,
		SH_CANDIDATES,
		W_MAX,
		W_MIN,
		W_STEP,
		clamp01,
		compareMethods,
		gridPoints,
		gridSide,
		halvingPlan,
		heatmap,
		qualityMax,
		randomPoints,
		snapBudget,
		snapW,
		type MethodId,
		type Point,
		type SearchState,
	} from '$lib/demos/hyperparameter-search';

	/** Hyperparameter search demo: grid, random and successive halving on one quality surface. */
	let { initial }: { initial?: Partial<SearchState> } = $props();

	/* The props only seed the initial state: the demo owns it afterwards. */
	/* svelte-ignore state_referenced_locally */
	let x0 = $state(clamp01(initial?.x0 ?? DEFAULT_STATE.x0));
	/* svelte-ignore state_referenced_locally */
	let y0 = $state(clamp01(initial?.y0 ?? DEFAULT_STATE.y0));
	/* svelte-ignore state_referenced_locally */
	let w = $state(snapW(initial?.w ?? DEFAULT_STATE.w));
	/* svelte-ignore state_referenced_locally */
	let budget = $state(snapBudget(initial?.budget ?? DEFAULT_STATE.budget));
	let seed = $state(DEFAULT_STATE.seed);
	/** Successive halving: rounds completed, 0..5. */
	let round = $state(0);
	/** Real width of the plot in px; 320 until the first measurement. */
	let plotWidth = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const s = $derived<SearchState>({ x0, y0, w, budget, seed });
	const W = $derived(plotWidth >= 200 ? plotWidth : 320);
	const H = $derived(Math.round(Math.min(W * 0.8, 340)));
	const top = $derived(qualityMax(s));
	const k = $derived(gridSide(budget));
	const grid = $derived(gridPoints(budget));
	const random = $derived(randomPoints(budget, seed));
	const plan = $derived(halvingPlan(s));
	const alive = $derived(plan.survivors[round] ?? []);
	const optPt = $derived(px({ x: x0, y: y0 }));
	const cells = $derived(heatmap(s));
	const results = $derived(compareMethods(s, plan));
	const rounds = $derived(
		plan.budgets.map((b, i) => ({
			n: i + 1,
			configs: (plan.survivors[i] ?? []).length,
			budget: b,
			units: (plan.survivors[i] ?? []).length * b,
			total: plan.spent[i + 1] ?? 0,
		})),
	);
	const rowOf = (id: MethodId) => results.find((r) => r.id === id);
	const gridRow = $derived(rowOf('grid'));
	const randomRow = $derived(rowOf('random'));

	const LABEL: Record<MethodId, string> = {
		grid: `Сетка ${k}×${k}`,
		random: `Случайный поиск`,
		halving: `Последовательный подбор`,
		full: `Полный перебор ${SH_CANDIDATES}`,
	};

	const fmt = (v: number) => v.toFixed(2);
	const pct = (v: number) => Math.round(v * 100);

	/** Explains the current state in one or two sentences; announced through aria-live. */
	const note = $derived.by(() => {
		const parts: string[] = [];
		parts.push(
			`Сетка ${k}×${k} проверила важный параметр в ${k} значениях и тратит ${grid.length} обучений; случайный поиск проверил ${budget} различных значений при ${budget} обучениях.`,
		);
		if (gridRow && randomRow) {
			const closer = randomRow.gap < gridRow.gap ? 'случайный поиск' : 'сетка';
			parts.push(
				`Разрыв до оптимума: сетка ${fmt(gridRow.gap)}, случайный поиск ${fmt(randomRow.gap)}; ближе ${closer}.`,
			);
		}
		if (w < 0.3) {
			parts.push(
				'Второй параметр почти не важен: качество меняется в основном вдоль одной оси, и сетка тратит значения на перебор второго параметра.',
			);
		} else {
			parts.push(
				'Оба параметра заметно влияют на качество. Сдвиньте оптимум или бюджет и сравните методы.',
			);
		}
		return parts.join(' ');
	});

	const live = $derived(
		`${note} Последовательный подбор после ${round} из 5 раундов: ${plan.spent[round] ?? 0} единиц из ${plan.spent[5] ?? 0}.`,
	);

	function px(p: Point): { x: number; y: number } {
		return { x: p.x * W, y: (1 - p.y) * H };
	}

	function diamond(p: Point): string {
		const c = px(p);
		return `${c.x},${c.y - 6} ${c.x + 6},${c.y} ${c.x},${c.y + 6} ${c.x - 6},${c.y}`;
	}

	/** Pointer on the plot moves the optimum (drag keeps it under the pointer). */
	let dragging = false;
	function setFromPointer(e: PointerEvent): void {
		const r = (e.currentTarget as Element).getBoundingClientRect();
		x0 = clamp01((e.clientX - r.left) / W);
		y0 = clamp01(1 - (e.clientY - r.top) / H);
	}
	function onDown(e: PointerEvent): void {
		dragging = true;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		setFromPointer(e);
	}
	function onMove(e: PointerEvent): void {
		if (dragging) setFromPointer(e);
	}
	function onUp(): void {
		dragging = false;
	}

	const KEY_STEP = 0.05;
	/** Arrow keys move the optimum marker; Shift makes a bigger step. */
	function onMarkerKey(e: KeyboardEvent): void {
		const step = e.shiftKey ? KEY_STEP * 2 : KEY_STEP;
		switch (e.key) {
			case 'ArrowLeft':
				x0 = clamp01(x0 - step);
				break;
			case 'ArrowRight':
				x0 = clamp01(x0 + step);
				break;
			case 'ArrowUp':
				y0 = clamp01(y0 + step);
				break;
			case 'ArrowDown':
				y0 = clamp01(y0 - step);
				break;
			default:
				return;
		}
		e.preventDefault();
	}

	function nextRound(): void {
		round = round >= 5 ? 0 : round + 1;
	}

	function reset(): void {
		x0 = DEFAULT_STATE.x0;
		y0 = DEFAULT_STATE.y0;
		w = DEFAULT_STATE.w;
		budget = DEFAULT_STATE.budget;
		seed = DEFAULT_STATE.seed;
		round = 0;
	}

	function newCase(): void {
		seed += 1;
		round = 0;
	}

	onMount(() => {
		return demos?.register('hyperparameter-search', {
			set: (patch) => {
				const p = patch as Partial<SearchState>;
				if (typeof p.x0 === 'number') x0 = clamp01(p.x0);
				if (typeof p.y0 === 'number') y0 = clamp01(p.y0);
				if (typeof p.w === 'number') w = snapW(p.w);
				if (typeof p.budget === 'number') budget = snapBudget(p.budget);
			},
		});
	});
</script>

<figure class="hs" id="demo-hyperparameter-search" data-demo="hyperparameter-search">
	<div class="hs-controls">
		<label class="hs-ctl">
			<span class="hs-label"><span class="hs-sym">w</span> вклад второго параметра</span>
			<input
				class="hs-range"
				type="range"
				min={W_MIN}
				max={W_MAX}
				step={W_STEP}
				value={w}
				oninput={(e) => (w = snapW(Number(e.currentTarget.value)))}
			/>
			<output class="hs-val">{w.toFixed(1)}</output>
		</label>

		<label class="hs-ctl">
			<span class="hs-label">бюджет, испытаний</span>
			<input
				class="hs-range"
				type="range"
				min={BUDGET_MIN}
				max={BUDGET_MAX}
				step="1"
				value={budget}
				oninput={(e) => (budget = snapBudget(Number(e.currentTarget.value)))}
			/>
			<output class="hs-val">{budget}</output>
		</label>

		<div class="hs-btns">
			<button type="button" class="hs-btn" onclick={newCase}>Другой случай</button>
			<button type="button" class="hs-btn" onclick={reset}>Сбросить</button>
		</div>
	</div>

	<div class="hs-plot" bind:clientWidth={plotWidth}>
		<svg
			class="hs-svg"
			width={W}
			height={H}
			viewBox="0 0 {W} {H}"
			role="img"
			aria-labelledby="hs-title hs-desc"
			onpointerdown={onDown}
			onpointermove={onMove}
			onpointerup={onUp}
			onpointercancel={onUp}
		>
			<title id="hs-title">Поверхность качества по двум гиперпараметрам</title>
			<desc id="hs-desc">{live}</desc>

			{#each cells as c (c.ix + '-' + c.iy)}
				<rect
					class="hs-cell"
					x={((c.ix * W) / HEAT_N).toFixed(2)}
					y={(((HEAT_N - 1 - c.iy) * H) / HEAT_N).toFixed(2)}
					width={(W / HEAT_N + 0.5).toFixed(2)}
					height={(H / HEAT_N + 0.5).toFixed(2)}
					fill-opacity={(0.04 + 0.9 * c.q * c.q).toFixed(3)}
				/>
			{/each}

			{#each grid as p, i (i)}
				{@const c = px(p)}
				<rect class="hs-grid" x={c.x - 5} y={c.y - 5} width="10" height="10" />
			{/each}

			{#each random as p, i (i)}
				{@const c = px(p)}
				<circle class="hs-rnd" cx={c.x} cy={c.y} r="4" />
			{/each}

			{#each alive as p, i (i)}
				<polygon class="hs-sh" points={diamond(p)} />
			{/each}

			<g
				class="hs-opt"
				role="button"
				tabindex="0"
				aria-label="Положение оптимума: важный параметр {x0.toFixed(2)}, второй {y0.toFixed(
					2,
				)}. Стрелки двигают точку."
				onkeydown={onMarkerKey}
			>
				<circle cx={optPt.x} cy={optPt.y} r="10" />
				<line x1={optPt.x - 14} x2={optPt.x + 14} y1={optPt.y} y2={optPt.y} />
				<line x1={optPt.x} x2={optPt.x} y1={optPt.y - 14} y2={optPt.y + 14} />
			</g>
		</svg>
	</div>

	<p class="hs-legend" aria-hidden="true">
		<span><i class="hs-k hs-k-grid"></i>сетка</span>
		<span><i class="hs-k hs-k-rnd"></i>случайный поиск</span>
		<span><i class="hs-k hs-k-sh"></i>последовательный подбор</span>
		<span><i class="hs-k hs-k-opt"></i>оптимум: тяните по полю или стрелками</span>
	</p>

	<div class="hs-tables">
		<div class="hs-block">
			<p class="hs-t">Четыре метода на одной поверхности</p>
			<table class="hs-table">
				<thead>
					<tr>
						<th scope="col">Метод</th>
						<th scope="col">Обучений</th>
						<th scope="col">Единиц</th>
						<th scope="col">Качество</th>
						<th scope="col">Разрыв</th>
					</tr>
				</thead>
				<tbody>
					{#each results as r (r.id)}
						<tr>
							<th scope="row">{LABEL[r.id]}</th>
							<td>{r.configs}</td>
							<td>{r.units}</td>
							<td>{fmt(r.value)}</td>
							<td>{fmt(r.gap)} <span class="hs-muted">({pct(1 - r.gap / top)}%)</span></td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="hs-hint">
				Полная тренировка = {FULL_UNITS} единиц. Качество выше — лучше; оптимум поверхности = {fmt(
					top,
				)}, разрыв = оптимум минус качество выбранной точки.
			</p>
		</div>

		<div class="hs-block">
			<p class="hs-t">Последовательный подбор: {SH_CANDIDATES} конфигураций</p>
			<table class="hs-table">
				<thead>
					<tr>
						<th scope="col">Раунд</th>
						<th scope="col">Конфигураций</th>
						<th scope="col">Бюджет на конф.</th>
						<th scope="col">Всего единиц</th>
					</tr>
				</thead>
				<tbody>
					{#each rounds as r (r.n)}
						<tr class:is-done={r.n <= round} class:is-now={r.n === round + 1}>
							<th scope="row">{r.n}</th>
							<td>{r.configs}</td>
							<td>{r.budget}</td>
							<td>{r.total}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="hs-step">
				<button type="button" class="hs-btn hs-btn-main" onclick={nextRound}>
					{round >= 5 ? 'Начать заново' : `Следующий раунд (${round} из 5)`}
				</button>
				<p class="hs-muted">
					Полный перебор тех же {SH_CANDIDATES} конфигураций: {SH_CANDIDATES * FULL_UNITS} единиц.
				</p>
			</div>
		</div>
	</div>
</figure>

<style>
	.hs {
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
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.hs :global(*),
	.hs :global(*::before),
	.hs :global(*::after) {
		box-sizing: border-box;
	}
	.hs p,
	.hs dl {
		margin: 0;
	}
	.hs button {
		font: inherit;
	}
	.hs-muted {
		color: var(--text-muted);
	}

	/* Controls */
	.hs-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.hs-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}
	.hs-label {
		color: var(--text-muted);
	}
	.hs-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}
	.hs-range {
		width: 140px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.hs-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.hs-btns {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.hs-btn {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--dur) var(--ease);
	}
	.hs-btn:hover {
		background: var(--topic-soft);
	}
	.hs-btn-main {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.hs-btn-main:hover {
		background: var(--topic);
		filter: brightness(1.08);
	}
	.hs-range:focus-visible,
	.hs-btn:focus-visible,
	.hs-opt:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Plot */
	.hs-plot {
		margin-top: var(--space-6);
		max-width: 100%;
	}
	.hs-svg {
		display: block;
		max-width: 100%;
		height: auto;
		touch-action: none;
		cursor: crosshair;
		user-select: none;
	}
	.hs-cell {
		fill: var(--topic);
	}
	.hs-grid {
		fill: none;
		stroke: var(--text);
		stroke-width: 1.5;
	}
	.hs-rnd {
		fill: var(--cat-2);
		stroke: var(--surface);
		stroke-width: 1;
	}
	.hs-sh {
		fill: var(--cat-3);
		stroke: var(--surface);
		stroke-width: 1;
	}
	.hs-opt {
		cursor: grab;
	}
	.hs-opt circle {
		fill: var(--surface);
		fill-opacity: 0.6;
		stroke: var(--text);
		stroke-width: 2;
	}
	.hs-opt line {
		stroke: var(--text);
		stroke-width: 2;
	}
	.hs-opt:focus {
		outline: none;
	}
	.hs-opt:focus-visible circle {
		stroke: var(--topic);
		stroke-width: 3;
	}

	.hs-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 12px;
	}
	.hs-legend span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.hs-k {
		display: inline-block;
		width: 10px;
		height: 10px;
		flex: none;
	}
	.hs-k-grid {
		border: 1.5px solid var(--text);
	}
	.hs-k-rnd {
		border-radius: 50%;
		background: var(--cat-2);
	}
	.hs-k-sh {
		background: var(--cat-3);
		transform: rotate(45deg) scale(0.8);
	}
	.hs-k-opt {
		border: 2px solid var(--text);
		border-radius: 50%;
	}

	/* Tables */
	.hs-tables {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.hs-block {
		min-width: 0;
	}
	.hs-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.hs-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.hs-table th,
	.hs-table td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: right;
		vertical-align: top;
	}
	.hs-table th {
		font-weight: 400;
		color: var(--text-muted);
	}
	.hs-table thead th {
		font-size: 12px;
	}
	.hs-table tbody th {
		text-align: left;
		color: var(--text);
	}
	.hs-table tr.is-done th,
	.hs-table tr.is-done td {
		color: var(--text);
	}
	.hs-table tr.is-now th {
		color: var(--topic);
		font-weight: 600;
	}
	.hs-hint {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.hs-step {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-3);
	}
	.hs-step p {
		font-size: 12px;
	}

	@media (prefers-reduced-motion: reduce) {
		.hs *,
		.hs *::before,
		.hs *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.hs {
			padding: var(--space-4);
		}
		.hs-tables {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 559px) {
		.hs-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.hs-ctl {
			flex-wrap: wrap;
		}
		.hs-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.hs-table {
			font-size: 12px;
		}
	}
</style>
