<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		AXIS,
		KAPPA_DEFAULT,
		KAPPA_MAX,
		KAPPA_MIN,
		KAPPA_STEP,
		LR_DEFAULT,
		LR_MAX,
		LR_MIN,
		LR_STEP,
		MOMENTUM_DEFAULT,
		MOMENTUM_MAX,
		MOMENTUM_MIN,
		MOMENTUM_STEP,
		OPTIMIZER_KINDS,
		OPTIMIZER_NAME,
		START,
		STEP_DEFAULT,
		TOTAL_STEPS,
		describeOptimizers,
		divergedBy,
		formatLoss,
		levelRadii,
		loss,
		pointAt,
		snapKappa,
		snapLr,
		snapMomentum,
		snapStep,
		toPixel,
		trajectory,
		type OptimizerDemoState,
		type OptimizerKind,
		type Trajectory,
	} from '$lib/demos/optimizers';

	/** Optimizer comparison on an ill-conditioned quadratic. Registers itself as demo `optimizers`. */
	let { initial }: { initial?: Partial<OptimizerDemoState> } = $props();

	/** Side of the square plot in px (the SVG uses the same viewBox). */
	const SIZE = 320;
	/** Level sets of the loss drawn as ellipses. */
	const LEVELS = [0.5, 2, 4.5, 8, 12.5, 18];

	/** Values the demo returns to on «Сброс»: the initial props, snapped to the sliders. */
	/* svelte-ignore state_referenced_locally */
	const reset0: OptimizerDemoState = {
		lr: snapLr(initial?.lr ?? LR_DEFAULT),
		kappa: snapKappa(initial?.kappa ?? KAPPA_DEFAULT),
		momentum: snapMomentum(initial?.momentum ?? MOMENTUM_DEFAULT),
		step: snapStep(initial?.step ?? STEP_DEFAULT),
	};

	let lr = $state(reset0.lr);
	let kappa = $state(reset0.kappa);
	let momentum = $state(reset0.momentum);
	let step = $state(reset0.step);

	const cfg = $derived({ lr, kappa, momentum });
	const trajs: Record<OptimizerKind, Trajectory> = $derived({
		sgd: trajectory('sgd', cfg),
		momentum: trajectory('momentum', cfg),
		adam: trajectory('adam', cfg),
	});
	const note = $derived(describeOptimizers(cfg, step, trajs));
	const startPx = toPixel(START, SIZE);
	const minPx = toPixel([0, 0], SIZE);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	function apply(patch: Partial<OptimizerDemoState>): void {
		if (typeof patch.lr === 'number') lr = snapLr(patch.lr);
		if (typeof patch.kappa === 'number') kappa = snapKappa(patch.kappa);
		if (typeof patch.momentum === 'number') momentum = snapMomentum(patch.momentum);
		if (typeof patch.step === 'number') step = snapStep(patch.step);
	}

	function resetAll(): void {
		lr = reset0.lr;
		kappa = reset0.kappa;
		momentum = reset0.momentum;
		step = reset0.step;
	}

	/** Polyline points of a trajectory up to iteration `n`, in pixels. */
	function pathOf(traj: Trajectory, n: number): string {
		const last = Math.min(Math.max(0, Math.round(n)), traj.points.length - 1);
		return traj.points
			.slice(0, last + 1)
			.map((w) => {
				const [x, y] = toPixel(w, SIZE);
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}

	function dotOf(traj: Trajectory): [number, number] {
		const [x, y] = toPixel(pointAt(traj, step), SIZE);
		return [Number(x.toFixed(1)), Number(y.toFixed(1))];
	}

	/** Semi-axes of each level set in px. */
	function ellipseOf(level: number): { rx: number; ry: number } {
		const [ax, ay] = levelRadii(level, kappa);
		const k = SIZE / (2 * AXIS);
		return { rx: ax * k, ry: ay * k };
	}

	onMount(() => {
		return demos?.register('optimizers', {
			set: (patch) => apply(patch as Partial<OptimizerDemoState>),
		});
	});
</script>

<figure class="op" id="demo-optimizers" data-demo="optimizers">
	<div class="op-controls">
		<label class="op-ctl">
			<span class="op-label"><span class="op-sym">η</span> (шаг)</span>
			<input
				class="op-range"
				type="range"
				min={LR_MIN}
				max={LR_MAX}
				step={LR_STEP}
				value={lr}
				oninput={(e) => (lr = snapLr(Number(e.currentTarget.value)))}
			/>
			<output class="op-val">{lr.toFixed(2)}</output>
		</label>

		<label class="op-ctl">
			<span class="op-label"><span class="op-sym">κ</span> (кривизна w₂)</span>
			<input
				class="op-range"
				type="range"
				min={KAPPA_MIN}
				max={KAPPA_MAX}
				step={KAPPA_STEP}
				value={kappa}
				oninput={(e) => (kappa = snapKappa(Number(e.currentTarget.value)))}
			/>
			<output class="op-val">{kappa}</output>
		</label>

		<label class="op-ctl">
			<span class="op-label"><span class="op-sym">β</span> (momentum)</span>
			<input
				class="op-range"
				type="range"
				min={MOMENTUM_MIN}
				max={MOMENTUM_MAX}
				step={MOMENTUM_STEP}
				value={momentum}
				oninput={(e) => (momentum = snapMomentum(Number(e.currentTarget.value)))}
			/>
			<output class="op-val">{momentum.toFixed(2)}</output>
		</label>

		<label class="op-ctl">
			<span class="op-label">Шаг <span class="op-sym">t</span></span>
			<input
				class="op-range"
				type="range"
				min="0"
				max={TOTAL_STEPS}
				step="1"
				value={step}
				oninput={(e) => (step = snapStep(Number(e.currentTarget.value)))}
			/>
			<output class="op-val">{step}</output>
		</label>
	</div>

	<div class="op-body">
		<div class="op-plot">
			<svg class="op-svg" viewBox="0 0 {SIZE} {SIZE}" role="img" aria-labelledby="op-title op-desc">
				<title id="op-title">Траектории оптимизаторов на поверхности потерь</title>
				<desc id="op-desc">{note}</desc>

				{#each LEVELS as level (level)}
					{@const e = ellipseOf(level)}
					<ellipse class="op-level" cx={SIZE / 2} cy={SIZE / 2} rx={e.rx} ry={e.ry} />
				{/each}

				{#each OPTIMIZER_KINDS as kind (kind)}
					<g class="op-series op-{kind}">
						<polyline class="op-line" points={pathOf(trajs[kind], step)} fill="none" />
						{#if !divergedBy(trajs[kind], step)}
							<circle
								class="op-dot"
								cx={dotOf(trajs[kind])[0]}
								cy={dotOf(trajs[kind])[1]}
								r="4.5"
							/>
						{/if}
					</g>
				{/each}

				<circle class="op-start" cx={startPx[0]} cy={startPx[1]} r="3.5" />
				<text class="op-mark" x={startPx[0] + 8} y={startPx[1] - 8}>старт</text>
				<circle class="op-min" cx={minPx[0]} cy={minPx[1]} r="3" />
				<text class="op-mark" x={minPx[0] + 8} y={minPx[1] + 14}>минимум</text>
			</svg>
			<p class="op-axis">w₁ — горизонталь, w₂ — вертикаль. Эллипсы: линии равной потери.</p>
		</div>

		<div class="op-side">
			<ul class="op-legend">
				{#each OPTIMIZER_KINDS as kind (kind)}
					{@const w = pointAt(trajs[kind], step)}
					<li class="op-leg op-{kind}">
						<span class="op-sw" aria-hidden="true"></span>
						<span class="op-name">{OPTIMIZER_NAME[kind]}</span>
						<span class="op-loss">
							{divergedBy(trajs[kind], step) ? 'расходится' : formatLoss(loss(w, kappa))}
						</span>
					</li>
				{/each}
			</ul>

			<ul class="op-formulas">
				<li><span class="op-name">SGD</span> w ← w − η·∇f</li>
				<li><span class="op-name">momentum</span> v ← β·v + ∇f, w ← w − η·v</li>
				<li>
					<span class="op-name">Adam</span> m, v — скользящие средние ∇f и ∇f²; w ← w − η·m̂/(√v̂ + ε)
				</li>
			</ul>
		</div>
	</div>

	<p class="op-note" aria-live="polite">{note}</p>

	<div class="op-actions">
		<button type="button" class="op-reset" onclick={resetAll}>Сбросить</button>
	</div>

	<div class="op-look">
		<p class="op-look-t">Что заметить</p>
		<ul>
			<li>
				При κ = 1 все три оптимизатора идут почти прямо к минимуму. При большом κ SGD зигзагает
				поперёк оврага: шаг ограничен крутизной по w₂, и устойчивость требует η·κ &lt; 2.
			</li>
			<li>
				Momentum накапливает движение вдоль пологого направления и гасит зигзаг. При большом β он
				может проскакивать минимум.
			</li>
			<li>
				Adam делает шаги порядка η по каждой координате независимо от величины градиента. Поэтому он
				быстро выходит из оврага, но при большом η колеблется у минимума.
			</li>
		</ul>
	</div>
</figure>

<style>
	.op {
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
	.op :global(*),
	.op :global(*::before),
	.op :global(*::after) {
		box-sizing: border-box;
	}
	.op p,
	.op ul {
		margin: 0;
		padding: 0;
	}
	.op ul {
		list-style: none;
	}
	.op button {
		font: inherit;
	}
	.op-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.op-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.op-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.op-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.op-range {
		width: 130px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.op-range:focus-visible,
	.op-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.op-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Plot and side panel */
	.op-body {
		display: grid;
		grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
		align-items: start;
	}
	.op-svg {
		display: block;
		width: 100%;
		max-width: 340px;
		height: auto;
		aspect-ratio: 1 / 1;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.op-level {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.45;
	}
	.op-line {
		stroke: var(--op-c);
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.op-dot {
		fill: var(--op-c);
		stroke: var(--surface);
		stroke-width: 1.5;
	}
	.op-start {
		fill: var(--text);
	}
	.op-min {
		fill: none;
		stroke: var(--text);
		stroke-width: 1.5;
	}
	.op-mark {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.op-axis {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.op-sgd {
		--op-c: var(--cat-1);
	}
	.op-momentum {
		--op-c: var(--cat-2);
	}
	.op-adam {
		--op-c: var(--cat-3);
	}

	.op-legend {
		display: grid;
		gap: var(--space-2);
	}
	.op-leg {
		display: grid;
		grid-template-columns: 14px minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-2) var(--space-3);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.op-sw {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--op-c);
	}
	.op-name {
		font-weight: 600;
	}
	.op-loss {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.op-formulas {
		display: grid;
		gap: var(--space-1);
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.op-formulas .op-name {
		font-family: var(--font-sans);
		color: var(--text);
	}

	.op-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.op-actions {
		margin-top: var(--space-3);
	}
	.op-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.op-reset:hover {
		border-color: var(--topic);
	}

	.op-look {
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
	}
	.op-look-t {
		margin-bottom: var(--space-2);
		font-weight: 600;
	}
	.op-look ul {
		display: grid;
		gap: var(--space-2);
		padding-left: var(--space-4);
		list-style: disc;
	}

	@media (max-width: 720px) {
		.op {
			padding: var(--space-4);
		}
		.op-body {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 559px) {
		.op-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.op-ctl {
			flex-wrap: wrap;
		}
		.op-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.op *,
		.op *::before,
		.op *::after {
			transition: none !important;
		}
	}
</style>
