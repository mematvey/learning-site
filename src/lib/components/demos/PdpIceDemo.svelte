<script lang="ts">
	import {
		DEFAULT_RHO,
		DEFAULT_V,
		GRID,
		GRID_MAX,
		GRID_MIN,
		GRID_STEP,
		RHO_MAX,
		RHO_MIN,
		RHO_STEP,
		X_MAX,
		X_MIN,
		conditionalCurve,
		curveDomain,
		describeState,
		iceCurves,
		linePath,
		linScale,
		makeSample,
		offCloudFlags,
		pdpCurve,
		permutationImportance,
		snapRho,
		snapV,
	} from '$lib/demos/interpretability';

	/** PDP and ICE on data with correlated features, plus permutation importance. */
	let { initial }: { initial?: { rho?: number; v?: number } } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let rho = $state(snapRho(initial?.rho ?? DEFAULT_RHO));
	/* svelte-ignore state_referenced_locally */
	let v = $state(snapV(initial?.v ?? DEFAULT_V));

	const W = 360;
	const H = 260;
	const PL = 40;
	const PR = 12;
	const PT = 12;
	const PB = 32;
	/** Horizontal scale for x1 in both charts. */
	const sx = linScale(X_MIN, X_MAX, PL, W - PR);
	/** Vertical scale of the scatter plot (x2). */
	const sxy = linScale(X_MIN, X_MAX, H - PB, PT);
	const ticks = [-1, 0, 1, 2];

	const sample = $derived(makeSample(rho));
	const ice = $derived(iceCurves(sample));
	const pdp = $derived(pdpCurve(ice));
	const cond = $derived(conditionalCurve(sample));
	const flags = $derived(offCloudFlags(sample, v));
	const offCount = $derived(flags.filter(Boolean).length);
	const imp = $derived(permutationImportance(sample));
	const readout = $derived(describeState(sample, v, rho));

	const yDomain = $derived(curveDomain(ice));
	const sy = $derived(linScale(yDomain[0], yDomain[1], H - PB, PT));
	const yTicks = $derived.by(() => {
		const out: number[] = [];
		for (let t = Math.ceil(yDomain[0]); t <= yDomain[1]; t++) out.push(t);
		return out;
	});
	const iceD = $derived(ice.map((row) => linePath(GRID, row, sx, sy)));
	const pdpD = $derived(linePath(GRID, pdp, sx, sy));
	const condD = $derived(linePath(GRID, cond, sx, sy));

	const impRows = $derived([
		{ label: 'x₁ отдельно', value: Math.max(0, imp.x1) },
		{ label: 'x₂ отдельно', value: Math.max(0, imp.x2) },
		{ label: 'x₁ и x₂ вместе', value: Math.max(0, imp.group) },
	]);
	const impMax = $derived(Math.max(...impRows.map((r) => r.value), 1e-9));

	const scatterDesc = $derived(
		`Точки данных с ρ = ${rho.toFixed(2)}. Вертикальная линия при x₁ = ${v.toFixed(1)}: ` +
			`${offCount} из ${sample.x2.length} точек, по которым усредняет PDP, лежат вне облака данных.`,
	);
	const iceDesc = `Тонкие линии: ICE по каждому объекту. Жирная линия: PDP, среднее ICE. Пунктир: условное среднее по данным рядом с x₁.`;

	function reset(): void {
		rho = DEFAULT_RHO;
		v = DEFAULT_V;
	}
</script>

