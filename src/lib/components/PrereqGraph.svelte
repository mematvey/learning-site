<script lang="ts" module>
	import type { PrereqGraphData } from '$lib/contracts/registry';
	import type { TopicId } from '$lib/contracts/ids';
	import { SvelteMap } from 'svelte/reactivity';

	/** Chapter node width in CSS px; text wraps inside it. */
	export const NODE_W = 180;
	const COL_GAP = 56;
	const ROW_GAP = 16;
	const PAD = 16;
	/** Node title: 13px text, about 20 Cyrillic characters per line, at most 3 lines. */
	const TITLE_CHARS = 20;
	const TITLE_LINES = 3;
	const LINE_H = 18;
	const NODE_PAD_Y = 8;
	/** Concept chips under the expanded chapter: 12px text, at most 2 lines each. */
	const CHIP_CHARS = 22;
	const CHIP_LINES = 2;
	const CHIP_LINE_H = 15;
	const CHIP_CHAR_W = 6.8;
	const CHIP_PAD_X = 7;
	const CHIP_PAD_Y = 4;
	const CHIP_GAP = 5;
	const CHIP_TOP_GAP = 8;
	const MAX_CHIPS = 6;

	export interface LayoutChip {
		lines: string[];
		x: number;
		y: number;
		w: number;
		h: number;
	}

	export interface LayoutNode {
		id: string;
		kind: 'chapter';
		lines: string[];
		x: number;
		y: number;
		w: number;
		h: number;
		layer: number;
		/** Concept chips; only the expanded chapter has them. */
		chips: LayoutChip[];
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
	 * Greedy word wrap by character count. Words longer than a line are split; text beyond
	 * `maxLines` is cut with an ellipsis. Character counts stand in for measured text width,
	 * which keeps the layout pure and testable.
	 */
	export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
		const lines: string[] = [];
		let cur = '';
		for (const word of text.trim().split(/\s+/).filter(Boolean)) {
			if (cur && cur.length + 1 + word.length <= maxChars) {
				cur += ' ' + word;
				continue;
			}
			if (cur) lines.push(cur);
			let rest = word;
			while (rest.length > maxChars) {
				lines.push(rest.slice(0, maxChars));
				rest = rest.slice(maxChars);
			}
			cur = rest;
		}
		if (cur) lines.push(cur);
		if (lines.length <= maxLines) return lines;
		const kept = lines.slice(0, maxLines);
		const last = kept[maxLines - 1] ?? '';
		kept[maxLines - 1] = last.slice(0, maxChars - 1).trimEnd() + '…';
		return kept;
	}

	/**
	 * Lays chapters out left to right: a chapter sits one column right of its deepest prerequisite.
	 * Chapters of one column stack top to bottom in input order. Concept nodes are not drawn as
	 * graph nodes; the concepts of `expanded` become chips under that chapter. Throws on a cycle
	 * (check-content rejects cycles, so this guards against broken generated data).
	 */
	export function layoutPrereq(
		graph: PrereqGraphData,
		topic?: TopicId,
		expanded?: string,
	): PrereqLayout {
		const chapters = graph.nodes.filter(
			(n) => n.kind === 'chapter' && (!topic || n.topic === topic),
		);
		const ids = new Set(chapters.map((n) => n.id));
		const edges = graph.edges.filter(
			(e) => e.kind === 'prereq' && ids.has(e.from) && ids.has(e.to),
		);

		// Longest-path relaxation; more passes than nodes means a cycle.
		const layer = new SvelteMap<string, number>();
		for (const n of chapters) layer.set(n.id, 0);
		let changed = true;
		for (let pass = 0; changed; pass++) {
			if (pass > chapters.length) throw new Error('prereq graph has a cycle');
			changed = false;
			for (const e of edges) {
				const next = (layer.get(e.from) ?? 0) + 1;
				if (next > (layer.get(e.to) ?? 0)) {
					layer.set(e.to, next);
					changed = true;
				}
			}
		}

		const titleOf = new SvelteMap(graph.nodes.map((n) => [n.id, n.title]));
		const titleLines = new SvelteMap(
			chapters.map((n) => [n.id, wrapText(n.title, TITLE_CHARS, TITLE_LINES)]),
		);
		const maxTitleLines = Math.max(1, ...Array.from(titleLines.values(), (l) => l.length));
		const nodeH = NODE_PAD_Y * 2 + maxTitleLines * LINE_H;

		const chipLabels = graph.edges
			.filter((e) => e.kind === 'introduces' && e.from === expanded && ids.has(e.from))
			.map((e) => titleOf.get(e.to))
			.filter((t): t is string => !!t);
		const shown = chipLabels.slice(0, MAX_CHIPS);
		if (chipLabels.length > MAX_CHIPS) shown.push(`+${chipLabels.length - MAX_CHIPS} ещё`);

		const cursor = new SvelteMap<number, number>();
		const nodes: LayoutNode[] = chapters.map((n) => {
			const l = layer.get(n.id) ?? 0;
			const y = PAD + (cursor.get(l) ?? 0);
			const isExpanded = n.id === expanded;
			const chips: LayoutChip[] = [];
			if (isExpanded) {
				let cy = y + nodeH + CHIP_TOP_GAP;
				for (const label of shown) {
					const lines = wrapText(label, CHIP_CHARS, CHIP_LINES);
					const longest = Math.max(...lines.map((s) => s.length));
					const w = Math.min(NODE_W, Math.ceil(longest * CHIP_CHAR_W) + CHIP_PAD_X * 2);
					const h = CHIP_PAD_Y * 2 + lines.length * CHIP_LINE_H;
					chips.push({ lines, x: 0, y: cy, w, h });
					cy += h + CHIP_GAP;
				}
			}
			const last = chips.at(-1);
			const blockH = last ? last.y + last.h - y : nodeH;
			cursor.set(l, (cursor.get(l) ?? 0) + blockH + ROW_GAP);
			return {
				id: n.id,
				kind: 'chapter',
				lines: titleLines.get(n.id) ?? [''],
				x: PAD + l * (NODE_W + COL_GAP),
				y,
				w: NODE_W,
				h: nodeH,
				layer: l,
				chips,
			};
		});

		const byId = new SvelteMap(nodes.map((n) => [n.id, n]));
		const layoutEdges: LayoutEdge[] = edges.map((e) => {
			const a = byId.get(e.from);
			const b = byId.get(e.to);
			if (!a || !b) throw new Error(`edge refers to unknown node: ${e.from} -> ${e.to}`);
			const x1 = a.x + a.w;
			const y1 = a.y + a.h / 2;
			const x2 = b.x;
			const y2 = b.y + b.h / 2;
			const c = (x2 - x1) / 2;
			return {
				from: e.from,
				to: e.to,
				d: `M${x1} ${y1} C${x1 + c} ${y1} ${x2 - c} ${y2} ${x2} ${y2}`,
			};
		});

		const maxLayer = Math.max(0, ...nodes.map((n) => n.layer));
		const tallest = Math.max(0, ...Array.from(cursor.values())) - ROW_GAP;
		return {
			nodes,
			edges: layoutEdges,
			width: PAD * 2 + (maxLayer + 1) * NODE_W + maxLayer * COL_GAP,
			height: nodes.length ? PAD * 2 + Math.max(0, tallest) : PAD * 2,
		};
	}
