<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ensureProgress } from '$lib/shell.svelte';
	import type { ChapterEntry, PrereqGraphData, TopicEntry } from '$lib/contracts/registry';
	import { chain, layoutSitemap } from '$lib/graph/sitemap-layout';

	/** Interactive map of all topics and chapters: clusters by topic, edges are prerequisites. */
	let {
		topics,
		chapters,
		graph,
	}: { topics: TopicEntry[]; chapters: ChapterEntry[]; graph: PrereqGraphData } = $props();

	type Status = 'new' | 'started' | 'done';
	const STATUS_LABEL: Record<Status, string> = {
		new: 'не начата',
		started: 'в процессе',
		done: 'пройдена',
	};

	const chapterById = $derived(new Map(chapters.map((c) => [c.id, c])));
	const topicTitle = $derived(new Map(topics.map((t) => [t.id, t.title])));

	/* ---------- Progress (client only) ---------- */

	let doneIds = $state<string[]>([]);
	let startedIds = $state<string[]>([]);

	onMount(() => {
		ensureProgress()
			.then((store) => store.list())
			.then(({ chapters: rows }) => {
				doneIds = rows.filter((c) => c.done).map((c) => c.id);
				startedIds = rows
					.filter((c) => !c.done && (c.visited !== null || c.sectionsReached.length > 0))
					.map((c) => c.id);
			})
			.catch(() => {
				// No readable progress: every chapter stays "not started".
			});
	});

	function statusOf(id: string): Status {
		if (doneIds.includes(id)) return 'done';
		if (startedIds.includes(id)) return 'started';
		return 'new';
	}

	/* ---------- Filter and layout ---------- */

	let filter = $state<string>('');
	let width = $state(0);

	const shownTopics = $derived(
		topics
			.filter((t) => !filter || t.id === filter)
			.map((t) => ({ id: t.id, title: t.title, chapterIds: t.chapterIds })),
	);
	const layout = $derived(layoutSitemap(graph, shownTopics, { maxRowWidth: 1000 }));

	/** Scale at which the whole map fits the container width; never below 0.5 (then it pans). */
	const fit = $derived(width > 0 ? Math.max(0.5, Math.min(1, width / layout.width)) : 1);
	const viewH = $derived(Math.round(Math.max(layout.height * fit, 280)));

	let k = $state(1);
	let tx = $state(0);
	let ty = $state(0);

	function resetView() {
		k = fit;
		tx = Math.max(0, (width - layout.width * fit) / 2);
		ty = 0;
	}

	$effect(() => {
		// Re-fit whenever the layout or the container size changes.
		k = fit;
		tx = Math.max(0, (width - layout.width * fit) / 2);
		ty = 0;
	});

	function zoomAt(factor: number, cx: number, cy: number) {
		const next = Math.min(2.5, Math.max(0.3, k * factor));
		const f = next / k;
		tx = cx - (cx - tx) * f;
		ty = cy - (cy - ty) * f;
		k = next;
	}

	let box: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!box) return;
		const el = box;
		// Zoom with the wheel only while Ctrl/Cmd is held, so the page keeps scrolling.
		const onWheel = (e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			const r = el.getBoundingClientRect();
			zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	});

	/* ---------- Pan by dragging ---------- */

	let drag: { id: number; x: number; y: number; tx: number; ty: number } | null = null;
	let moved = false;
	let panning = $state(false);

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		drag = { id: e.pointerId, x: e.clientX, y: e.clientY, tx, ty };
		moved = false;
	}
	function onPointerMove(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (!moved && Math.hypot(dx, dy) < 5) return;
		if (!moved) {
			moved = true;
			panning = true;
			box?.setPointerCapture(e.pointerId);
		}
		tx = drag.tx + dx;
		ty = drag.ty + dy;
	}
	function onPointerUp(e: PointerEvent) {
		if (drag && e.pointerId === drag.id) {
			drag = null;
			panning = false;
		}
	}
	function onClickCapture(e: MouseEvent) {
		// A drag must not open the chapter under the pointer.
		if (moved) {
			e.preventDefault();
			e.stopPropagation();
			moved = false;
		}
	}

	function onBoxKey(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		const cx = width / 2;
		const cy = viewH / 2;
		const step = 60;
		if (e.key === '+' || e.key === '=') zoomAt(1.2, cx, cy);
		else if (e.key === '-') zoomAt(1 / 1.2, cx, cy);
		else if (e.key === '0') resetView();
		else if (e.shiftKey && e.key === 'ArrowLeft') tx += step;
		else if (e.shiftKey && e.key === 'ArrowRight') tx -= step;
		else if (e.shiftKey && e.key === 'ArrowUp') ty += step;
		else if (e.shiftKey && e.key === 'ArrowDown') ty -= step;
		else return;
		e.preventDefault();
	}

	/* ---------- Highlight chain and tooltip ---------- */

	let active = $state<string | null>(null);
	const lit = $derived.by(() => {
		if (!active) return null;
		const { ancestors, descendants } = chain(layout.edges, active);
		return { ancestors, descendants };
	});

	function relation(id: string): 'self' | 'up' | 'down' | 'dim' | 'none' {
		if (!lit || !active) return 'none';
		if (id === active) return 'self';
		if (lit.ancestors.has(id)) return 'up';
		if (lit.descendants.has(id)) return 'down';
		return 'dim';
	}

	function edgeState(from: string, to: string): 'up' | 'down' | 'dim' | 'none' {
		if (!lit || !active) return 'none';
		const upSet = lit.ancestors;
		const downSet = lit.descendants;
		if ((to === active || upSet.has(to)) && (upSet.has(from) || from === active)) return 'up';
		if ((from === active || downSet.has(from)) && (downSet.has(to) || to === active)) return 'down';
		return 'dim';
	}

	const tip = $derived.by(() => {
		if (!active) return null;
		const n = layout.nodes.find((x) => x.id === active);
		const c = chapterById.get(active);
		if (!n || !c) return null;
		const half = 130;
		const cx = tx + (n.x + n.w / 2) * k;
		const left = Math.min(Math.max(cx, half), Math.max(half, width - half));
		const top = ty + (n.y + n.h) * k + 8;
		const summary = c.summary.length > 170 ? c.summary.slice(0, 167).trimEnd() + '…' : c.summary;
		return {
			left,
			top: Math.min(top, viewH - 8),
			title: c.title,
			topic: topicTitle.get(c.topic) ?? c.topic,
			minutes: minutesOf(c),
			status: STATUS_LABEL[statusOf(c.id)],
			summary,
		};
	});

	/** Keep a keyboard-focused node inside the viewport. */
	function reveal(id: string) {
		const n = layout.nodes.find((x) => x.id === id);
		if (!n) return;
		const pad = 24;
		const left = tx + n.x * k;
		const right = tx + (n.x + n.w) * k;
		const top = ty + n.y * k;
		const bottom = ty + (n.y + n.h) * k;
		if (left < pad) tx += pad - left;
		else if (right > width - pad) tx -= right - (width - pad);
		if (top < pad) ty += pad - top;
		else if (bottom > viewH - pad) ty -= bottom - (viewH - pad);
	}

	/** Reading time in minutes at the base level. */
	function minutesOf(c: ChapterEntry): number {
		const m = c.minutes;
		if (typeof m === 'number') return m;
		return m.c2 ?? m.c1 ?? m.c3 ?? m.c4 ?? 0;
	}
