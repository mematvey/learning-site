<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		ALPHA_MAX,
		ALPHA_MIN,
		ALPHA_STEP,
		DEFAULT_ALPHA,
		DEFAULT_N,
		DEFAULT_SEED,
		N_CHOICES,
		N_TEST,
		type CalibrationSize,
		type ConformalDemoState,
		type Method,
		evaluateConformal,
		isMethod,
		minCalibrationSize,
		snapAlpha,
		snapN,
		snapSeed,
	} from '$lib/demos/conformal';

	/** Split conformal prediction on heteroscedastic data. Registers itself as demo `conformal`. */
	let { initial }: { initial?: Partial<ConformalDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let alpha = $state(snapAlpha(initial?.alpha ?? DEFAULT_ALPHA));
	/* svelte-ignore state_referenced_locally */
	let n = $state<CalibrationSize>(snapN(initial?.n ?? DEFAULT_N));
	/* svelte-ignore state_referenced_locally */
	let seed = $state(snapSeed(initial?.seed ?? DEFAULT_SEED));
	/* svelte-ignore state_referenced_locally */
	let method = $state<Method>(isMethod(initial?.method) ? initial.method : 'fixed');
	/** Real width of the plot in px; the SVG is drawn at this width (no viewBox scaling). */
	let plotW = $state(0);

	const DEFAULTS = { alpha: DEFAULT_ALPHA, n: DEFAULT_N, seed: DEFAULT_SEED };
	const H = 260;
	const PAD = { l: 40, r: 12, t: 22, b: 30 };

	const res = $derived(evaluateConformal({ alpha, n, seed }));
	const W = $derived(plotW >= 200 ? plotW : 320);
	const target = $derived(Math.round((1 - alpha) * 100));
	const minN = $derived(minCalibrationSize(alpha));

	/** y domain from the shown points, with a small margin. */
	const yMin = $derived(Math.min(...res.points.map((p) => p.y)));
	const yMax = $derived(Math.max(...res.points.map((p) => p.y)));
	const yLo = $derived(yMin - 0.06 * (yMax - yMin));
	const yHi = $derived(yMax + 0.06 * (yMax - yMin));

	const regionRows = $derived(
		['левая треть', 'средняя треть', 'правая треть'].map((name, r) => ({
			name,
			f: res.fixed.byRegion[r] ?? 0,
			a: res.adaptive.byRegion[r] ?? 0,
		})),
	);

	function sx(x: number): number {
		return PAD.l + x * (W - PAD.l - PAD.r);
	}
	function sy(y: number): number {
		const c = Math.min(yHi, Math.max(yLo, y));
		return H - PAD.b - ((c - yLo) / (yHi - yLo)) * (H - PAD.t - PAD.b);
	}

	/** Closed band polygon between the lower and upper edges; infinite edges are clipped to the plot. */
	function bandPath(rows: { x: number; lo: number; hi: number }[]): string {
		const top = rows.map((r) => `${sx(r.x).toFixed(1)},${sy(r.hi).toFixed(1)}`);
		const bottom = [...rows].reverse().map((r) => `${sx(r.x).toFixed(1)},${sy(r.lo).toFixed(1)}`);
		return `M${top.join(' L')} L${bottom.join(' L')} Z`;
	}
	const fixedPath = $derived(
		bandPath(res.curve.map((c) => ({ x: c.x, lo: c.fixedLo, hi: c.fixedHi }))),
	);
	const adaptPath = $derived(
		bandPath(res.curve.map((c) => ({ x: c.x, lo: c.adaptLo, hi: c.adaptHi }))),
	);
	const meanPath = $derived(
		res.curve
			.map((c, i) => `${i ? 'L' : 'M'}${sx(c.x).toFixed(1)},${sy(c.mu).toFixed(1)}`)
			.join(' '),
	);

	function pct(v: number): string {
		return `${Math.round(v * 100)}%`;
	}
	function num(v: number): string {
		return Number.isFinite(v) ? v.toFixed(2) : '∞';
	}
	function isLow(cov: number): boolean {
		return cov < 1 - alpha - 1e-9;
	}

	const isDefault = $derived(
		alpha === DEFAULTS.alpha && n === DEFAULTS.n && seed === DEFAULTS.seed,
	);

	/** Text for the live region: the result of the current state in one place. */
	const live = $derived(
		res.kValid
			? `Постоянная полоса покрывает ${pct(res.fixed.coverage)} точек, справа ${pct(res.fixed.byRegion[2])}. ` +
					`Адаптивная полоса покрывает ${pct(res.adaptive.coverage)}, справа ${pct(res.adaptive.byRegion[2])}. Цель ${target}%.`
			: `k = ${res.k} больше n = ${n}: полосы бесконечны, покрытие 100%.`,
	);

	function regenerate(): void {
		seed = snapSeed(seed + 1);
	}
	function reset(): void {
		alpha = snapAlpha(DEFAULTS.alpha);
		n = snapN(DEFAULTS.n);
		seed = snapSeed(DEFAULTS.seed);
		method = 'fixed';
	}

	function apply(patch: Partial<ConformalDemoState>): void {
		if (typeof patch.alpha === 'number') alpha = snapAlpha(patch.alpha);
		if (typeof patch.n === 'number') n = snapN(patch.n);
		if (typeof patch.seed === 'number') seed = snapSeed(patch.seed);
		if (isMethod(patch.method)) method = patch.method;
	}

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	onMount(() => {
		return demos?.register('conformal', {
			set: (patch) => apply(patch as Partial<ConformalDemoState>),
		});
	});
</script>

<div class="cf" id="demo-conformal" data-demo="conformal">
	<div class="cf-controls">
		<label class="cf-ctl">
			<span class="cf-label"><span class="cf-sym">α</span> (доля промахов)</span>
			<input
				class="cf-range"
				type="range"
				min={ALPHA_MIN}
				max={ALPHA_MAX}
				step={ALPHA_STEP}
				value={alpha}
				oninput={(e) => (alpha = snapAlpha(Number(e.currentTarget.value)))}
			/>
			<output class="cf-val">{alpha.toFixed(2)}</output>
		</label>

		<fieldset class="cf-field">
			<legend class="cf-label">Калибровочная выборка <span class="cf-sym">n</span></legend>
			<div class="cf-group">
				{#each N_CHOICES as c (c)}
					<label class="cf-opt" class:is-on={n === c}>
						<input type="radio" name="cf-n" value={c} checked={n === c} onchange={() => (n = c)} />
						<span>{c}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset class="cf-field">
			<legend class="cf-label">Промахи подсвечены для</legend>
			<div class="cf-group">
				<label class="cf-opt" class:is-on={method === 'fixed'}>
					<input
						type="radio"
						name="cf-method"
						value="fixed"
						checked={method === 'fixed'}
						onchange={() => (method = 'fixed')}
					/>
					<span>постоянной полосы</span>
				</label>
				<label class="cf-opt" class:is-on={method === 'adaptive'}>
					<input
						type="radio"
						name="cf-method"
						value="adaptive"
						checked={method === 'adaptive'}
						onchange={() => (method = 'adaptive')}
					/>
					<span>адаптивной полосы</span>
				</label>
			</div>
		</fieldset>
	</div>

	<div class="cf-plot" bind:clientWidth={plotW}>
		<svg
			class="cf-svg"
			width={W}
			height={H}
			viewBox="0 0 {W} {H}"
			role="img"
			aria-labelledby="cf-title cf-desc"
		>
			<title id="cf-title">Предсказательные полосы на данных с растущим разбросом</title>
			<desc id="cf-desc">
				Постоянная полоса ±{num(res.fixed.q)} и адаптивная полоса, покрытие {pct(
					res.fixed.coverage,
				)} и
				{pct(res.adaptive.coverage)} при цели {target}%. Точки промахов подсвечены для выбранной
				полосы.
			</desc>
			<text class="cf-axis-t" x="4" y="14">y</text>
			<text class="cf-axis-t" x={sx(0)} y={H - 8} text-anchor="middle">0</text>
			<text class="cf-axis-t" x={sx(0.5)} y={H - 8} text-anchor="middle">x = 0,5</text>
			<text class="cf-axis-t" x={sx(1)} y={H - 8} text-anchor="middle">1</text>

			{#each [1 / 3, 2 / 3] as edge (edge)}
				<line class="cf-sep" x1={sx(edge)} x2={sx(edge)} y1={PAD.t} y2={H - PAD.b} />
			{/each}
			<text class="cf-axis-t" x={sx(1 / 6)} y={PAD.t - 6} text-anchor="middle">левая</text>
			<text class="cf-axis-t" x={sx(0.5)} y={PAD.t - 6} text-anchor="middle">средняя</text>
			<text class="cf-axis-t" x={sx(5 / 6)} y={PAD.t - 6} text-anchor="middle">правая</text>

			<path class="cf-band cf-band-fixed" d={fixedPath} />
			<path class="cf-band cf-band-adapt" d={adaptPath} />

			{#each res.points as p, i (i)}
				<circle
					class="cf-dot"
					class:cf-miss-fixed={method === 'fixed' && p.missFixed}
					class:cf-miss-adapt={method === 'adaptive' && p.missAdaptive}
					cx={sx(p.x).toFixed(1)}
					cy={sy(p.y).toFixed(1)}
					r={(method === 'fixed' ? p.missFixed : p.missAdaptive) ? 3.2 : 2}
				/>
			{/each}

			<path class="cf-mean" d={meanPath} fill="none" />
		</svg>
	</div>

	<div class="cf-legend">
		<span class="cf-sw cf-sw-fixed" aria-hidden="true"></span>
		<span>постоянная ширина ±q</span>
		<span class="cf-sw cf-sw-adapt" aria-hidden="true"></span>
		<span>адаптивная ±q·σ̂(x)</span>
	</div>

	<div class="cf-chain">
		<p class="cf-row">
			<span class="cf-k">k = ⌈(n+1)(1−α)⌉ = ⌈{n + 1} · {(1 - alpha).toFixed(2)}⌉ = {res.k}</span>
		</p>
		<p class="cf-row">
			{#if res.kValid}
				Порог — {res.k}-е по величине из {n} оценок: q = {num(res.fixed.q)} для постоянной полосы, q =
				{num(res.adaptive.q)} для адаптивной.
			{:else}
				k = {res.k} больше n = {n}: порог не определён, интервалы бесконечны. Для α = {alpha.toFixed(
					2,
				)}
				нужно не меньше {minN} точек.
			{/if}
		</p>
		<p class="cf-row cf-muted">
			Оценки зависят от выборки и n, но не от α. Ползунок α меняет только номер k.
		</p>
	</div>

	<div class="cf-live" aria-live="polite">
		<p>{live}</p>
	</div>

	<table class="cf-table">
		<caption class="cf-cap">Покрытие на отложенной выборке, цель {target}%</caption>
		<thead>
			<tr>
				<th scope="col">Область</th>
				<th scope="col">Постоянная</th>
				<th scope="col">Адаптивная</th>
			</tr>
		</thead>
		<tbody>
			{#each regionRows as row (row.name)}
				<tr>
					<th scope="row">{row.name}</th>
					<td class:is-low={isLow(row.f)}>
						{pct(row.f)}{#if isLow(row.f)}<span class="cf-mark" aria-hidden="true">↓</span>{/if}
					</td>
					<td class:is-low={isLow(row.a)}>
						{pct(row.a)}{#if isLow(row.a)}<span class="cf-mark" aria-hidden="true">↓</span>{/if}
					</td>
				</tr>
			{/each}
			<tr>
				<th scope="row">вся выборка</th>
				<td class:is-low={isLow(res.fixed.coverage)}>{pct(res.fixed.coverage)}</td>
				<td class:is-low={isLow(res.adaptive.coverage)}>{pct(res.adaptive.coverage)}</td>
			</tr>
			<tr>
				<th scope="row">ширина интервала</th>
				<td>{num(res.fixed.width)}</td>
				<td>{num(res.adaptive.width)}</td>
			</tr>
		</tbody>
	</table>
	<p class="cf-note">
		Покрытие считается по {N_TEST} отложенным точкам. Гарантия относится к среднему по выборкам: одна
		конкретная выборка может дать покрытие немного ниже цели. ↓ означает ниже цели.
	</p>

	<div class="cf-actions">
		<span class="cf-sample">Выборка № {seed}</span>
		<button type="button" class="cf-btn" onclick={regenerate}>Перегенерировать выборку</button>
		<button type="button" class="cf-btn" onclick={reset} disabled={isDefault}>Сбросить</button>
	</div>
</div>

<style>
	.cf {
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
	}
	.cf :global(*),
	.cf :global(*::before),
	.cf :global(*::after) {
		box-sizing: border-box;
	}
	.cf p,
	.cf table,
	.cf fieldset {
		margin: 0;
	}
	.cf button {
		font: inherit;
	}
	.cf-muted {
		color: var(--text-muted);
	}
	.cf-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.cf-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cf-field {
		min-width: 0;
		padding: 0;
		border: 0;
	}
	.cf-label {
		padding: 0;
		margin-bottom: var(--space-2);
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cf-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.cf-range {
		width: 160px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cf-val {
		min-width: 4ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.cf-group {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 3px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.cf-opt {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 32px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}
	.cf-opt input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.cf-opt.is-on {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.cf-opt:has(input:focus-visible),
	.cf-range:focus-visible,
	.cf-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.cf-opt:has(input:disabled) {
		opacity: 0.5;
	}

	/* Plot */
	.cf-plot {
		margin-top: var(--space-4);
		width: 100%;
	}
	.cf-svg {
		display: block;
		width: 100%;
		height: 260px;
		overflow: visible;
	}
	.cf-axis-t {
		font-size: 12px;
		fill: var(--text-muted);
	}
	.cf-sep {
		stroke: var(--border-control);
		stroke-dasharray: 3 4;
	}
	.cf-band {
		transition: d var(--dur) var(--ease);
	}
	.cf-band-fixed {
		fill: var(--cat-2);
		fill-opacity: 0.14;
		stroke: var(--cat-2);
		stroke-width: 1.2;
		stroke-dasharray: 5 4;
	}
	.cf-band-adapt {
		fill: var(--topic);
		fill-opacity: 0.18;
		stroke: var(--topic);
		stroke-width: 1.2;
	}
	.cf-mean {
		stroke: var(--text);
		stroke-width: 1.5;
	}
	.cf-dot {
		fill: var(--text-muted);
		fill-opacity: 0.55;
	}
	.cf-miss-fixed {
		fill: var(--cat-2);
		fill-opacity: 1;
		stroke: var(--surface);
		stroke-width: 1;
	}
	.cf-miss-adapt {
		fill: var(--topic);
		fill-opacity: 1;
		stroke: var(--surface);
		stroke-width: 1;
	}

	.cf-legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-2);
		color: var(--text-muted);
	}
	.cf-sw {
		display: inline-block;
		width: 18px;
		height: 10px;
		border-radius: 2px;
	}
	.cf-sw-fixed {
		background: color-mix(in srgb, var(--cat-2) 22%, transparent);
		border: 1px dashed var(--cat-2);
	}
	.cf-sw-adapt {
		background: color-mix(in srgb, var(--topic) 26%, transparent);
		border: 1px solid var(--topic);
	}

	/* Cause and effect */
	.cf-chain {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--surface-2);
		border-radius: var(--radius);
	}
	.cf-k {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.cf-live {
		margin-top: var(--space-3);
		color: var(--text);
	}

	/* Table */
	.cf-table {
		width: 100%;
		margin-top: var(--space-4);
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.cf-cap {
		caption-side: top;
		padding-bottom: var(--space-2);
		text-align: left;
		color: var(--text-muted);
	}
	.cf-table th,
	.cf-table td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border);
		text-align: right;
	}
	.cf-table th {
		font-weight: 500;
		color: var(--text-muted);
	}
	.cf-table th[scope='row'] {
		text-align: left;
		color: var(--text);
	}
	.cf-table td.is-low {
		color: var(--warn);
		font-weight: 600;
	}
	.cf-mark {
		margin-left: 2px;
	}
	.cf-note {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}

	.cf-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.cf-sample {
		margin-right: auto;
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-muted);
	}
	.cf-btn {
		min-height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
	}
	.cf-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	@media (max-width: 480px) {
		.cf {
			padding: var(--space-4);
			min-width: 0;
			max-width: 100%;
		}
		.cf-table {
			table-layout: fixed;
		}
		.cf-table th,
		.cf-table td {
			padding: var(--space-2) var(--space-1);
			overflow-wrap: anywhere;
		}
		.cf-table th[scope='row'] {
			width: 40%;
		}
		.cf-range {
			width: 100%;
		}
		.cf-ctl {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cf *,
		.cf *::before,
		.cf *::after {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
