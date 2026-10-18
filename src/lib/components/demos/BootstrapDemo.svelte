<script lang="ts">
	import {
		BOOT_B,
		SAMPLE_A,
		SAMPLE_B,
		SEED,
		bootstrapRun,
		bootstrapSe,
		exactPermutationDiffs,
		histogram,
		mean,
		mulberry32,
		observedDiff,
		percentileInterval,
		pooled,
		randomLabelsA,
		resampleMean,
		sampleSd,
		twoSidedP,
	} from '$lib/demos/bootstrap-permutation';

	/** Bootstrap of the mean and permutation test of a difference of means. Logic lives in $lib/demos. */
	let { initial }: { initial?: { mode?: 'boot' | 'perm' } } = $props();

	type Mode = 'boot' | 'perm';

	/* svelte-ignore state_referenced_locally */
	let mode = $state<Mode>(initial?.mode === 'perm' ? 'perm' : 'boot');
	let wBoot = $state(0);
	let wPerm = $state(0);

	const N = SAMPLE_A.length;
	const observed = observedDiff(SAMPLE_A, SAMPLE_B);
	const POOL = pooled(SAMPLE_A, SAMPLE_B);
	const sampleMean = mean(SAMPLE_A);
	const sampleS = sampleSd(SAMPLE_A);

	// Bootstrap: all BOOT_B resamples are computed once (fast); the demo reveals them step by step.
	const BOOT = bootstrapRun(SAMPLE_A, BOOT_B, SEED);
	const BOOT_LO = 10;
	const BOOT_HI = 20;
	const BOOT_BIN = 0.1;

	let drawn = $state(0);
	const shownMeans = $derived(BOOT.means.subarray(0, drawn));
	/** Indices of the last drawn resample (for the chips). */
	const lastIdx = $derived(
		drawn > 0 ? Array.from(BOOT.idx.subarray((drawn - 1) * N, drawn * N)) : [],
	);
	const lastValues = $derived(lastIdx.map((i) => SAMPLE_A[i]));
	const lastMean = $derived(drawn > 0 ? resampleMean(SAMPLE_A, lastIdx) : null);
	const bootSe = $derived(drawn >= 2 ? bootstrapSe(shownMeans) : null);
	const bootCi = $derived(drawn >= 20 ? percentileInterval(shownMeans, 0.05) : null);
	const bootCounts = $derived(histogram(shownMeans, BOOT_LO, BOOT_HI, BOOT_BIN));
	const bootMax = $derived(Math.max(1, ...bootCounts));

	function drawBoot(k: number): void {
		drawn = Math.min(BOOT_B, drawn + k);
	}
	function resetBoot(): void {
		drawn = 0;
	}

	// Permutation test: random relabellings on demand, or the exact distribution over all of them.
	let permRng: (() => number) | null = null;
	let permDiffs = $state<number[]>([]);
	let permLast = $state<{ labelsA: number[]; d: number } | null>(null);
	let exact = $state<Float64Array | null>(null);

	const PERM_LO = -8;
	const PERM_HI = 8;
	const PERM_BIN = 0.5;
	const permSource = $derived(exact ?? Float64Array.from(permDiffs));
	const permCounts = $derived(histogram(permSource, PERM_LO, PERM_HI, PERM_BIN));
	const permMax = $derived(Math.max(1, ...permCounts));
	const permTest = $derived(exact ? twoSidedP(exact, observed) : null);
	const permExtremeShown = $derived(
		permSource.length === 0 ? 0 : twoSidedP(permSource, observed).count,
	);

	function shuffleOnce(): void {
		if (!permRng) permRng = mulberry32(SEED);
		const labelsA = randomLabelsA(permRng, POOL.length, N);
		const isA = new Set(labelsA);
		const a = POOL.filter((_, i) => isA.has(i));
		const b = POOL.filter((_, i) => !isA.has(i));
		const d = observedDiff(a, b);
		permDiffs = [...permDiffs, d];
		permLast = { labelsA, d };
	}
	function computeExact(): void {
		exact = exactPermutationDiffs(POOL, N);
	}
	function resetPerm(): void {
		permRng = null;
		permDiffs = [];
		permLast = null;
		exact = null;
	}

	/** A bin is "extreme" when all its values are at least |observed| in absolute value. */
	function isExtremeBin(lowEdge: number): boolean {
		return lowEdge >= observed - 1e-9 || lowEdge + PERM_BIN <= -observed + 1e-9;
	}

	// SVG geometry, drawn at the real width (no viewBox scaling of text).
	const H = 150;
	const PAD_B = 22;
	const plotBootW = $derived(wBoot >= 160 ? wBoot : 320);
	const plotPermW = $derived(wPerm >= 160 ? wPerm : 320);
	const bootBarW = $derived(plotBootW / bootCounts.length);
	const permBarW = $derived(plotPermW / permCounts.length);
	const xBoot = (v: number): number => ((v - BOOT_LO) / (BOOT_HI - BOOT_LO)) * plotBootW;
	const xPerm = (v: number): number => ((v - PERM_LO) / (PERM_HI - PERM_LO)) * plotPermW;
	const xSample = (v: number): number => ((v - 8) / 20) * plotBootW;

	const bootDesc = $derived(
		drawn === 0
			? 'Пересэмплирований пока нет.'
			: `Показано ${drawn} пересэмплирований из ${BOOT_B}; среднее бутстрэп-средних ${mean(Array.from(shownMeans)).toFixed(2)}.`,
	);
	const permDesc = $derived(
		exact
			? `Все ${exact.length} перестановок: при |d| не меньше ${observed.toFixed(3)} их ${permTest?.count}; p = ${permTest?.p.toFixed(4)}.`
			: `Показано ${permDiffs.length} случайных перестановок; при |d| не меньше ${observed.toFixed(3)} их ${permExtremeShown}.`,
	);
	const fmt = (v: number, d = 2): string => v.toFixed(d).replace('.', ',');
