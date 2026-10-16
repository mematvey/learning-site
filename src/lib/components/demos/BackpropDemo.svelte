<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		DEFAULT_STATE,
		PARAM_MAX,
		PARAM_MIN,
		PARAM_STEP,
		STEP_MAX,
		TARGET_MAX,
		TARGET_MIN,
		backward,
		backwardDone,
		describeStep,
		fmt,
		forward,
		forwardDone,
		nodeAtStep,
		normalizeState,
		snapParam,
		snapStep,
		snapTarget,
		type BackpropDemoState,
		type GraphNode,
		type OpNode,
		type ParamKey,
	} from '$lib/demos/backprop';

	/** Backprop demo: a one-neuron graph with a squared loss, walked step by step. Registers as `backprop`. */
	let { initial }: { initial?: Partial<BackpropDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let st = $state<BackpropDemoState>(normalizeState(initial));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const fwd = $derived(forward(st));
	const grad = $derived(backward(st, fwd));
	const current = $derived(nodeAtStep(st.step));
	const text = $derived(describeStep(st));

	/** Node positions in a 360 × 520 box. Inputs are narrower than operation nodes. */
	type Box = { cx: number; cy: number; w: number; label: string };
	const BOX: Record<GraphNode, Box> = {
		w: { cx: 60, cy: 40, w: 80, label: 'w' },
		x: { cx: 240, cy: 40, w: 80, label: 'x' },
		m: { cx: 150, cy: 130, w: 100, label: 'm = w · x' },
		b: { cx: 300, cy: 220, w: 80, label: 'b' },
		s: { cx: 150, cy: 220, w: 100, label: 's = m + b' },
		a: { cx: 150, cy: 310, w: 100, label: 'a = σ(s)' },
		y: { cx: 300, cy: 400, w: 80, label: 'y' },
		d: { cx: 150, cy: 400, w: 100, label: 'd = a − y' },
		L: { cx: 150, cy: 490, w: 100, label: 'L = d²' },
	};

	/** Value of each node after the forward pass (inputs are the sliders). */
	const values = $derived<Record<GraphNode, number>>({
		w: st.w,
		x: st.x,
		b: st.b,
		y: st.y,
		m: fwd.m,
		s: fwd.s,
		a: fwd.a,
		d: fwd.d,
		L: fwd.L,
	});

	/** Edges producer → consumer. The forward value of the producer and the gradient ∂L/∂producer sit on the edge. */
	type Edge = {
		from: GraphNode;
		to: GraphNode;
		/** Label positions: forward value (blue) and gradient (orange). */
		fx: number;
		fy: number;
		gx: number;
		gy: number;
		anchor: 'start' | 'middle' | 'end';
		path: string;
	};
	const EDGES: Edge[] = [
		{
			from: 'w',
			to: 'm',
			path: 'M60 60 L150 95',
			fx: 98,
			fy: 70,
			gx: 98,
			gy: 88,
			anchor: 'end',
		},
		{
			from: 'x',
			to: 'm',
			path: 'M240 60 L150 95',
			fx: 202,
			fy: 70,
			gx: 202,
			gy: 88,
			anchor: 'start',
		},
		{
			from: 'm',
			to: 's',
			path: 'M150 150 L150 200',
			fx: 158,
			fy: 180,
			gx: 142,
			gy: 180,
			anchor: 'start',
		},
		{
			from: 'b',
			to: 's',
			path: 'M260 220 L200 220',
			fx: 230,
			fy: 212,
			gx: 230,
			gy: 236,
			anchor: 'middle',
		},
		{
			from: 's',
			to: 'a',
			path: 'M150 240 L150 290',
			fx: 158,
			fy: 270,
			gx: 142,
			gy: 270,
			anchor: 'start',
		},
		{
			from: 'a',
			to: 'd',
			path: 'M150 330 L150 380',
			fx: 158,
			fy: 360,
			gx: 142,
			gy: 360,
			anchor: 'start',
		},
		{
			from: 'y',
			to: 'd',
			path: 'M260 400 L200 400',
			fx: 230,
			fy: 392,
			gx: 230,
			gy: 416,
			anchor: 'middle',
		},
		{
			from: 'd',
			to: 'L',
			path: 'M150 420 L150 470',
			fx: 158,
			fy: 450,
			gx: 142,
			gy: 450,
			anchor: 'start',
		},
	];

	function isInput(node: GraphNode): node is ParamKey {
		return node === 'w' || node === 'x' || node === 'b' || node === 'y';
	}

	function edgeForward(e: Edge): string {
		return fmt(values[e.from], 2);
	}

	function edgeGradient(e: Edge): string {
		return fmt(grad[e.from], 3);
	}

	/** Gradient on an edge appears once its consumer has been processed backward. */
	function edgeHasGradient(e: Edge): boolean {
		return !isInput(e.to) && backwardDone(e.to as OpNode, st.step);
	}

	function edgeHasForward(e: Edge): boolean {
		return forwardDone(e.from, st.step);
	}

	function nodeShowsValue(node: GraphNode): boolean {
		return isInput(node) || forwardDone(node, st.step);
	}

	function nodeIsGradDone(node: GraphNode): boolean {
		return !isInput(node) && backwardDone(node as OpNode, st.step);
	}

	function nodeIsActive(node: GraphNode): boolean {
		return current !== null && current.node === node;
	}

	function apply(patch: Partial<BackpropDemoState>): void {
		st = normalizeState({ ...st, ...patch });
	}

	function setParam(key: ParamKey, raw: number): void {
		if (key === 'y') st.y = snapTarget(raw);
		else st[key] = snapParam(raw);
	}

	function setStep(k: number): void {
		st.step = snapStep(k);
	}

	function reset(): void {
		st = normalizeState(DEFAULT_STATE);
	}

	/** Backward-pass label: which node the current step handles, for the step bar. */
	const stepLabel = $derived(
		current === null
			? 'Старт'
			: current.dir === 'forward'
				? `Прямой проход: ${current.node}`
				: `Обратный проход: ${current.node}`,
	);

	const PARAM_CONTROLS: {
		key: ParamKey;
		sym: string;
		name: string;
		min: number;
		max: number;
		step: number;
	}[] = [
		{ key: 'w', sym: 'w', name: 'вес', min: PARAM_MIN, max: PARAM_MAX, step: PARAM_STEP },
		{ key: 'x', sym: 'x', name: 'вход', min: PARAM_MIN, max: PARAM_MAX, step: PARAM_STEP },
		{ key: 'b', sym: 'b', name: 'сдвиг', min: PARAM_MIN, max: PARAM_MAX, step: PARAM_STEP },
		{ key: 'y', sym: 'y', name: 'цель', min: TARGET_MIN, max: TARGET_MAX, step: PARAM_STEP },
	];

	onMount(() => {
		return demos?.register('backprop', {
			set: (patch) => apply(patch as Partial<BackpropDemoState>),
		});
	});
</script>

<figure
	class="bp"
	id="demo-backprop"
	data-demo="backprop"
	class:hl-q={hl === 'q'}
	class:hl-k={hl === 'k'}
>
	<div class="bp-controls">
		{#each PARAM_CONTROLS as c (c.key)}
			<label class="bp-ctl">
				<span class="bp-label"><span class="bp-sym">{c.sym}</span> ({c.name})</span>
				<input
					class="bp-range"
					type="range"
					min={c.min}
					max={c.max}
					step={c.step}
					value={st[c.key]}
					oninput={(e) => setParam(c.key, Number(e.currentTarget.value))}
				/>
				<output class="bp-val">{fmt(st[c.key], 1)}</output>
			</label>
		{/each}
	</div>

	<div class="bp-graph">
		<svg class="bp-svg" viewBox="0 0 360 520" role="img" aria-labelledby="bp-title bp-desc">
			<title id="bp-title">Граф вычислений: m, s, a, d, L</title>
			<desc id="bp-desc">{text}</desc>

			{#each EDGES as e (e.from + '-' + e.to)}
				<path class="bp-edge" class:is-live={edgeHasForward(e)} d={e.path} />
				{#if edgeHasForward(e)}
					<text class="bp-fwd" x={e.fx} y={e.fy} text-anchor={e.anchor}>{edgeForward(e)}</text>
				{/if}
				{#if edgeHasGradient(e)}
					<text class="bp-grad" x={e.gx} y={e.gy} text-anchor={e.anchor}>{edgeGradient(e)}</text>
				{/if}
			{/each}

			{#each Object.keys(BOX) as k (k)}
				{@const node = k as GraphNode}
				{@const b = BOX[node]}
				<g
					class="bp-node"
					class:is-input={isInput(node)}
					class:is-active={nodeIsActive(node)}
					class:is-computed={nodeShowsValue(node) && !isInput(node)}
					class:is-grad={nodeIsGradDone(node)}
				>
					<rect x={b.cx - b.w / 2} y={b.cy - 20} width={b.w} height="40" rx="8" />
					<text class="bp-name" x={b.cx} y={isInput(node) ? b.cy + 5 : b.cy - 2}>
						{isInput(node) ? `${node} = ${fmt(values[node], 2)}` : b.label}
					</text>
					{#if !isInput(node) && nodeShowsValue(node)}
						<text class="bp-value" x={b.cx} y={b.cy + 13}>= {fmt(values[node], 3)}</text>
					{/if}
				</g>
			{/each}
		</svg>
	</div>

	<div class="bp-step" role="group" aria-label="Управление шагами">
		<button
			type="button"
			class="bp-btn"
			onclick={() => setStep(st.step - 1)}
			disabled={st.step === 0}
		>
			Назад
		</button>
		<output class="bp-counter" aria-live="off">Шаг {st.step} из {STEP_MAX} · {stepLabel}</output>
		<button
			type="button"
			class="bp-btn"
			onclick={() => setStep(st.step + 1)}
			disabled={st.step === STEP_MAX}
		>
			Вперёд
		</button>
		<button type="button" class="bp-btn bp-btn-ghost" onclick={reset}>Сброс</button>
	</div>

	<p class="bp-text" aria-live="polite">{text}</p>

	<p class="bp-legend">
		<span class="bp-key-fwd">синим</span> — значение на ребре в прямом проходе,
		<span class="bp-key-grad">оранжевым</span> — градиент ∂L/∂(узел-источник) в обратном.
	</p>

	<div class="bp-worth">
		<p class="bp-worth-t">Что заметить</p>
		<ul>
			<li>
				Градиент идёт от L назад по тем же рёбрам, что и значения вперёд, и умножается на локальную
				производную.
			</li>
			<li>
				σ'(s) = a(1 − a) не больше 0.25, поэтому градиент, пройдя через сигмоиду, уменьшается.
			</li>
			<li>Сложение передаёт один и тот же градиент сразу в оба входа: ∂L/∂m = ∂L/∂b.</li>
		</ul>
	</div>
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
		text-align: left;
		letter-spacing: normal;
		text-transform: none;
	}
	.bp :global(*),
	.bp :global(*::before),
	.bp :global(*::after) {
		box-sizing: border-box;
	}
	.bp p,
	.bp ul,
	.bp li {
		margin: 0;
	}
	.bp button {
		font: inherit;
	}
	.bp-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.bp-controls {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.bp-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}
	.bp-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.bp-range {
		flex: 1 1 120px;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.bp-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.bp-range:focus-visible,
	.bp-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Graph */
	.bp-graph {
		margin: var(--space-6) auto 0;
		max-width: 360px;
	}
	.bp-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.bp-node rect {
		fill: var(--surface-2);
		stroke: var(--border);
		stroke-width: 1.5;
		transition:
			stroke var(--dur) var(--ease),
			fill var(--dur) var(--ease);
	}
	.bp-node.is-input rect {
		fill: var(--surface);
	}
	.bp-node.is-computed rect {
		stroke: var(--cat-1);
	}
	.bp-node.is-grad rect {
		stroke: var(--cat-2);
	}
	.bp-node.is-active rect {
		stroke: var(--topic);
		stroke-width: 2.5;
	}
	.bp-name {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		text-anchor: middle;
	}
	.bp-value {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		text-anchor: middle;
	}
	.bp-edge {
		fill: none;
		stroke: var(--border);
		stroke-width: 1.5;
	}
	.bp-edge.is-live {
		stroke: var(--text-muted);
	}
	.bp-fwd,
	.bp-grad {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 4px;
		stroke-linejoin: round;
	}
	.bp-fwd {
		fill: var(--cat-1);
	}
	.bp-grad {
		fill: var(--cat-2);
	}

	/* Step bar */
	.bp-step {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-6);
	}
	.bp-counter {
		min-width: 14ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		text-align: center;
	}
	.bp-btn {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--dur) var(--ease);
	}
	.bp-btn:hover:not(:disabled) {
		border-color: var(--topic);
	}
	.bp-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.bp-btn-ghost {
		background: none;
		color: var(--text-muted);
	}

	.bp-text {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		min-height: 3.2em;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.bp-legend {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}
	.bp-key-fwd {
		color: var(--cat-1);
		font-weight: 600;
	}
	.bp-key-grad {
		color: var(--cat-2);
		font-weight: 600;
	}

	.bp-worth {
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.bp-worth-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.bp-worth ul {
		padding-left: var(--space-4);
		color: var(--text-muted);
	}
	.bp-worth li + li {
		margin-top: var(--space-1);
	}

	/* Highlight from the text: q dims gradients, k dims forward values */
	.bp.hl-q .bp-grad,
	.bp.hl-k .bp-fwd {
		opacity: 0.3;
	}

	@media (prefers-reduced-motion: reduce) {
		.bp *,
		.bp *::before,
		.bp *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.bp {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.bp-controls {
			grid-template-columns: minmax(0, 1fr);
		}
		.bp-step {
			justify-content: space-between;
		}
		.bp-counter {
			order: -1;
			width: 100%;
		}
	}
</style>
