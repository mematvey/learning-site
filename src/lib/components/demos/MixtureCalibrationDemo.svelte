<script lang="ts">
	import { madRaw, madn, normalCdf, normalPdf, normalQuantile, rho } from '$lib/demos/robust-core';
	import { madLimitRatio, makeMixture, scaleLimitRatio } from '$lib/demos/robust-model';
	import { mulberry32 } from '$lib/prob/rng';
	import { fmt, linePath, linearMap, logClamp, yieldToUi } from './robust/plot';

	/**
	 * Contaminated normal model U = (1 - ε) N + ε · t_ν (scaled to Var = 1): density against N(0, 1),
	 * tail probabilities, the normal-consistency limits of MAD and M-scale, and a Monte Carlo run.
	 */
	let { initial }: { initial?: { eps?: number; df?: number } } = $props();

	const SEED = 20261020;
	const RHO_C = 1.54764;
	const RHO_B = 0.5;
	const MU = 2;
	const SIGMA = 3;
	const NS = [50, 100, 300, 1000];
	const REPS = 200;
	const CHUNK = 10;
	const W_MIN = 160;
	const H = 220;
	const PAD_L = 44;
	const PAD_R = 10;
	const PAD_T = 10;
	const PAD_B = 24;
	const X_LO = -6;
	const X_HI = 6;
	const LOG_LO = -7;
	const LOG_HI = 0;
	const LIN_HI = 0.45;

	/* svelte-ignore state_referenced_locally */
	let eps = $state(initial?.eps ?? 0.05);
	/* svelte-ignore state_referenced_locally */
	let df = $state(initial?.df ?? 3);
	let logScale = $state(false);
	let plotW = $state(0);

	const W = $derived(plotW >= W_MIN ? plotW : 320);
	const innerW = $derived(W - PAD_L - PAD_R);
	const innerH = H - PAD_T - PAD_B;

	const mix = $derived(makeMixture({ eps, df }));
	const qF75 = $derived(mix.quantile(0.75));
	const phi75 = normalQuantile(0.75);
	const madLimit = $derived(madLimitRatio(mix));

	/* Tail table */
	const TAIL_KS = [2, 3, 5];
	const tails = $derived(
		TAIL_KS.map((k) => {
			const m = mix.tailProb(k);
			const nrm = 2 * normalCdf(-k);
			return { k, mix: m, normal: nrm, ratio: m / nrm };
		}),
	);
	const fmtSci = (v: number): string =>
		v >= 1e-3 ? fmt(v, 4) : v.toExponential(2).replace('.', ',');
	const fmtRatio = (v: number): string => (v >= 100 ? Math.round(v).toString() : fmt(v, 2));

	/* Density plot */
	const GRID = Array.from({ length: 241 }, (_, i) => X_LO + (i * (X_HI - X_LO)) / 240);
	const xD = $derived(linearMap(X_LO, X_HI, PAD_L, PAD_L + innerW));
	const yD = (v: number): number =>
		logScale
			? PAD_T + innerH * (1 - (logClamp(v, 1e-7) - LOG_LO) / (LOG_HI - LOG_LO))
			: PAD_T + innerH * (1 - v / LIN_HI);
	const mixPath = $derived(linePath(GRID.map((x) => [xD(x), yD(mix.pdf(x))] as const)));
	const normPath = $derived(linePath(GRID.map((x) => [xD(x), yD(normalPdf(x))] as const)));
	const Y_TICKS_LIN = [0, 0.1, 0.2, 0.3, 0.4];
	const Y_TICKS_LOG = [-7, -5, -3, -1];
	const SUP: Record<string, string> = {
		'-': '⁻',
		'0': '⁰',
		'1': '¹',
		'2': '²',
		'3': '³',
		'4': '⁴',
		'5': '⁵',
		'6': '⁶',
		'7': '⁷',
		'8': '⁸',
		'9': '⁹',
	};
	const powLabel = (e: number): string =>
		`10${String(e)
			.split('')
			.map((c) => SUP[c] ?? c)
			.join('')}`;

	/* Scale limit under the normal calibration: heavy, computed after the parameters settle. */
	let scaleLimit = $state<number | null>(null);
	$effect(() => {
		const e = eps;
		const d = df;
		scaleLimit = null;
		const t = setTimeout(() => {
			scaleLimit = scaleLimitRatio(
				makeMixture({ eps: e, df: d }),
				(u) => rho('bisquare', u, RHO_C),
				RHO_B,
			);
		}, 0);
		return () => clearTimeout(t);
	});

	/* Monte Carlo: MADN with the normal constant and MAD calibrated by q_F(0.75), against n. */
	interface McRow {
		n: number;
		madn: number;
		cal: number;
		reps: number;
	}
	let running = $state(false);
	let done = $state(0);
	let runId = 0;
	let mc = $state<McRow[]>([]);
	const TOTAL = NS.length * REPS;

	$effect(() => {
		// Changing the model cancels a run in progress and clears its results.
		void eps;
		void df;
		runId += 1;
		running = false;
		done = 0;
		mc = [];
	});

	async function runExperiment(): Promise<void> {
		const id = ++runId;
		const m = mix;
		const q = m.quantile(0.75);
		const rngs = new Map(NS.map((n) => [n, mulberry32(SEED + n)] as const));
		const acc = new Map<number, { madn: number; cal: number; reps: number }>(
			NS.map((n) => [n, { madn: 0, cal: 0, reps: 0 }]),
		);
		const jobs = NS.flatMap((n) => Array.from({ length: REPS }, () => n));
		running = true;
		done = 0;
		mc = [];
		for (let i = 0; i < jobs.length; i += CHUNK) {
			if (id !== runId) return;
			const end = Math.min(i + CHUNK, jobs.length);
			for (let j = i; j < end; j++) {
				const n = jobs[j] ?? 0;
				const x = m.sampleX(n, rngs.get(n) ?? mulberry32(SEED), MU, SIGMA);
				const a = acc.get(n);
				if (!a) continue;
				a.madn += madn(x);
				a.cal += madRaw(x) / q;
				a.reps += 1;
			}
			done = end;
			mc = NS.map((n) => {
				const a = acc.get(n) ?? { madn: 0, cal: 0, reps: 0 };
				const r = Math.max(a.reps, 1);
				return { n, madn: a.madn / r, cal: a.cal / r, reps: a.reps };
			});
			await yieldToUi();
		}
		running = false;
	}

	const xN = (n: number): number =>
		PAD_L + ((Math.log10(n) - Math.log10(40)) / (Math.log10(1200) - Math.log10(40))) * innerW;
	const yMc = (v: number): number => PAD_T + innerH * (1 - v / (SIGMA * 1.2));
	const mcPath = (key: 'madn' | 'cal'): string =>
		linePath(mc.map((r) => [xN(r.n), yMc(r[key])] as const));
