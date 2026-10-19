<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		ALPHA,
		DELTA_MAX,
		DELTA_MIN,
		DELTA_STEP,
		LOOKS_MAX,
		LOOKS_MIN,
		POWER,
		SIGMA_MAX,
		SIGMA_MIN,
		SIGMA_STEP,
		SIM_RUNS,
		type AbTestDemoState,
		criticalZ,
		power,
		powerCurve,
		sampleSize,
		simulatePeeking,
		snapDelta,
		snapLooks,
		snapSigma,
	} from '$lib/demos/ab-testing';

	/** A/B-test demo: power curve from n, and a simulation of peeking. Registers itself as demo `ab-testing`. */
	let { initial }: { initial?: Partial<AbTestDemoState> } = $props();

	const DEFAULTS = { sigma: 1, delta: 0.2, looks: LOOKS_MAX, seed: 1 } as const;

	/* The props only seed the initial state: the demo owns it afterwards. */
	/* svelte-ignore state_referenced_locally */
	let sigma = $state(snapSigma(initial?.sigma ?? DEFAULTS.sigma));
	/* svelte-ignore state_referenced_locally */
	let delta = $state(snapDelta(initial?.delta ?? DEFAULTS.delta));
	/* svelte-ignore state_referenced_locally */
	let looks = $state(snapLooks(initial?.looks ?? DEFAULTS.looks));
	/* svelte-ignore state_referenced_locally */
	let seed = $state(Math.max(1, Math.floor(initial?.seed ?? DEFAULTS.seed)));
	/** Sample size per group picked by the reader for the power readout. */
	let nPick = $state(200);
	/** Position in the list of runs that declared a false win, for the path chart. */
	let pickPos = $state(0);
	/** Measured widths of the charts in px; drawn 1:1 (no viewBox scaling). */
	let wPower = $state(0);
	let wPath = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const zCrit = $derived(criticalZ(ALPHA));
	const n80 = $derived(sampleSize(sigma, delta));
	const nMax = $derived(Math.max(500, Math.ceil((n80 * 1.5) / 100) * 100));
	const nSafe = $derived(Math.min(nMax, Math.max(10, nPick)));
	const pNow = $derived(power(nSafe, sigma, delta));
	const plotWPower = $derived(wPower >= 160 ? wPower : 360);
	const curve = $derived(powerCurve(sigma, delta, nMax, 160));

	const sim = $derived(simulatePeeking(looks, seed));
	/** Runs where some look crosses the Bonferroni-free threshold: the illustrative false wins. */
	const crossing = $derived.by(() => {
		const k = looks;
		const out: number[] = [];
		for (let r = 0; r < SIM_RUNS; r++) {
			for (let j = 0; j < k; j++) {
				if (Math.abs(sim.paths[r * k + j] ?? 0) > zCrit) {
					out.push(r);
					break;
				}
			}
		}
		return out;
	});
	const runIdx = $derived(crossing.length ? (crossing[pickPos % crossing.length] ?? 0) : 0);
	const pathZ = $derived(
		Array.from({ length: looks }, (_, j) => sim.paths[runIdx * looks + j] ?? 0),
	);
	const plotWPath = $derived(wPath >= 160 ? wPath : 360);
	const zRange = 3.5;

	function fmt(v: number, d: number): string {
		return v.toFixed(d).replace('.', ',');
	}
	function pct(p: number): string {
		return `${Math.round(p * 100)}%`;
	}

	// Power chart geometry
	const PW_H = 200;
	const PAD_L = 40;
	const PAD_B = 28;
	const PAD_T = 8;
	const PAD_R = 10;
	function xPow(n: number): number {
		return PAD_L + (n / nMax) * (plotWPower - PAD_L - PAD_R);
	}
	function yPow(p: number): number {
		return PW_H - PAD_B - p * (PW_H - PAD_B - PAD_T);
	}
	const curvePath = $derived(
		curve
			.map((pt, i) => `${i === 0 ? 'M' : 'L'}${xPow(pt.n).toFixed(1)},${yPow(pt.power).toFixed(1)}`)
			.join(' '),
	);
	const xTicks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(nMax * f)));

	// Path chart geometry
	const PH_H = 180;
	function xPath(j: number): number {
		return PAD_L + ((j + 0.5) / looks) * (plotWPath - PAD_L - PAD_R);
	}
	function yPath(z: number): number {
		const c = Math.max(-zRange, Math.min(zRange, z));
		return PAD_T + ((zRange - c) / (2 * zRange)) * (PH_H - PAD_T - PAD_B);
	}

	const sentence = $derived(
		`Размер выборки на группу для мощности 80% при α = 0,05: ${n80}. ` +
			`При n = ${nSafe} мощность ${pct(pNow)}. ` +
			`Симуляция без эффекта, ${SIM_RUNS} экспериментов: при одной проверке ложных побед ${pct(sim.single)}, ` +
			`при ${looks} проверках без поправки ${pct(sim.peeking)}, с поправкой Бонферрони ${pct(sim.bonferroni)}.`,
	);

	function reset(): void {
		sigma = DEFAULTS.sigma;
		delta = DEFAULTS.delta;
		looks = DEFAULTS.looks;
		seed = DEFAULTS.seed;
		pickPos = 0;
	}

	function apply(patch: Partial<AbTestDemoState>): void {
		if (typeof patch.sigma === 'number') sigma = snapSigma(patch.sigma);
		if (typeof patch.delta === 'number') delta = snapDelta(patch.delta);
		if (typeof patch.looks === 'number') looks = snapLooks(patch.looks);
		pickPos = 0;
	}

	function preset(kind: 'half' | 'fifth' | 'conv'): void {
		if (kind === 'conv') {
			sigma = 0.3;
			delta = 0.01;
		} else {
			sigma = 1;
			delta = kind === 'half' ? 0.5 : 0.2;
		}
		pickPos = 0;
	}

	onMount(() => {
		return demos?.register('ab-testing', {
			set: (patch) => apply(patch as Partial<AbTestDemoState>),
		});
	});