</script>

<div class="sitemap">
	<div class="bar">
		<div class="chips" role="group" aria-label="Фильтр карты по топику">
			<button
				class="chip chip-all"
				type="button"
				aria-pressed={filter === ''}
				onclick={() => (filter = '')}
			>
				Все
			</button>
			{#each topics as t (t.id)}
				<button
					class="chip"
					type="button"
					data-topic={t.id}
					aria-pressed={filter === t.id}
					onclick={() => (filter = filter === t.id ? '' : t.id)}
				>
					<span class="dot" aria-hidden="true"></span>{t.title}
				</button>
			{/each}
		</div>
		<div class="zoom" role="group" aria-label="Масштаб карты">
			<button
				type="button"
				aria-label="Уменьшить"
				onclick={() => zoomAt(1 / 1.25, width / 2, viewH / 2)}>−</button
			>
			<button
				type="button"
				aria-label="Увеличить"
				onclick={() => zoomAt(1.25, width / 2, viewH / 2)}>+</button
			>
			<button type="button" class="reset" onclick={resetView}>Сброс</button>
		</div>
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="viewport"
		class:panning
		class:pannable={k > fit * 1.01 || fit <= 0.5}
		style:height="{viewH}px"
		bind:this={box}
		bind:clientWidth={width}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onclickcapture={onClickCapture}
		onkeydown={onBoxKey}
		onmouseleave={() => (active = null)}
	>
		<svg
			class="canvas"
			width="100%"
			height={viewH}
			role="group"
			aria-label="Карта сайта: главы по топикам. Перемещайтесь клавишей Tab; Enter открывает главу. Плюс и минус меняют масштаб, Shift со стрелками двигает карту."
		>
			<g transform="translate({tx} {ty}) scale({k})">
				{#each layout.clusters as c (c.topic)}
					<g data-topic={c.topic}>
						<rect class="cluster" x={c.x} y={c.y} width={c.w} height={c.h} rx="14" />
						<text class="cluster-title" x={c.x + 14} y={c.y + 20}>{c.title}</text>
					</g>
				{/each}

				<g class="edges" aria-hidden="true">
					{#each layout.edges as e (e.from + '>' + e.to)}
						<path
							class="edge edge-{e.kind} is-{edgeState(e.from, e.to)}"
							class:cross={e.cross}
							d={e.d}
							marker-end="url(#sm-arrow)"
						/>
					{/each}
				</g>

				{#each layout.nodes as n (n.id)}
					{@const c = chapterById.get(n.id)}
					{@const st = statusOf(n.id)}
					{#if c}
						<g data-topic={n.topic}>
							<a
								class="node is-{st} rel-{relation(n.id)}"
								href={resolve(c.href as '/')}
								aria-label="{c.title}. {topicTitle.get(c.topic)}, {STATUS_LABEL[
									st
								]}, около {minutesOf(c)} мин"
								onmouseenter={() => (active = n.id)}
								onfocus={() => {
									active = n.id;
									reveal(n.id);
								}}
								onblur={() => (active = null)}
							>
								<rect x={n.x} y={n.y} width={n.w} height={n.h} rx="9" />
								{#each n.lines as line, i (i)}
									<text class="label" x={n.x + 10} y={n.y + 19 + i * 15}>{line}</text>
								{/each}
								<g class="status" transform="translate({n.x + n.w - 14} {n.y + 11})">
									<circle r="5" class="ring" />
									{#if st === 'started'}
										<path class="half" d="M0 -5 A5 5 0 0 1 0 5 Z" />
									{:else if st === 'done'}
										<circle r="5" class="full" />
										<path class="tick" d="M-2.5 0 L-0.8 2 L2.6 -2" />
									{/if}
								</g>
							</a>
						</g>
					{/if}
				{/each}
			</g>
			<defs>
				<marker
					id="sm-arrow"
					viewBox="0 0 8 8"
					refX="7"
					refY="4"
					markerWidth="8"
					markerHeight="8"
					markerUnits="userSpaceOnUse"
					orient="auto"
				>
					<path d="M0 0 L8 4 L0 8 Z" class="arrow" />
				</marker>
			</defs>
		</svg>

		{#if tip}
			<div class="tip" style:left="{tip.left}px" style:top="{tip.top}px" role="presentation">
				<strong>{tip.title}</strong>
				<span class="tip-meta">{tip.topic} · около {tip.minutes} мин · {tip.status}</span>
				<span class="tip-text">{tip.summary}</span>
			</div>
		{/if}
	</div>

	<ul class="legend" aria-label="Обозначения">
		<li><span class="sw sw-new"></span>не начата</li>
		<li><span class="sw sw-started"></span>в процессе</li>
		<li><span class="sw sw-done"></span>пройдена</li>
		<li><span class="ln ln-solid"></span>нужно знать до</li>
		<li><span class="ln ln-dash"></span>использует понятие</li>
	</ul>
	<p class="hint">
		Наведите или сфокусируйте главу, чтобы увидеть цепочку. Перетаскивание двигает карту, Ctrl и
		колесо меняют масштаб.
	</p>

	<details class="list">
		<summary>Список глав по топикам (текстовая версия карты)</summary>
		{#each topics as t (t.id)}
			<section data-topic={t.id}>
				<h3>{t.title}</h3>
				<ol>
					{#each t.chapterIds as id (id)}
						{@const c = chapterById.get(id)}
						{#if c}
							<li>
								<a href={resolve(c.href as '/')}>{c.title}</a>
								<span class="li-meta">{STATUS_LABEL[statusOf(id)]}, около {minutesOf(c)} мин</span>
								{#if c.prereqs.length}
									<span class="li-meta">
										· после: {c.prereqs.map((p) => chapterById.get(p)?.title ?? p).join(', ')}</span
									>
								{/if}
							</li>
						{/if}
					{/each}
				</ol>
			</section>
		{/each}
	</details>
</div>

<style>
	.sitemap {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.chips,
	.zoom {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chip,
	.zoom button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: 500;
		cursor: pointer;
	}
	.zoom button {
		min-width: 36px;
		justify-content: center;
		border-radius: 10px;
	}
	.chip:hover,
	.zoom button:hover {
		border-color: var(--topic, var(--accent));
	}
	.chip[aria-pressed='true'] {
		background: var(--topic-soft, var(--surface-2));
		border-color: var(--topic, var(--accent));
		font-weight: 600;
	}
	.chip-all[aria-pressed='true'] {
		background: var(--surface-2);
		border-color: var(--accent);
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--topic);
	}
	.viewport {
		position: relative;
		width: 100%;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--bg);
		touch-action: pan-y;
		cursor: grab;
	}
	.viewport.pannable {
		touch-action: none;
	}
	.viewport.panning {
		cursor: grabbing;
	}
	.viewport:focus-visible,
	.node:focus-visible rect {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.canvas {
		width: 100%;
		display: block;
		max-width: 100%;
		user-select: none;
	}
	.cluster {
		fill: var(--topic-soft);
		stroke: var(--topic);
		stroke-opacity: 0.5;
		stroke-width: 1;
	}
	.cluster-title {
		fill: var(--text);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.02em;
	}
	.edge {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.4;
		stroke-opacity: 0.55;
	}
	.edge-uses {
		stroke-dasharray: 5 4;
	}
	.edge.cross {
		stroke: var(--accent);
		stroke-opacity: 0.8;
	}
	.edge.is-up,
	.edge.is-down {
		stroke-opacity: 1;
		stroke-width: 2.4;
	}
	.edge.is-up {
		stroke: var(--accent);
	}
	.edge.is-down {
		stroke: var(--ok);
	}
	.edge.is-dim {
		stroke-opacity: 0.12;
	}
	.arrow {
		fill: var(--text-muted);
	}
	.node {
		cursor: pointer;
		outline: none;
	}
	.node rect {
		fill: var(--surface-2);
		stroke: var(--border);
		stroke-width: 1;
	}
	.node.is-started rect {
		fill: var(--surface);
		stroke: var(--topic);
		stroke-width: 1.8;
	}
	.node.is-done rect {
		fill: var(--surface);
		stroke: var(--topic);
		stroke-width: 2.4;
	}
	.label {
		fill: var(--text);
		font-size: 12px;
		pointer-events: none;
	}
	.ring {
		fill: var(--surface);
		stroke: var(--topic);
		stroke-width: 1.4;
	}
	.half {
		fill: var(--topic);
	}
	.full {
		fill: var(--topic);
	}
	.tick {
		fill: none;
		stroke: var(--surface);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.node:hover rect,
	.node.rel-self rect {
		stroke: var(--topic);
		stroke-width: 2.6;
	}
	.node.rel-up rect {
		stroke: var(--accent);
		stroke-width: 2.2;
	}
	.node.rel-down rect {
		stroke: var(--ok);
		stroke-width: 2.2;
	}
	.node.rel-dim {
		opacity: 0.28;
	}
	@media (prefers-reduced-motion: no-preference) {
		.node,
		.edge {
			transition:
				opacity 0.15s ease,
				stroke-opacity 0.15s ease;
		}
	}
	.tip {
		position: absolute;
		z-index: 2;
		display: grid;
		gap: 2px;
		width: 260px;
		max-width: calc(100% - 16px);
		transform: translateX(-50%);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.18);
		font-size: var(--fs-sm);
		line-height: 1.4;
		pointer-events: none;
	}
	.tip-meta {
		color: var(--text-muted);
		font-size: 12px;
	}
	.tip-text {
		color: var(--text);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.sw {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1.5px solid var(--accent);
		background: var(--surface);
	}
	.sw-started {
		background: linear-gradient(90deg, var(--surface) 50%, var(--accent) 50%);
	}
	.sw-done {
		background: var(--accent);
	}
	.ln {
		width: 22px;
		border-top: 2px solid var(--text-muted);
	}
	.ln-dash {
		border-top-style: dashed;
	}
	.hint {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.list {
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: var(--space-3) var(--space-4);
		background: var(--surface);
	}
	.list summary {
		cursor: pointer;
		font-weight: 600;
	}
	.list section {
		margin-top: var(--space-4);
	}
	.list h3 {
		font-size: var(--fs-body);
		color: var(--topic);
		margin: 0 0 var(--space-2);
	}
	.list ol {
		margin: 0;
		padding-left: var(--space-6);
		display: grid;
		gap: var(--space-1);
	}
	.list a {
		color: var(--accent);
	}
	.li-meta {
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
</style>