</script>

<figure class="bp" id="demo-bootstrap-permutation" data-demo="bootstrap-permutation">
	<div class="bp-controls">
		<div class="bp-group" role="group" aria-label="Режим демо">
			<button
				type="button"
				class="bp-seg"
				aria-pressed={mode === 'boot'}
				onclick={() => (mode = 'boot')}>Бутстрэп</button
			>
			<button
				type="button"
				class="bp-seg"
				aria-pressed={mode === 'perm'}
				onclick={() => (mode = 'perm')}>Перестановки</button
			>
		</div>
	</div>

	{#if mode === 'boot'}
		<div class="bp-row" bind:clientWidth={wBoot}>
			<p class="bp-label">Выборка A (8 значений), среднее {fmt(sampleMean)}, s ≈ {fmt(sampleS)}</p>
			<svg
				class="bp-svg"
				width="100%"
				height="40"
				viewBox="0 0 {plotBootW} 40"
				role="img"
				aria-label="Значения выборки A на числовой оси"
			>
				<line class="bp-axis" x1="0" x2={plotBootW} y1="28" y2="28" />
				{#each SAMPLE_A as v, i (i)}
					<circle class="bp-dot" cx={xSample(v).toFixed(1)} cy="28" r="5" />
				{/each}
			</svg>
		</div>

		<div class="bp-row">
			<p class="bp-label">
				{#if lastValues.length}
					Последняя пересэмплированная выборка, среднее {fmt(lastMean ?? 0)}:
				{:else}
					<span class="bp-muted"
						>Нажмите «Пересэмплировать»: из A тянется выборка того же размера с возвращением.</span
					>
				{/if}
			</p>
			<ul class="bp-chips" aria-label="Значения последней пересэмплированной выборки">
				{#each lastValues as v, i (i)}
					<li class="bp-chip">{v}</li>
				{/each}
			</ul>
		</div>

		<div class="bp-plot">
			<svg
				class="bp-svg"
				width="100%"
				height={H}
				viewBox="0 0 {plotBootW} {H}"
				role="img"
				aria-labelledby="bp-boot-title bp-boot-desc"
			>
				<title id="bp-boot-title">Бутстрэп-распределение среднего</title>
				<desc id="bp-boot-desc">{bootDesc}</desc>
				{#each bootCounts as c, k (k)}
					{@const h = (c / bootMax) * (H - PAD_B - 8)}
					<rect
						class="bp-bar"
						x={(k * bootBarW).toFixed(1)}
						y={(H - PAD_B - h).toFixed(1)}
						width={Math.max(0.5, bootBarW - 0.5).toFixed(1)}
						height={h.toFixed(1)}
					/>
				{/each}
				<line
					class="bp-ref"
					x1={xBoot(sampleMean).toFixed(1)}
					x2={xBoot(sampleMean).toFixed(1)}
					y1="0"
					y2={H - PAD_B}
				/>
				{#if bootCi}
					<line
						class="bp-ci"
						x1={xBoot(bootCi[0]).toFixed(1)}
						x2={xBoot(bootCi[0]).toFixed(1)}
						y1="0"
						y2={H - PAD_B}
					/>
					<line
						class="bp-ci"
						x1={xBoot(bootCi[1]).toFixed(1)}
						x2={xBoot(bootCi[1]).toFixed(1)}
						y1="0"
						y2={H - PAD_B}
					/>
				{/if}
				<line class="bp-axis" x1="0" x2={plotBootW} y1={H - PAD_B} y2={H - PAD_B} />
				<text class="bp-tick" x="0" y={H - 6}>{BOOT_LO}</text>
				<text class="bp-tick" x={plotBootW} y={H - 6} text-anchor="end">{BOOT_HI}</text>
			</svg>
		</div>

		<dl class="bp-stats">
			<div>
				<dt>Пересэмплирований</dt>
				<dd>{drawn} из {BOOT_B}</dd>
			</div>
			<div>
				<dt>SE (бутстрэп)</dt>
				<dd>{bootSe === null ? '—' : fmt(bootSe)}</dd>
			</div>
			<div>
				<dt>95%-интервал (процентильный)</dt>
				<dd>{bootCi === null ? '—' : `[${fmt(bootCi[0])}; ${fmt(bootCi[1])}]`}</dd>
			</div>
		</dl>

		<div class="bp-buttons">
			<button type="button" class="bp-btn" onclick={() => drawBoot(1)} disabled={drawn >= BOOT_B}
				>Пересэмплировать</button
			>
			<button type="button" class="bp-btn" onclick={() => drawBoot(100)} disabled={drawn >= BOOT_B}
				>+100</button
			>
			<button
				type="button"
				class="bp-btn"
				onclick={() => drawBoot(BOOT_B)}
				disabled={drawn >= BOOT_B}>Все {BOOT_B}</button
			>
			<button type="button" class="bp-btn bp-btn-quiet" onclick={resetBoot} disabled={drawn === 0}
				>Сбросить</button
			>
		</div>
		<p class="bp-live" aria-live="polite">{bootDesc}</p>
	{:else}
		<p class="bp-label">
			Пул из {POOL.length} значений; наблюдаемая разность средних B − A = {fmt(observed, 3)}.
		</p>

		<div class="bp-plot" bind:clientWidth={wPerm}>
			<svg
				class="bp-svg"
				width="100%"
				height={H}
				viewBox="0 0 {plotPermW} {H}"
				role="img"
				aria-labelledby="bp-perm-title bp-perm-desc"
			>
				<title id="bp-perm-title">Распределение разности средних при перестановках</title>
				<desc id="bp-perm-desc">{permDesc}</desc>
				{#each permCounts as c, k (k)}
					{@const low = PERM_LO + k * PERM_BIN}
					{@const h = (c / permMax) * (H - PAD_B - 8)}
					<rect
						class="bp-bar"
						class:bp-bar-hit={isExtremeBin(low)}
						x={(k * permBarW).toFixed(1)}
						y={(H - PAD_B - h).toFixed(1)}
						width={Math.max(0.5, permBarW - 0.5).toFixed(1)}
						height={h.toFixed(1)}
					/>
				{/each}
				<line
					class="bp-ref"
					x1={xPerm(observed).toFixed(1)}
					x2={xPerm(observed).toFixed(1)}
					y1="0"
					y2={H - PAD_B}
				/>
				<line
					class="bp-ref"
					x1={xPerm(-observed).toFixed(1)}
					x2={xPerm(-observed).toFixed(1)}
					y1="0"
					y2={H - PAD_B}
				/>
				<line class="bp-axis" x1="0" x2={plotPermW} y1={H - PAD_B} y2={H - PAD_B} />
				<text class="bp-tick" x={xPerm(0).toFixed(1)} y={H - 6} text-anchor="middle">0</text>
				<text class="bp-tick" x="0" y={H - 6}>{PERM_LO}</text>
				<text class="bp-tick" x={plotPermW} y={H - 6} text-anchor="end">{PERM_HI}</text>
			</svg>
		</div>

		<div class="bp-row">
			<p class="bp-label">
				{#if permLast}
					Случайная перестановка: группа A = {permLast.labelsA.map((i) => POOL[i]).join(', ')}; d = {fmt(
						permLast.d,
						3,
					)}
				{:else}
					<span class="bp-muted"
						>Нажмите «Перемешать метки»: значения группы A выбираются случайно из пула.</span
					>
				{/if}
			</p>
		</div>

		<dl class="bp-stats">
			<div>
				<dt>Перестановок</dt>
				<dd>{exact ? exact.length : permDiffs.length}{exact ? '' : ' (случайных)'}</dd>
			</div>
			<div>
				<dt>При |d| ≥ {fmt(observed, 3)}</dt>
				<dd>{permTest ? permTest.count : permExtremeShown}</dd>
			</div>
			<div>
				<dt>p-значение (двустороннее)</dt>
				<dd>
					{permTest && exact ? `${permTest.count} / ${exact.length} ≈ ${fmt(permTest.p, 4)}` : '—'}
				</dd>
			</div>
		</dl>

		<div class="bp-buttons">
			<button type="button" class="bp-btn" onclick={shuffleOnce} disabled={exact !== null}
				>Перемешать метки</button
			>
			<button type="button" class="bp-btn" onclick={computeExact} disabled={exact !== null}
				>Все 12 870 перестановок</button
			>
			<button
				type="button"
				class="bp-btn bp-btn-quiet"
				onclick={resetPerm}
				disabled={permDiffs.length === 0 && exact === null}>Сбросить</button
			>
		</div>
		<p class="bp-live" aria-live="polite">{permDesc}</p>
	{/if}

	<p class="bp-note">
		<strong>Что заметить:</strong>
		{#if mode === 'boot'}
			средние пересэмплированных выборок разбросаны заметно, хотя исходная выборка одна. Их разброс
			и есть оценка стандартной ошибки.
		{:else}
			разность средних при случайных метках обычно близка к нулю. Столбцы с |d| от 6 и выше
			(выделены) редки; их доля и есть p-значение.
		{/if}
	</p>
</figure>

<style>
	.bp {
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
	.bp :global(*),
	.bp :global(*::before),
	.bp :global(*::after) {
		box-sizing: border-box;
	}
	.bp p,
	.bp dl,
	.bp dd,
	.bp dt,
	.bp ul {
		margin: 0;
	}
	.bp button {
		font: inherit;
	}
	.bp-muted {
		color: var(--text-muted);
	}
	.bp-controls {
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.bp-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.bp-seg {
		height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	.bp-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.bp-seg:focus-visible,
	.bp-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.bp-row {
		margin-top: var(--space-4);
	}
	.bp-label {
		color: var(--text-muted);
		margin-bottom: var(--space-2);
	}
	.bp-svg {
		display: block;
		overflow: visible;
	}
	.bp-axis {
		stroke: var(--border);
		stroke-width: 1;
	}
	.bp-dot {
		fill: var(--topic);
	}
	.bp-plot {
		margin-top: var(--space-4);
	}
	.bp-bar {
		fill: var(--topic-soft);
		stroke: var(--topic);
		stroke-width: 0.5;
		transition:
			height var(--dur) var(--ease),
			y var(--dur) var(--ease);
	}
	.bp-bar-hit {
		fill: var(--warn-bg, var(--topic-soft));
		stroke: var(--warn);
	}
	.bp-ref {
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.bp-ci {
		stroke: var(--accent);
		stroke-width: 1.5;
	}
	.bp-tick {
		font-size: 11px;
		fill: var(--text-muted);
	}
	.bp-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		list-style: none;
		padding: 0;
	}
	.bp-chip {
		min-width: 36px;
		padding: 2px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.bp-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.bp-stats dt {
		color: var(--text-muted);
		font-size: 12px;
	}
	.bp-stats dd {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.bp-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.bp-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--topic);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--topic);
		cursor: pointer;
	}
	.bp-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.bp-btn-quiet {
		border-color: var(--border);
		color: var(--text-muted);
	}
	.bp-live {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.bp-note {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	@media (prefers-reduced-motion: reduce) {
		.bp-bar {
			transition: none;
		}
	}
	@media (max-width: 559px) {
		.bp {
			padding: var(--space-4);
		}
	}
</style>