</script>

<figure class="ab" id="demo-ab-testing" data-demo="ab-testing">
	<section class="ab-part" aria-labelledby="ab-power-t">
		<h4 class="ab-h" id="ab-power-t">Мощность от размера выборки</h4>

		<div class="ab-controls">
			<label class="ab-ctl">
				<span class="ab-label"><span class="ab-sym">σ</span> (разброс)</span>
				<input
					class="ab-range"
					type="range"
					min={SIGMA_MIN}
					max={SIGMA_MAX}
					step={SIGMA_STEP}
					value={sigma}
					oninput={(e) => (sigma = snapSigma(Number(e.currentTarget.value)))}
				/>
				<output class="ab-val">{fmt(sigma, 2)}</output>
			</label>
			<label class="ab-ctl">
				<span class="ab-label"><span class="ab-sym">δ</span> (эффект)</span>
				<input
					class="ab-range"
					type="range"
					min={DELTA_MIN}
					max={DELTA_MAX}
					step={DELTA_STEP}
					value={delta}
					oninput={(e) => (delta = snapDelta(Number(e.currentTarget.value)))}
				/>
				<output class="ab-val">{fmt(delta, 2)}</output>
			</label>
		</div>

		<div class="ab-presets" role="group" aria-label="Готовые варианты">
			<button type="button" class="ab-btn" onclick={() => preset('fifth')}>δ = 0,2σ</button>
			<button type="button" class="ab-btn" onclick={() => preset('half')}>δ = 0,5σ</button>
			<button type="button" class="ab-btn" onclick={() => preset('conv')}>конверсия 10 → 11%</button
			>
		</div>

		<div class="ab-plot" bind:clientWidth={wPower}>
			<svg
				class="ab-svg"
				width={plotWPower}
				height={PW_H}
				viewBox="0 0 {plotWPower} {PW_H}"
				role="img"
				aria-labelledby="ab-power-title ab-power-desc"
			>
				<title id="ab-power-title">Кривая мощности</title>
				<desc id="ab-power-desc">
					Мощность растёт с размером выборки на группу. Пунктир на уровне 80% отмечает желаемую
					мощность, вертикальная линия n = {n80} показывает нужный размер выборки.
				</desc>
				{#each [0, 0.5, 0.8, 1] as p (p)}
					<line class="ab-grid" x1={PAD_L} x2={plotWPower - PAD_R} y1={yPow(p)} y2={yPow(p)} />
					<text class="ab-tick" x={PAD_L - 6} y={yPow(p) + 4} text-anchor="end">{pct(p)}</text>
				{/each}
				{#each xTicks as t (t)}
					<text class="ab-tick" x={xPow(t)} y={PW_H - 8} text-anchor="middle">{t}</text>
				{/each}
				<line
					class="ab-target"
					x1={PAD_L}
					x2={plotWPower - PAD_R}
					y1={yPow(POWER)}
					y2={yPow(POWER)}
				/>
				<line class="ab-mark" x1={xPow(n80)} x2={xPow(n80)} y1={PAD_T} y2={PW_H - PAD_B} />
				<path class="ab-curve" d={curvePath} />
				<circle class="ab-dot" cx={xPow(nSafe)} cy={yPow(pNow)} r="5" />
			</svg>
		</div>

		<div class="ab-controls">
			<label class="ab-ctl ab-ctl-wide">
				<span class="ab-label">n на группу</span>
				<input
					class="ab-range"
					type="range"
					min="10"
					max={nMax}
					step="10"
					value={nSafe}
					oninput={(e) => (nPick = Number(e.currentTarget.value))}
				/>
				<output class="ab-val">{nSafe}</output>
			</label>
		</div>

		<dl class="ab-stats">
			<dt>Нужно на группу (80%)</dt>
			<dd>{n80}</dd>
			<dt>Мощность при n = {nSafe}</dt>
			<dd>{pct(pNow)}</dd>
		</dl>
	</section>

	<section class="ab-part" aria-labelledby="ab-peek-t">
		<h4 class="ab-h" id="ab-peek-t">Подглядывание</h4>
		<p class="ab-text">
			Эффекта нет, а результат смотрят {looks} раз подряд и останавливаются при первом p &lt; 0,05.
		</p>

		<div class="ab-controls">
			<label class="ab-ctl ab-ctl-wide">
				<span class="ab-label">проверок</span>
				<input
					class="ab-range"
					type="range"
					min={LOOKS_MIN}
					max={LOOKS_MAX}
					step="1"
					value={looks}
					oninput={(e) => {
						looks = snapLooks(Number(e.currentTarget.value));
						pickPos = 0;
					}}
				/>
				<output class="ab-val">{looks}</output>
			</label>
		</div>

		<div class="ab-bars" role="img" aria-label="Доля ложных побед по вариантам">
			<div class="ab-bar-row">
				<span class="ab-bar-l">1 проверка</span>
				<span class="ab-bar-track"
					><span class="ab-bar-fill ab-fill-1" style="width: {sim.single * 100}%"></span></span
				>
				<span class="ab-bar-v">{pct(sim.single)}</span>
			</div>
			<div class="ab-bar-row">
				<span class="ab-bar-l">{looks} без поправки</span>
				<span class="ab-bar-track"
					><span class="ab-bar-fill ab-fill-warn" style="width: {sim.peeking * 100}%"></span></span
				>
				<span class="ab-bar-v">{pct(sim.peeking)}</span>
			</div>
			<div class="ab-bar-row">
				<span class="ab-bar-l">{looks}, Бонферрони (z ≈ {fmt(sim.zBonferroni, 2)})</span>
				<span class="ab-bar-track"
					><span class="ab-bar-fill ab-fill-2" style="width: {sim.bonferroni * 100}%"></span></span
				>
				<span class="ab-bar-v">{pct(sim.bonferroni)}</span>
			</div>
		</div>
		<p class="ab-note">
			Заявленный уровень α = 0,05. Ложная победа: |z| &gt; {fmt(zCrit, 2)} хотя бы на одной проверке.
		</p>

		<div class="ab-plot" bind:clientWidth={wPath}>
			<svg
				class="ab-svg"
				width={plotWPath}
				height={PH_H}
				viewBox="0 0 {plotWPath} {PH_H}"
				role="img"
				aria-labelledby="ab-path-title ab-path-desc"
			>
				<title id="ab-path-title">Статистика одного эксперимента по проверкам</title>
				<desc id="ab-path-desc">
					Значение z при каждой проверке для эксперимента без эффекта. Пунктир: порог
					{fmt(zCrit, 2)}. Если линия выходит за пунктир, эксперимент остановили бы как победу.
				</desc>
				<line class="ab-grid" x1={PAD_L} x2={plotWPath - PAD_R} y1={yPath(0)} y2={yPath(0)} />
				<line
					class="ab-thr"
					x1={PAD_L}
					x2={plotWPath - PAD_R}
					y1={yPath(zCrit)}
					y2={yPath(zCrit)}
				/>
				<line
					class="ab-thr"
					x1={PAD_L}
					x2={plotWPath - PAD_R}
					y1={yPath(-zCrit)}
					y2={yPath(-zCrit)}
				/>
				<line
					class="ab-thr-b"
					x1={PAD_L}
					x2={plotWPath - PAD_R}
					y1={yPath(sim.zBonferroni)}
					y2={yPath(sim.zBonferroni)}
				/>
				<line
					class="ab-thr-b"
					x1={PAD_L}
					x2={plotWPath - PAD_R}
					y1={yPath(-sim.zBonferroni)}
					y2={yPath(-sim.zBonferroni)}
				/>
				<text class="ab-tick" x={PAD_L - 6} y={yPath(zCrit) + 4} text-anchor="end"
					>{fmt(zCrit, 2)}</text
				>
				<text class="ab-tick" x={PAD_L - 6} y={yPath(sim.zBonferroni) + 4} text-anchor="end"
					>{fmt(sim.zBonferroni, 2)}</text
				>
				{#if looks > 1}
					<polyline
						class="ab-path"
						points={pathZ.map((z, j) => `${xPath(j).toFixed(1)},${yPath(z).toFixed(1)}`).join(' ')}
					/>
				{/if}
				{#each pathZ as z, j (j)}
					<circle class="ab-pt" cx={xPath(j).toFixed(1)} cy={yPath(z).toFixed(1)} r="4" />
					<text class="ab-tick" x={xPath(j).toFixed(1)} y={PH_H - 8} text-anchor="middle"
						>{j + 1}</text
					>
				{/each}
			</svg>
		</div>

		<div class="ab-row">
			<p class="ab-text ab-muted">
				Показан эксперимент {crossing.length
					? `${(pickPos % crossing.length) + 1} из ${crossing.length}`
					: '—'}
				с ложной победой без поправки.
			</p>
			<button
				type="button"
				class="ab-btn"
				disabled={crossing.length < 2}
				onclick={() => (pickPos += 1)}>Следующий</button
			>
		</div>
	</section>

	<div class="ab-foot">
		<p class="ab-live" aria-live="polite">{sentence}</p>
		<button
			type="button"
			class="ab-btn"
			onclick={() => {
				seed += 1;
				pickPos = 0;
			}}>Новая серия</button
		>
		<button type="button" class="ab-btn" onclick={reset}>Сброс</button>
	</div>
</figure>

<style>
	.ab {
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
	.ab :global(*),
	.ab :global(*::before),
	.ab :global(*::after) {
		box-sizing: border-box;
	}
	.ab dl,
	.ab dd,
	.ab dt,
	.ab p,
	.ab h4 {
		margin: 0;
	}
	.ab button {
		font: inherit;
	}
	.ab-part + .ab-part {
		margin-top: var(--space-8);
		padding-top: var(--space-6);
		border-top: 1px solid var(--border);
	}
	.ab-h {
		margin-bottom: var(--space-3);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.ab-text {
		margin-bottom: var(--space-3);
	}
	.ab-muted,
	.ab-label,
	.ab-tick,
	.ab-note {
		color: var(--text-muted);
	}
	.ab-note {
		margin-top: var(--space-2);
		font-size: 12px;
	}
	.ab-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	.ab-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-6);
	}
	.ab-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.ab-ctl-wide {
		flex: 1 1 100%;
	}
	.ab-label {
		white-space: nowrap;
	}
	.ab-range {
		width: 170px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.ab-ctl-wide .ab-range {
		flex: 1 1 auto;
		width: auto;
		min-width: 0;
	}
	.ab-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.ab-presets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-3) 0 var(--space-4);
	}
	.ab-btn {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.ab-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.ab-btn:focus-visible,
	.ab-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.ab-plot {
		margin-top: var(--space-4);
		width: 100%;
		overflow: hidden;
	}
	.ab-svg {
		display: block;
		max-width: 100%;
		height: auto;
		overflow: visible;
	}
	.ab-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.ab-target {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 4 3;
	}
	.ab-mark {
		stroke: var(--cat-3);
		stroke-width: 1.5;
	}
	.ab-curve {
		fill: none;
		stroke: var(--cat-1);
		stroke-width: 2.5;
	}
	.ab-dot {
		fill: var(--cat-1);
		stroke: var(--surface);
		stroke-width: 2;
	}
	.ab-tick {
		font-family: var(--font-mono);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	.ab-thr {
		stroke: var(--color-warn);
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
	}
	.ab-thr-b {
		stroke: var(--cat-2);
		stroke-width: 1.5;
		stroke-dasharray: 1 3;
	}
	.ab-path {
		fill: none;
		stroke: var(--cat-4);
		stroke-width: 2;
	}
	.ab-pt {
		fill: var(--cat-4);
	}

	.ab-stats {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.ab-stats dt {
		color: var(--text-muted);
	}
	.ab-stats dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.ab-bars {
		display: grid;
		gap: var(--space-2);
	}
	.ab-bar-row {
		display: grid;
		grid-template-columns: minmax(0, 11rem) minmax(0, 1fr) 3.5rem;
		align-items: center;
		gap: var(--space-3);
		font-size: 13px;
	}
	.ab-bar-l {
		color: var(--text-muted);
	}
	.ab-bar-track {
		display: block;
		height: 14px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.ab-bar-fill {
		display: block;
		height: 100%;
		transition: width var(--dur) var(--ease);
	}
	.ab-fill-1 {
		background: var(--cat-1);
	}
	.ab-fill-warn {
		background: var(--color-warn);
	}
	.ab-fill-2 {
		background: var(--cat-2);
	}
	.ab-bar-v {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.ab-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.ab-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-8);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.ab-live {
		flex: 1 1 100%;
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.ab *,
		.ab *::before,
		.ab *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.ab {
			padding: var(--space-4);
		}
		.ab-range {
			width: 100%;
			flex: 1 1 100%;
		}
		.ab-ctl {
			flex-wrap: wrap;
		}
		.ab-bar-row {
			grid-template-columns: minmax(0, 1fr) 3rem;
		}
		.ab-bar-track {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
