<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		COMPONENTS_MAX,
		COMPONENTS_MIN,
		DEFAULT_COMPONENTS,
		DEFAULT_K,
		K_MAX,
		K_MIN,
		START_SEED,
		type ClusteringPcaDemoState,
		type Point,
		assign,
		describeKmeans,
		describePca,
		inertia,
		initState,
		kmeansStep,
		makeCloud,
		pca2,
		reconstruct,
		runKmeans,
		snapComponents,
		snapK,
	} from '$lib/demos/clustering-pca';

	/** k-means and PCA on one fixed 2-D cloud. Registers itself as demo `clustering-pca`. */
	let { initial }: { initial?: Partial<ClusteringPcaDemoState> } = $props();

	/* Fixed data: computed once, identical on every page load. */
	const points: Point[] = makeCloud();
	const pca = pca2(points);
	/* Props only seed the initial state: the demo owns it afterwards. */
	/* svelte-ignore state_referenced_locally */
	const K0 = snapK(initial?.k ?? DEFAULT_K);
	/* svelte-ignore state_referenced_locally */
	const C0 = snapComponents(initial?.components ?? DEFAULT_COMPONENTS);

	let k = $state(K0);
	let components = $state(C0);
	let seed = $state(START_SEED);
	let km = $state(initState(points, K0, START_SEED));
	/** Real widths of the two panels in px; 0 until the first measurement. */
	let wKm = $state(0);
	let wPca = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	/** Labels to colour the points with: the last assignment, or the nearest centre before the first step. */
	const labels = $derived(km.labels ?? assign(points, km.centers));
	const J = $derived(inertia(points, km.centers, labels));
	const kmDesc = $derived(describeKmeans(km, J));
	const pcaDesc = $derived(describePca(pca, components));

	/** Square plots, equal scale on both axes so that the principal axes stay perpendicular. */
	const side = (w: number) => (w >= 120 ? Math.min(w, 320) : 280);
	const sideKm = $derived(side(wKm));
	const sidePca = $derived(side(wPca));

	/* Data box: centre and half-size of the square that holds the cloud. */
	const box = (() => {
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for (const [x, y] of points) {
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		}
		return {
			cx: (minX + maxX) / 2,
			cy: (minY + maxY) / 2,
			half: (Math.max(maxX - minX, maxY - minY) / 2) * 1.12,
		};
	})();

	/** Data point -> pixel inside a square of size `s`. */
	function toPx(p: Point, s: number): [number, number] {
		const f = s / 2 / box.half;
		return [s / 2 + (p[0] - box.cx) * f, s / 2 - (p[1] - box.cy) * f];
	}

	const kmPts = $derived(points.map((p) => toPx(p, sideKm)));
	const kmCentres = $derived(km.centers.map((c) => toPx(c, sideKm)));

	const recon = $derived(reconstruct(points, pca, components));
	const reconPx = $derived(recon.map((p) => toPx(p, sidePca)));
	const origPx = $derived(points.map((p) => toPx(p, sidePca)));
	const meanPx = $derived(toPx([pca.mean[0], pca.mean[1]], sidePca));
	/** Half-length of the drawn principal axes, in data units. */
	const axisLen = $derived(2.4 * Math.sqrt(pca.variances[0]));
	const axisLen2 = $derived(2.4 * Math.sqrt(pca.variances[1]));
	const ax1 = $derived([
		toPx([pca.mean[0] - pca.axes[0][0] * axisLen, pca.mean[1] - pca.axes[0][1] * axisLen], sidePca),
		toPx([pca.mean[0] + pca.axes[0][0] * axisLen, pca.mean[1] + pca.axes[0][1] * axisLen], sidePca),
	]);
	const ax2 = $derived([
		toPx(
			[pca.mean[0] - pca.axes[1][0] * axisLen2, pca.mean[1] - pca.axes[1][1] * axisLen2],
			sidePca,
		),
		toPx(
			[pca.mean[0] + pca.axes[1][0] * axisLen2, pca.mean[1] + pca.axes[1][1] * axisLen2],
			sidePca,
		),
	]);

	function clusterColour(i: number): string {
		const idx = (labels[i] ?? 0) % 5;
		return `var(--cat-${idx + 1})`;
	}

	function apply(patch: Partial<ClusteringPcaDemoState>): void {
		if (typeof patch.k === 'number') {
			k = snapK(patch.k);
			km = initState(points, k, seed);
		}
		if (typeof patch.components === 'number') components = snapComponents(patch.components);
	}

	onMount(() =>
		demos?.register('clustering-pca', {
			set: (patch) => apply(patch as Partial<ClusteringPcaDemoState>),
		}),
	);

	function onKInput(e: Event): void {
		k = snapK(Number((e.currentTarget as HTMLInputElement).value));
		km = initState(points, k, seed);
	}

	function onComponentsInput(e: Event): void {
		components = snapComponents(Number((e.currentTarget as HTMLInputElement).value));
	}

	function step(): void {
		km = kmeansStep(points, km);
	}

	function runToEnd(): void {
		km = runKmeans(points, km);
	}

	function newStart(): void {
		seed += 1;
		km = initState(points, k, seed);
	}

	function resetAll(): void {
		k = K0;
		components = C0;
		seed = START_SEED;
		km = initState(points, K0, START_SEED);
	}