<figure class="pi" id="demo-pdp-ice" data-demo="pdp-ice">
	<div class="pi-controls">
		<label class="pi-ctl">
			<span class="pi-label"><span class="pi-sym">ρ</span> (связь признаков)</span>
			<input
				class="pi-range"
				type="range"
				min={RHO_MIN}
				max={RHO_MAX}
				step={RHO_STEP}
				value={rho}
				oninput={(e) => (rho = snapRho(Number(e.currentTarget.value)))}
			/>
			<output class="pi-val">{rho.toFixed(2)}</output>
		</label>

		<label class="pi-ctl">
			<span class="pi-label"><span class="pi-sym">x₁</span> (точка среза)</span>
			<input
				class="pi-range"
				type="range"
				min={GRID_MIN}
				max={GRID_MAX}
				step={GRID_STEP}
				value={v}
				oninput={(e) => (v = snapV(Number(e.currentTarget.value)))}
			/>
			<output class="pi-val">{v.toFixed(1)}</output>
		</label>

		<button type="button" class="pi-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="pi-plots">
		<div class="pi-panel">
			<p class="pi-panel-t">Данные и точки для PDP <span class="pi-muted">при x₁ = v</span></p>
			<svg class="pi-svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="pi-sc-t pi-sc-d">
				<title id="pi-sc-t">Облако данных и точки среза</title>
				<desc id="pi-sc-d">{scatterDesc}</desc>
				<line class="pi-axis" x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} />
				<line class="pi-axis" x1={PL} x2={PL} y1={PT} y2={H - PB} />
				<line class="pi-diag" x1={sx(X_MIN)} y1={sxy(X_MIN)} x2={sx(X_MAX)} y2={sxy(X_MAX)} />
				{#each sample.x1 as a, i (i)}
					<circle
						class="pi-dot"
						cx={sx(a).toFixed(1)}
						cy={sxy(sample.x2[i] ?? 0).toFixed(1)}
						r="2.5"
					/>
				{/each}
				<line class="pi-cut" x1={sx(v).toFixed(1)} x2={sx(v).toFixed(1)} y1={PT} y2={H - PB} />
				{#each sample.x2 as b, i (i)}
					<circle
						class="pi-probe"
						class:is-off={flags[i]}
						cx={sx(v).toFixed(1)}
						cy={sxy(b).toFixed(1)}
						r="3.5"
					/>
				{/each}
				{#each ticks as t (t)}
					<text class="pi-tick" x={sx(t).toFixed(1)} y={H - PB + 16}>{t}</text>
					<text class="pi-tick" x={PL - 6} y={sxy(t).toFixed(1)} text-anchor="end">{t}</text>
				{/each}
				<text class="pi-axis-t" x={W - PR} y={H - 4} text-anchor="end">x₁</text>
				<text class="pi-axis-t" x={PL + 4} y={PT + 8}>x₂</text>
			</svg>
			<p class="pi-legend">
				<span class="pi-key pi-key-on"></span> в облаке
				<span class="pi-key pi-key-off"></span> вне облака
			</p>
		</div>

		<div class="pi-panel">
			<p class="pi-panel-t">ICE и PDP <span class="pi-muted">по x₁</span></p>
			<svg class="pi-svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="pi-ice-t pi-ice-d">
				<title id="pi-ice-t">ICE-кривые и PDP</title>
				<desc id="pi-ice-d">{iceDesc}</desc>
				<line class="pi-axis" x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} />
				<line class="pi-axis" x1={PL} x2={PL} y1={PT} y2={H - PB} />
				{#each yTicks as t (t)}
					<line class="pi-grid" x1={PL} x2={W - PR} y1={sy(t)} y2={sy(t)} />
					<text class="pi-tick" x={PL - 6} y={sy(t) + 4} text-anchor="end">{t}</text>
				{/each}
				{#each iceD as d, i (i)}
					<path class="pi-ice" {d} />
				{/each}
				<path class="pi-cond" d={condD} />
				<path class="pi-pdp" d={pdpD} />
				<line class="pi-cut" x1={sx(v).toFixed(1)} x2={sx(v).toFixed(1)} y1={PT} y2={H - PB} />
				{#each ticks as t (t)}
					<text class="pi-tick" x={sx(t).toFixed(1)} y={H - PB + 16}>{t}</text>
				{/each}
				<text class="pi-axis-t" x={W - PR} y={H - 4} text-anchor="end">x₁</text>
			</svg>
			<p class="pi-legend">
				<span class="pi-key pi-key-pdp"></span> PDP
				<span class="pi-key pi-key-cond"></span> условное среднее
			</p>
		</div>
	</div>

	<div class="pi-imp">
		<p class="pi-panel-t">Перестановочная важность <span class="pi-muted">рост ошибки</span></p>
		{#each impRows as r (r.label)}
			<div class="pi-bar-row">
				<span class="pi-bar-label">{r.label}</span>
				<span class="pi-bar-track">
					<span class="pi-bar" style="width: {((r.value / impMax) * 100).toFixed(1)}%"></span>
				</span>
				<span class="pi-bar-val">{r.value.toFixed(3)}</span>
			</div>
		{/each}
		<p class="pi-muted pi-small">
			Модель здесь одинаково опирается на обе копии признака. Переставив одну, вы оставляете вторую,
			и ошибка растёт мало.
		</p>
	</div>

	<p class="pi-readout" aria-live="polite">{readout}</p>
</figure>

<style>
	.pi {
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
	.pi :global(*),
	.pi :global(*::before),
	.pi :global(*::after) {
		box-sizing: border-box;
	}
	.pi p {
		margin: 0;
	}
	.pi button {
		font: inherit;
	}
	.pi-muted {
		color: var(--text-muted);
	}
	.pi-small {
		margin-top: var(--space-3);
		font-size: 13px;
	}
	.pi-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.pi-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.pi-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.pi-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.pi-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.pi-range:focus-visible,
	.pi-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.pi-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.pi-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}

	/* Plots */
	.pi-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.pi-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.pi-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.pi-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.6;
	}
	.pi-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.pi-diag {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		opacity: 0.6;
	}
	.pi-cut {
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.pi-dot {
		fill: var(--cat-4);
		opacity: 0.45;
	}
	.pi-probe {
		fill: var(--cat-1);
		stroke: var(--surface);
		stroke-width: 1;
	}
	.pi-probe.is-off {
		fill: var(--warn);
	}
	.pi-ice {
		fill: none;
		stroke: var(--cat-4);
		stroke-width: 1;
		opacity: 0.18;
	}
	.pi-pdp {
		fill: none;
		stroke: var(--topic);
		stroke-width: 3;
		stroke-linejoin: round;
	}
	.pi-cond {
		fill: none;
		stroke: var(--cat-3);
		stroke-width: 2;
		stroke-dasharray: 5 3;
	}
	.pi-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
		text-anchor: middle;
	}
	.pi-axis-t {
		fill: var(--text-muted);
		font-family: var(--font-serif);
		font-size: 13px;
	}
	.pi-legend {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.pi-key {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin: 0 4px 0 10px;
		border-radius: 50%;
		vertical-align: -1px;
	}
	.pi-key-on {
		background: var(--cat-1);
	}
	.pi-key-off {
		background: var(--warn);
	}
	.pi-key-pdp {
		background: var(--topic);
	}
	.pi-key-cond {
		background: var(--cat-3);
	}

	/* Permutation importance bars */
	.pi-imp {
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.pi-bar-row {
		display: grid;
		grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 4.5rem;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
	.pi-bar-label {
		color: var(--text-muted);
	}
	.pi-bar-track {
		display: block;
		height: 12px;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.pi-bar {
		display: block;
		height: 100%;
		background: var(--topic);
		transition: width var(--dur) var(--ease);
	}
	.pi-bar-val {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.pi-readout {
		margin-top: var(--space-4);
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.pi *,
		.pi *::before,
		.pi *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.pi {
			padding: var(--space-4);
		}
		.pi-plots {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 559px) {
		.pi-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.pi-ctl {
			flex-wrap: wrap;
		}
		.pi-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.pi-bar-row {
			grid-template-columns: minmax(0, 1fr) 4.5rem;
		}
		.pi-bar-track {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
