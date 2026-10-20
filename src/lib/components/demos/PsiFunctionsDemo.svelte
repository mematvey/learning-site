<script lang="ts">
	import { linearScale } from '$lib/charts/scales';
	import {
		C_RANGE,
		FAMILIES,
		FAMILY_LABEL,
		PRESETS,
		curveSet,
		defaultC,
		fmt,
		polyPath,
		range,
		type CurveFamily,
	} from './robust/plot';

	/** rho, psi and weight curves of Huber, bisquare and clipped quadratic. Maths: $lib/demos/robust-core. */
	let { initial }: { initial?: { family?: CurveFamily; c?: number } } = $props();

	/* svelte-ignore state_referenced_locally */
	let family = $state<CurveFamily>(initial?.family ?? 'huber');
	/* svelte-ignore state_referenced_locally */
	let c = $state<number>(initial?.c ?? defaultC(initial?.family ?? 'huber'));

	const U = range(-8, 8, 321);
	/** The mean line psi(u) = u leaves the psi panel beyond |u| = 4, so it is drawn only there. */
	const U_NEAR = U.filter((u) => Math.abs(u) <= 4);
	const SIGN_Y = U.map((u) => Math.sign(u));
	const H = 120;
	const PAD_B = 20;
	const PAD_T = 6;

	let wrap = $state(0);
	const plotW = $derived(wrap >= 240 ? wrap : 280);
	const sx = $derived(linearScale([-8, 8], [0, plotW]));

	const fns = $derived(curveSet(family, c));
	const rhoYs = $derived(U.map((u) => fns.rho(u)));
	const psiYs = $derived(U.map((u) => fns.psi(u)));
	const wYs = $derived(U.map((u) => fns.weight(u)));

	const rhoMax = $derived(family === 'huber' ? fns.rho(8) * 1.03 : 1.05);
	const wMax = $derived(Math.max(1.1, ...wYs) * 1.05);
	const syRho = $derived(linearScale([0, rhoMax], [H - PAD_B, PAD_T]));
	const syPsi = $derived(linearScale([-4, 4], [H - PAD_B, PAD_T]));
	const syW = $derived(linearScale([0, wMax], [H - PAD_B, PAD_T]));

	const rhoPath = $derived(polyPath(U, rhoYs, sx, syRho));
	const psiPath = $derived(polyPath(U, psiYs, sx, syPsi));
	const meanPsiPath = $derived(polyPath(U_NEAR, U_NEAR, sx, syPsi));
	const signPath = $derived(polyPath(U, SIGN_Y, sx, syPsi));
	const wPath = $derived(polyPath(U, wYs, sx, syW));

	const presets = $derived(PRESETS[family]);
	const note = $derived(
		family === 'huber'
			? 'Huber ограничивает влияние: при |u| > c функция ψ стоит на уровне ±c, вес c/|u| убывает, но не обнуляется.'
			: family === 'bisquare'
				? 'bisquare обнуляет влияние: при |u| ≥ c ψ = 0 и вес равен нулю, далёкие точки не учитываются вовсе.'
				: 'Клипованная квадратичная: ρ насыщается на 1, ψ = ρ′ обнуляется при |u| ≥ c. Используется для масштаба, а не для положения.',
	);
	const live = $derived(
		`${FAMILY_LABEL[family]}, c = ${fmt(c, 3)}. Вес при u = 4: ${fmt(fns.weight(4), 3)}; ψ при u = 4: ${fmt(fns.psi(4), 3)}.`,
	);

	function selectFamily(f: CurveFamily): void {
		family = f;
		c = defaultC(f);
	}
</script>