</script>

<script lang="ts">
	import type { PrereqGraphProps, PrereqNodeState } from '$lib/contracts/component-props';
	import type { ChapterId } from '$lib/contracts/ids';

	/**
	 * Prerequisite map of one topic. The SVG is drawn at its real pixel size (measured with
	 * ResizeObserver), never scaled through the viewBox, so text keeps 12–13px at any width.
	 */
	const { graph, focus, topic, done = [], onSelect }: PrereqGraphProps = $props();

	const uid = $props.id();
	const titleId = `prereq-title-${uid}`;
	const markerId = `prereq-arrow-${uid}`;

	/** Chapter picked by the reader; its concepts are shown as chips. Starts from `focus`. */
	let picked = $state<string | undefined>(undefined);
	const expanded = $derived(picked ?? focus);
	const layout = $derived(layoutPrereq(graph, topic, expanded));
	const doneSet = $derived(new Set<string>(done));

	let wrapEl = $state<HTMLDivElement | undefined>(undefined);
	let avail = $state(0);
	$effect(() => {
		const el = wrapEl;
		if (!el) return;
		avail = el.clientWidth;
		if (typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => {
			avail = el.clientWidth;
		});
		ro.observe(el);
		return () => ro.disconnect();
	});

	/** Measured width, or the layout width before the first measurement. */
	const measured = $derived(avail || layout.width);
	const svgWidth = $derived(Math.max(layout.width, measured));
	const offsetX = $derived(Math.max(0, (measured - layout.width) / 2));

	function stateOf(id: string): PrereqNodeState {
		if (doneSet.has(id)) return 'done';
		if (focus === id) return 'current';
		return 'ahead';
	}

	/** Chapter nodes are keyboard-reachable buttons; picking one shows its concepts. */
	function nodeAttrs(id: string, title: string) {
		return {
			role: 'button',
			'aria-label': title,
			'aria-pressed': expanded === id,
			tabindex: 0,
			onclick: () => choose(id),
			onkeydown: (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					choose(id);
				}
			},
		};
	}

	function choose(id: string) {
		picked = id;
		onSelect?.(id as ChapterId);
	}

	const titleById = $derived(new SvelteMap(graph.nodes.map((n) => [n.id, n.title])));