</script>

<figure class="mx" id="demo-mixture-calibration" data-demo="mixture-calibration">
	<div class="mx-controls">
		<label class="mx-range">
			<span>ε, доля выбросов <output>{fmt(eps, 2)}</output></span>
			<input type="range" min="0" max="0.3" step="0.01" bind:value={eps} />
		</label>
		<label class="mx-range">
			<span>ν, степени свободы t <output>{df}</output></span>
			<input type="range" min="3" max="10" step="1" bind:value={df} />
		</label>
	</div>

	<div class="mx-group-row">
		<div class="mx-group" role="group" aria-label="Шкала плотности">
			<button
				type="button"
				class="mx-seg"
				aria-pressed={!logScale}
				onclick={() => (logScale = false)}>Линейная</button
			>
			<button type="button" class="mx-seg" aria-pressed={logScale} onclick={() => (logScale = true)}
				>Логарифмическая</button
			>
		</div>
	</div>

	<div class="mx-row" bind:clientWidth={plotW}>
		<svg
			class="mx-svg"
			width="100%"
			height={H}
			viewBox="0 0 {W} {H}"
			role="img"
			aria-labelledby="mx-dens-title mx-dens-desc"
		>
			<title id="mx-dens-title">Плотность смеси против N(0, 1)</title>
			<desc id="mx-dens-desc">
				Смесь выше нормальной в центре и на далёких хвостах; на линейной шкале хвост почти не виден.
			</desc>
			{#each logScale ? Y_TICKS_LOG : Y_TICKS_LIN as t (t)}
				<line
					class="mx-grid"
					x1={PAD_L}
					x2={W - PAD_R}
					y1={yD(logScale ? 10 ** t : t).toFixed(1)}
					y2={yD(logScale ? 10 ** t : t).toFixed(1)}
				/>
				<text
					class="mx-tick"
					x={PAD_L - 6}
					y={(yD(logScale ? 10 ** t : t) + 4).toFixed(1)}
					text-anchor="end">{logScale ? powLabel(t) : fmt(t, 1)}</text
				>
			{/each}
			{#each [-6, -4, -2, 0, 2, 4, 6] as t (t)}
				<text class="mx-tick" x={xD(t).toFixed(1)} y={H - 6} text-anchor="middle">{t}</text>
			{/each}
			<line class="mx-axis" x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} />
			<path class="mx-line mx-line-norm" d={normPath} />
			<path class="mx-line mx-line-mix" d={mixPath} />
		</svg>
	</div>
	<ul class="mx-legend">
		<li><span class="mx-sw mx-sw-mix"></span>Смесь (ε, ν)</li>
		<li><span class="mx-sw mx-sw-norm"></span>N(0, 1)</li>
	</ul>

	<h3 class="mx-h">Хвосты: P(|U| &gt; k)</h3>
	<table class="mx-table">
		<thead>
			<tr>
				<th scope="col">k</th>
				<th scope="col">Смесь</th>
				<th scope="col">N(0, 1)</th>
				<th scope="col">Отношение</th>
			</tr>
		</thead>
		<tbody>
			{#each tails as t (t.k)}
				<tr>
					<th scope="row">{t.k}</th>
					<td>{fmtSci(t.mix)}</td>
					<td>{fmtSci(t.normal)}</td>
					<td class="mx-hot">{fmtRatio(t.ratio)} ×</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="mx-note">
		Около центра смесь даже уже нормальной, а хвост при |U| &gt; 5 в тысячи раз тяжелее. Обычные
		пороги 2–3σ этого не показывают.
	</p>

	<h3 class="mx-h">Нормировка: что MAD реально оценивает</h3>
	<dl class="mx-stats">
		<div>
			<dt>q<sub>F</sub>(0,75) смеси</dt>
			<dd>{fmt(qF75, 4)}</dd>
		</div>
		<div>
			<dt>Φ⁻¹(0,75) для нормали</dt>
			<dd>{fmt(phi75, 4)}</dd>
		</div>
		<div>
			<dt>Предел MADN / σ</dt>
			<dd>{fmt(madLimit, 3)}</dd>
		</div>
		<div>
			<dt>Предел M-масштаба (b = 0,5, bisquare)</dt>
			<dd>{scaleLimit === null ? '…' : fmt(scaleLimit, 3)}</dd>
		</div>
	</dl>
	<p class="mx-note">
		Если делить MAD на Φ⁻¹(0,75), при этой смеси оценка систематически занижена примерно на
		{Math.round((1 - madLimit) * 100)}%. Калибровка делением на q<sub>F</sub>(0,75) исправляет это.
	</p>

	<h3 class="mx-h">Эксперимент: μ = {MU}, σ = {SIGMA}, R = {REPS} повторов</h3>
	<div class="mx-buttons">
		<button type="button" class="mx-btn" onclick={runExperiment} disabled={running}
			>Эксперимент</button
		>
		{#if running}
			<progress class="mx-progress" max={TOTAL} value={done} aria-label="Ход эксперимента"
			></progress>
			<span class="mx-muted">{done} из {TOTAL}</span>
		{/if}
	</div>
	<div class="mx-row">
		<svg
			class="mx-svg"
			width="100%"
			height={H}
			viewBox="0 0 {W} {H}"
			role="img"
			aria-labelledby="mx-mc-title mx-mc-desc"
		>
			<title id="mx-mc-title">Среднее MADN и калиброванного MAD против n</title>
			<desc id="mx-mc-desc">
				Линия калиброванного MAD выходит на σ = {SIGMA}; сырой MADN держится у предела {fmt(
					SIGMA * madLimit,
					3,
				)}.
			</desc>
			{#each [0, 1, 2, 3] as t (t)}
				<line
					class="mx-grid"
					x1={PAD_L}
					x2={W - PAD_R}
					y1={yMc(t).toFixed(1)}
					y2={yMc(t).toFixed(1)}
				/>
				<text class="mx-tick" x={PAD_L - 6} y={(yMc(t) + 4).toFixed(1)} text-anchor="end">{t}</text>
			{/each}
			{#each NS as n (n)}
				<text class="mx-tick" x={xN(n).toFixed(1)} y={H - 6} text-anchor="middle">{n}</text>
			{/each}
			<line class="mx-axis" x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} />
			<line
				class="mx-ref"
				x1={PAD_L}
				x2={W - PAD_R}
				y1={yMc(SIGMA).toFixed(1)}
				y2={yMc(SIGMA).toFixed(1)}
			/>
			<line
				class="mx-ref-limit"
				x1={PAD_L}
				x2={W - PAD_R}
				y1={yMc(SIGMA * madLimit).toFixed(1)}
				y2={yMc(SIGMA * madLimit).toFixed(1)}
			/>
			{#if mc.length > 0}
				<path class="mx-line mx-line-madn" d={mcPath('madn')} />
				<path class="mx-line mx-line-cal" d={mcPath('cal')} />
				{#each mc as r (r.n)}
					<circle
						class="mx-pt mx-pt-madn"
						cx={xN(r.n).toFixed(1)}
						cy={yMc(r.madn).toFixed(1)}
						r="3.5"
					/>
					<circle
						class="mx-pt mx-pt-cal"
						cx={xN(r.n).toFixed(1)}
						cy={yMc(r.cal).toFixed(1)}
						r="3.5"
					/>
				{/each}
			{/if}
		</svg>
	</div>
	<ul class="mx-legend">
		<li><span class="mx-sw mx-sw-madn"></span>MADN с нормальной константой</li>
		<li><span class="mx-sw mx-sw-cal"></span>MAD / q<sub>F</sub>(0,75)</li>
		<li><span class="mx-sw mx-sw-true"></span>σ = {SIGMA}</li>
		<li><span class="mx-sw mx-sw-limit"></span>Предел MADN</li>
	</ul>

	{#if mc.length > 0}
		<table class="mx-table">
			<thead>
				<tr>
					<th scope="col">n</th>
					<th scope="col">MADN (среднее)</th>
					<th scope="col">MAD / q<sub>F</sub> (среднее)</th>
				</tr>
			</thead>
			<tbody>
				{#each mc as r (r.n)}
					<tr>
						<th scope="row">{r.n}</th>
						<td>{fmt(r.madn, 3)}</td>
						<td>{fmt(r.cal, 3)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="mx-muted">Нажмите «Эксперимент»: расчёт идёт порциями и не блокирует страницу.</p>
	{/if}

	<p class="mx-note">
		<strong>Что заметить:</strong> сырой MADN сходится к {fmt(madLimit, 3)}σ, а не к σ; калибровка
		делением на q<sub>F</sub>(0,75) возвращает σ. Выводы относятся к этой смеси (ε = 0,05, ν = 3).
	</p>
</figure>

<style>
	.mx {
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
	.mx :global(*),
	.mx :global(*::before),
	.mx :global(*::after) {
		box-sizing: border-box;
	}
	.mx p,
	.mx dl,
	.mx dd,
	.mx dt,
	.mx ul,
	.mx table {
		margin: 0;
	}
	.mx button,
	.mx input {
		font: inherit;
	}
	.mx-controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.mx-range {
		display: grid;
		gap: var(--space-2);
	}
	.mx-range output {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		margin-left: var(--space-2);
	}
	.mx-range input {
		width: 100%;
		accent-color: var(--topic);
	}
	.mx-group-row {
		margin-top: var(--space-4);
	}
	.mx-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.mx-seg {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	.mx-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.mx-seg:focus-visible,
	.mx-btn:focus-visible,
	.mx-range input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.mx-row {
		margin-top: var(--space-4);
	}
	.mx-svg {
		display: block;
		overflow: visible;
	}
	.mx-axis {
		stroke: var(--border);
		stroke-width: 1;
	}
	.mx-grid {
		stroke: var(--border);
		stroke-width: 1;
		stroke-dasharray: 2 3;
	}
	.mx-tick {
		font-size: 11px;
		fill: var(--text-muted);
	}
	.mx-line {
		fill: none;
		stroke-width: 2;
	}
	.mx-line-mix,
	.mx-line-madn {
		stroke: var(--topic);
	}
	.mx-line-norm {
		stroke: var(--text);
		stroke-dasharray: 5 4;
		opacity: 0.7;
	}
	.mx-line-cal {
		stroke: var(--cat-3);
	}
	.mx-ref {
		stroke: var(--text);
		stroke-width: 1.25;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.mx-ref-limit {
		stroke: var(--cat-2);
		stroke-width: 2;
		stroke-dasharray: 5 3;
	}
	.mx-pt-madn {
		fill: var(--topic);
	}
	.mx-pt-cal {
		fill: var(--cat-3);
	}
	.mx-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		list-style: none;
		padding: 0;
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.mx-sw {
		display: inline-block;
		width: 14px;
		height: 3px;
		margin-right: var(--space-2);
		vertical-align: middle;
	}
	.mx-sw-mix,
	.mx-sw-madn {
		background: var(--topic);
	}
	.mx-sw-norm,
	.mx-sw-true {
		background: var(--text);
		opacity: 0.7;
	}
	.mx-sw-cal {
		background: var(--cat-3);
	}
	.mx-sw-limit {
		background: var(--cat-2);
	}
	.mx-h {
		margin-top: var(--space-6);
		font-size: var(--fs-base, 1rem);
		font-weight: 600;
	}
	.mx-table {
		width: 100%;
		margin-top: var(--space-3);
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.mx-table th,
	.mx-table td {
		padding: var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: right;
	}
	.mx-table th[scope='row'],
	.mx-table thead th:first-child {
		text-align: left;
	}
	.mx-table thead th {
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 600;
	}
	.mx-table .mx-hot {
		color: var(--warn);
		font-weight: 600;
	}
	.mx-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
		margin-top: var(--space-3);
	}
	.mx-stats dt {
		color: var(--text-muted);
		font-size: 12px;
	}
	.mx-stats dd {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.mx-buttons {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.mx-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--topic);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--topic);
		cursor: pointer;
	}
	.mx-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.mx-progress {
		width: 180px;
		height: 10px;
		accent-color: var(--topic);
	}
	.mx-muted,
	.mx-note {
		color: var(--text-muted);
	}
	.mx-note {
		margin-top: var(--space-3);
	}
	@media (max-width: 559px) {
		.mx {
			padding: var(--space-4);
		}
	}
</style>