<figure class="pf" id="demo-psi-functions" data-demo="psi-functions">
	<div class="pf-controls">
		<div class="pf-group" role="group" aria-label="Семейство функций">
			{#each FAMILIES as f (f)}
				<button
					type="button"
					class="pf-seg"
					aria-pressed={family === f}
					onclick={() => selectFamily(f)}>{FAMILY_LABEL[f]}</button
				>
			{/each}
		</div>

		<label class="pf-slider">
			<span>Настроечная константа c = {fmt(c, 3)}</span>
			<input
				type="range"
				min={C_RANGE[family].min}
				max={C_RANGE[family].max}
				step="0.005"
				bind:value={c}
				aria-label="Константа c"
			/>
		</label>

		<div class="pf-buttons" role="group" aria-label="Стандартные значения c">
			{#each presets as p (p.c)}
				<button type="button" class="pf-btn" aria-pressed={c === p.c} onclick={() => (c = p.c)}
					>{p.label}</button
				>
			{/each}
		</div>
	</div>

	<div class="pf-plot" bind:clientWidth={wrap}>
		<p class="pf-label">ρ(u): функция потерь, насколько сильно растёт штраф</p>
		<svg
			class="pf-svg"
			width="100%"
			height={H}
			viewBox="0 0 {plotW} {H}"
			role="img"
			aria-labelledby="pf-rho-title"
		>
			<title id="pf-rho-title">ρ(u) для {FAMILY_LABEL[family]}, c = {fmt(c, 3)}</title>
			<line class="pf-axis" x1="0" x2={plotW} y1={H - PAD_B} y2={H - PAD_B} />
			<line class="pf-cline" x1={sx(c)} x2={sx(c)} y1="0" y2={H - PAD_B} />
			<line class="pf-cline" x1={sx(-c)} x2={sx(-c)} y1="0" y2={H - PAD_B} />
			<path class="pf-curve" d={rhoPath} />
		</svg>
	</div>

	<div class="pf-plot">
		<p class="pf-label">ψ(u) = ρ′(u): влияние одного наблюдения (influence function)</p>
		<svg
			class="pf-svg"
			width="100%"
			height={H}
			viewBox="0 0 {plotW} {H}"
			role="img"
			aria-labelledby="pf-psi-title"
		>
			<title id="pf-psi-title">ψ(u) для {FAMILY_LABEL[family]}, c = {fmt(c, 3)}</title>
			<line class="pf-axis" x1="0" x2={plotW} y1={H - PAD_B} y2={H - PAD_B} />
			<line class="pf-cline" x1={sx(c)} x2={sx(c)} y1="0" y2={H - PAD_B} />
			<line class="pf-cline" x1={sx(-c)} x2={sx(-c)} y1="0" y2={H - PAD_B} />
			<path class="pf-ref" d={meanPsiPath} />
			<path class="pf-ref-dash" d={signPath} />
			<path class="pf-curve" d={psiPath} />
		</svg>
	</div>

	<div class="pf-plot">
		<p class="pf-label">w(u) = ψ(u)/u: вес наблюдения в средневзвешенной оценке</p>
		<svg
			class="pf-svg"
			width="100%"
			height={H}
			viewBox="0 0 {plotW} {H}"
			role="img"
			aria-labelledby="pf-w-title"
		>
			<title id="pf-w-title">Вес w(u) для {FAMILY_LABEL[family]}, c = {fmt(c, 3)}</title>
			<line class="pf-axis" x1="0" x2={plotW} y1={H - PAD_B} y2={H - PAD_B} />
			<line class="pf-cline" x1={sx(c)} x2={sx(c)} y1="0" y2={H - PAD_B} />
			<line class="pf-cline" x1={sx(-c)} x2={sx(-c)} y1="0" y2={H - PAD_B} />
			<line class="pf-ref" x1="0" x2={plotW} y1={syW(1)} y2={syW(1)} />
			<path class="pf-curve" d={wPath} />
		</svg>
		<p class="pf-axis-note">
			<span class="pf-tick-l">−8</span>
			<span class="pf-tick-c">u = 0</span>
			<span class="pf-tick-r">8</span>
		</p>
	</div>

	<p class="pf-legend">
		Толстая линия: выбранная функция. Тонкая сплошная: ψ(u) = u («среднее», вес 1). Тонкая
		штриховая: sign(u) («медиана», вес 1/|u|). Пунктир: границы ±c.
	</p>

	<p class="pf-note">
		<strong>Что заметить:</strong>
		{note}
	</p>

	<p class="pf-live" aria-live="polite">{live}</p>
</figure>

<style>
	.pf {
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
	.pf :global(*),
	.pf :global(*::before),
	.pf :global(*::after) {
		box-sizing: border-box;
	}
	.pf p {
		margin: 0;
	}
	.pf button {
		font: inherit;
	}
	.pf-controls {
		display: grid;
		gap: var(--space-3);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.pf-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		max-width: 100%;
	}
	.pf-seg {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	.pf-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.pf-slider {
		display: grid;
		gap: var(--space-1);
		font-variant-numeric: tabular-nums;
	}
	.pf-slider input {
		width: 100%;
		accent-color: var(--topic);
	}
	.pf-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.pf-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text-muted);
		cursor: pointer;
	}
	.pf-btn[aria-pressed='true'] {
		border-color: var(--topic);
		color: var(--topic);
		font-weight: 600;
	}
	.pf-seg:focus-visible,
	.pf-btn:focus-visible,
	.pf-slider input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.pf-plot {
		margin-top: var(--space-4);
	}
	.pf-label {
		color: var(--text-muted);
		margin-bottom: var(--space-2);
	}
	.pf-svg {
		display: block;
		overflow: visible;
	}
	.pf-axis {
		stroke: var(--border);
		stroke-width: 1;
	}
	.pf-cline {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.pf-curve {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2.5;
		stroke-linejoin: round;
	}
	.pf-ref {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.pf-ref-dash {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 5 3;
	}
	.pf-axis-note {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--text-muted);
		margin-top: 2px;
	}
	.pf-legend {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-size: 12px;
	}
	.pf-note {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	.pf-live {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	@media (max-width: 559px) {
		.pf {
			padding: var(--space-4);
		}
	}
</style>