</script>

<div class="map-card">
	{#if layout.nodes.length === 0}
		<p class="map-empty">Карта появится, когда в теме будет больше глав.</p>
	{:else}
		<div class="map-wrap" bind:this={wrapEl}>
			<svg
				class="map-svg"
				style:width="{svgWidth}px"
				style:height="{layout.height}px"
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
				<g transform="translate({offsetX} 0)">
					<g class="map-edges">
						{#each layout.edges as e (e.from + '>' + e.to)}
							<path class="map-edge" d={e.d} marker-end="url(#{markerId})" />
						{/each}
					</g>
					{#each layout.nodes as n (n.id)}
						{@const st = stateOf(n.id)}
						<g
							class="map-node is-{st} is-clickable"
							transform="translate({n.x} {n.y})"
							{...nodeAttrs(n.id, titleById.get(n.id) ?? n.id)}
						>
							<rect width={n.w} height={n.h} rx="10" />
							{#each n.lines as line, i (i)}
								<text
									x={n.w / 2}
									y={n.h / 2 + (i - (n.lines.length - 1) / 2) * LINE_H}
									class="map-title">{line}</text
								>
							{/each}
						</g>
						{#each n.chips as c, ci (ci)}
							<g class="map-chip" transform="translate({n.x + c.x} {c.y})">
								<rect width={c.w} height={c.h} rx="6" />
								{#each c.lines as line, li (li)}
									<text x={c.w / 2} y={c.h / 2 + (li - (c.lines.length - 1) / 2) * CHIP_LINE_H}
										>{line}</text
									>
								{/each}
							</g>
						{/each}
					{/each}
				</g>
			</svg>
		</div>
		{#if layout.nodes.length === 1}
			<p class="map-empty">Карта появится, когда в теме будет больше глав.</p>
		{/if}
		<ul class="map-legend">
			<li><span class="swatch swatch-done"></span>Пройдено</li>
			<li><span class="swatch swatch-current"></span>Текущая глава</li>
			<li><span class="swatch swatch-todo"></span>Впереди</li>
		</ul>
	{/if}
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
		max-width: none;
	}
	.map-empty {
		margin: 0 0 var(--space-4);
		font-size: var(--fs-sm);
		color: var(--text-muted);
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
	.map-node text,
	.map-chip text {
		font-family: var(--font-sans);
		fill: var(--text);
		text-anchor: middle;
		dominant-baseline: middle;
	}
	.map-node .map-title {
		font-size: 13px;
	}
	.map-chip rect {
		fill: var(--surface);
		stroke: var(--border);
		stroke-width: 1;
	}
	.map-chip text {
		font-size: 12px;
		fill: var(--text-muted);
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
	.map-node.is-current .map-title {
		font-weight: 650;
	}
	.map-node.is-clickable {
		cursor: pointer;
	}
	.map-node:focus-visible rect {
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
