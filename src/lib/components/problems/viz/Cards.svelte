<script lang="ts">
	import { onDestroy } from 'svelte';
	import katex from 'katex';
	import { multinomial, nPr } from '$lib/prob/comb';

	/**
	 * Cards with digits: the child lays `draw` cards from `pool` in a row and the panel
	 * shows how many different layouts exist. A layout equal to `target` is highlighted.
	 */
	let {
		pool,
		draw,
		target,
		mode,
	}: {
		/** Labels of all cards, e.g. [1, 2, 3, 4, 5, 6] or [1, 1, 1, 2, 2, 3]. */
		pool: number[];
		/** How many cards are laid out in the row. */
		draw: number;
		/** Target sequence (same length as `draw`). */
		target: number[];
		/** `arrangement`: ordered draw of distinct cards; `multinomial`: all cards, repeated labels. */
		mode: 'arrangement' | 'multinomial';
	} = $props();

	const SHUFFLE_STEPS = 8;
	const STEP_MS = 70;

	let shuffled: number[] | null = $state(null);
	let spinning = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const sameMultiset = (a: number[], b: number[]): boolean =>
		[...a].sort((x, y) => x - y).join(',') === [...b].sort((x, y) => x - y).join(',');

	const N = $derived(pool.length);
	const d = $derived(Math.max(0, Math.min(draw, N)));
	// Before the first shuffle the row is laid out in reverse, so it never shows the target by accident.
	const current = $derived(
		shuffled !== null && sameMultiset(shuffled, pool) ? shuffled : pool.slice().reverse(),
	);
	const laid = $derived(current.slice(0, d));
	const rest = $derived(current.slice(d));
	const isHit = $derived(
		shuffled !== null && laid.length === target.length && laid.every((v, i) => v === target[i]),
	);

	const counts = $derived(
		Object.values(
			pool.reduce<Record<number, number>>((acc, v) => {
				acc[v] = (acc[v] ?? 0) + 1;
				return acc;
			}, {}),
		),
	);
	const total = $derived(mode === 'arrangement' ? nPr(N, d) : multinomial(counts));

	const formula = $derived.by(() => {
		if (mode === 'arrangement') {
			const product = Array.from({ length: d }, (_, i) => N - i).join('\\cdot ');
			return `A_{${N}}^{${d}} = ${product} = ${total}`;
		}
		const denominator = counts.map((c) => `${c}!`).join('\\,');
		return `P_{${N}}(${counts.join(', ')}) = \\dfrac{${N}!}{${denominator}} = ${total}`;
	});

	/** Renders TeX into the node; the source is built from integers only. */
	function tex(node: HTMLElement, source: string) {
		const render = (s: string): void => {
			katex.render(s, node, { throwOnError: false, strict: 'ignore' });
		};
		render(source);
		return { update: render };
	}

	function shuffleOnce(): number[] {
		const a = pool.slice();
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const ai = a[i] ?? 0;
			a[i] = a[j] ?? 0;
			a[j] = ai;
		}
		return a;
	}

	function cancel(): void {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		spinning = false;
	}

	function shuffle(): void {
		cancel();
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced) {
			shuffled = shuffleOnce();
			return;
		}
		spinning = true;
		let step = 0;
		const tick = (): void => {
			step += 1;
			shuffled = shuffleOnce();
			if (step < SHUFFLE_STEPS) timer = setTimeout(tick, STEP_MS);
			else cancel();
		};
		tick();
	}

	onDestroy(cancel);
</script>

<div class="cd">
	<div class="cd-controls">
		<button type="button" class="cd-btn" onclick={shuffle}>Перемешать</button>
		<span class="cd-target">Целевое число: <b>{target.join('')}</b></span>
	</div>

	<div class="cd-row" role="group" aria-label="Выложенные карточки">
		{#each laid as v, i (i)}
			<span class="cd-card" class:is-hit={isHit} class:is-spin={spinning}>{v}</span>
		{/each}
	</div>

	{#if rest.length > 0}
		<div class="cd-row cd-rest" role="group" aria-label="Карточки в колоде">
			{#each rest as v, i (i)}
				<span class="cd-mini">{v}</span>
			{/each}
		</div>
	{/if}

	<p class="cd-result" aria-live="polite">
		{#if shuffled === null}
			Нажмите «Перемешать», чтобы выложить карточки.
		{:else}
			Получилось число <b>{laid.join('')}</b>:
			{isHit ? 'совпало с целевым.' : 'не совпало с целевым.'}
		{/if}
	</p>

	<div class="cd-formula">
		<p class="cd-count">
			Различных выкладок: <b>{total.toString()}</b>. Целевая одна, P = 1/{total.toString()}.
		</p>
		<div class="cd-tex" use:tex={formula}></div>
	</div>
</div>

<style>
	.cd {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
	}
	.cd-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-4);
	}
	.cd-target {
		color: var(--text-muted);
	}
	.cd-target b,
	.cd-result b,
	.cd-count b {
		font-family: var(--font-mono);
		font-weight: 500;
		color: var(--text);
	}
	.cd-btn {
		font: inherit;
		font-size: var(--fs-sm);
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius);
		border: 1px solid var(--topic);
		background: var(--topic);
		color: var(--surface);
		cursor: pointer;
		transition: opacity var(--dur-fast) var(--ease);
	}
	.cd-btn:hover {
		opacity: 0.9;
	}
	.cd-btn:focus-visible,
	.cd-card:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.cd-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.cd-card {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		height: 60px;
		padding: 0 var(--space-2);
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--surface);
		box-shadow: var(--shadow);
		font-family: var(--font-serif);
		font-size: 26px;
		font-weight: 600;
		color: var(--text);
		transition:
			border-color var(--dur) var(--ease),
			background var(--dur) var(--ease);
	}
	.cd-card.is-hit {
		border: 2px solid var(--topic);
		background: var(--topic-soft);
	}
	.cd-card.is-spin {
		animation: cd-jiggle var(--dur) var(--ease) infinite alternate;
	}
	.cd-rest {
		gap: var(--space-1);
	}
	.cd-mini {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 28px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.cd-result {
		margin: 0;
		min-height: 1.5em;
	}
	.cd-formula {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	.cd-count {
		margin: 0;
	}
	.cd-tex {
		overflow-x: auto;
		max-width: 100%;
	}

	@keyframes cd-jiggle {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-4px) rotate(-2deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cd-card.is-spin {
			animation: none;
		}
		.cd-card,
		.cd-btn {
			transition: none;
		}
	}
</style>
