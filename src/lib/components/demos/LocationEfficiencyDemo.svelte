<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { PsiKind } from '$lib/demos/robust-core';
	import {
		BISQ_C,
		EPS_DEFAULT,
		EPS_MAX,
		EPS_MIN,
		EPS_STEP,
		GRID_BISQ,
		GRID_HUBER,
		HUBER_C,
		TABLE_BISQ,
		TABLE_HUBER,
		cachedLocValue,
		fillLocValues,
		medianValue,
		snapEps,
		type LocPoint,
	} from '$lib/components/demos/robust/location-grid';
	import { MC_R, runLocationMc, type McResult } from '$lib/components/demos/robust/location-mc';

	/** Asymptotic location factor V_mu(c) for Huber and bisquare psi, with a Monte-Carlo check. */
	let { initial }: { initial?: { eps?: number } } = $props();

	type Pt = { c: number; v: number };
	interface TableRow {
		kind: PsiKind;
		c: number;
		v: number | undefined;
	}

	const GRID_POINTS: LocPoint[] = [
		...GRID_HUBER.map((c) => ({ kind: 'huber' as const, c })),
		...GRID_BISQ.map((c) => ({ kind: 'bisquare' as const, c })),
	];
	const TABLE_POINTS: LocPoint[] = [
		...TABLE_HUBER.map((c) => ({ kind: 'huber' as const, c })),
		...TABLE_BISQ.map((c) => ({ kind: 'bisquare' as const, c })),
	];

	/* The props only seed the initial state: the demo owns it afterwards. */
	/* svelte-ignore state_referenced_locally */
	let eps = $state(snapEps(initial?.eps ?? EPS_DEFAULT));

	let huberPts = $state<Pt[]>([]);
	let bisqPts = $state<Pt[]>([]);
	let medianV = $state(1);
	let gridReady = $state(false);
	let plotW = $state(0);

	let tableRows = $state<TableRow[]>(TABLE_POINTS.map((p) => ({ ...p, v: undefined })));

	/* Monte-Carlo check */
	let simRunning = $state(false);
	let simDone = $state(0);
	let simResult = $state<McResult | null>(null);
	let simToken = 0;

	function collect(kind: PsiKind, cs: readonly number[], e: number): Pt[] {
		const out: Pt[] = [];
		for (const c of cs) {
			const v = cachedLocValue(e, { kind, c });
			if (v !== undefined) out.push({ c, v });
		}
		return out;
	}

	function refreshGrid(e: number): void {
		huberPts = collect('huber', GRID_HUBER, e);
		bisqPts = collect('bisquare', GRID_BISQ, e);
		medianV = medianValue(e);
	}

	function refreshTable(): void {
		tableRows = TABLE_POINTS.map((p) => ({
			kind: p.kind,
			c: p.c,
			v: cachedLocValue(EPS_DEFAULT, p),
		}));
	}

	let gridToken = 0;
	/** Recomputes the curves for `e` in chunks; a newer eps cancels the older run. */
	function loadGrid(e: number): void {
		const my = ++gridToken;
		gridReady = false;
		refreshGrid(e);
		void fillLocValues(e, GRID_POINTS, {
			isCurrent: () => my === gridToken,
			onChunk: () => refreshGrid(e),
		}).then((ok) => {
			if (ok) gridReady = true;
		});
	}

	$effect(() => {
		const e = eps;
		untrack(() => loadGrid(e));
	});

	onMount(() => {
		refreshTable();
		void fillLocValues(EPS_DEFAULT, TABLE_POINTS, { onChunk: refreshTable });
	});

	function setEps(v: number): void {
		eps = snapEps(v);
		simToken++;
		simRunning = false;
		simResult = null;
		simDone = 0;
	}

	async function runSim(): Promise<void> {
		const e = eps;
		const my = ++simToken;
		simRunning = true;
		simDone = 0;
		simResult = null;
		const res = await runLocationMc(e, {
			onProgress: (d) => {
				if (my === simToken) simDone = d;
			},
			isCancelled: () => my !== simToken,
		});
		if (my !== simToken || !res) return;
		simRunning = false;
		simResult = res;
	}

	const fmt = (v: number, d = 2): string => v.toFixed(d).replace('.', ',');

	function argmin(pts: Pt[]): Pt | null {
		let best: Pt | null = null;
		for (const p of pts) if (!best || p.v < best.v) best = p;
		return best;
	}
	const huberMin = $derived(argmin(huberPts));
	const bisqMin = $derived(argmin(bisqPts));

	// SVG geometry, drawn at the real width (no viewBox scaling of text).
	const H = 260;
	const PAD = { l: 44, r: 12, t: 14, b: 30 };
	const W = $derived(Math.max(320, plotW));
	const X0 = 0.5;
	const X1 = 7;
	const xOf = (c: number): number => PAD.l + ((c - X0) / (X1 - X0)) * (W - PAD.l - PAD.r);

	const yDom = $derived.by(() => {
		let lo = Math.min(1, medianV);
		let hi = Math.max(1, medianV);
		for (const p of [...huberPts, ...bisqPts]) {
			lo = Math.min(lo, p.v);
			hi = Math.max(hi, p.v);
		}
		const pad = (hi - lo) * 0.08 || 0.05;
		return { lo: Math.max(0, lo - pad), hi: hi + pad };
	});
	const yOf = (v: number): number =>
		PAD.t + (1 - (v - yDom.lo) / (yDom.hi - yDom.lo)) * (H - PAD.t - PAD.b);
	const yTicks = $derived(
		Array.from({ length: 5 }, (_, i) => yDom.lo + ((yDom.hi - yDom.lo) * i) / 4),
	);
	const xTicks = [1, 2, 3, 4, 5, 6, 7];
	const pathOf = (pts: Pt[]): string =>
		pts.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.c).toFixed(1)} ${yOf(p.v).toFixed(1)}`).join(' ');

	const chartDesc = $derived(
		`При ε = ${fmt(eps)}: минимум V_μ для Хубера ${huberMin ? `при c = ${fmt(huberMin.c, 1)}, V = ${fmt(huberMin.v, 3)}` : 'ещё не вычислен'}; для bisquare ${bisqMin ? `при c = ${fmt(bisqMin.c, 2)}, V = ${fmt(bisqMin.v, 3)}` : 'ещё не вычислен'}. Среднее: V = 1; медиана: V = ${fmt(medianV, 3)}.`,
	);

	const tableView = $derived([
		{ name: 'Среднее', c: null as number | null, v: 1 as number | null },
		{ name: 'Медиана', c: null as number | null, v: medianV as number | null },
		...tableRows.map((r) => ({
			name: r.kind === 'huber' ? 'Хубер' : 'Tukey bisquare',
			c: r.c as number | null,
			v: r.v ?? null,
		})),
	]);
	const chosen = (name: string, c: number | null): boolean =>
		(name === 'Хубер' && c === HUBER_C) || (name === 'Tukey bisquare' && c === BISQ_C);
</script>

<figure class="le" id="demo-location-efficiency" data-demo="location-efficiency">
	<div class="le-controls">
		<label class="le-slider">
			<span class="le-slider-label">
				Доля выбросов ε = <output class="le-eps" aria-live="polite">{fmt(eps, 2)}</output>
			</span>
			<input
				type="range"
				min={EPS_MIN}
				max={EPS_MAX}
				step={EPS_STEP}
				value={eps}
				oninput={(e) => setEps(Number(e.currentTarget.value))}
			/>
		</label>
		<p class="le-hint">
			{gridReady ? 'Кривые посчитаны для этого ε.' : 'Считаем кривые V_μ(c)…'}
		</p>
	</div>

	<div class="le-plot" bind:clientWidth={plotW}>
		<svg
			class="le-svg"
			width={W}
			height={H}
			viewBox="0 0 {W} {H}"
			role="img"
			aria-labelledby="le-chart-title le-chart-desc"
		>
			<title id="le-chart-title">Фактор асимптотической дисперсии положения V_μ(c)</title>
			<desc id="le-chart-desc">{chartDesc}</desc>
			{#each yTicks as t, k (k)}
				<line class="le-grid" x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} />
				<text class="le-tick" x={PAD.l - 6} y={yOf(t) + 4} text-anchor="end">{fmt(t)}</text>
			{/each}
			{#each xTicks as t (t)}
				<text class="le-tick" x={xOf(t)} y={H - 10} text-anchor="middle">{t}</text>
			{/each}
			<line class="le-axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
			<line class="le-ref" x1={PAD.l} x2={W - PAD.r} y1={yOf(1)} y2={yOf(1)} />
			<text class="le-ref-label" x={W - PAD.r - 4} y={yOf(1) - 5} text-anchor="end"
				>среднее, V = 1</text
			>
			<line
				class="le-ref le-ref-median"
				x1={PAD.l}
				x2={W - PAD.r}
				y1={yOf(medianV)}
				y2={yOf(medianV)}
			/>
			<text class="le-ref-label" x={W - PAD.r - 4} y={yOf(medianV) - 5} text-anchor="end"
				>медиана</text
			>
			<path class="le-line le-huber" d={pathOf(huberPts)} fill="none" />
			<path class="le-line le-bisq" d={pathOf(bisqPts)} fill="none" />
			{#if huberMin}
				<circle class="le-min le-huber" cx={xOf(huberMin.c)} cy={yOf(huberMin.v)} r="4.5" />
			{/if}
			{#if bisqMin}
				<circle class="le-min le-bisq" cx={xOf(bisqMin.c)} cy={yOf(bisqMin.v)} r="4.5" />
			{/if}
		</svg>
	</div>

	<ul class="le-legend" aria-label="Обозначения; по горизонтали отложена настройка c">
		<li><span class="le-swatch le-swatch-huber"></span>Хубер, ψ(u) = clip(u, ±c)</li>
		<li><span class="le-swatch le-swatch-bisq"></span>Tukey bisquare, ψ(u) = u(1 − (u/c)²)²</li>
	</ul>

	<dl class="le-stats">
		<div>
			<dt>Минимум, Хубер</dt>
			<dd>{huberMin ? `c = ${fmt(huberMin.c, 1)}, V = ${fmt(huberMin.v, 4)}` : '—'}</dd>
		</div>
		<div>
			<dt>Минимум, bisquare</dt>
			<dd>{bisqMin ? `c = ${fmt(bisqMin.c, 2)}, V = ${fmt(bisqMin.v, 4)}` : '—'}</dd>
		</div>
	</dl>

	<div class="le-row">
		<p class="le-label">
			Таблица при ε = 0,05 (как в ноутбуке). Эффективность = 1 / V: во сколько раз меньше дисперсия
			относительно среднего.
		</p>
		<div class="le-table-wrap">
			<table class="le-table">
				<thead>
					<tr>
						<th scope="col">Оценка</th>
						<th scope="col">c</th>
						<th scope="col">V_μ</th>
						<th scope="col">Эффективность</th>
					</tr>
				</thead>
				<tbody>
					{#each tableView as r, k (k)}
						<tr class:le-chosen={chosen(r.name, r.c)}>
							<td>{r.name}</td>
							<td class="le-num"
								>{r.c === null ? '—' : fmt(r.c, Number.isInteger(r.c * 10) ? 1 : 3)}</td
							>
							<td class="le-num">{r.v === null ? '…' : fmt(r.v, 4)}</td>
							<td class="le-num">{r.v === null ? '…' : fmt(1 / r.v, 3)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="le-hint">Выбраны в ноутбуке: Хубер c = 1,5 и bisquare c = 4,685 (выделены жирным).</p>
	</div>

	<div class="le-row">
		<p class="le-label">
			Симуляция: R = {MC_R} выборок по n = 500 из смеси при ε = {fmt(eps, 2)}. Масштаб — M-scale
			bisquare (c = 1,54764), калибровка b_F из модели. Сравниваем n·Var(μ̂)/σ² с V_μ.
		</p>
		<div class="le-buttons">
			<button type="button" class="le-btn" onclick={runSim} disabled={simRunning}
				>Проверить симуляцией</button
			>
		</div>
		{#if simRunning}
			<p class="le-live" aria-live="polite">Повторов: {simDone} из {MC_R}…</p>
		{:else if simResult}
			<div class="le-table-wrap">
				<table class="le-table">
					<thead>
						<tr>
							<th scope="col">Оценка</th>
							<th scope="col">n·Var/σ², симуляция</th>
							<th scope="col">V_μ, теория</th>
						</tr>
					</thead>
					<tbody>
						{#each simResult.rows as r (r.name)}
							<tr>
								<td>{r.name}</td>
								<td class="le-num">{fmt(r.emp, 3)}</td>
								<td class="le-num">{fmt(r.theory, 3)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="le-live" aria-live="polite">
				Результат при ε = {fmt(simResult.eps, 2)}, b_F = {fmt(simResult.bF, 4)}. При R = {MC_R}
				разброс оценки дисперсии около 10%, поэтому совпадение примерное.
			</p>
		{/if}
	</div>

	<p class="le-note">
		<strong>Что заметить:</strong> V = 1 у среднего задано нормировкой Var(U) = 1 при любом ε; у робастных
		оценок V зависит от ε и c. Вывод верен для этой модели смеси и этих c.
	</p>
</figure>

<style>
	.le {
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
	.le :global(*),
	.le :global(*::before),
	.le :global(*::after) {
		box-sizing: border-box;
	}
	.le p,
	.le dl,
	.le dd,
	.le dt,
	.le ul {
		margin: 0;
	}
	.le ul {
		padding: 0;
		list-style: none;
	}
	.le button {
		font: inherit;
	}
	.le-hint {
		margin-top: var(--space-2);
		color: var(--text-muted);
	}
	.le-controls {
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.le-slider {
		display: grid;
		gap: var(--space-2);
	}
	.le-slider input {
		width: 100%;
		accent-color: var(--topic);
	}
	.le-slider input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.le-eps {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.le-plot {
		margin-top: var(--space-4);
	}
	.le-svg {
		display: block;
		max-width: 100%;
		overflow: visible;
	}
	.le-grid,
	.le-axis {
		stroke: var(--border);
		stroke-width: 1;
	}
	.le-tick,
	.le-ref-label {
		font-size: 11px;
		fill: var(--text-muted);
	}
	.le-ref {
		stroke: var(--text);
		stroke-width: 1.25;
		stroke-dasharray: 4 3;
		opacity: 0.6;
	}
	.le-ref-median {
		stroke: var(--text-muted);
	}
	.le-line {
		stroke-width: 2.25;
	}
	.le-line.le-huber {
		stroke: var(--topic);
	}
	.le-line.le-bisq {
		stroke: var(--accent);
	}
	.le-min {
		stroke: var(--surface);
		stroke-width: 2;
	}
	.le-min.le-huber {
		fill: var(--topic);
	}
	.le-min.le-bisq {
		fill: var(--accent);
	}
	.le-swatch-huber {
		background: var(--topic);
	}
	.le-swatch-bisq {
		background: var(--accent);
	}
	.le-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.le-legend li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.le-swatch {
		display: inline-block;
		width: 16px;
		height: 3px;
		border-radius: 2px;
	}
	.le-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.le-stats dt {
		color: var(--text-muted);
		font-size: 12px;
	}
	.le-stats dd {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.le-row {
		margin-top: var(--space-5);
	}
	.le-label {
		color: var(--text-muted);
		margin-bottom: var(--space-2);
	}
	.le-table-wrap {
		overflow-x: auto;
	}
	.le-table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.le-table th,
	.le-table td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border);
		text-align: left;
	}
	.le-table th {
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 500;
	}
	.le-num {
		text-align: right;
	}
	.le-chosen td {
		font-weight: 700;
	}
	.le-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-3) 0;
	}
	.le-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--topic);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--topic);
		cursor: pointer;
	}
	.le-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.le-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.le-live {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.le-note {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	@media (max-width: 559px) {
		.le {
			padding: var(--space-4);
		}
	}
</style>
