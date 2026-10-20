<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		ALPHA,
		EPS_DEFAULT,
		EPS_MAX,
		EPS_MIN,
		EPS_STEP,
		N_DEFAULT,
		N_MAX,
		P_DEFAULT,
		P_MAX,
		P_MIN,
		P_STEP,
		POS_DEFAULT,
		POS_MAX,
		TABLE_NS,
		type ConcentrationDemoState,
		boundsAt,
		chebyshevSampleSize,
		clampN,
		consequenceNote,
		curveSeries,
		describeState,
		exactSampleSize,
		formatProb,
		hoeffdingSampleSize,
		nFromPos,
		pathOf,
		plotBox,
		posFromN,
		powLabel,
		reasonNote,
		snapEps,
		snapP,
		xOfN,
		yOfProb,
	} from '$lib/demos/concentration';

	/**
	 * Concentration demo: the mean of n Bernoulli(p) measurements, the exact tail P(|X̄ − p| ≥ ε)
	 * and three bounds (Markov, Chebyshev, Hoeffding) on the log scale. Registers as `concentration`.
	 */
	let { initial }: { initial?: Partial<ConcentrationDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let pos = $state(posFromN(clampN(initial?.n ?? N_DEFAULT)));
	/* svelte-ignore state_referenced_locally */
	let p = $state(snapP(initial?.p ?? P_DEFAULT));
	/* svelte-ignore state_referenced_locally */
	let eps = $state(snapEps(initial?.eps ?? EPS_DEFAULT));
	/** Real width of the chart in px; the SVG is drawn at this width (no viewBox scaling). */
	let plotW = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const n = $derived(nFromPos(pos));
	const b = $derived(boundsAt(n, p, eps));
	const box = $derived(plotBox(plotW >= 200 ? plotW : 320));
	const series = $derived(curveSeries(p, eps));
	const paths = $derived({
		exact: pathOf(series.ns, series.exact, box),
		markov: pathOf(series.ns, series.markov, box),
		chebyshev: pathOf(series.ns, series.chebyshev, box),
		hoeffding: pathOf(series.ns, series.hoeffding, box),
	});
	const cursorX = $derived(xOfN(n, box));
	const alphaY = $derived(yOfProb(ALPHA, box));
	const sizes = $derived({
		chebyshev: chebyshevSampleSize(p, eps, ALPHA),
		hoeffding: hoeffdingSampleSize(eps, ALPHA),
		exact: exactSampleSize(p, eps, ALPHA),
	});
	const rows = $derived(TABLE_NS.map((tn) => ({ n: tn, b: boundsAt(tn, p, eps) })));
	const live = $derived(describeState({ n, p, eps }));
	const reason = $derived(reasonNote({ n, p, eps }));
	const consequence = $derived(consequenceNote({ n, p, eps }));

	/** Log-axis ticks: exponents of the probability axis and values of the n axis. */
	const Y_EXPONENTS = [0, -2, -4, -6, -8, -10, -12];
	const X_TICKS = [1, 10, 100, 1000];

	function apply(patch: Partial<ConcentrationDemoState>): void {
		if (typeof patch.n === 'number') pos = posFromN(clampN(patch.n));
		if (typeof patch.p === 'number') p = snapP(patch.p);
		if (typeof patch.eps === 'number') eps = snapEps(patch.eps);
	}

	function reset(): void {
		pos = POS_DEFAULT;
		p = P_DEFAULT;
		eps = EPS_DEFAULT;
	}

	onMount(() => {
		return demos?.register('concentration', {
			set: (patch) => apply(patch as Partial<ConcentrationDemoState>),
		});
	});
</script>

<figure class="cd" id="demo-concentration" data-demo="concentration">
	<div class="cd-controls">
		<label class="cd-ctl">
			<span class="cd-label"><span class="cd-sym">n</span> (измерений)</span>
			<input
				class="cd-range"
				type="range"
				min="0"
				max={POS_MAX}
				step="1"
				value={pos}
				oninput={(e) => (pos = Number(e.currentTarget.value))}
			/>
			<output class="cd-val">{n}</output>
		</label>

		<label class="cd-ctl">
			<span class="cd-label"><span class="cd-sym">p</span> (вероятность)</span>
			<input
				class="cd-range"
				type="range"
				min={P_MIN}
				max={P_MAX}
				step={P_STEP}
				value={p}
				oninput={(e) => (p = snapP(Number(e.currentTarget.value)))}
			/>
			<output class="cd-val">{p.toFixed(2).replace('.', ',')}</output>
		</label>

		<label class="cd-ctl">
			<span class="cd-label"><span class="cd-sym">ε</span> (порог)</span>
			<input
				class="cd-range"
				type="range"
				min={EPS_MIN}
				max={EPS_MAX}
				step={EPS_STEP}
				value={eps}
				oninput={(e) => (eps = snapEps(Number(e.currentTarget.value)))}
			/>
			<output class="cd-val">{eps.toFixed(2).replace('.', ',')}</output>
		</label>

		<button type="button" class="cd-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="cd-panel">
		<p class="cd-panel-t">P(|X̄ − p| ≥ ε) и три границы</p>
		<div class="cd-plot" bind:clientWidth={plotW}>
			<svg
				class="cd-svg"
				viewBox="0 0 {box.w} {box.h}"
				role="img"
				aria-labelledby="cd-title cd-desc"
			>
				<title id="cd-title">Точная вероятность и границы по n</title>
				<desc id="cd-desc">{live}</desc>
				{#each Y_EXPONENTS as e (e)}
					{@const y = yOfProb(Math.pow(10, e), box)}
					<line class="cd-grid" x1={box.left} x2={box.w - box.right} y1={y} y2={y} />
					<text class="cd-tick" x={box.left - 6} y={y + 4} text-anchor="end">{powLabel(e)}</text>
				{/each}
				{#each X_TICKS as tx (tx)}
					<text class="cd-tick" x={xOfN(tx, box)} y={box.h - 8} text-anchor="middle">{tx}</text>
				{/each}
				<line class="cd-alpha" x1={box.left} x2={box.w - box.right} y1={alphaY} y2={alphaY} />
				<text class="cd-tick" x={box.w - box.right} y={alphaY - 4} text-anchor="end">α = 0,05</text>
				<path class="cd-curve cd-markov" d={paths.markov} />
				<path class="cd-curve cd-cheb" d={paths.chebyshev} />
				<path class="cd-curve cd-hoeff" d={paths.hoeffding} />
				<path class="cd-curve cd-exact" d={paths.exact} />
				<line class="cd-cursor" x1={cursorX} x2={cursorX} y1={box.top} y2={box.h - box.bottom} />
				<circle class="cd-dot cd-dot-markov" cx={cursorX} cy={yOfProb(b.markov, box)} r="4" />
				<circle class="cd-dot cd-dot-cheb" cx={cursorX} cy={yOfProb(b.chebyshev, box)} r="4" />
				<circle class="cd-dot cd-dot-hoeff" cx={cursorX} cy={yOfProb(b.hoeffding, box)} r="4" />
				<circle class="cd-dot cd-dot-exact" cx={cursorX} cy={yOfProb(b.exact, box)} r="5" />
			</svg>
		</div>
		<p class="cd-axis">
			По горизонтали n, логарифмическая шкала. По вертикали вероятность, тоже логарифмическая.
		</p>
		<ul class="cd-legend">
			<li><span class="cd-sw cd-sw-exact" aria-hidden="true"></span>точная</li>
			<li><span class="cd-sw cd-sw-markov" aria-hidden="true"></span>Маркова</li>
			<li><span class="cd-sw cd-sw-cheb" aria-hidden="true"></span>Чебышёва</li>
			<li><span class="cd-sw cd-sw-hoeff" aria-hidden="true"></span>Хёффдинга</li>
		</ul>
		<p class="cd-live" aria-live="polite">{live}</p>
	</div>

	<div class="cd-cause">
		<p><span class="cd-h">Причина:</span> {reason}</p>
		<p><span class="cd-h">Следствие:</span> {consequence}</p>
	</div>

	<table class="cd-table">
		<caption>
			Значения при p = {p.toFixed(2).replace('.', ',')}, ε = {eps.toFixed(2).replace('.', ',')}.
			Выше единицы граница показана как 1.
		</caption>
		<thead>
			<tr>
				<th scope="col">n</th>
				<th scope="col">точная</th>
				<th scope="col">ЦПТ</th>
				<th scope="col">Маркова</th>
				<th scope="col">Чебышёва</th>
				<th scope="col">Хёффдинга</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.n)}
				<tr>
					<th scope="row">{r.n}</th>
					<td data-label="точная">{formatProb(r.b.exact)}</td>
					<td data-label="ЦПТ">{formatProb(r.b.clt)}</td>
					<td data-label="Маркова">{formatProb(Math.min(1, r.b.markov))}</td>
					<td data-label="Чебышёва">{formatProb(Math.min(1, r.b.chebyshev))}</td>
					<td data-label="Хёффдинга">{formatProb(Math.min(1, r.b.hoeffding))}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<section class="cd-sizes" aria-labelledby="cd-sizes-t">
		<p id="cd-sizes-t" class="cd-h">Сколько измерений нужно, чтобы P ≤ 0,05</p>
		<dl class="cd-sizes-list">
			<dt>Чебышёв</dt>
			<dd>
				{#if sizes.chebyshev > N_MAX}больше {N_MAX}{:else}n ≥ {sizes.chebyshev}{/if}
			</dd>
			<dt>Хёффдинг</dt>
			<dd>
				{#if sizes.hoeffding > N_MAX}больше {N_MAX}{:else}n ≥ {sizes.hoeffding}{/if}
			</dd>
			<dt>точный расчёт</dt>
			<dd>
				{#if sizes.exact === null}больше {N_MAX}{:else}n = {sizes.exact}{/if}
				<span class="cd-muted">(первое n с P ≤ 0,05)</span>
			</dd>
		</dl>
	</section>
</figure>

<style>
	.cd {
		display: block;
		width: 100%;
		min-width: 0;
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
		overflow-wrap: break-word;
	}
	.cd :global(*),
	.cd :global(*::before),
	.cd :global(*::after) {
		box-sizing: border-box;
	}
	.cd p,
	.cd dl,
	.cd dd,
	.cd dt,
	.cd ul {
		margin: 0;
	}
	.cd button {
		font: inherit;
	}
	.cd-muted {
		color: var(--text-muted);
	}
	.cd-h {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.cd-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.cd-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cd-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.cd-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cd-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cd-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.cd-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.cd-range:focus-visible,
	.cd-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Chart */
	.cd-panel {
		margin-top: var(--space-6);
	}
	.cd-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.cd-plot {
		width: 100%;
	}
	.cd-svg {
		display: block;
		width: 100%;
		height: 240px;
		overflow: visible;
	}
	.cd-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.cd-alpha {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 2 3;
	}
	.cd-cursor {
		stroke: var(--text);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		opacity: 0.5;
	}
	.cd-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.cd-curve {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.cd-exact {
		stroke: var(--topic);
		stroke-width: 2.5;
	}
	.cd-markov {
		stroke: var(--cat-2);
		stroke-dasharray: 6 4;
	}
	.cd-cheb {
		stroke: var(--cat-5);
		stroke-dasharray: 6 4;
	}
	.cd-hoeff {
		stroke: var(--cat-3);
		stroke-dasharray: 6 4;
	}
	.cd-dot {
		stroke: var(--surface);
		stroke-width: 1.5;
	}
	.cd-dot-exact {
		fill: var(--topic);
	}
	.cd-dot-markov {
		fill: var(--cat-2);
	}
	.cd-dot-cheb {
		fill: var(--cat-5);
	}
	.cd-dot-hoeff {
		fill: var(--cat-3);
	}
	.cd-axis {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.cd-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-6);
		margin-top: var(--space-2);
		padding: 0;
		list-style: none;
		font-size: 13px;
		color: var(--text);
	}
	.cd-legend li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.cd-sw {
		display: inline-block;
		width: 22px;
		border-top: 2px solid;
	}
	.cd-sw-exact {
		border-color: var(--topic);
		border-top-width: 2.5px;
	}
	.cd-sw-markov {
		border-color: var(--cat-2);
		border-top-style: dashed;
	}
	.cd-sw-cheb {
		border-color: var(--cat-5);
		border-top-style: dashed;
	}
	.cd-sw-hoeff {
		border-color: var(--cat-3);
		border-top-style: dashed;
	}
	.cd-live {
		margin-top: var(--space-3);
		padding: var(--space-2) var(--space-3);
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text);
	}

	/* Cause and consequence */
	.cd-cause {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		width: 100%;
		min-width: 0;
		gap: var(--space-2);
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* Table */
	.cd-table {
		width: 100%;
		margin-top: var(--space-6);
		border-collapse: collapse;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.cd-table caption {
		display: block;
		width: 100%;
		caption-side: top;
		margin-bottom: var(--space-2);
		text-align: left;
		color: var(--text-muted);
		font-size: 13px;
	}
	.cd-table th,
	.cd-table td {
		padding: var(--space-2) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: right;
		font-family: var(--font-mono);
		color: var(--text);
	}
	.cd-table thead th {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-weight: 500;
	}
	.cd-table tbody th {
		font-family: var(--font-mono);
		color: var(--text);
		font-weight: 600;
	}

	/* Sample sizes */
	.cd-sizes {
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.cd-sizes-list {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-2);
	}
	.cd-sizes-list dt {
		color: var(--text-muted);
	}
	.cd-sizes-list dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	@media (prefers-reduced-motion: reduce) {
		.cd *,
		.cd *::before,
		.cd *::after {
			transition: none !important;
			animation: none !important;
		}
	}

	@media (max-width: 720px) {
		.cd {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.cd-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.cd-ctl {
			flex-wrap: wrap;
		}
		.cd-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.cd-reset {
			align-self: flex-start;
		}
		/* Table turns into one block per n on narrow screens */
		.cd-table thead {
			display: none;
		}
		.cd-table,
		.cd-table tbody,
		.cd-table tr,
		.cd-table th,
		.cd-table td {
			display: block;
			width: 100%;
		}
		.cd-table tr {
			margin-bottom: var(--space-2);
			padding: var(--space-2) var(--space-3);
			background: var(--bg);
			border: 1px solid var(--border);
			border-radius: var(--radius);
		}
		.cd-table th,
		.cd-table td {
			padding: 2px 0;
			border: 0;
			text-align: left;
		}
		.cd-table td::before {
			content: attr(data-label) ': ';
			color: var(--text-muted);
			font-family: var(--font-sans);
		}
		.cd-sizes-list {
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
		}
		.cd-sizes-list dt {
			margin-top: var(--space-2);
		}
	}
</style>
