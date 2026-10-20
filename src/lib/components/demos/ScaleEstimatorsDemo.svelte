<script lang="ts">
	import { iqrn, madRaw, madn, mScale, normalQuantile, sd } from '$lib/demos/robust-core';
	import { mulberry32 } from '$lib/prob/rng';
	import { fmt, linePath, linearMap, logClamp } from './robust/plot';

	/**
	 * Scale estimators on one sample: SD, MAD, MADN, IQRN and the bisquare M-scale. Points can be
	 * dragged or moved with the keyboard; the share slider shows how the estimates react to outliers.
	 */
	let { initial }: { initial?: { share?: number } } = $props();

	const SEED = 2026;
	const N = 21;
	/** Outliers are moved by this many units (50 sigma of the usual part). */
	const SHIFT = 50;
	const RHO_C = 1.54764;
	const RHO_B = 0.5;
	const TRUE_SIGMA = 1;
	const X_LO = -4;
	const X_HI = 12;
	const Y_LO = 0.1;
	const Y_HI = 100;
	const SHARE_MAX = 0.5;
	const SHARE_STEP = 0.02;
	const OUTLIER_FIRST = 8;
	const OUTLIER_GAP = 1.5;
	const KEY_STEP = 0.1;
	const KEY_STEP_BIG = 1;
	const H_DOTS = 110;
	const H_CURVE = 220;
	const PAD_B = 24;
	const PAD_L = 44;
	const PAD_T = 10;
	const PAD_R = 10;

	interface Estimates {
		sd: number;
		mad: number;
		madn: number;
		iqrn: number;
		mscale: number;
	}

	/** Sample from N(0, 1) by inverse CDF; values rounded to 0.01 for display. */
	function sampleAt(seed: number): number[] {
		const rng = mulberry32(seed);
		return Array.from({ length: N }, () => {
			const p = Math.min(Math.max(rng(), 1e-6), 1 - 1e-6);
			return Math.round(normalQuantile(p) * 100) / 100;
		});
	}

	function estimate(data: number[]): Estimates {
		return {
			sd: sd(data),
			mad: madRaw(data),
			madn: madn(data),
			iqrn: iqrn(data),
			mscale: mScale(data, { kind: 'bisquare', c: RHO_C, b: RHO_B }),
		};
	}

	/** Replaces the first round(share * n) values by values shifted by SHIFT. */
	function applyShare(data: number[], share: number): number[] {
		const k = Math.round(share * data.length);
		return data.map((v, i) => (i < k ? v + SHIFT : v));
	}

	const clampX = (v: number): number => Math.min(X_HI, Math.max(X_LO, v));
	const round2 = (v: number): number => Math.round(v * 100) / 100;

	let seedStep = $state(0);
	let points = $state<number[]>(sampleAt(SEED));
	let addedCount = $state(0);
	/* svelte-ignore state_referenced_locally */
	let share = $state(initial?.share ?? 0);
	let plotW = $state(0);
	let svgEl = $state<SVGSVGElement | null>(null);
	let dragIdx = $state<number | null>(null);

	const W = $derived(plotW >= 160 ? plotW : 320);
	const current = $derived(estimate(points));
	const k = $derived(Math.round(share * points.length));
	const shifted = $derived(estimate(applyShare(points, share)));
	const mean = $derived(points.reduce((s, v) => s + v, 0) / points.length);

	/** Estimates on the share grid; computed from the unshifted points only. */
	const curve = $derived(
		Array.from({ length: Math.round(SHARE_MAX / SHARE_STEP) + 1 }, (_, i) => {
			const s = i * SHARE_STEP;
			return { s, ...estimate(applyShare(points, s)) };
		}),
	);

	const xDot = $derived(linearMap(X_LO, X_HI, 12, W - 12));
	const xToValue = (px: number): number => X_LO + ((px - 12) / (W - 24)) * (X_HI - X_LO);
	const innerW = $derived(W - PAD_L - PAD_R);
	const innerH = H_CURVE - PAD_T - PAD_B;
	const xShare = (s: number): number => PAD_L + (s / SHARE_MAX) * innerW;
	const yLog = (v: number): number =>
		PAD_T +
		innerH * (1 - (logClamp(v, Y_LO) - Math.log10(Y_LO)) / (Math.log10(Y_HI) - Math.log10(Y_LO)));
	const Y_TICKS = [0.1, 1, 10, 100];
	const X_TICKS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

	const pathOf = (key: 'sd' | 'madn' | 'mscale'): string =>
		linePath(curve.map((c) => [xShare(c.s), yLog(c[key])] as const));

	const liveText = $derived(
		`Выборка: SD ${fmt(current.sd)}, MADN ${fmt(current.madn)}. При доле выбросов ${Math.round(share * 100)}%: SD ${fmt(shifted.sd)}, MADN ${fmt(shifted.madn)}.`,
	);

	function newSample(): void {
		seedStep += 1;
		points = sampleAt(SEED + seedStep);
		addedCount = 0;
	}
	function addOutlier(): void {
		const v = clampX(OUTLIER_FIRST + OUTLIER_GAP * addedCount);
		addedCount += 1;
		points.push(round2(v));
	}
	function removeOutliers(): void {
		points = points.slice(0, N);
		addedCount = 0;
	}

	function onDotKey(e: KeyboardEvent, i: number): void {
		const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
		let d: number;
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = step;
		else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -step;
		else return;
		e.preventDefault();
		points[i] = round2(clampX((points[i] ?? 0) + d));
	}
	function onDotDown(e: PointerEvent, i: number): void {
		dragIdx = i;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}
	function onDotMove(e: PointerEvent): void {
		if (dragIdx === null || !svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		points[dragIdx] = round2(clampX(xToValue(e.clientX - rect.left)));
	}
	function onDotUp(): void {
		dragIdx = null;
	}

	const pct = (v: number): string => `${Math.round(v * 100)}%`;
</script>

<figure class="sc" id="demo-scale-estimators" data-demo="scale-estimators">
	<p class="sc-label">
		Выборка из N(0, 1), {points.length} точек. Перетаскивайте точки мышью или фокусируйтесь на них и двигайте
		стрелками (с Shift — шаг 1).
	</p>

	<div class="sc-row" bind:clientWidth={plotW}>
		<svg
			class="sc-svg"
			bind:this={svgEl}
			width="100%"
			height={H_DOTS}
			viewBox="0 0 {W} {H_DOTS}"
			role="group"
			aria-label="Точки выборки на числовой оси"
			onpointermove={onDotMove}
			onpointerup={onDotUp}
			onpointercancel={onDotUp}
		>
			<line class="sc-axis" x1="0" x2={W} y1={H_DOTS - PAD_B} y2={H_DOTS - PAD_B} />
			{#each [-4, -2, 0, 2, 4, 6, 8, 10, 12] as t (t)}
				<text class="sc-tick" x={xDot(t).toFixed(1)} y={H_DOTS - 6} text-anchor="middle">{t}</text>
			{/each}
			<line
				class="sc-ref-mean"
				x1={xDot(mean).toFixed(1)}
				x2={xDot(mean).toFixed(1)}
				y1="0"
				y2={H_DOTS - PAD_B}
			/>
			<!-- The true centre of N(0, 1) is 0. -->
			<line
				class="sc-ref-true"
				x1={xDot(0).toFixed(1)}
				x2={xDot(0).toFixed(1)}
				y1="0"
				y2={H_DOTS - PAD_B}
			/>
			{#each points as v, i (i)}
				<circle
					class="sc-dot"
					class:sc-dot-out={i >= N}
					class:sc-dot-drag={dragIdx === i}
					cx={xDot(v).toFixed(1)}
					cy={(24 + (i % 3) * 22).toFixed(1)}
					r="6"
					tabindex="0"
					role="slider"
					aria-label={`Точка ${i + 1}${i >= N ? ' (выброс)' : ''}`}
					aria-valuemin={X_LO}
					aria-valuemax={X_HI}
					aria-valuenow={points[i]}
					aria-valuetext={fmt(points[i] ?? 0)}
					onkeydown={(e) => onDotKey(e, i)}
					onpointerdown={(e) => onDotDown(e, i)}
				/>
			{/each}
		</svg>
	</div>

	<div class="sc-buttons">
		<button type="button" class="sc-btn" onclick={newSample}>Новая выборка</button>
		<button type="button" class="sc-btn" onclick={addOutlier}>Добавить выброс</button>
		<button
			type="button"
			class="sc-btn sc-btn-quiet"
			onclick={removeOutliers}
			disabled={points.length <= N}>Убрать выбросы</button
		>
	</div>

	<table class="sc-table">
		<thead>
			<tr>
				<th scope="col">Оценка</th>
				<th scope="col">Выборка</th>
				<th scope="col">При доле выбросов {pct(share)}</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<th scope="row">Истинное σ</th>
				<td>{fmt(TRUE_SIGMA)}</td>
				<td>{fmt(TRUE_SIGMA)}</td>
			</tr>
			<tr>
				<th scope="row">Стандартное отклонение (SD)</th>
				<td>{fmt(current.sd)}</td>
				<td class="sc-hot">{fmt(shifted.sd)}</td>
			</tr>
			<tr>
				<th scope="row">MAD (сырой)</th>
				<td>{fmt(current.mad)}</td>
				<td>{fmt(shifted.mad)}</td>
			</tr>
			<tr>
				<th scope="row">MADN = MAD / Φ⁻¹(0,75)</th>
				<td>{fmt(current.madn)}</td>
				<td>{fmt(shifted.madn)}</td>
			</tr>
			<tr>
				<th scope="row">IQRN = IQR / (2 Φ⁻¹(0,75))</th>
				<td>{fmt(current.iqrn)}</td>
				<td>{fmt(shifted.iqrn)}</td>
			</tr>
			<tr>
				<th scope="row">M-оценка масштаба (bisquare, c = 1,54764, b = 0,5)</th>
				<td>{fmt(current.mscale)}</td>
				<td>{fmt(shifted.mscale)}</td>
			</tr>
		</tbody>
	</table>
	<p class="sc-live" aria-live="polite">{liveText}</p>

	<div class="sc-share">
		<label class="sc-range">
			<span>Доля выбросов (сдвиг на +{SHIFT}, {k} из {points.length} точек)</span>
			<input
				type="range"
				min="0"
				max={SHARE_MAX}
				step={SHARE_STEP}
				bind:value={share}
				aria-valuetext={`${pct(share)}, ${k} точек`}
			/>
		</label>
	</div>

	<div class="sc-row">
		<svg
			class="sc-svg"
			width="100%"
			height={H_CURVE}
			viewBox="0 0 {W} {H_CURVE}"
			role="img"
			aria-labelledby="sc-curve-title sc-curve-desc"
		>
			<title id="sc-curve-title">Оценка масштаба против доли выбросов</title>
			<desc id="sc-curve-desc">
				SD растёт сразу после первого выброса, MADN и M-оценка масштаба держатся рядом с σ = 1 до
				доли около 50%.
			</desc>
			{#each Y_TICKS as t (t)}
				<line
					class="sc-grid"
					x1={PAD_L}
					x2={W - PAD_R}
					y1={yLog(t).toFixed(1)}
					y2={yLog(t).toFixed(1)}
				/>
				<text class="sc-tick" x={PAD_L - 6} y={(yLog(t) + 4).toFixed(1)} text-anchor="end"
					>{t < 1 ? fmt(t, 1) : t}</text
				>
			{/each}
			{#each X_TICKS as t (t)}
				<text class="sc-tick" x={xShare(t).toFixed(1)} y={H_CURVE - 6} text-anchor="middle"
					>{Math.round(t * 100)}%</text
				>
			{/each}
			<line class="sc-axis" x1={PAD_L} x2={W - PAD_R} y1={H_CURVE - PAD_B} y2={H_CURVE - PAD_B} />
			<line
				class="sc-ref-true"
				x1={PAD_L}
				x2={W - PAD_R}
				y1={yLog(TRUE_SIGMA).toFixed(1)}
				y2={yLog(TRUE_SIGMA).toFixed(1)}
			/>
			<path class="sc-line sc-line-sd" d={pathOf('sd')} />
			<path class="sc-line sc-line-madn" d={pathOf('madn')} />
			<path class="sc-line sc-line-mscale" d={pathOf('mscale')} />
			<line
				class="sc-cursor"
				x1={xShare(share).toFixed(1)}
				x2={xShare(share).toFixed(1)}
				y1={PAD_T}
				y2={H_CURVE - PAD_B}
			/>
			<circle
				class="sc-pt sc-pt-sd"
				cx={xShare(share).toFixed(1)}
				cy={yLog(shifted.sd).toFixed(1)}
				r="4"
			/>
			<circle
				class="sc-pt sc-pt-madn"
				cx={xShare(share).toFixed(1)}
				cy={yLog(shifted.madn).toFixed(1)}
				r="4"
			/>
		</svg>
	</div>
	<ul class="sc-legend">
		<li><span class="sc-sw sc-sw-sd"></span>SD</li>
		<li><span class="sc-sw sc-sw-madn"></span>MADN</li>
		<li><span class="sc-sw sc-sw-mscale"></span>M-оценка масштаба</li>
		<li><span class="sc-sw sc-sw-true"></span>σ = 1</li>
	</ul>
	<p class="sc-note">
		Ось логарифмическая (от 0,1 до 100). <strong>Что видно:</strong> SD уезжает при одном выбросе, MADN
		почти не двигается. Точка пробоя MADN близка к 50%, а у SD она равна нулю.
	</p>
</figure>

<style>
	.sc {
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
	.sc :global(*),
	.sc :global(*::before),
	.sc :global(*::after) {
		box-sizing: border-box;
	}
	.sc p,
	.sc ul,
	.sc table {
		margin: 0;
	}
	.sc button,
	.sc input {
		font: inherit;
	}
	.sc-label,
	.sc-live,
	.sc-note {
		color: var(--text-muted);
	}
	.sc-row {
		margin-top: var(--space-4);
	}
	.sc-svg {
		display: block;
		overflow: visible;
		touch-action: none;
		user-select: none;
	}
	.sc-axis {
		stroke: var(--border);
		stroke-width: 1;
	}
	.sc-grid {
		stroke: var(--border);
		stroke-width: 1;
		stroke-dasharray: 2 3;
	}
	.sc-tick {
		font-size: 11px;
		fill: var(--text-muted);
	}
	.sc-ref-mean {
		stroke: var(--warn);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
	}
	.sc-ref-true,
	.sc-cursor {
		stroke: var(--text);
		stroke-width: 1.25;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.sc-cursor {
		stroke: var(--accent);
		opacity: 0.9;
	}
	.sc-dot {
		fill: var(--topic-soft);
		stroke: var(--topic);
		stroke-width: 1.5;
		cursor: grab;
	}
	.sc-dot-out {
		stroke: var(--warn);
		fill: var(--warn-bg);
	}
	.sc-dot-drag {
		cursor: grabbing;
	}
	.sc-dot:focus-visible {
		outline: none;
		stroke: var(--accent);
		stroke-width: 3;
	}
	.sc-line {
		fill: none;
		stroke-width: 2;
	}
	.sc-line-sd {
		stroke: var(--warn);
	}
	.sc-line-madn {
		stroke: var(--topic);
	}
	.sc-line-mscale {
		stroke: var(--cat-3);
	}
	.sc-pt-sd {
		fill: var(--warn);
	}
	.sc-pt-madn {
		fill: var(--topic);
	}
	.sc-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.sc-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--topic);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--topic);
		cursor: pointer;
	}
	.sc-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.sc-btn-quiet {
		border-color: var(--border);
		color: var(--text-muted);
	}
	.sc-btn:focus-visible,
	.sc-range input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.sc-table {
		width: 100%;
		margin-top: var(--space-4);
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.sc-table th,
	.sc-table td {
		padding: var(--space-2) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}
	.sc-table td {
		text-align: right;
		font-weight: 600;
		white-space: nowrap;
	}
	.sc-table th[scope='row'] {
		font-weight: 400;
		color: var(--text-muted);
	}
	.sc-table thead th {
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 600;
	}
	.sc-table .sc-hot {
		color: var(--warn);
	}
	.sc-live {
		margin-top: var(--space-2);
	}
	.sc-share {
		margin-top: var(--space-4);
	}
	.sc-range {
		display: grid;
		gap: var(--space-2);
	}
	.sc-range input {
		width: 100%;
		accent-color: var(--topic);
	}
	.sc-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		list-style: none;
		padding: 0;
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.sc-sw {
		display: inline-block;
		width: 14px;
		height: 3px;
		margin-right: var(--space-2);
		vertical-align: middle;
	}
	.sc-sw-sd {
		background: var(--warn);
	}
	.sc-sw-madn {
		background: var(--topic);
	}
	.sc-sw-mscale {
		background: var(--cat-3);
	}
	.sc-sw-true {
		background: var(--text);
		opacity: 0.7;
	}
	.sc-note {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	@media (max-width: 559px) {
		.sc {
			padding: var(--space-4);
		}
		.sc-table {
			font-size: 12px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sc-dot {
			transition: none;
		}
	}
</style>
