<script module lang="ts">
	/** Per-page counter: keeps SVG marker ids unique when several demos share a page. */
	let instances = 0;
</script>

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
		DIM_MAX,
		DIM_MIN,
		DIM_STEP,
		MAIN_CHAIN,
		NODE_IDS,
		NODE_LABEL,
		RESIDUAL,
		TOKENS_MAX,
		TOKENS_MIN,
		type NodeId,
		type TransformerBlockDemoState,
		describeNode,
		formatShape,
		isNodeId,
		nodeInfo,
		snapDim,
		snapTokens,
		totalParams,
	} from '$lib/demos/transformer-block';

	/** Pre-LN transformer block demo. Registers itself as demo `transformer-block`. */
	let { initial }: { initial?: Partial<TransformerBlockDemoState> } = $props();

	instances += 1;
	const uid = `tb-${instances}`;

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let node = $state<NodeId>(isNodeId(initial?.node) ? initial.node : DEFAULT_STATE.node);
	/* svelte-ignore state_referenced_locally */
	let tokens = $state(snapTokens(initial?.tokens ?? DEFAULT_STATE.tokens));
	/* svelte-ignore state_referenced_locally */
	let dim = $state(snapDim(initial?.dim ?? DEFAULT_STATE.dim));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);
	const attnEntity = $derived(hl === 'q' || hl === 'k' || hl === 'v');

	const info = $derived(nodeInfo(node, tokens, dim));
	const total = $derived(totalParams(dim));

	/** Layout of the diagram in SVG units (viewBox 340 wide). */
	const BOX_X = 40;
	const BOX_W = 200;
	const BOX_H = 40;
	const CX = BOX_X + BOX_W / 2;
	const SKIP_X = 300;
	const ROW: Record<NodeId, number> = {
		x: 10,
		ln1: 72,
		attn: 134,
		add1: 196,
		ln2: 258,
		mlp: 320,
		add2: 382,
	};
	const RIGHT = BOX_X + BOX_W;

	/** Residual arcs drawn on the right side: from the block input and from the first sum. */
	const SKIP_PATHS = [
		`M${RIGHT} ${ROW.x + 20} H${SKIP_X} V${ROW.add1 + 16} H${RIGHT}`,
		`M${RIGHT} ${ROW.add1 + 24} H${SKIP_X} V${ROW.add2 + 16} H${RIGHT}`,
	];

	/** Fill-stripe colour of each node kind: tokens of the palette only. */
	const STRIPE: Record<string, string> = {
		tensor: '--text-muted',
		norm: '--cat-3',
		attn: '--cat-1',
		mlp: '--cat-2',
		sum: '--cat-4',
	};

	function apply(patch: Partial<TransformerBlockDemoState>): void {
		if (isNodeId(patch.node)) node = patch.node;
		if (typeof patch.tokens === 'number') tokens = snapTokens(patch.tokens);
		if (typeof patch.dim === 'number') dim = snapDim(patch.dim);
	}

	function reset(): void {
		node = DEFAULT_STATE.node;
		tokens = DEFAULT_STATE.tokens;
		dim = DEFAULT_STATE.dim;
	}

	function onNodeKey(e: KeyboardEvent, id: NodeId): void {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			node = id;
		}
	}

	onMount(() => {
		return demos?.register('transformer-block', {
			set: (patch) => apply(patch as Partial<TransformerBlockDemoState>),
		});
	});
</script>

<figure
	class="tb"
	id="demo-transformer-block"
	data-demo="transformer-block"
	class:hl-attn={attnEntity}
