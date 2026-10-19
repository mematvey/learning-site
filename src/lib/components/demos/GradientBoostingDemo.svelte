<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DEFAULT_STATE,
		DEPTH_MAX,
		DEPTH_MIN,
		MAX_ROUNDS,
		NU_MAX,
		NU_MIN,
		NU_STEP,
		STEP_MAX,
		STEP_MIN,
		boostPredict,
		contribution,
		describeBoost,
		earlyStop,
		fitBoost,
		gridX,
		linearScale,
		makeData,
		polylinePath,
		snapDepth,
		snapNu,
		snapStep,
		trueF,
		validationCurves,
		type GbDemoState,
	} from '$lib/demos/gradient-boosting';

	/** Gradient boosting demo: trees added one by one to a 1D regression. Registers as demo `gradient-boosting`. */
	let { initial }: { initial?: Partial<GbDemoState> } = $props();

	const data = makeData();
	const GRID = gridX(241);
	const PAD_L = 34;
	const PAD_R = 10;
	const PAD_T = 10;
	const PAD_B = 22;
	const H_FIT = 240;
	const H_CORR = 110;
	const H_CURVE = 200;
	/** Half-range of the y axis of the fit and correction charts, and the top of the error chart. */
	const Y_FIT = 1.6;
	const Y_CORR = 1;
	const Y_ERR = 0.7;

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let nu = $state(snapNu(initial?.nu ?? DEFAULT_STATE.nu));
	/* svelte-ignore state_referenced_locally */
	let depth = $state(snapDepth(initial?.depth ?? DEFAULT_STATE.depth));
	/* svelte-ignore state_referenced_locally */
	let step = $state(snapStep(initial?.step ?? DEFAULT_STATE.step));
	/** Real width of the chart column in px; the SVGs are drawn at this width (no viewBox scaling). */
	let W = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	// The stumps and trees depend on nu and depth, so the boosting is refit when either changes.
	const fit = $derived(fitBoost(data.train, MAX_ROUNDS, nu, depth));
	const curves = $derived(validationCurves(fit, data));
	const stop = $derived(earlyStop(curves.val));
	const k = $derived(Math.min(step, MAX_ROUNDS));
	const pw = $derived(W >= 200 ? W : 320);

	const sx = $derived(linearScale(0, 1, PAD_L, pw - PAD_R));
	const syFit = linearScale(-Y_FIT, Y_FIT, H_FIT - PAD_B, PAD_T);
	const syCorr = linearScale(-Y_CORR, Y_CORR, H_CORR - PAD_B, PAD_T);
	const sxErr = $derived(linearScale(0, MAX_ROUNDS, PAD_L, pw - PAD_R));
	const syErr = linearScale(0, Y_ERR, H_CURVE - PAD_B, PAD_T);

	const trueD = $derived(polylinePath(GRID.map((x) => ({ x: sx(x), y: syFit(trueF(x)) }))));
	const modelD = $derived(
		polylinePath(GRID.map((x) => ({ x: sx(x), y: syFit(boostPredict(fit, k, x)) }))),
	);
	const prevD = $derived(
		k > 0
			? polylinePath(GRID.map((x) => ({ x: sx(x), y: syFit(boostPredict(fit, k - 1, x)) })))
			: '',
	);
	/** Residuals that the last tree (k) was fitted to: from each training point to F_(k-1). */
	const residuals = $derived(
		k > 0
			? data.train.map((p) => ({
					x: sx(p.x),
					y1: syFit(p.y),
					y2: syFit(boostPredict(fit, k - 1, p.x)),
				}))
			: [],
	);
	const corrD = $derived(
		polylinePath(GRID.map((x) => ({ x: sx(x), y: syCorr(contribution(fit, k, x)) }))),
	);
	const trainErrD = $derived(
		polylinePath(curves.train.map((v, i) => ({ x: sxErr(i), y: syErr(Math.min(v, Y_ERR)) }))),
	);
	const valErrD = $derived(
		polylinePath(curves.val.map((v, i) => ({ x: sxErr(i), y: syErr(Math.min(v, Y_ERR)) }))),
	);
	const stepX = $derived(sxErr(k));
	const bestX = $derived(sxErr(stop.best));
	const bestY = $derived(syErr(Math.min(curves.val[stop.best] ?? 0, Y_ERR)));
	const stopX = $derived(stop.stopAt === null ? null : sxErr(stop.stopAt));
	const trainNow = $derived(curves.train[k] ?? 0);
	const valNow = $derived(curves.val[k] ?? 0);

	const desc = $derived(describeBoost({ nu, depth, step: k }, curves, stop));
	const stopNote = $derived(
		stop.stopAt === null
			? 'Ранней остановки за 60 шагов не было: ошибка на контроле ещё падает или колеблется.'
			: `Ранняя остановка на шаге ${stop.stopAt}: после лучшего шага ${stop.best} ошибка на контроле не падала.`,
	);

	function apply(patch: Partial<GbDemoState>): void {
		if (typeof patch.nu === 'number') nu = snapNu(patch.nu);
		if (typeof patch.depth === 'number') depth = snapDepth(patch.depth);
		if (typeof patch.step === 'number') step = snapStep(patch.step);
	}

	function nextTree(): void {
		step = Math.min(step + 1, STEP_MAX);
	}

	function toBest(): void {
		step = stop.best;
	}

	function reset(): void {
		nu = DEFAULT_STATE.nu;
		depth = DEFAULT_STATE.depth;
		step = DEFAULT_STATE.step;
	}

	onMount(() => {
		return demos?.register('gradient-boosting', {
			set: (patch) => apply(patch as Partial<GbDemoState>),
		});
	});
