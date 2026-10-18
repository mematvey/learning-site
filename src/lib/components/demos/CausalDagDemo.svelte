<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		ALPHA_MAX,
		ALPHA_MIN,
		ALPHA_STEP,
		DEFAULT_STATE,
		SCENARIOS,
		TRUE_EFFECT,
		type CausalDagDemoState,
		type Scenario,
		describeState,
		estimate,
		expectedLabel,
		isScenario,
		snapAlpha,
	} from '$lib/demos/causal-dag';

	/** Causal DAG demo: how controlling for a third variable changes the slope of Y on X. Registers as demo `causal-dag`. */
	let { initial }: { initial?: Partial<CausalDagDemoState> } = $props();

	const SCENARIO_NAMES: Record<Scenario, string> = {
		confounder: 'Конфаундер',
		mediator: 'Медиатор',
		collider: 'Коллайдер',
	};

	/** Third variable: Z (confounder), M (mediator), K (collider). */
	const THIRD: Record<Scenario, string> = { confounder: 'Z', mediator: 'M', collider: 'K' };

	type NodeId = 'X' | 'Y' | 'C';
	interface Node {
		id: NodeId;
		label: string;
		x: number;
		y: number;
	}
	interface Edge {
		from: NodeId;
		to: NodeId;
	}
	const LAYOUT: Record<Scenario, { nodes: Node[]; edges: Edge[] }> = {
		confounder: {
			nodes: [
				{ id: 'C', label: 'Z', x: 160, y: 40 },
				{ id: 'X', label: 'X', x: 60, y: 160 },
				{ id: 'Y', label: 'Y', x: 260, y: 160 },
			],
			edges: [
				{ from: 'C', to: 'X' },
				{ from: 'C', to: 'Y' },
				{ from: 'X', to: 'Y' },
			],
		},
		mediator: {
			nodes: [
				{ id: 'X', label: 'X', x: 60, y: 110 },
				{ id: 'C', label: 'M', x: 160, y: 40 },
				{ id: 'Y', label: 'Y', x: 260, y: 110 },
			],
			edges: [
				{ from: 'X', to: 'C' },
				{ from: 'C', to: 'Y' },
			],
		},
		collider: {
			nodes: [
				{ id: 'X', label: 'X', x: 60, y: 90 },
				{ id: 'Y', label: 'Y', x: 260, y: 90 },
				{ id: 'C', label: 'K', x: 160, y: 170 },
			],
			edges: [
				{ from: 'X', to: 'Y' },
				{ from: 'X', to: 'C' },
				{ from: 'Y', to: 'C' },
			],
		},
	};

	/* svelte-ignore state_referenced_locally */
	let scenario = $state<Scenario>(
		isScenario(initial?.scenario) ? initial.scenario : DEFAULT_STATE.scenario,
	);
	/* svelte-ignore state_referenced_locally */
	let adjust = $state(typeof initial?.adjust === 'boolean' ? initial.adjust : DEFAULT_STATE.adjust);
	/* svelte-ignore state_referenced_locally */
	let alpha = $state(snapAlpha(initial?.alpha ?? DEFAULT_STATE.alpha));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const value = $derived(estimate(scenario, adjust, alpha));
	const layout = $derived(LAYOUT[scenario]);
	const announce = $derived(describeState({ scenario, adjust, alpha }));

	/** Number line from -0.5 to 3, drawn 280 units wide. */
	const LINE_MIN = -0.5;
	const LINE_MAX = 3;
	const LINE_W = 280;
	const lineX = (v: number) => ((v - LINE_MIN) / (LINE_MAX - LINE_MIN)) * LINE_W;

	function node(id: NodeId): Node {
		const found = layout.nodes.find((n) => n.id === id);
		return found ?? { id, label: id, x: 0, y: 0 };
	}

	/** Arrow from one node to another, shortened so that it stops at the target circle. */
	function edgeLine(e: Edge): { x1: number; y1: number; x2: number; y2: number } {
		const a = node(e.from);
		const b = node(e.to);
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		const r = 22;
		return {
			x1: a.x + (dx / len) * r,
			y1: a.y + (dy / len) * r,
			x2: b.x - (dx / len) * (r + 4),
			y2: b.y - (dy / len) * (r + 4),
		};
	}

	/** Set the state, keeping values inside their ranges. */
	function apply(patch: Partial<CausalDagDemoState>) {
		if (isScenario(patch.scenario)) scenario = patch.scenario;
		if (typeof patch.adjust === 'boolean') adjust = patch.adjust;
		if (typeof patch.alpha === 'number') alpha = snapAlpha(patch.alpha);
	}

	function reset() {
		apply(DEFAULT_STATE);
	}

	onMount(() => {
		return demos?.register('causal-dag', {
			set: (patch) => apply(patch as Partial<CausalDagDemoState>),
		});
	});
