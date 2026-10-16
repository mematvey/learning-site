<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { ProblemParams } from '$lib/prob/types';

	/** Problem 5 visual: urn of parts (standard / defective), sample of n without return, probability tree. */
	let { params }: { params: ProblemParams } = $props();

	type Part = 'S' | 'D';

	const DELAY_MS = 450;
	const TREE_MAX_N = 3;
	const TREE_W = 360;
	const LEVEL_H = 56;
	const TOP = 16;

	const LABEL: Record<Part, string> = { S: 'стандартная', D: 'бракованная' };
	const SHORT: Record<Part, string> = { S: 'С', D: 'Б' };

	const total = $derived(Math.max(0, Math.floor(params.N ?? 0)));
	const good = $derived(Math.min(total, Math.max(0, Math.floor(params.good ?? 0))));
	const bad = $derived(total - good);
	const sampleSize = $derived(Math.max(0, Math.floor(params.n ?? 0)));

	const parts = $derived.by(() => {
		const list: Part[] = [];
		for (let i = 0; i < total; i++) list.push(i < good ? 'S' : 'D');
		return list;
	});

	const key = $derived(`${total}/${good}/${sampleSize}`);

	// Draw view is tied to the params key: changing params resets the draw.
	let view: { key: string; picked: number[] } = $state({ key: '', picked: [] });
	let busy = $state(false);
	let timers: ReturnType<typeof setTimeout>[] = [];

	const picked = $derived(view.key === key ? view.picked : []);
	const sample = $derived(picked.map((id) => parts[id]).filter((p): p is Part => p !== undefined));

	type Question = 'a' | 'b' | 'c';
	const QUESTIONS: Array<{ key: Question; label: string }> = [
		{ key: 'a', label: 'а) все стандартные' },
		{ key: 'b', label: 'б) вторая бракованная' },
		{ key: 'c', label: 'в) ровно одна бракованная' },
	];
	let question = $state<Question>('a');

	function hits(q: Question, path: string): boolean {
		if (q === 'a') return !path.includes(SHORT.D);
		if (q === 'b') return path.length >= 2 && path[1] === SHORT.D;
		return path.split(SHORT.D).length - 1 === 1;
	}

	interface TreeNode {
		depth: number;
		path: string;
		x: number;
		kids: Array<{ node: TreeNode; label: string }>;
	}

	/** Probability tree without return: edge labels are the conditional counts, branches with zero count are dropped. */
	function grow(depth: number, sUsed: number, dUsed: number, path: string): TreeNode {
		const node: TreeNode = { depth, path, x: 0, kids: [] };
		if (depth >= sampleSize) return node;
		const left = total - depth;
		const sLeft = good - sUsed;
		const dLeft = bad - dUsed;
		if (sLeft > 0) {
			node.kids.push({
				node: grow(depth + 1, sUsed + 1, dUsed, path + SHORT.S),
				label: `${sLeft}/${left}`,
			});
		}
		if (dLeft > 0) {
			node.kids.push({
				node: grow(depth + 1, sUsed, dUsed + 1, path + SHORT.D),
				label: `${dLeft}/${left}`,
			});
		}
		return node;
	}

	const tree = $derived.by(() => {
		if (sampleSize < 1 || sampleSize > TREE_MAX_N || sampleSize > total) return null;
		const root = grow(0, 0, 0, '');
		const leaves: TreeNode[] = [];
		const collect = (node: TreeNode): void => {
			if (node.kids.length === 0) {
				leaves.push(node);
				return;
			}
			node.kids.forEach((k) => collect(k.node));
		};
		collect(root);
		const width = leaves.length;
		leaves.forEach((leaf, i) => {
			leaf.x = ((i + 0.5) * TREE_W) / width;
		});
		const place = (node: TreeNode): number => {
			if (node.kids.length === 0) return node.x;
			const xs = node.kids.map((k) => place(k.node));
			node.x = xs.reduce((s, x) => s + x, 0) / xs.length;
			return node.x;
		};
		place(root);
		const edges: Array<{ x1: number; y1: number; x2: number; y2: number; label: string }> = [];
		const nodes: Array<{ x: number; y: number; path: string; leaf: boolean }> = [];
		const walk = (node: TreeNode): void => {
			const y = TOP + node.depth * LEVEL_H;
			nodes.push({ x: node.x, y, path: node.path, leaf: node.kids.length === 0 });
			for (const k of node.kids) {
				edges.push({
					x1: node.x,
					y1: y,
					x2: k.node.x,
					y2: TOP + k.node.depth * LEVEL_H,
					label: k.label,
				});
				walk(k.node);
			}
		};
		walk(root);
		const height = TOP + sampleSize * LEVEL_H + 12;
		return { nodes, edges, height, leafCount: width };
	});

	function reducedMotion(): boolean {
		return (
			typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	function clearTimers(): void {
		for (const t of timers) clearTimeout(t);
		timers = [];
	}

	onDestroy(clearTimers);

	function draw(): void {
		clearTimers();
		const ids = Array.from(parts, (_, i) => i);
		const n = Math.min(sampleSize, ids.length);
		// Partial Fisher–Yates: the first n positions form a uniform ordered sample without replacement.
		for (let i = 0; i < n; i++) {
			const j = i + Math.floor(Math.random() * (ids.length - i));
			const a = ids[i] ?? 0;
			const b = ids[j] ?? 0;
			ids[i] = b;
			ids[j] = a;
		}
		const order = ids.slice(0, n);
		const currentKey = key;
		view = { key: currentKey, picked: [] };
		if (order.length === 0) return;
		if (reducedMotion()) {
			view = { key: currentKey, picked: order };
			return;
		}
		busy = true;
		order.forEach((_, step) => {
			timers.push(
				setTimeout(
					() => {
						view = { key: currentKey, picked: order.slice(0, step + 1) };
						if (step === order.length - 1) busy = false;
					},
					(step + 1) * DELAY_MS,
				),
			);
		});
	}

	function reset(): void {
		clearTimers();
		busy = false;
		view = { key, picked: [] };
	}

	const gridStyle = $derived(`--cols: ${Math.min(10, Math.max(1, total))}`);
</script>

<div class="urn">
	<div
		class="grid"
		style={gridStyle}
		role="img"
		aria-label="Партия: стандартных {good}, бракованных {bad}"
	>
		{#each parts as p, id (id)}
			<span
				class="part {p === 'S' ? 'std' : 'def'}"
				class:gone={picked.includes(id)}
				title={LABEL[p]}
			></span>
		{/each}
	</div>
	<p class="legend">
		<span class="swatch std"></span> стандартные {good}
		<span class="swatch def"></span> бракованные {bad}
	</p>

	<ol class="sample" aria-label="Выборка по порядку">
		{#each Array.from({ length: sampleSize }, (_, i) => i) as i (i)}
			{@const p = sample[i]}
			<li class="chip" class:empty={p === undefined} class:def={p === 'D'} class:std={p === 'S'}>
				<span class="num">{i + 1}-я</span>
				<span>{p ? LABEL[p] : '—'}</span>
			</li>
		{/each}
	</ol>

	<div class="controls">
		<button
			type="button"
			class="btn"
			onclick={draw}
			disabled={busy || sampleSize < 1 || sampleSize > total}
		>
			Выбрать {sampleSize} без возврата
		</button>
		<button type="button" class="btn ghost" onclick={reset} disabled={busy}>Вернуть в партию</button
		>
	</div>

	{#if tree}
		<div class="tree-head" role="group" aria-label="Событие для дерева">
			{#each QUESTIONS as q (q.key)}
				<button
					type="button"
					class="pill"
					aria-pressed={question === q.key}
					onclick={() => (question = q.key)}
				>
					{q.label}
				</button>
			{/each}
		</div>
		<svg
			class="tree"
			viewBox="0 0 {TREE_W} {tree.height}"
			role="img"
			aria-label="Дерево вероятностей выборки без возврата"
		>
			{#each tree.edges as e, i (i)}
				<line class="edge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
				<text
					class="edge-label"
					text-anchor={e.x2 < e.x1 ? 'end' : 'start'}
					x={(e.x1 + e.x2) / 2 + (e.x2 < e.x1 ? -4 : 4)}
					y={(e.y1 + e.y2) / 2 - 2}>{e.label}</text
				>
			{/each}
			{#each tree.nodes as nd, i (i)}
				{#if nd.leaf}
					<circle class="node" class:hit={hits(question, nd.path)} cx={nd.x} cy={nd.y} r="5" />
					<text class="leaf-label" x={nd.x} y={nd.y + 18} text-anchor="middle">{nd.path}</text>
				{:else}
					<circle class="inner" cx={nd.x} cy={nd.y} r="3" />
				{/if}
			{/each}
		</svg>
		<p class="note">
			Ветви: С — стандартная, Б — бракованная. Подпись на ветви — «число нужных / осталось».
			Выделены исходы события «{QUESTIONS.find((q) => q.key === question)?.label.slice(3)}».
		</p>
	{:else}
		<p class="note">Дерево показано для n от 1 до {TREE_MAX_N} при N ≥ n.</p>
	{/if}
</div>

<style>
	.urn {
		display: grid;
		gap: var(--space-4);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 4px;
		max-width: 360px;
		width: 100%;
		justify-self: center;
	}
	.part {
		display: block;
		aspect-ratio: 1;
		border-radius: 4px;
		transition: opacity var(--dur) var(--ease);
	}
	.part.std {
		background: var(--cat-1);
	}
	.part.def {
		background: var(--fail);
	}
	.part.gone {
		opacity: 0.2;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		color: var(--text-muted);
	}
	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}
	.swatch.std {
		background: var(--cat-1);
	}
	.swatch.def {
		background: var(--fail);
	}
	.sample {
		display: grid;
		gap: var(--space-1);
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.chip {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.chip.empty {
		color: var(--text-muted);
		border-style: dashed;
	}
	.num {
		font-weight: 600;
		min-width: 40px;
	}
	.chip.def {
		border-color: var(--fail);
	}
	.chip.std {
		border-color: var(--cat-1);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
	}
	.btn {
		min-height: 40px;
		padding: var(--space-2) var(--space-4);
		border: 1px solid var(--topic);
		border-radius: var(--radius);
		background: var(--topic);
		color: var(--surface);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.btn.ghost {
		background: transparent;
		color: var(--topic);
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.btn:focus-visible,
	.pill:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.tree-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
	}
	.pill {
		min-height: 36px;
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}
	.pill[aria-pressed='true'] {
		border-color: var(--topic);
		background: var(--topic-soft);
		color: var(--topic);
		font-weight: 600;
	}
	.tree {
		width: 100%;
		max-width: 360px;
		height: auto;
		overflow: visible;
	}
	.edge {
		stroke: var(--border);
		stroke-width: 1.5;
	}
	.edge-label,
	.leaf-label {
		font-family: var(--font-sans);
		font-size: 12px;
		fill: var(--text-muted);
	}
	.node {
		fill: var(--surface);
		stroke: var(--text-muted);
		stroke-width: 1.5;
		transition: fill var(--dur) var(--ease);
	}
	.node.hit {
		fill: var(--topic);
		stroke: var(--topic);
	}
	.inner {
		fill: var(--text-muted);
	}
	.note {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
</style>
