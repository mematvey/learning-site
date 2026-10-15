<script lang="ts" module>
	import type { PrereqGraphData } from '$lib/contracts/registry';
	import type { TopicId } from '$lib/contracts/ids';
	import { SvelteMap } from 'svelte/reactivity';

	export const NODE_W = 168;
	export const NODE_H = 52;
	const PITCH_X = 200;
	const PITCH_Y = 90;
	const PAD = 16;

	export interface LayoutNode {
		id: string;
		title: string;
		kind: 'chapter' | 'concept';
		x: number;
		y: number;
		layer: number;
	}

	export interface LayoutEdge {
		from: string;
		to: string;
		/** SVG path data, from the right side of `from` to the left side of `to`. */
		d: string;
	}

	export interface PrereqLayout {
		nodes: LayoutNode[];
		edges: LayoutEdge[];
		width: number;
		height: number;
	}

	/**
	 * Layers the graph left to right: a node sits one column right of its deepest prerequisite.
	 * Nodes inside a column keep the input order. Throws on a cycle (check-content rejects them,
	 * so this is a safety net for broken generated data).
	 */
	export function layoutPrereq(graph: PrereqGraphData, topic?: TopicId): PrereqLayout {
		const sourceNodes = topic ? graph.nodes.filter((n) => n.topic === topic) : graph.nodes;
		const ids = new Set(sourceNodes.map((n) => n.id));
		const edges = graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to));

		const layer = new SvelteMap<string, number>();
		for (const n of sourceNodes) layer.set(n.id, 0);
		// Longest-path relaxation; more passes than nodes means a cycle.
		let changed = true;
		for (let pass = 0; changed; pass++) {
			if (pass > sourceNodes.length) throw new Error('prereq graph has a cycle');
			changed = false;
			for (const e of edges) {
				const next = (layer.get(e.from) ?? 0) + 1;
				if (next > (layer.get(e.to) ?? 0)) {
					layer.set(e.to, next);
					changed = true;
				}
			}
		}

		const rowInLayer = new SvelteMap<number, number>();
		const nodes: LayoutNode[] = sourceNodes.map((n) => {
			const l = layer.get(n.id) ?? 0;
			const row = rowInLayer.get(l) ?? 0;
			rowInLayer.set(l, row + 1);
			return {
				id: n.id,
				title: n.title,
				kind: n.kind === 'concept' ? 'concept' : 'chapter',
				x: PAD + l * PITCH_X,
				y: PAD + row * PITCH_Y,
				layer: l,
			};
		});

		const byId = new SvelteMap(nodes.map((n) => [n.id, n]));
		const layoutEdges: LayoutEdge[] = edges.map((e) => {
			const a = byId.get(e.from);
			const b = byId.get(e.to);
			if (!a || !b) throw new Error(`edge refers to unknown node: ${e.from} -> ${e.to}`);
			const x1 = a.x + NODE_W;
			const y1 = a.y + NODE_H / 2;
			const x2 = b.x;
			const y2 = b.y + NODE_H / 2;
			const c = (x2 - x1) / 2;
			return {
				from: e.from,
				to: e.to,
				d: `M${x1} ${y1} C${x1 + c} ${y1} ${x2 - c} ${y2} ${x2} ${y2}`,
			};
		});

		const maxLayer = Math.max(0, ...nodes.map((n) => n.layer));
		const maxRows = Math.max(1, ...Array.from(rowInLayer.values()));
		return {
			nodes,
			edges: layoutEdges,
			width: PAD * 2 + maxLayer * PITCH_X + NODE_W,
			height: PAD * 2 + (maxRows - 1) * PITCH_Y + NODE_H,
		};
	}
</script>