</script>

<figure class="cd" id="demo-causal-dag" data-demo="causal-dag">
	<div class="cd-controls">
		<div class="cd-group" role="group" aria-label="Схема связей">
			{#each SCENARIOS as s (s)}
				<button
					type="button"
					class="cd-chip"
					aria-pressed={scenario === s}
					onclick={() => (scenario = s)}>{SCENARIO_NAMES[s]}</button
				>
			{/each}
		</div>
		<label class="cd-check">
			<input type="checkbox" bind:checked={adjust} />
			<span>Контролировать по {THIRD[scenario]}</span>
		</label>
		{#if scenario === 'confounder'}
			<label class="cd-slider">
				<span>Сила связи Z → X: <strong>{alpha.toFixed(1)}</strong></span>
				<input type="range" min={ALPHA_MIN} max={ALPHA_MAX} step={ALPHA_STEP} bind:value={alpha} />
			</label>
		{/if}
		<button type="button" class="cd-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="cd-plots">
		<svg
			class="cd-dag"
			viewBox="0 0 320 200"
			role="img"
			aria-label="Схема переменных: {SCENARIO_NAMES[scenario]}"
		>
			<defs>
				<marker
					id="cd-arrow"
					viewBox="0 0 10 10"
					refX="9"
					refY="5"
					markerWidth="6"
					markerHeight="6"
					orient="auto-start-reverse"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" />
				</marker>
			</defs>
			{#each layout.edges as e (e.from + e.to)}
				{@const l = edgeLine(e)}
				<line
					x1={l.x1}
					y1={l.y1}
					x2={l.x2}
					y2={l.y2}
					stroke="var(--text-muted)"
					stroke-width="2"
					marker-end="url(#cd-arrow)"
				/>
			{/each}
			{#each layout.nodes as n (n.id)}
				<circle
					cx={n.x}
					cy={n.y}
					r="22"
					fill={n.id === 'C' ? 'var(--surface)' : 'var(--accent)'}
					stroke={n.id === 'C' ? 'var(--accent)' : 'none'}
					stroke-width="2"
				/>
				<text
					x={n.x}
					y={n.y + 5}
					text-anchor="middle"
					font-size="14"
					font-family="var(--font-serif)"
					fill={n.id === 'C' ? 'var(--text)' : 'var(--surface)'}>{n.label}</text
				>
			{/each}
		</svg>

		<svg
			class="cd-line"
			viewBox="0 0 {LINE_W} 70"
			role="img"
			aria-label="Оценка связи на числовой прямой"
		>
			<line x1="0" y1="40" x2={LINE_W} y2="40" stroke="var(--border)" stroke-width="2" />
			<line
				x1={lineX(TRUE_EFFECT)}
				y1="18"
				x2={lineX(TRUE_EFFECT)}
				y2="52"
				stroke="var(--text)"
				stroke-dasharray="3 3"
			/>
			<text
				x={lineX(TRUE_EFFECT)}
				y="12"
				text-anchor="middle"
				font-size="11"
				fill="var(--text-muted)">истина 2</text
			>
			<circle cx={lineX(value)} cy="40" r="7" fill="var(--accent)" />
			<text x={lineX(value)} y="62" text-anchor="middle" font-size="12" fill="var(--text)"
				>{value.toFixed(2)}</text
			>
		</svg>
	</div>

	<p class="cd-status" aria-live="polite">{announce}</p>
	<p class="cd-expect">Цель: {expectedLabel(scenario)}.</p>
</figure>

<style>
	.cd {
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
	}
	.cd button {
		font: inherit;
	}
	.cd-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
	}
	.cd-group {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.cd-chip,
	.cd-reset {
		min-height: 44px;
		padding: var(--space-2) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
	}
	.cd-chip[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
	}
	.cd-check {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
	}
	.cd-slider {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 200px;
		flex: 1 1 200px;
	}
	.cd-plots {
		display: grid;
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.cd-dag,
	.cd-line {
		width: 100%;
		max-width: 320px;
		height: auto;
		justify-self: center;
	}
	.cd-status {
		margin-top: var(--space-4);
	}
	.cd-expect {
		margin-top: var(--space-2);
		color: var(--text-muted);
	}
	.cd :focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	@media (max-width: 374px) {
		.cd {
			padding: var(--space-4);
		}
	}
</style>
