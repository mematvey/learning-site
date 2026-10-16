<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { ProblemParams } from '$lib/prob/types';

	/** Problem 4 visual: fruit vase, sequential draw of three fruits without returning them. */
	let { params }: { params: ProblemParams } = $props();

	type Kind = 'mandarin' | 'orange' | 'lemon';

	const WORDS: Record<Kind, string> = { mandarin: 'мандарин', orange: 'апельсин', lemon: 'лимон' };
	const LETTERS: Record<Kind, string> = { mandarin: 'М', orange: 'А', lemon: 'Л' };
	const COLS = 5;
	const STEP_X = 24;
	const STEP_Y = 26;
	const DELAY_MS = 450;

	const count = (key: string): number => Math.max(0, Math.floor(params[key] ?? 0));

	/** Fruit ids are indices into this list; the list order is fixed for the current params. */
	const fruits = $derived.by(() => {
		const list: Kind[] = [];
		const groups: Array<[Kind, string]> = [
			['mandarin', 'mandarins'],
			['orange', 'oranges'],
			['lemon', 'lemons'],
		];
		for (const [kind, key] of groups) {
			for (let i = 0; i < count(key); i++) list.push(kind);
		}
		return list;
	});

	const key = $derived(`${count('mandarins')}/${count('oranges')}/${count('lemons')}`);

	// Draw view is tied to the params key: changing params resets the draw.
	let view: { key: string; picked: number[] } = $state({ key: '', picked: [] });
	let busy = $state(false);
	let timers: ReturnType<typeof setTimeout>[] = [];

	const picked = $derived(view.key === key ? view.picked : []);
	const seq = $derived(picked.map((id) => fruits[id]).filter((k): k is Kind => k !== undefined));

	const sequenceA = $derived(
		seq.length === 3 && seq[0] === 'lemon' && seq[1] === 'orange' && seq[2] === 'mandarin',
	);
	const sequenceB = $derived(seq.length === 3 && new Set(seq).size === 3);

	const verdict = (ok: boolean): string => {
		if (seq.length < 3) return 'ещё не все фрукты вынуты';
		return ok ? 'выполнено' : 'не выполнено';
	};

	const slots = $derived(
		fruits.map((kind, id) => ({
			id,
			kind,
			cx: 52 + (id % COLS) * STEP_X,
			cy: 200 - Math.floor(id / COLS) * STEP_Y,
		})),
	);

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
		const ids = Array.from(fruits, (_, i) => i);
		// Partial Fisher–Yates: the first three positions form a uniform ordered sample.
		const n = Math.min(3, ids.length);
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
</script>

<div class="vase">
	<svg
		class="vase-svg"
		viewBox="0 0 200 240"
		role="img"
		aria-label="Ваза: лимонов {count('lemons')}, апельсинов {count('oranges')}, мандаринов {count(
			'mandarins',
		)}"
	>
		<path
			class="body"
			d="M 78 20 H 122 V 60 C 170 80 180 120 175 160 C 170 205 150 228 100 228 C 50 228 30 205 25 160 C 20 120 30 80 78 60 Z"
		/>
		{#each slots as f (f.id)}
			<g class="fruit k-{f.kind}" class:gone={picked.includes(f.id)}>
				<circle cx={f.cx} cy={f.cy} r="11" />
				<text x={f.cx} y={f.cy + 4} text-anchor="middle">{LETTERS[f.kind]}</text>
			</g>
		{/each}
	</svg>

	<ol class="seq" aria-label="Вынутые фрукты по порядку">
		{#each [0, 1, 2] as i (i)}
			{@const k = seq[i]}
			<li
				class="chip"
				class:empty={k === undefined}
				class:k-mandarin={k === 'mandarin'}
				class:k-orange={k === 'orange'}
				class:k-lemon={k === 'lemon'}
			>
				<span class="dot" aria-hidden="true">{k ? LETTERS[k] : '·'}</span>
				<span>{k ? WORDS[k] : `${i + 1}-й`}</span>
			</li>
		{/each}
	</ol>

	<div class="controls">
		<button type="button" class="btn" onclick={draw} disabled={busy || fruits.length < 3}>
			Вынуть три по одному
		</button>
		<button type="button" class="btn ghost" onclick={reset} disabled={busy}>Вернуть в вазу</button>
	</div>

	<ul class="verdicts" aria-live="polite">
		<li>а) лимон, апельсин, мандарин по порядку: <strong>{verdict(sequenceA)}</strong></li>
		<li>б) три разных фрукта: <strong>{verdict(sequenceB)}</strong></li>
	</ul>
</div>

<style>
	.vase {
		display: grid;
		gap: var(--space-4);
		justify-items: center;
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
	}
	.vase-svg {
		width: min(100%, 220px);
		height: auto;
	}
	.body {
		fill: var(--surface-2);
		stroke: var(--border);
		stroke-width: 2;
	}
	.fruit circle {
		stroke: var(--border);
		stroke-width: 1;
		transition: opacity var(--dur) var(--ease);
	}
	.fruit text {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 700;
		fill: var(--surface);
		transition: opacity var(--dur) var(--ease);
	}
	.fruit.gone {
		opacity: 0.15;
	}
	.k-mandarin circle {
		fill: var(--warn);
	}
	.k-orange circle {
		fill: var(--cat-2);
	}
	.k-lemon circle {
		fill: var(--cat-3);
	}
	.seq {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.chip.empty {
		color: var(--text-muted);
		border-style: dashed;
	}
	.dot {
		display: inline-grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--text-muted);
		color: var(--surface);
		font-weight: 700;
		font-size: 12px;
	}
	.chip.k-mandarin .dot {
		background: var(--warn);
	}
	.chip.k-orange .dot {
		background: var(--cat-2);
	}
	.chip.k-lemon .dot {
		background: var(--cat-3);
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
	.btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.verdicts {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--space-1);
		text-align: left;
		width: 100%;
	}
	.verdicts strong {
		color: var(--text);
	}
</style>
