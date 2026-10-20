<script lang="ts">
	import { onDestroy } from 'svelte';
	import { drho, jointM, rho, type PsiKind, type RhoKind } from '$lib/demos/robust-core';
	import { scaleFactor } from '$lib/demos/robust-model';
	import { mulberry32 } from '$lib/prob/rng';
	import {
		BISQ_C,
		EPS_DEFAULT,
		HUBER_C,
		locValue,
		mixtureFor,
	} from '$lib/components/demos/robust/location-grid';

	/** Joint location-scale M-estimation: psi for mu, rho for sigma, alternating steps. */
	let { initial }: { initial?: { psi?: PsiKind; rho?: RhoKind } } = $props();

	const M = mixtureFor(EPS_DEFAULT);
	const N = 300;
	const MU = 2;
	const SIGMA = 3;
	const SEED0 = 4242;
	const PLAY_MS = 600;

	const PSI_OPTS = [
		{ label: 'Хубер, c = 1,5', kind: 'huber' as PsiKind, c: HUBER_C },
		{ label: 'Tukey bisquare, c = 4,685', kind: 'bisquare' as PsiKind, c: BISQ_C },
	];
	/** b = E_F rho(U): calibrated on the model so that the true sigma solves the scale equation. */
	const RHO_OPTS = [
		{ label: 'Tukey bisquare, c = 1,54764', kind: 'bisquare' as RhoKind, c: 1.54764 },
		{ label: 'Clipped quadratic, c = 2', kind: 'clipped' as RhoKind, c: 2 },
	].map((o) => ({ ...o, b: M.expect((u) => rho(o.kind, u, o.c)) }));

	const V_MU = PSI_OPTS.map((o) => locValue(EPS_DEFAULT, { kind: o.kind, c: o.c }));
	const V_SIGMA = RHO_OPTS.map((o) =>
		scaleFactor(
			M,
			(u) => rho(o.kind, u, o.c),
			(u) => drho(o.kind, u, o.c),
			o.b,
		),
	);

	/* The props only seed the initial state: the demo owns it afterwards. */
	/* svelte-ignore state_referenced_locally */
	let psiIdx = $state(initial?.psi === 'bisquare' ? 1 : 0);
	/* svelte-ignore state_referenced_locally */
	let rhoIdx = $state(initial?.rho === 'clipped' ? 1 : 0);
	let seedNo = $state(0);
	let step = $state(0);
	let playing = $state(false);
	let plotW = $state(0);

	const sample = $derived(M.sampleX(N, mulberry32(SEED0 + seedNo), MU, SIGMA));

	const fits = $derived(
		PSI_OPTS.flatMap((p, pi) =>
			RHO_OPTS.map((r, ri) => ({
				pi,
				ri,
				fit: jointM(sample, {
					psi: { kind: p.kind, c: p.c },
					rho: { kind: r.kind, c: r.c, b: r.b },
				}),
			})),
		),
	);
	const selected = $derived(fits.find((f) => f.pi === psiIdx && f.ri === rhoIdx) ?? fits[0]!);
	const trace = $derived(selected.fit.trace);
	const last = $derived(trace.length - 1);
	const cur = $derived(Math.min(step, last));
	const finalStep = $derived(trace[last]!);

	/* Animation of the alternation */
	let timer: ReturnType<typeof setInterval> | null = null;
	function stopPlay(): void {
		if (timer !== null) clearInterval(timer);
		timer = null;
		playing = false;
	}
	function reducedMotion(): boolean {
		return (
			typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}
	function play(): void {
		if (step >= last) step = 0;
		if (reducedMotion()) {
			step = last;
			return;
		}
		playing = true;
		timer = setInterval(() => {
			if (step >= last) {
				stopPlay();
				return;
			}
			step++;
		}, PLAY_MS);
	}
	function nextStep(): void {
		stopPlay();
		step = Math.min(last, step + 1);
	}
	function resetSteps(): void {
		stopPlay();
		step = 0;
	}
	function pick(pi: number, ri: number): void {
		psiIdx = pi;
		rhoIdx = ri;
		resetSteps();
	}
	function newSample(): void {
		seedNo++;
		resetSteps();
	}
	onDestroy(stopPlay);

	const fmt = (v: number, d = 2): string => v.toFixed(d).replace('.', ',');

	// SVG geometry: two panels (mu and sigma by iteration), drawn at the real width.
	const PH = 120;
	const PAD = { l: 48, r: 10, t: 10, b: 22 };
	const PW = $derived(Math.max(300, plotW));
	const xOf = (k: number): number => PAD.l + (k / Math.max(1, last)) * (PW - PAD.l - PAD.r);

	interface Dom {
		lo: number;
		hi: number;
	}
	function domainOf(vals: number[]): Dom {
		const lo = Math.min(...vals);
		const hi = Math.max(...vals);
		const pad = (hi - lo) * 0.15 || Math.max(Math.abs(hi), 1) * 0.01;
		return { lo: lo - pad, hi: hi + pad };
	}
	const muDom = $derived(domainOf(trace.map((s) => s.mu)));
	const sigmaDom = $derived(domainOf(trace.map((s) => s.sigma)));
	const yOf = (v: number, d: Dom): number =>
		PAD.t + (1 - (v - d.lo) / (d.hi - d.lo)) * (PH - PAD.t - PAD.b);
	const pathOf = (key: 'mu' | 'sigma', d: Dom): string =>
		trace
			.slice(0, cur + 1)
			.map((s, k) => `${k ? 'L' : 'M'}${xOf(k).toFixed(1)} ${yOf(s[key], d).toFixed(1)}`)
			.join(' ');

	const stepText = $derived(
		cur === 0
			? 'Старт: медиана выборки и M-scale вокруг неё.'
			: `Итерация ${cur}: μ-шаг (IRLS при σ предыдущей итерации), затем σ-шаг (M-scale при новом μ).`,
	);
	const curVals = $derived(trace[cur]!);
	const liveDesc = $derived(
		`Шаг ${cur} из ${last}: μ = ${fmt(curVals.mu, 4)}, σ = ${fmt(curVals.sigma, 4)}.`,
	);
</script>

<figure class="je" id="demo-joint-estimation" data-demo="joint-estimation">
	<div class="je-row">
		<p class="je-label">
			Выборка из смеси: n = {N}, ε = {fmt(EPS_DEFAULT, 2)}, истинные μ = {MU}, σ = {SIGMA}. Выборка
			№ {seedNo + 1}.
		</p>
		<div class="je-buttons">
			<button type="button" class="je-btn" onclick={newSample}>Новая выборка</button>
		</div>
	</div>

	<div class="je-row">
		<p class="je-label">Комбинация: ψ для μ и ρ для σ</p>
		<table class="je-table">
			<thead>
				<tr>
					<th scope="col">ψ (положение)</th>
					<th scope="col">ρ (масштаб)</th>
					<th scope="col" class="je-num">μ̂</th>
					<th scope="col" class="je-num">σ̂</th>
					<th scope="col" class="je-num">Шагов</th>
				</tr>
			</thead>
			<tbody>
				{#each fits as f (f.pi * 10 + f.ri)}
					<tr class:je-chosen={f.pi === psiIdx && f.ri === rhoIdx}>
						<td>
							<button
								type="button"
								class="je-pick"
								aria-pressed={f.pi === psiIdx && f.ri === rhoIdx}
								onclick={() => pick(f.pi, f.ri)}>{PSI_OPTS[f.pi]!.label}</button
							>
						</td>
						<td>{RHO_OPTS[f.ri]!.label}</td>
						<td class="je-num">{fmt(f.fit.mu, 4)}</td>
						<td class="je-num">{fmt(f.fit.sigma, 4)}</td>
						<td class="je-num">{f.fit.iterations}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="je-hint">
			Истинные значения: μ = {MU}, σ = {SIGMA}. Выбранная комбинация показана ниже.
		</p>
	</div>

	<div class="je-row" bind:clientWidth={plotW}>
		<p class="je-label">
			Чередование шагов для «{PSI_OPTS[psiIdx]!.label}» и «{RHO_OPTS[rhoIdx]!.label}».
			{stepText}
		</p>
		<svg
			class="je-svg"
			width={PW}
			height={PH}
			viewBox="0 0 {PW} {PH}"
			role="img"
			aria-labelledby="je-mu-title je-mu-desc"
		>
			<title id="je-mu-title">Оценка положения μ по итерациям</title>
			<desc id="je-mu-desc">{liveDesc}</desc>
			<line class="je-axis" x1={PAD.l} x2={PW - PAD.r} y1={PH - PAD.b} y2={PH - PAD.b} />
			<line
				class="je-ref"
				x1={PAD.l}
				x2={PW - PAD.r}
				y1={yOf(finalStep.mu, muDom)}
				y2={yOf(finalStep.mu, muDom)}
			/>
			<path class="je-line je-mu" d={pathOf('mu', muDom)} fill="none" />
			<circle class="je-dot je-mu" cx={xOf(cur)} cy={yOf(curVals.mu, muDom)} r="4" />
			<text class="je-tick" x={PAD.l - 6} y={yOf(muDom.hi, muDom) + 4} text-anchor="end"
				>{fmt(muDom.hi, 2)}</text
			>
			<text class="je-tick" x={PAD.l - 6} y={yOf(muDom.lo, muDom) + 4} text-anchor="end"
				>{fmt(muDom.lo, 2)}</text
			>
			<text class="je-tick" x={PAD.l} y={PH - 6}>μ, итерация 0</text>
		</svg>

		<svg
			class="je-svg je-svg-sigma"
			width={PW}
			height={PH}
			viewBox="0 0 {PW} {PH}"
			role="img"
			aria-labelledby="je-sigma-title je-sigma-desc"
		>
			<title id="je-sigma-title">Оценка масштаба σ по итерациям</title>
			<desc id="je-sigma-desc">{liveDesc}</desc>
			<line class="je-axis" x1={PAD.l} x2={PW - PAD.r} y1={PH - PAD.b} y2={PH - PAD.b} />
			<line
				class="je-ref"
				x1={PAD.l}
				x2={PW - PAD.r}
				y1={yOf(finalStep.sigma, sigmaDom)}
				y2={yOf(finalStep.sigma, sigmaDom)}
			/>
			<path class="je-line je-sigma" d={pathOf('sigma', sigmaDom)} fill="none" />
			<circle class="je-dot je-sigma" cx={xOf(cur)} cy={yOf(curVals.sigma, sigmaDom)} r="4" />
			<text class="je-tick" x={PAD.l - 6} y={yOf(sigmaDom.hi, sigmaDom) + 4} text-anchor="end"
				>{fmt(sigmaDom.hi, 2)}</text
			>
			<text class="je-tick" x={PAD.l - 6} y={yOf(sigmaDom.lo, sigmaDom) + 4} text-anchor="end"
				>{fmt(sigmaDom.lo, 2)}</text
			>
			<text class="je-tick" x={PAD.l} y={PH - 6}>σ, итерация 0</text>
		</svg>

		<p class="je-live" aria-live="polite">{liveDesc}</p>
	</div>

	<div class="je-buttons">
		<button type="button" class="je-btn" onclick={play} disabled={playing || cur >= last}
			>Проиграть</button
		>
		<button type="button" class="je-btn" onclick={nextStep} disabled={cur >= last}>Шаг</button>
		<button type="button" class="je-btn je-btn-quiet" onclick={resetSteps} disabled={cur === 0}
			>Сбросить</button
		>
	</div>

	<div class="je-row">
		<p class="je-label">
			Асимптотические факторы дисперсии для этой смеси. Меньше V — оценка точнее; вывод верен для
			этой смеси и этих c.
		</p>
		<table class="je-table">
			<thead>
				<tr>
					<th scope="col">Оценка</th>
					<th scope="col">c</th>
					<th scope="col" class="je-num">V (асимпт.)</th>
				</tr>
			</thead>
			<tbody>
				{#each PSI_OPTS as o, i (o.label)}
					<tr>
						<td>Положение, ψ = {o.kind === 'huber' ? 'Хубер' : 'bisquare'}</td>
						<td>{fmt(o.c, o.c === 4.685 ? 3 : 1)}</td>
						<td class="je-num">V_μ = {fmt(V_MU[i]!, 3)}</td>
					</tr>
				{/each}
				{#each RHO_OPTS as o, i (o.label)}
					<tr>
						<td>Масштаб, ρ = {o.kind === 'bisquare' ? 'bisquare' : 'clipped quadratic'}</td>
						<td>{fmt(o.c, o.c === 1.54764 ? 5 : 1)}</td>
						<td class="je-num">V_σ = {fmt(V_SIGMA[i]!, 3)} (b_F = {fmt(o.b, 4)})</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="je-note">
		<strong>Что заметить:</strong> смена ψ мало меняет оценку положения, а выбор ρ для масштаба заметно
		меняет V_σ. Итоговая комбинация в ноутбуке: bisquare (4,685) для положения и clipped quadratic (2)
		для масштаба.
	</p>
</figure>

<style>
	.je {
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
	.je :global(*),
	.je :global(*::before),
	.je :global(*::after) {
		box-sizing: border-box;
	}
	.je p {
		margin: 0;
	}
	.je button {
		font: inherit;
	}
	.je-row {
		margin-top: var(--space-4);
	}
	.je-label {
		color: var(--text-muted);
		margin-bottom: var(--space-2);
	}
	.je-hint {
		margin-top: var(--space-2);
		color: var(--text-muted);
	}
	.je-live {
		margin-top: var(--space-2);
		font-variant-numeric: tabular-nums;
	}
	.je-table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
		display: block;
		overflow-x: auto;
	}
	.je-table th,
	.je-table td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border);
		text-align: left;
		vertical-align: middle;
	}
	.je-table th {
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 500;
	}
	.je-num {
		text-align: right;
	}
	.je-chosen td {
		background: var(--surface-2);
	}
	.je-pick {
		min-height: 32px;
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
		text-align: left;
	}
	.je-pick[aria-pressed='true'] {
		border-color: var(--topic);
		color: var(--topic);
		font-weight: 600;
	}
	.je-pick:focus-visible,
	.je-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.je-svg {
		display: block;
		max-width: 100%;
		overflow: visible;
		margin-bottom: var(--space-2);
	}
	.je-axis {
		stroke: var(--border);
		stroke-width: 1;
	}
	.je-ref {
		stroke: var(--text);
		stroke-width: 1.25;
		stroke-dasharray: 4 3;
		opacity: 0.6;
	}
	.je-tick {
		font-size: 11px;
		fill: var(--text-muted);
	}
	.je-line {
		fill: none;
		stroke-width: 2.25;
	}
	.je-line.je-mu,
	.je-dot.je-mu {
		stroke: var(--topic);
	}
	.je-line.je-sigma,
	.je-dot.je-sigma {
		stroke: var(--accent);
	}
	.je-dot.je-mu {
		fill: var(--topic);
	}
	.je-dot.je-sigma {
		fill: var(--accent);
	}
	.je-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.je-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--topic);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--topic);
		cursor: pointer;
	}
	.je-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.je-btn-quiet {
		border-color: var(--border);
		color: var(--text-muted);
	}
	.je-note {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	@media (prefers-reduced-motion: reduce) {
		.je-line {
			transition: none;
		}
	}
	@media (max-width: 559px) {
		.je {
			padding: var(--space-4);
		}
	}
</style>