</script>

<figure class="gb" id="demo-gradient-boosting" data-demo="gradient-boosting">
	<div class="gb-controls">
		<label class="gb-ctl">
			<span class="gb-label"><span class="gb-sym">ν</span> сжатие</span>
			<input
				class="gb-range"
				type="range"
				min={NU_MIN}
				max={NU_MAX}
				step={NU_STEP}
				value={nu}
				oninput={(e) => (nu = snapNu(Number(e.currentTarget.value)))}
			/>
			<output class="gb-val">{nu.toFixed(2)}</output>
		</label>

		<label class="gb-ctl">
			<span class="gb-label">глубина</span>
			<input
				class="gb-range"
				type="range"
				min={DEPTH_MIN}
				max={DEPTH_MAX}
				step="1"
				value={depth}
				oninput={(e) => (depth = snapDepth(Number(e.currentTarget.value)))}
			/>
			<output class="gb-val">{depth}</output>
		</label>

		<label class="gb-ctl">
			<span class="gb-label">деревьев</span>
			<input
				class="gb-range"
				type="range"
				min={STEP_MIN}
				max={STEP_MAX}
				step="1"
				value={k}
				oninput={(e) => (step = snapStep(Number(e.currentTarget.value)))}
			/>
			<output class="gb-val">{k}</output>
		</label>
	</div>

	<div class="gb-actions">
		<button
			type="button"
			class="gb-btn gb-btn-primary"
			onclick={nextTree}
			disabled={k >= MAX_ROUNDS}
		>
			Добавить дерево
		</button>
		<button type="button" class="gb-btn" onclick={toBest}>К лучшему шагу ({stop.best})</button>
		<button type="button" class="gb-btn" onclick={reset}>Сбросить</button>
	</div>

	<div class="gb-plots" bind:clientWidth={W}>
		<div class="gb-panel">
			<p class="gb-panel-t">Модель после {k} деревьев</p>
			<svg
				class="gb-svg"
				width={pw}
				height={H_FIT}
				role="img"
				aria-label="Точки, истинная кривая и модель F_k"
			>
				<line class="gb-axis" x1={PAD_L} x2={pw - PAD_R} y1={syFit(0)} y2={syFit(0)} />
				{#each [-1, 0, 1] as t (t)}
					<text class="gb-tick" x={PAD_L - 6} y={syFit(t) + 4} text-anchor="end">{t}</text>
				{/each}
				<path class="gb-true" d={trueD} />
				{#if prevD !== ''}
					<path class="gb-prev" d={prevD} />
					{#each residuals as r, i (i)}
						<line class="gb-res" x1={r.x} x2={r.x} y1={r.y1} y2={r.y2} />
					{/each}
				{/if}
				<path class="gb-model" d={modelD} />
				{#each data.train as p, i (i)}
					<circle class="gb-pt-train" cx={sx(p.x)} cy={syFit(p.y)} r="3" />
				{/each}
				{#each data.val as p, i (i)}
					<circle class="gb-pt-val" cx={sx(p.x)} cy={syFit(p.y)} r="3" />
				{/each}
			</svg>
			<p class="gb-legend">
				<span class="gb-sw gb-sw-true"></span>истина
				<span class="gb-sw gb-sw-model"></span>модель
				<span class="gb-sw gb-sw-res"></span>остатки последнего дерева
				<span class="gb-dot"></span>обучение
				<span class="gb-dot gb-dot-val"></span>контроль
			</p>
		</div>

		<div class="gb-panel">
			<p class="gb-panel-t">Вклад последнего дерева: ν · h<sub>{k}</sub>(x)</p>
			<svg
				class="gb-svg"
				width={pw}
				height={H_CORR}
				role="img"
				aria-label="Вклад последнего дерева"
			>
				<line class="gb-axis" x1={PAD_L} x2={pw - PAD_R} y1={syCorr(0)} y2={syCorr(0)} />
				{#each [-1, 0, 1] as t (t)}
					<text class="gb-tick" x={PAD_L - 6} y={syCorr(t) + 4} text-anchor="end">{t}</text>
				{/each}
				<path class="gb-corr" d={corrD} />
			</svg>
		</div>

		<div class="gb-panel">
			<p class="gb-panel-t">Ошибка по числу деревьев</p>
			<svg
				class="gb-svg"
				width={pw}
				height={H_CURVE}
				role="img"
				aria-label="Ошибка на обучении и на контроле по шагам"
			>
				{#each [0, 0.2, 0.4, 0.6] as t (t)}
					<line class="gb-grid" x1={PAD_L} x2={pw - PAD_R} y1={syErr(t)} y2={syErr(t)} />
					<text class="gb-tick" x={PAD_L - 6} y={syErr(t) + 4} text-anchor="end">{t}</text>
				{/each}
				{#each [0, 20, 40, 60] as t (t)}
					<text class="gb-tick" x={sxErr(t)} y={H_CURVE - 6} text-anchor="middle">{t}</text>
				{/each}
				<path class="gb-err-train" d={trainErrD} />
				<path class="gb-err-val" d={valErrD} />
				{#if stopX !== null}
					<line class="gb-stop" x1={stopX} x2={stopX} y1={PAD_T} y2={H_CURVE - PAD_B} />
				{/if}
				<line class="gb-now" x1={stepX} x2={stepX} y1={PAD_T} y2={H_CURVE - PAD_B} />
				<circle class="gb-best" cx={bestX} cy={bestY} r="4" />
			</svg>
			<p class="gb-legend">
				<span class="gb-sw gb-sw-train"></span>обучение
				<span class="gb-sw gb-sw-val"></span>контроль
				<span class="gb-sw gb-sw-now"></span>текущий шаг
				<span class="gb-dot gb-dot-best"></span>лучший шаг
			</p>
		</div>
	</div>

	<dl class="gb-stats">
		<dt>Ошибка на обучении</dt>
		<dd>{trainNow.toFixed(3)}</dd>
		<dt>Ошибка на контроле</dt>
		<dd>{valNow.toFixed(3)}</dd>
		<dt>Лучший шаг по контролю</dt>
		<dd>{stop.best}</dd>
	</dl>

	<p class="gb-live" aria-live="polite">{desc}</p>

	<p class="gb-note">
		<strong>Что заметить:</strong> при большом сжатии модель быстро подгоняется под точки, и ошибка
		на контроле начинает расти раньше. При малом сжатии кривая идёт плавнее, но деревьев нужно
		больше.
		{stopNote}
	</p>
</figure>

<style>
	.gb {
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
	.gb :global(*),
	.gb :global(*::before),
	.gb :global(*::after) {
		box-sizing: border-box;
	}
	.gb dl,
	.gb dd,
	.gb dt,
	.gb p {
		margin: 0;
	}
	.gb button {
		font: inherit;
	}
	.gb-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.gb-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.gb-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.gb-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}
	.gb-range {
		width: 140px;
		max-width: 100%;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.gb-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.gb-range:focus-visible,
	.gb-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.gb-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.gb-btn {
		height: 34px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.gb-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.gb-btn-primary {
		border-color: var(--topic);
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}

	.gb-plots {
		display: grid;
		gap: var(--space-5);
		margin-top: var(--space-5);
	}
	.gb-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.gb-svg {
		display: block;
		max-width: 100%;
		height: auto;
		overflow: visible;
	}
	.gb-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.gb-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.gb-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.gb-true {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
	}
	.gb-prev {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 2 3;
		opacity: 0.7;
	}
	.gb-model {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2.5;
	}
	.gb-res {
		stroke: var(--cat-4);
		stroke-width: 1.5;
		opacity: 0.8;
	}
	.gb-pt-train {
		fill: var(--text);
	}
	.gb-pt-val {
		fill: var(--surface);
		stroke: var(--text);
		stroke-width: 1.5;
	}
	.gb-corr {
		fill: none;
		stroke: var(--cat-2);
		stroke-width: 2;
	}
	.gb-err-train {
		fill: none;
		stroke: var(--cat-1);
		stroke-width: 2;
	}
	.gb-err-val {
		fill: none;
		stroke: var(--cat-2);
		stroke-width: 2;
	}
	.gb-now {
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 3 3;
	}
	.gb-stop {
		stroke: var(--cat-4);
		stroke-width: 1.5;
	}
	.gb-best {
		fill: var(--topic);
		stroke: var(--surface);
		stroke-width: 1.5;
	}

	.gb-legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-3);
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.gb-sw {
		display: inline-block;
		width: 14px;
		height: 0;
		border-top: 2px solid var(--text-muted);
		vertical-align: middle;
	}
	.gb-sw-true {
		border-top-style: dashed;
	}
	.gb-sw-model {
		border-color: var(--topic);
	}
	.gb-sw-res {
		border-color: var(--cat-4);
	}
	.gb-sw-train {
		border-color: var(--cat-1);
	}
	.gb-sw-val {
		border-color: var(--cat-2);
	}
	.gb-sw-now {
		border-color: var(--text);
		border-top-style: dashed;
	}
	.gb-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text);
		vertical-align: middle;
	}
	.gb-dot-val {
		background: var(--surface);
		border: 1.5px solid var(--text);
	}
	.gb-dot-best {
		background: var(--topic);
	}

	.gb-stats {
		display: grid;
		grid-template-columns: auto auto;
		justify-content: start;
		gap: var(--space-1) var(--space-6);
		margin-top: var(--space-5);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.gb-stats dt {
		font-family: var(--font-sans);
		color: var(--text-muted);
	}
	.gb-stats dd {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.gb-live {
		margin-top: var(--space-4);
		padding: var(--space-3);
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		color: var(--text);
	}
	.gb-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.gb-note strong {
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.gb * {
			transition: none !important;
		}
	}
</style>
