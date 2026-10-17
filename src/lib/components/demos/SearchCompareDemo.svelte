<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		GRID_MAX,
		GRID_MIN,
		PEAK_WIDTH,
		PEAK_X,
		REPEATS,
		describeSearch,
		sanitizeSearchState,
		snapDraw,
		snapSide,
		summarizeSearch,
		type Point,
		type SearchState,
	} from '$lib/demos/search-compare';

	/** Grid search against random search: same budget, two hyperparameters, one of them matters. Registers as `search-compare`. */
	let { initial }: { initial?: Partial<SearchState> } = $props();

	/* svelte-ignore state_referenced_locally */
	const start = sanitizeSearchState(initial);
	let state = $state<SearchState>({ ...start });

	const s = $derived(summarizeSearch(state));
	const note = $derived(describeSearch(s));

	const S = 160;
	const PAD = 24;
	const W = 2 * S + 3 * PAD;
	const H = S + 2 * PAD + 14;
	/** Left edge of each panel. */
	const PANELS = [PAD, 2 * PAD + S];
	const sx = (v: number, panel: number): number => (PANELS[panel] ?? PAD) + v * S;
	const sy = (v: number): number => PAD + (1 - v) * S;

	function bestOf(pts: readonly Point[]): Point {
		return pts.reduce((a, b) => (b.score > a.score ? b : a));
	}
	const gridTop = $derived(bestOf(s.grid));
	const randTop = $derived(bestOf(s.random));

	function reset(): void {
		state = { ...start };
	}

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	onMount(() =>
		demos?.register('search-compare', {
			set: (patch) => {
				state = sanitizeSearchState({ ...state, ...(patch as Partial<SearchState>) });
			},
		}),
	);
</script>

<figure class="sc" id="demo-search-compare" data-demo="search-compare">
	<div class="sc-controls">
		<label class="sc-field">
			<span>Сетка {state.side}×{state.side}, бюджет {s.budget}</span>
			<input
				type="range"
				min={GRID_MIN}
				max={GRID_MAX}
				step="1"
				value={state.side}
				oninput={(e) => (state.side = snapSide(Number(e.currentTarget.value)))}
			/>
		</label>
		<button type="button" class="sc-btn" onclick={() => (state.draw = snapDraw(state.draw + 1))}
			>Другой случайный набор</button
		>
		<button type="button" class="sc-btn" onclick={reset}>Сбросить</button>
	</div>

	<svg class="sc-plot" viewBox="0 0 {W} {H}" role="img" aria-labelledby="sc-title sc-desc">
		<title id="sc-title">Перебор по сетке и случайный поиск при одинаковом бюджете</title>
		<desc id="sc-desc">{note}</desc>
		{#each PANELS as left, k (k)}
			<rect class="sc-frame" x={left} y={sy(1)} width={S} height={S} />
			<rect
				class="sc-peak"
				x={sx(PEAK_X - PEAK_WIDTH, k)}
				y={sy(1)}
				width={2 * PEAK_WIDTH * S}
				height={S}
			/>
			<text class="sc-cap" x={left + S / 2} y={H - 4}>{k === 0 ? 'Сетка' : 'Случайный поиск'}</text>
		{/each}
		{#each s.grid as p, i (i)}
			<circle class="sc-dot" cx={sx(p.x, 0)} cy={sy(p.y)} r="4" />
		{/each}
		{#each s.random as p, i (i)}
			<circle class="sc-dot sc-rand" cx={sx(p.x, 1)} cy={sy(p.y)} r="4" />
		{/each}
		<circle class="sc-best" cx={sx(gridTop.x, 0)} cy={sy(gridTop.y)} r="8" />
		<circle class="sc-best" cx={sx(randTop.x, 1)} cy={sy(randTop.y)} r="8" />
	</svg>

	<dl class="sc-stats">
		<dt>Сетка: значений важного параметра</dt>
		<dd>{s.gridDistinctX}</dd>
		<dt>Случайный поиск: значений важного параметра</dt>
		<dd>{s.randomDistinctX}</dd>
		<dt>Лучший результат, сетка</dt>
		<dd>{s.gridBest.toFixed(3)}</dd>
		<dt>Лучший результат, этот случайный набор</dt>
		<dd>{s.randomBest.toFixed(3)}</dd>
		<dt>Случайный поиск в среднем по {REPEATS} наборам</dt>
		<dd>{s.randomMean.toFixed(3)}</dd>
	</dl>

	<p class="sc-note" aria-live="polite">{note}</p>

	<div class="sc-notice">
		<p class="sc-h">Что заметить</p>
		<ul>
			<li>
				Важен только параметр по горизонтали (полоса показывает узкий пик качества). Точки сетки
				повторяют одни и те же значения по горизонтали, случайные точки все разные.
			</li>
			<li>
				Один случайный набор может проиграть сетке: кнопка показывает другие наборы. Среднее по {REPEATS}
				наборам выше результата сетки. Поверхность смоделирована, это не измерения.
			</li>
		</ul>
	</div>
</figure>

<style>
	.sc {
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
	.sc dl,
	.sc dd,
	.sc dt,
	.sc p,
	.sc ul {
		margin: 0;
	}
	.sc ul {
		padding-left: var(--space-4);
	}
	.sc-h {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.sc-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.sc-field {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
	}
	.sc-field input {
		accent-color: var(--topic);
		min-height: 32px;
	}
	.sc-btn {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}
	.sc-btn:focus-visible,
	.sc-field input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.sc-plot {
		display: block;
		width: 100%;
		max-width: 560px;
		height: auto;
		margin: var(--space-4) 0;
	}
	.sc-frame {
		fill: none;
		stroke: var(--border);
	}
	.sc-peak {
		fill: var(--topic);
		opacity: 0.14;
	}
	.sc-cap {
		fill: var(--text-muted);
		font-size: 11px;
		text-anchor: middle;
	}
	.sc-dot {
		fill: var(--cat-1);
	}
	.sc-rand {
		fill: var(--cat-2);
	}
	.sc-best {
		fill: none;
		stroke: var(--text);
		stroke-width: 1.5;
	}
	.sc-stats {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-4);
	}
	.sc-stats dt {
		color: var(--text-muted);
	}
	.sc-stats dd {
		font-family: var(--font-mono);
	}
	.sc-note {
		margin-top: var(--space-3);
	}
	.sc-notice {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
</style>