>
	<div class="tb-controls">
		<label class="tb-ctl">
			<span class="tb-label">Токенов <i>n</i></span>
			<input
				class="tb-range"
				type="range"
				min={TOKENS_MIN}
				max={TOKENS_MAX}
				step="1"
				value={tokens}
				aria-valuetext="n = {tokens}"
				oninput={(e) => (tokens = snapTokens(Number(e.currentTarget.value)))}
			/>
			<output class="tb-val">{tokens}</output>
		</label>

		<label class="tb-ctl">
			<span class="tb-label">Ширина <i>d</i></span>
			<input
				class="tb-range"
				type="range"
				min={DIM_MIN}
				max={DIM_MAX}
				step={DIM_STEP}
				value={dim}
				aria-valuetext="d = {dim}"
				oninput={(e) => (dim = snapDim(Number(e.currentTarget.value)))}
			/>
			<output class="tb-val">{dim}</output>
		</label>

		<button type="button" class="tb-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="tb-body">
		<svg
			class="tb-svg"
			viewBox="0 0 340 440"
			role="group"
			aria-label="Схема блока трансформера: выберите узел"
		>
			<defs>
				<marker
					id="{uid}-arrow"
					viewBox="0 0 10 10"
					refX="9"
					refY="5"
					markerWidth="7"
					markerHeight="7"
					orient="auto-start-reverse"
				>
					<path class="tb-arrowhead" d="M0,0 L10,5 L0,10 z" />
				</marker>
			</defs>

			{#each MAIN_CHAIN as [from, to] (from + to)}
				<line
					class="tb-edge"
					x1={CX}
					x2={CX}
					y1={ROW[from] + BOX_H}
					y2={ROW[to]}
					marker-end="url(#{uid}-arrow)"
				/>
			{/each}

			{#each RESIDUAL as [from, to], i (from + to)}
				<path class="tb-skip" d={SKIP_PATHS[i]} marker-end="url(#{uid}-arrow)" />
			{/each}
			<text class="tb-skip-label" x={SKIP_X - 4} y={ROW.attn + 4} text-anchor="end">остаток</text>
			<text class="tb-skip-label" x={SKIP_X - 4} y={ROW.mlp + 4} text-anchor="end">остаток</text>

			{#each NODE_IDS as id (id)}
				{@const kind = nodeInfo(id, tokens, dim).kind}
				<g
					class="tb-node tb-{kind}"
					class:is-on={node === id}
					role="button"
					tabindex="0"
					aria-pressed={node === id}
					aria-label={NODE_LABEL[id]}
					onclick={() => (node = id)}
					onkeydown={(e) => onNodeKey(e, id)}
				>
					<rect class="tb-box" x={BOX_X} y={ROW[id]} width={BOX_W} height={BOX_H} rx="6" />
					<rect
						class="tb-stripe"
						style="fill: var({STRIPE[kind]})"
						x={BOX_X}
						y={ROW[id]}
						width="6"
						height={BOX_H}
						rx="3"
					/>
					<text class="tb-node-t" x={CX + 3} y={ROW[id] + 25} text-anchor="middle"
						>{NODE_LABEL[id]}</text
					>
				</g>
			{/each}
		</svg>

		<div class="tb-panel">
			<p class="tb-desc" aria-live="polite">{describeNode(info)}</p>
			<p class="tb-panel-t">{info.title}</p>
			<dl class="tb-shapes">
				<dt>Вход</dt>
				<dd>{info.input ? formatShape(info.input) : '—'}</dd>
				<dt>Выход</dt>
				<dd>{formatShape(info.output)}</dd>
				{#each info.detail as d (d.label)}
					<dt>{d.label}</dt>
					<dd>{formatShape(d.shape)}</dd>
				{/each}
				<dt>Параметры</dt>
				<dd>{info.params.toLocaleString('en-US')}</dd>
			</dl>
			<p class="tb-op">{info.op}</p>
			<p class="tb-total">
				Блок целиком: <span class="tb-mono">{total.toLocaleString('en-US')}</span> параметров при
				<i>d</i>
				= {dim}.
			</p>
		</div>
	</div>

	<p class="tb-notice">
		<strong>Что заметить:</strong> форма тензора на входе и выходе блока одинакова, [{tokens},
		{dim}]. Остаточная связь складывает вход с результатом подблока, поэтому блок можно ставить в
		стек. Параметров больше всего в MHA и MLP, и при росте <i>d</i> они растут примерно как
		<i>d</i>², а нормализация растёт только линейно.
	</p>
</figure>

<style>
	.tb {
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
	.tb :global(*),
	.tb :global(*::before),
	.tb :global(*::after) {
		box-sizing: border-box;
	}
	.tb dl,
	.tb dd,
	.tb dt,
	.tb p {
		margin: 0;
	}
	.tb button {
		font: inherit;
	}
	.tb i {
		font-family: var(--font-serif);
	}
	.tb-mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	/* Controls */
	.tb-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.tb-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.tb-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.tb-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.tb-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.tb-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.tb-range:focus-visible,
	.tb-reset:focus-visible,
	.tb-node:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Body: diagram and panel */
	.tb-body {
		display: grid;
		grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
		align-items: start;
	}
	.tb-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.tb-edge {
		stroke: var(--text-muted);
		stroke-width: 1.5;
	}
	.tb-arrowhead {
		fill: var(--text-muted);
	}
	.tb-skip {
		fill: none;
		stroke: var(--topic);
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
	}
	.tb-skip-label {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.tb-node {
		cursor: pointer;
		transition: opacity var(--dur) var(--ease);
	}
	.tb-box {
		fill: var(--surface-2);
		stroke: var(--border);
		stroke-width: 1;
	}
	.tb-node.is-on .tb-box {
		fill: var(--topic-soft);
		stroke: var(--topic);
		stroke-width: 2;
	}
	.tb-node-t {
		fill: var(--text);
		font-size: 13px;
		font-family: var(--font-sans);
		pointer-events: none;
	}
	.tb.hl-attn .tb-node:not(.tb-attn) {
		opacity: 0.45;
	}

	/* Panel */
	.tb-panel {
		min-width: 0;
		padding: var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.tb-desc {
		margin-bottom: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}
	.tb-panel-t {
		margin-bottom: var(--space-3);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.tb-shapes {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-1) var(--space-4);
		font-size: 13px;
	}
	.tb-shapes dt {
		color: var(--text-muted);
	}
	.tb-shapes dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.tb-op {
		margin-top: var(--space-3);
		color: var(--text);
	}
	.tb-total {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 13px;
	}
	.tb-total .tb-mono {
		color: var(--text);
	}

	.tb-notice {
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--surface-2);
		border-left: 3px solid var(--topic);
		border-radius: var(--radius-sm);
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.tb *,
		.tb *::before,
		.tb *::after {
			transition: none !important;
		}
	}

	@media (max-width: 719px) {
		.tb-body {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-4);
		}
		.tb-svg {
			max-width: 340px;
			margin: 0 auto;
		}
	}

	@media (max-width: 559px) {
		.tb {
			padding: var(--space-4);
		}
		.tb-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.tb-ctl {
			flex-wrap: wrap;
		}
		.tb-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
