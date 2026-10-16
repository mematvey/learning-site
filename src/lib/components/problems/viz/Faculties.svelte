<script lang="ts">
	import { onDestroy } from 'svelte';

	/** Random split of `total` people into two faculties of equal size; medalists are highlighted. */
	let { total, medalists, k }: { total: number; medalists: number; k: number } = $props();

	const FRAMES = 10;
	const FRAME_MS = 70;

	function identity(n: number): number[] {
		return Array.from({ length: n }, (_, i) => i);
	}

	/** mulberry32: small seeded PRNG, so one seed gives one layout. */
	function mulberry32(seed: number): () => number {
		let s = seed >>> 0;
		return () => {
			s = (s + 0x6d2b79f5) >>> 0;
			let t = s;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	/** Fisher–Yates permutation of person ids for the given seed; ids below `medalists` are medalists. */
	function shuffled(n: number, seed: number): number[] {
		const a = identity(n);
		const rng = mulberry32(seed);
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			[a[i], a[j]] = [a[j] as number, a[i] as number];
		}
		return a;
	}

	const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);

	/** Seed of the current layout; a new seed is drawn on each shuffle. */
	let layout = $state(newSeed());
	let shuffling = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;

	const order = $derived(shuffled(total, layout));

	onDestroy(() => clearInterval(timer));

	const half = $derived(Math.floor(total / 2));
	const people = $derived(order.map((id) => ({ id, med: id < medalists })));
	const facA = $derived(people.slice(0, half));
	const facB = $derived(people.slice(half));
	const mA = $derived(facA.filter((p) => p.med).length);
	const mB = $derived(medalists - mA);

	/** Which event (if any) the current layout realises. */
	const outcome = $derived.by(() => {
		if (mA === 0 || mA === medalists) return 'one';
		if (mA === k || mA === medalists - k) return 'split';
		return 'other';
	});

	const caption = $derived.by(() => {
		if (shuffling) return 'Перемешиваем…';
		if (outcome === 'one') return `Все ${medalists} медалистов на одном факультете.`;
		if (outcome === 'split')
			return `Получилось ${mA} и ${mB}: на одном факультете ${k}, на другом ${medalists - k}.`;
		return `Получилось ${mA} и ${mB}: ни «все на одном», ни «${k} и ${medalists - k}».`;
	});

	function draw(): void {
		if (shuffling) return;
		const reduce =
			typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduce) {
			layout = newSeed();
			return;
		}
		shuffling = true;
		let frame = 0;
		clearInterval(timer);
		timer = setInterval(() => {
			frame += 1;
			layout = newSeed();
			if (frame >= FRAMES) {
				clearInterval(timer);
				shuffling = false;
			}
		}, FRAME_MS);
	}
</script>

<div class="fac">
	<div class="cols">
		{#each [{ name: 'Факультет 1', list: facA, m: mA }, { name: 'Факультет 2', list: facB, m: mB }] as col (col.name)}
			<section class="col" aria-label="{col.name}: {col.list.length} человек, медалистов {col.m}">
				<h4>{col.name} <span class="count">{col.list.length} чел.</span></h4>
				<ul class="tiles">
					{#each col.list as p (p.id)}
						<li class="tile" class:med={p.med}>
							<span class="sr-only">{p.med ? 'медалист' : 'не медалист'}</span>
							{#if p.med}<span aria-hidden="true">★</span>{/if}
						</li>
					{/each}
				</ul>
				<p class="med-count">Медалистов: <strong>{col.m}</strong></p>
			</section>
		{/each}
	</div>

	<div class="controls">
		<button type="button" class="btn" onclick={draw} disabled={shuffling}>
			Случайная раскладка
		</button>
		<ul class="legend" aria-hidden="true">
			<li><span class="swatch med"></span> медалист</li>
			<li><span class="swatch"></span> остальные</li>
		</ul>
	</div>

	<p class="caption" aria-live="polite" data-outcome={outcome}>{caption}</p>
</div>

<style>
	.fac {
		display: grid;
		gap: var(--space-4);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-4);
	}
	.col {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-3);
		min-width: 0;
	}
	h4 {
		margin: 0 0 var(--space-2);
		font-family: var(--font-serif);
		font-size: var(--fs-base);
		font-weight: 600;
	}
	.count,
	.med-count {
		color: var(--text-muted);
		font-weight: 400;
	}
	.tiles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		min-height: 80px;
	}
	.tile {
		width: 26px;
		height: 26px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--surface);
		display: grid;
		place-items: center;
		font-size: 12px;
		color: var(--surface);
		transition: background-color var(--dur-fast) var(--ease);
	}
	.tile.med {
		background: var(--topic);
		border-color: var(--topic);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-4);
	}
	.btn {
		min-height: 36px;
		padding: 0 var(--space-4);
		border-radius: var(--radius);
		border: 1px solid var(--topic);
		background: var(--topic);
		color: var(--surface);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.btn:hover:not(:disabled) {
		filter: brightness(1.08);
	}
	.btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.legend {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		gap: var(--space-3);
		color: var(--text-muted);
	}
	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 3px;
		border: 1px solid var(--border);
		background: var(--surface);
		vertical-align: -1px;
	}
	.swatch.med {
		background: var(--topic);
		border-color: var(--topic);
	}
	.caption {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--topic);
		background: var(--topic-soft);
		border-radius: var(--radius-sm);
		font-size: var(--fs-base);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	@media (max-width: 420px) {
		.cols {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.tile {
			transition: none;
		}
	}
</style>