<script lang="ts">
	import type { PrereqGraphProps, PrereqNodeState } from '$lib/contracts/component-props';

	/** Prerequisite graph around a chapter or topic. */
	const { graph, focus, topic, done = [], onSelect }: PrereqGraphProps = $props();

	const uid = $props.id();
	const titleId = `prereq-title-${uid}`;
	const markerId = `prereq-arrow-${uid}`;

	const layout = $derived(layoutPrereq(graph, topic));
	const doneSet = $derived(new Set<string>(done));

	function stateOf(id: string): PrereqNodeState {
		if (doneSet.has(id)) return 'done';
		if (focus === id) return 'current';
		return 'ahead';
	}

	function clickable(n: LayoutNode): boolean {
		return !!onSelect && n.kind === 'chapter';
	}

	/** Chapter nodes are keyboard-reachable buttons when a handler is given; others are labelled images. */
	function nodeAttrs(n: LayoutNode) {
		const interactive = clickable(n);
		return {
			role: interactive ? 'button' : 'img',
			'aria-label': n.title,
			tabindex: interactive ? 0 : -1,
			onclick: () => select(n.id, n.kind),
			onkeydown: (e: KeyboardEvent) => onNodeKey(e, n.id, n.kind),
		};
	}

	function select(id: string, kind: 'chapter' | 'concept') {
		if (onSelect && kind === 'chapter') onSelect(id as Parameters<typeof onSelect>[0]);
	}

	function onNodeKey(e: KeyboardEvent, id: string, kind: 'chapter' | 'concept') {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			select(id, kind);
		}
	}
</script>

<div class="map-card">
	<div class="map-wrap">
		<svg
			class="map-svg"
			viewBox="0 0 {layout.width} {layout.height}"
			role="img"
			aria-labelledby={titleId}
		>
			<title id={titleId}>Граф пререквизитов</title>
			<defs>
				<marker
					id={markerId}
					viewBox="0 0 10 10"
					refX="9"
					refY="5"
					markerWidth="7"
					markerHeight="7"
					orient="auto-start-reverse"
				>
					<path class="map-arrow" d="M0 0 L10 5 L0 10 z" />
				</marker>
			</defs>
			<g class="map-edges">
				{#each layout.edges as e (e.from + '>' + e.to)}
					<path class="map-edge" d={e.d} marker-end="url(#{markerId})" />
				{/each}
			</g>
			{#each layout.nodes as n (n.id)}
				{@const st = stateOf(n.id)}
				<g
					class="map-node is-{st}"
					class:is-clickable={clickable(n)}
					transform="translate({n.x} {n.y})"
					{...nodeAttrs(n)}
				>
					<rect width={NODE_W} height={NODE_H} rx="10" />
					<text x={NODE_W / 2} y={NODE_H / 2}>{n.title}</text>
				</g>
			{/each}
		</svg>
	</div>
	<ul class="map-legend">
		<li><span class="swatch swatch-done"></span>Пройдено</li>
		<li><span class="swatch swatch-current"></span>Текущая глава</li>
		<li><span class="swatch swatch-todo"></span>Впереди</li>
	</ul>
</div>

<style>
	.map-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-6);
		box-shadow: var(--shadow);
	}
	.map-wrap {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}
	.map-svg {
		display: block;
		width: 100%;
		min-width: 640px;
		height: auto;
	}
	.map-edge {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
		opacity: 0.55;
	}
	.map-arrow {
		fill: var(--text-muted);
		opacity: 0.7;
	}
	.map-node rect {
		fill: var(--surface-2);
		stroke: var(--border);
		stroke-width: 1;
	}
	.map-node text {
		font-family: var(--font-sans);
		font-size: 12px;
		fill: var(--text);
		text-anchor: middle;
		dominant-baseline: middle;
	}
	.map-node.is-done rect {
		fill: var(--topic-soft);
		stroke: var(--topic);
	}
	.map-node.is-current rect {
		fill: var(--surface);
		stroke: var(--topic);
		stroke-width: 2.5;
	}
	.map-node.is-current text {
		font-weight: 650;
	}
	.map-node.is-clickable {
		cursor: pointer;
	}
	.map-node.is-clickable:focus-visible rect {
		stroke: var(--topic);
		stroke-width: 2.5;
	}
	.map-legend {
		list-style: none;
		padding: 0;
		margin: var(--space-4) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4) var(--space-6);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.map-legend li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.swatch {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--surface-2);
	}
	.swatch-done {
		background: var(--topic-soft);
		border-color: var(--topic);
	}
	.swatch-current {
		background: var(--surface);
		border: 2px solid var(--topic);
	}
</style>
