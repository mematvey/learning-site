<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PrereqGraphProps } from '$lib/contracts/component-props';
	import type { ChapterId } from '$lib/contracts/ids';
	import { getChapters } from '$lib/content/registry';
	import { ensureProgress } from '$lib/shell.svelte';
	import {
		LINE_H,
		fitScale,
		layoutGraph,
		neighbor,
		relatives,
		revealRect,
		statusOf,
		zoomAt,
		type Direction,
		type ReadStatus,
		type Viewport,
	} from '$lib/graph/layout';

	/**
	 * Interactive map of chapter prerequisites. Two modes: the whole `topic`, or the
	 * neighbourhood of `focus` when `depth` is set. Nodes are links (Enter opens the chapter);
	 * arrow keys move between related chapters; hovering or focusing a node highlights its
	 * prerequisites and dependents. The drawing is pannable and zoomable; a plain list below
	 * is the text alternative.
	 */
	interface Props extends PrereqGraphProps {
		/** With `focus`: show only chapters within this many steps of it. */
		depth?: number;
		/** Lower viewport height cap, for the small graph on a chapter page. */
		compact?: boolean;
	}
	const { graph, focus, topic, done = [], depth, compact = false, onSelect }: Props = $props();

	const uid = $props.id();
	const titleId = `prereq-title-${uid}`;
	const markerId = `prereq-arrow-${uid}`;
	const markerHiId = `prereq-arrow-hi-${uid}`;

	const layout = $derived(layoutGraph(graph, { topic, focus, depth }));
	const hrefById = $derived(new Map(getChapters().map((c) => [c.id as string, c.href])));
	const titleById = $derived(new Map(graph.nodes.map((n) => [n.id, n.title])));
	const edgesPlain = $derived(graph.edges.filter((e) => e.kind === 'prereq'));
	// Experimental flag lives in the graph data, not in the layout nodes.
	const experimentalIds = $derived(
		new Set(graph.nodes.filter((n) => n.experimental).map((n) => n.id)),
	);
	const hasExperimental = $derived(experimentalIds.size > 0);

	// Progress: the `done` prop plus whatever the local store knows (client only).
	let storeDone = $state<string[]>([]);
	let storeVisited = $state<string[]>([]);
	onMount(() => {
		ensureProgress()
			.then((s) => s.list())
			.then(({ chapters }) => {
				storeDone = chapters.filter((c) => c.done).map((c) => c.id);
				storeVisited = chapters.filter((c) => c.visited !== null).map((c) => c.id);
			})
			.catch(() => {
				// No readable progress: every chapter shows as not started.
			});
	});
	const doneSet = $derived(new Set<string>([...done, ...storeDone]));
	const visitedSet = $derived(new Set<string>(storeVisited));
	const statusRu: Record<ReadStatus, string> = {
		new: 'не начата',
		progress: 'в процессе',
		done: 'пройдена',
	};

	// Highlight.
	let hoverId = $state<string | undefined>(undefined);
	let focusId = $state<string | undefined>(undefined);
	const active = $derived(hoverId ?? focusId);
	const rel = $derived(active ? relatives(edgesPlain, active) : undefined);
	const related = $derived(
		active && rel ? new Set<string>([active, ...rel.ancestors, ...rel.descendants]) : undefined,
	);
	function edgeLit(from: string, to: string): boolean {
		if (!active || !rel) return false;
		const up = (id: string) => id === active || rel.ancestors.has(id);
		const down = (id: string) => id === active || rel.descendants.has(id);
		return (up(from) && up(to)) || (down(from) && down(to));
	}

	// Viewport: pan and zoom.
	let viewEl = $state<HTMLDivElement | undefined>(undefined);
	let viewW = $state(0);
	let vp = $state<Viewport>({ scale: 1, x: 0, y: 0 });
	const maxH = $derived(compact ? 320 : 520);
	const viewH = $derived(Math.round(Math.min(maxH, Math.max(140, layout.height * vp.scale + 8))));

	$effect(() => {
		const el = viewEl;
		if (!el) return;
		viewW = el.clientWidth;
		if (typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => (viewW = el.clientWidth));
		ro.observe(el);
		return () => ro.disconnect();
	});

	function resetView() {
		const scale = fitScale(layout.width, viewW);
		let next: Viewport = { scale, x: Math.max(0, (viewW - layout.width * scale) / 2), y: 0 };
		const cur = focus ? layout.nodes.find((n) => n.id === focus) : undefined;
		if (cur) next = revealRect(next, cur, viewW, Math.min(maxH, layout.height * scale + 8), 24);
		vp = next;
	}
	// Refit when the data or the available width changes.
	$effect(() => {
		void layout;
		void viewW;
		resetView();
	});

	function zoom(factor: number) {
		vp = zoomAt(vp, factor, viewW / 2, viewH / 2);
	}

	let drag: { id: number; x: number; y: number; moved: boolean } | undefined;
	let suppressClick = false;
	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0 || (e.target as Element).closest('.map-controls')) return;
		drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
	}
	function onPointerMove(e: PointerEvent) {
		if (!drag || drag.id !== e.pointerId) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (!drag.moved && Math.hypot(dx, dy) < 5) return;
		if (!drag.moved) viewEl?.setPointerCapture(e.pointerId);
		drag.moved = true;
		drag.x = e.clientX;
		drag.y = e.clientY;
		vp = { ...vp, x: vp.x + dx, y: vp.y + dy };
	}
	function onPointerUp(e: PointerEvent) {
		if (!drag || drag.id !== e.pointerId) return;
		suppressClick = drag.moved;
		drag = undefined;
		if (suppressClick) setTimeout(() => (suppressClick = false), 0);
	}
	function onWheel(e: WheelEvent) {
		// Plain wheel keeps scrolling the page; Ctrl/Cmd + wheel zooms the map.
		if (!e.ctrlKey && !e.metaKey) return;
		e.preventDefault();
		const box = viewEl?.getBoundingClientRect();
		vp = zoomAt(
			vp,
			e.deltaY < 0 ? 1.12 : 1 / 1.12,
			e.clientX - (box?.left ?? 0),
			e.clientY - (box?.top ?? 0),
		);
	}

	function onNodeClick(e: MouseEvent, id: string) {
		if (suppressClick) {
			e.preventDefault();
			return;
		}
		onSelect?.(id as ChapterId);
	}

	const keyDir: Record<string, Direction> = {
		ArrowLeft: 'left',
		ArrowRight: 'right',
		ArrowUp: 'up',
		ArrowDown: 'down',
	};
	function onNodeKey(e: KeyboardEvent, id: string) {
		const dir = keyDir[e.key];
		if (!dir) return;
		e.preventDefault();
		const to = neighbor(layout, id, dir);
		const node = layout.nodes.find((n) => n.id === to);
		if (!to || !node) return;
		vp = revealRect(vp, node, viewW, viewH, 16);
		const el = viewEl?.querySelector<SVGAElement>(`a[data-id="${CSS.escape(to)}"]`);
		el?.focus();
	}

	const listed = $derived(
		[...layout.nodes]
			.sort((a, b) => a.layer - b.layer)
			.map((n) => ({
				...n,
				needs: layout.edges.filter((e) => e.to === n.id).map((e) => e.from),
				opens: layout.edges.filter((e) => e.from === n.id).map((e) => e.to),
			})),
	);