</script>

<figure class="cp" id="demo-clustering-pca" data-demo="clustering-pca" class:hl-q={hl === 'q'}>
	<div class="cp-controls">
		<label class="cp-ctl">
			<span class="cp-label">Число кластеров <i>k</i></span>
			<input
				class="cp-range"
				type="range"
				min={K_MIN}
				max={K_MAX}
				step="1"
				value={k}
				aria-label="Число кластеров k"
				aria-valuetext={`k = ${k}`}
				oninput={onKInput}
			/>
			<output class="cp-val">k = {k}</output>
		</label>

		<label class="cp-ctl">
			<span class="cp-label">Компонент для PCA</span>
			<input
				class="cp-range"
				type="range"
				min={COMPONENTS_MIN}
				max={COMPONENTS_MAX}
				step="1"
				value={components}
				aria-label="Число главных компонент"
				aria-valuetext={`компонент: ${components}`}
				oninput={onComponentsInput}
			/>
			<output class="cp-val">{components}</output>
		</label>
	</div>

	<div class="cp-plots">
		<div class="cp-panel" bind:clientWidth={wKm}>
			<p class="cp-title">k-means: центры и назначения</p>
			<svg
				class="cp-svg"
				width={sideKm}
				height={sideKm}
				role="img"
				aria-labelledby="cp-km-title cp-km-desc"
			>
				<title id="cp-km-title">Точки, раскрашенные по кластерам k-means</title>
				<desc id="cp-km-desc">{kmDesc}</desc>
				{#each kmPts as [x, y], i (i)}
					<circle
						class="cp-dot"
						class:is-raw={km.labels === null}
						style:--c={clusterColour(i)}
						cx={x.toFixed(1)}
						cy={y.toFixed(1)}
						r="3.5"
					/>
				{/each}
				{#each kmCentres as [x, y], j (j)}
					<g class="cp-centre" style:--c={`var(--cat-${(j % 5) + 1})`}>
						<line x1={x - 7} y1={y - 7} x2={x + 7} y2={y + 7} />
						<line x1={x - 7} y1={y + 7} x2={x + 7} y2={y - 7} />
					</g>
				{/each}
			</svg>
		</div>

		<div class="cp-panel" bind:clientWidth={wPca}>
			<p class="cp-title">PCA: проекция на главные оси</p>
			<svg
				class="cp-svg"
				width={sidePca}
				height={sidePca}
				role="img"
				aria-labelledby="cp-pca-title cp-pca-desc"
			>
				<title id="cp-pca-title">Облако точек с главными осями и проекцией</title>
				<desc id="cp-pca-desc">{pcaDesc}</desc>
				<line
					class="cp-axis cp-axis-1"
					x1={ax1[0]?.[0]}
					y1={ax1[0]?.[1]}
					x2={ax1[1]?.[0]}
					y2={ax1[1]?.[1]}
				/>
				<line
					class="cp-axis cp-axis-2"
					x1={ax2[0]?.[0]}
					y1={ax2[0]?.[1]}
					x2={ax2[1]?.[0]}
					y2={ax2[1]?.[1]}
				/>
				{#if components === 1}
					{#each origPx as [x, y], i (i)}
						{@const r = reconPx[i] ?? [x, y]}
						<line
							class="cp-proj"
							x1={x.toFixed(1)}
							y1={y.toFixed(1)}
							x2={r[0].toFixed(1)}
							y2={r[1].toFixed(1)}
						/>
					{/each}
					{#each reconPx as [x, y], i (i)}
						<circle class="cp-dot cp-dot-proj" cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" />
					{/each}
				{/if}
				{#each origPx as [x, y], i (i)}
					<circle class="cp-dot cp-dot-orig" cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" />
				{/each}
				<circle class="cp-mean" cx={meanPx[0]} cy={meanPx[1]} r="3.5" />
			</svg>
		</div>
	</div>

	<div class="cp-actions" role="group" aria-label="Управление k-means">
		<button type="button" class="cp-btn" onclick={step} disabled={km.converged}>Шаг</button>
		<button type="button" class="cp-btn" onclick={runToEnd} disabled={km.converged}
			>До сходимости</button
		>
		<button type="button" class="cp-btn" onclick={newStart}>Другой старт</button>
		<button type="button" class="cp-btn cp-btn-ghost" onclick={resetAll}>Сброс</button>
	</div>

	<p class="cp-note" aria-live="polite">{kmDesc} {pcaDesc}</p>

	<div class="cp-look">
		<p class="cp-look-t">Что заметить</p>
		<ul>
			<li>
				Центры стартуют в случайных точках и за несколько шагов переезжают в середины своих групп.
				Значение J не растёт. Другой старт может дать другое разбиение.
			</li>
			<li>
				Облако вытянуто вдоль одной оси: PC1 несёт большую часть дисперсии. Одна компонента
				сохраняет структуру, а потеря идёт на перпендикулярной оси.
			</li>
		</ul>
	</div>
</figure>

<style>
	.cp {
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
	.cp :global(*),
	.cp :global(*::before),
	.cp :global(*::after) {
		box-sizing: border-box;
	}
	.cp p,
	.cp ul {
		margin: 0;
	}
	.cp button {
		font: inherit;
	}
	.cp i {
		font-family: var(--font-serif);
		font-style: italic;
	}

	/* Controls */
	.cp-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cp-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.cp-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cp-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cp-range:focus-visible,
	.cp-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.cp-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Plots */
	.cp-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.cp-title {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.cp-svg {
		display: block;
		max-width: 100%;
		height: auto;
		overflow: hidden;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.cp-dot {
		fill: var(--c, var(--topic));
		transition: fill var(--dur) var(--ease);
	}
	.cp-dot.is-raw {
		fill: var(--text-muted);
	}
	.cp-centre line {
		stroke: var(--c);
		stroke-width: 3;
		stroke-linecap: round;
	}
	.cp-axis {
		stroke-width: 1.5;
	}
	.cp-axis-1 {
		stroke: var(--topic);
	}
	.cp-axis-2 {
		stroke: var(--cat-6);
		stroke-dasharray: 4 3;
	}
	.cp-proj {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.4;
	}
	.cp-dot-orig {
		fill: var(--text-muted);
		opacity: 0.55;
	}
	.cp-dot-proj {
		fill: var(--topic);
	}
	.cp-mean {
		fill: var(--text);
	}

	/* Actions */
	.cp-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-6);
	}
	.cp-btn {
		height: 34px;
		padding: 0 var(--space-4);
		border: 1px solid var(--topic);
		border-radius: var(--radius-sm);
		background: var(--topic);
		color: var(--surface);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: opacity var(--dur) var(--ease);
	}
	.cp-btn-ghost {
		background: none;
		color: var(--topic);
	}
	.cp-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.cp-note {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		font-size: 14px;
	}

	.cp-look {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
	}
	.cp-look-t {
		margin-bottom: var(--space-2);
		font-weight: 600;
	}
	.cp-look ul {
		padding-left: var(--space-4);
		color: var(--text);
	}
	.cp-look li + li {
		margin-top: var(--space-2);
	}

	@media (prefers-reduced-motion: reduce) {
		.cp *,
		.cp *::before,
		.cp *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.cp {
			padding: var(--space-4);
		}
		.cp-plots {
			grid-template-columns: minmax(0, 1fr);
		}
		.cp-range {
			width: 120px;
		}
	}

	@media (max-width: 559px) {
		.cp-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.cp-ctl {
			flex-wrap: wrap;
		}
		.cp-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