</script>

<div class="map-card" class:is-compact={compact}>
	{#if layout.nodes.length === 0}
		<p class="map-empty">Карта появится, когда в теме будут главы.</p>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="map-view"
			style:height="{viewH}px"
			bind:this={viewEl}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onwheel={onWheel}
		>
			<svg class="map-svg" role="group" aria-labelledby={titleId}>
				<title id={titleId}
					>Граф пререквизитов: стрелки ведут от нужной главы к той, что её использует</title
				>
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
					<marker
						id={markerHiId}
						viewBox="0 0 10 10"
						refX="9"
						refY="5"
						markerWidth="7"
						markerHeight="7"
						orient="auto-start-reverse"
					>
						<path class="map-arrow-hi" d="M0 0 L10 5 L0 10 z" />
					</marker>
				</defs>
				<g class="map-world" transform="translate({vp.x} {vp.y}) scale({vp.scale})">
					<g>
						{#each layout.edges as e (e.from + '>' + e.to)}
							{@const lit = edgeLit(e.from, e.to)}
							<path
								class="map-edge"
								class:is-lit={lit}
								class:is-dim={!!related && !lit}
								d={e.d}
								marker-end="url(#{lit ? markerHiId : markerId})"
							/>
						{/each}
					</g>
					{#each layout.nodes as n (n.id)}
						{@const st = statusOf(n.id, doneSet, visitedSet)}
						{@const href = hrefById.get(n.id)}
						<g
							class="map-node is-{st}"
							class:is-current={focus === n.id}
							class:is-dim={!!related && !related.has(n.id)}
							class:is-active={active === n.id}
							class:is-experimental={experimentalIds.has(n.id)}
							data-topic={n.topic}
							transform="translate({n.x} {n.y})"
							role="presentation"
							onpointerenter={() => (hoverId = n.id)}
							onpointerleave={() => (hoverId = undefined)}
						>
							<a
								href={href ? resolve(href as '/') : undefined}
								data-id={n.id}
								aria-label="{n.title}, {statusRu[st]}{focus === n.id ? ', текущая глава' : ''}"
								aria-current={focus === n.id ? 'page' : undefined}
								onfocus={() => (focusId = n.id)}
								onblur={() => (focusId = undefined)}
								onclick={(e) => onNodeClick(e, n.id)}
								onkeydown={(e) => onNodeKey(e, n.id)}
							>
								<rect width={n.w} height={n.h} rx="10" />
								{#each n.lines as line, i (i)}
									<text
										x={n.w / 2}
										y={n.h / 2 + (i - (n.lines.length - 1) / 2) * LINE_H}
										class="map-title">{line}</text
									>
								{/each}
								{#if st === 'done'}
									<circle class="mark-bg" cx={n.w - 11} cy="11" r="7" />
									<path class="mark-check" d="M{n.w - 14.5} 11 l2.4 2.6 l4.6 -5" />
								{:else if st === 'progress'}
									<circle class="mark-ring" cx={n.w - 11} cy="11" r="6" />
									<path class="mark-half" d="M{n.w - 11} 5 a6 6 0 0 1 0 12 z" />
								{/if}
							</a>
						</g>
					{/each}
				</g>
			</svg>
			<div class="map-controls" role="group" aria-label="Масштаб карты">
				<button type="button" aria-label="Уменьшить" onclick={() => zoom(1 / 1.25)}>−</button>
				<button type="button" aria-label="Увеличить" onclick={() => zoom(1.25)}>+</button>
				<button type="button" aria-label="Вписать в окно" onclick={resetView}>⤢</button>
			</div>
		</div>
		<p class="map-hint">
			Перетащите карту, чтобы сдвинуть; Ctrl и колесо или кнопки меняют масштаб. Стрелки клавиатуры
			переходят между связанными главами, Enter открывает главу.
		</p>
		<ul class="map-legend" aria-label="Обозначения">
			<li><span class="swatch swatch-new"></span>Не начата</li>
			<li><span class="swatch swatch-progress"></span>В процессе</li>
			<li><span class="swatch swatch-done"></span>Пройдена</li>
			{#if focus}
				<li><span class="swatch swatch-current"></span>Текущая глава</li>
			{/if}
			{#if hasExperimental}
				<li><span class="swatch swatch-experimental"></span>Экспериментальная</li>
			{/if}
			<li><span class="arrow-key" aria-hidden="true">→</span>Сначала левая, потом правая</li>
		</ul>
		<details class="map-list">
			<summary>Список глав (текстовая версия)</summary>
			<ul>
				{#each listed as n (n.id)}
					{@const href = hrefById.get(n.id)}
					<li>
						{#if href}<a href={resolve(href as '/')}>{n.title}</a>{:else}{n.title}{/if}
						<span class="list-status">{statusRu[statusOf(n.id, doneSet, visitedSet)]}</span>
						{#if n.needs.length}
							<span class="list-rel"
								>Нужно знать: {n.needs.map((i) => titleById.get(i) ?? i).join(', ')}.</span
							>
						{/if}
						{#if n.opens.length}
							<span class="list-rel"
								>Открывает: {n.opens.map((i) => titleById.get(i) ?? i).join(', ')}.</span
							>
						{/if}
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<style>
	.map-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		box-shadow: var(--shadow);
		min-width: 0;
	}
	.map-view {
		position: relative;
		overflow: hidden;
		border-radius: var(--radius-md, 8px);
		background: var(--bg);
		cursor: grab;
		touch-action: pan-y;
		user-select: none;
	}
	.map-view:active {
		cursor: grabbing;
	}
	.map-svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.map-empty {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.map-controls {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		display: flex;
		gap: var(--space-1);
	}
	.map-controls button {
		width: 32px;
		height: 32px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
	}
	.map-controls button:hover {
		border-color: var(--accent);
	}
	.map-controls button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.map-hint {
		margin: var(--space-3) 0 0;
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.map-edge {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
		opacity: 0.5;
	}
	.map-edge.is-lit {
		stroke: var(--accent);
		stroke-width: 2.5;
		opacity: 1;
	}
	.map-edge.is-dim {
		opacity: 0.12;
	}
	.map-arrow {
		fill: var(--text-muted);
		opacity: 0.7;
	}
	.map-arrow-hi {
		fill: var(--accent);
	}
	.map-node a {
		cursor: pointer;
		outline: none;
	}
	.map-node rect {
		fill: var(--surface-2);
		stroke: var(--border);
		stroke-width: 1;
	}
	.map-node text {
		font-family: var(--font-sans);
		font-size: 13px;
		fill: var(--text);
		text-anchor: middle;
		dominant-baseline: middle;
		pointer-events: none;
	}
	.map-node.is-progress rect {
		fill: var(--surface);
		stroke: var(--topic);
		stroke-width: 1.5;
		stroke-dasharray: 5 3;
	}
	.map-node.is-done rect {
		fill: var(--topic-soft);
		stroke: var(--topic);
	}
	.map-node.is-current rect {
		stroke: var(--topic);
		stroke-width: 3;
		stroke-dasharray: none;
	}
	.map-node.is-current text {
		font-weight: 650;
	}
	.map-node.is-active rect,
	.map-node a:focus-visible rect {
		stroke: var(--accent);
		stroke-width: 3;
		stroke-dasharray: none;
	}
	.map-node.is-dim {
		opacity: 0.3;
	}
	/* Experimental chapters keep a dashed outline, also when current or active (declared last to win). */
	.map-node.is-experimental rect {
		stroke-dasharray: 4 3;
		stroke-width: 1.5;
	}
	.mark-bg {
		fill: var(--topic);
	}
	.mark-check {
		fill: none;
		stroke: var(--surface);
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.mark-ring {
		fill: none;
		stroke: var(--topic);
		stroke-width: 1.5;
	}
	.mark-half {
		fill: var(--topic);
	}
	@media (prefers-reduced-motion: no-preference) {
		.map-node,
		.map-edge {
			transition: opacity 0.15s;
		}
	}
	.map-legend {
		list-style: none;
		padding: 0;
		margin: var(--space-3) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.map-legend li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.swatch {
		width: 16px;
		height: 14px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		box-sizing: border-box;
	}
	.swatch-progress {
		background: var(--surface);
		border: 1.5px dashed var(--topic);
	}
	.swatch-done {
		background: var(--topic-soft);
		border-color: var(--topic);
	}
	.swatch-current {
		background: var(--surface-2);
		border: 3px solid var(--topic);
	}
	.swatch-experimental {
		background: var(--surface-2);
		border: 1.5px dashed var(--text-muted);
	}
	.arrow-key {
		color: var(--accent);
		font-weight: 700;
	}
	.map-list {
		margin-top: var(--space-4);
		font-size: var(--fs-sm);
	}
	.map-list summary {
		cursor: pointer;
		color: var(--accent);
		min-height: 24px;
	}
	.map-list summary:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.map-list ul {
		list-style: none;
		padding: 0;
		margin: var(--space-3) 0 0;
		display: grid;
		gap: var(--space-3);
	}
	.map-list li {
		overflow-wrap: anywhere;
	}
	.map-list a {
		color: var(--accent);
		font-weight: 600;
	}
	.list-status {
		margin-left: var(--space-2);
		color: var(--topic);
	}
	.list-rel {
		display: block;
		color: var(--text-muted);
	}
	@media (max-width: 480px) {
		.map-card {
			padding: var(--space-3);
		}
	}
</style>
