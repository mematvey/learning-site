<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		ACC_DOMAIN,
		DIFF_DOMAIN,
		N_DEFAULT,
		N_MAX,
		N_MIN,
		N_STEP,
		type EvaluationDemoState,
		describeState,
		expectedCounts,
		fmt,
		sampleCounts,
		scaleX,
		snapN,
		snapSeed,
		summarize,
		verdictOf,
	} from '$lib/demos/evaluation';

	/** Two model versions on one evaluation set; the interval depends on the set size. Registers as demo `evaluation`. */
	let { initial }: { initial?: Partial<EvaluationDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let n = $state(snapN(initial?.n ?? N_DEFAULT));
	/* svelte-ignore state_referenced_locally */
	let seed = $state<number | null>(snapSeed(initial?.seed ?? null));
	/** Real width of the charts in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wPlot = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const counts = $derived(seed === null ? expectedCounts(n) : sampleCounts(n, seed));
	const s = $derived(summarize(counts));
	const verdict = $derived(verdictOf(s));
	const note = $derived(describeState(counts, s));
	const plotW = $derived(wPlot >= 200 ? wPlot : 320);

	/* Layout of the accuracy chart: labels on the left, axis at the bottom. */
	const X0 = $derived(plotW < 360 ? 28 : 40);
	const X1 = $derived(plotW - 12);
	const ACC_TICKS = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
	const DIFF_TICKS = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];

	function apply(patch: Partial<EvaluationDemoState>): void {
		if (typeof patch.n === 'number') n = snapN(patch.n);
		if ('seed' in patch) seed = snapSeed(patch.seed ?? null);
	}

	function newSet(): void {
		seed = (seed ?? 0) + 1;
	}

	function reset(): void {
		n = N_DEFAULT;
		seed = null;
	}

	onMount(() => {
		return demos?.register('evaluation', {
			set: (patch) => apply(patch as Partial<EvaluationDemoState>),
		});
	});
</script>

<figure class="ev" id="demo-evaluation" data-demo="evaluation">
	<div class="ev-controls">
		<label class="ev-ctl">
			<span class="ev-label"><span class="ev-sym">n</span> (размер набора)</span>
			<input
				class="ev-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step={N_STEP}
				value={n}
				oninput={(e) => (n = snapN(Number(e.currentTarget.value)))}
			/>
			<output class="ev-val">{n}</output>
		</label>

		<div class="ev-buttons">
			<button type="button" class="ev-btn" onclick={newSet}>Другой набор</button>
			<button type="button" class="ev-btn ev-btn-ghost" onclick={reset}>Сбросить</button>
		</div>
		<p class="ev-set">
			{#if seed === null}
				Ожидаемый состав набора (без случайности).
			{:else}
				Случайный набор, seed {seed}.
			{/if}
		</p>
	</div>

	<div class="ev-plots" bind:clientWidth={wPlot}>
		<div class="ev-panel">
			<p class="ev-panel-t">Точность двух версий <span class="ev-muted">95 % интервал</span></p>
			<svg
				class="ev-svg ev-svg-acc"
				viewBox="0 0 {plotW} 124"
				role="img"
				aria-labelledby="ev-acc-title ev-acc-desc"
			>
				<title id="ev-acc-title">Точность модели A и модели B с 95 % интервалами</title>
				<desc id="ev-acc-desc">
					A: {fmt(s.accA)}, интервал от {fmt(s.ciA[0])} до {fmt(s.ciA[1])}. B: {fmt(s.accB)},
					интервал от
					{fmt(s.ciB[0])} до {fmt(s.ciB[1])}.
				</desc>
				{#each ACC_TICKS as t (t)}
					<line
						class="ev-grid"
						x1={scaleX(t, ACC_DOMAIN, X0, X1).toFixed(1)}
						x2={scaleX(t, ACC_DOMAIN, X0, X1).toFixed(1)}
						y1="6"
						y2="94"
					/>
					<text class="ev-tick" x={scaleX(t, ACC_DOMAIN, X0, X1).toFixed(1)} y="114"
						>{fmt(t, 1)}</text
					>
				{/each}

				<text class="ev-row-label ev-cat-a" x="0" y="34">A</text>
				<line
					class="ev-ci ev-ci-a"
					x1={scaleX(s.ciA[0], ACC_DOMAIN, X0, X1).toFixed(1)}
					x2={scaleX(s.ciA[1], ACC_DOMAIN, X0, X1).toFixed(1)}
					y1="34"
					y2="34"
				/>
				<circle
					class="ev-dot ev-dot-a"
					cx={scaleX(s.accA, ACC_DOMAIN, X0, X1).toFixed(1)}
					cy="34"
					r="5"
				/>

				<text class="ev-row-label ev-cat-b" x="0" y="74">B</text>
				<line
					class="ev-ci ev-ci-b"
					x1={scaleX(s.ciB[0], ACC_DOMAIN, X0, X1).toFixed(1)}
					x2={scaleX(s.ciB[1], ACC_DOMAIN, X0, X1).toFixed(1)}
					y1="74"
					y2="74"
				/>
				<circle
					class="ev-dot ev-dot-b"
					cx={scaleX(s.accB, ACC_DOMAIN, X0, X1).toFixed(1)}
					cy="74"
					r="5"
				/>
			</svg>
		</div>

		<div class="ev-panel">
			<p class="ev-panel-t">Разница A − B <span class="ev-muted">95 % интервал</span></p>
			<svg
				class="ev-svg ev-svg-diff"
				viewBox="0 0 {plotW} 150"
				role="img"
				aria-labelledby="ev-diff-title ev-diff-desc"
			>
				<title id="ev-diff-title">Разница точностей: парный и непарный интервалы</title>
				<desc id="ev-diff-desc">
					Разница {fmt(s.diff)}. Парный интервал от {fmt(s.pairedCi[0])} до {fmt(s.pairedCi[1])},
					непарный от {fmt(s.unpairedCi[0])} до {fmt(s.unpairedCi[1])}.
				</desc>
				<line
					class="ev-zero"
					x1={scaleX(0, DIFF_DOMAIN, X0, X1).toFixed(1)}
					x2={scaleX(0, DIFF_DOMAIN, X0, X1).toFixed(1)}
					y1="6"
					y2="108"
				/>
				{#each DIFF_TICKS as t (t)}
					<text class="ev-tick" x={scaleX(t, DIFF_DOMAIN, X0, X1).toFixed(1)} y="132"
						>{fmt(t, 1)}</text
					>
				{/each}

				<text class="ev-row-label" x="0" y="40">парн.</text>
				<line
					class="ev-ci ev-ci-paired"
					x1={scaleX(s.pairedCi[0], DIFF_DOMAIN, X0, X1).toFixed(1)}
					x2={scaleX(s.pairedCi[1], DIFF_DOMAIN, X0, X1).toFixed(1)}
					y1="40"
					y2="40"
				/>
				<circle
					class="ev-dot ev-dot-paired"
					cx={scaleX(s.diff, DIFF_DOMAIN, X0, X1).toFixed(1)}
					cy="40"
					r="5"
				/>

				<text class="ev-row-label" x="0" y="96">непарн.</text>
				<line
					class="ev-ci ev-ci-unpaired"
					x1={scaleX(s.unpairedCi[0], DIFF_DOMAIN, X0, X1).toFixed(1)}
					x2={scaleX(s.unpairedCi[1], DIFF_DOMAIN, X0, X1).toFixed(1)}
					y1="96"
					y2="96"
				/>
				<circle
					class="ev-dot ev-dot-unpaired"
					cx={scaleX(s.diff, DIFF_DOMAIN, X0, X1).toFixed(1)}
					cy="96"
					r="5"
				/>
			</svg>
		</div>
	</div>

	<dl class="ev-stats">
		<dt>Величина</dt>
		<dd class="ev-h">A</dd>
		<dd class="ev-h">B</dd>
		<dt>Точность</dt>
		<dd>{fmt(s.accA)}</dd>
		<dd>{fmt(s.accB)}</dd>
		<dt>SE точности</dt>
		<dd>{fmt(s.seA, 3)}</dd>
		<dd>{fmt(s.seB, 3)}</dd>
		<dt>Разница A − B</dt>
		<dd class="ev-span">{fmt(s.diff)}</dd>
		<dt>SE, парная</dt>
		<dd class="ev-span">{fmt(s.pairedSe, 3)}</dd>
		<dt>SE, непарная</dt>
		<dd class="ev-span">{fmt(s.unpairedSe, 3)}</dd>
		<dt>Отношение разницы к SE</dt>
		<dd class="ev-span">{fmt(s.ratio, 1)}</dd>
	</dl>

	<p class="ev-note" aria-live="polite" data-verdict={verdict}>{note}</p>

	<div class="ev-notice">
		<p class="ev-notice-t">Что заметить</p>
		<ul>
			<li>
				При n = 100 интервалы точностей перекрываются, а парный интервал разницы включает ноль.
			</li>
			<li>
				Непарный интервал разницы заметно шире парного: та же пара моделей, но без учёта того, что
				они решают одни и те же примеры.
			</li>
			<li>
				Уменьшите разброс: при n = 1000 парный интервал уже не включает ноль. Нажмите «Другой набор»
				несколько раз при n = 100: разница заметно меняется от набора к набору.
			</li>
		</ul>
	</div>
</figure>

<style>
	.ev {
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
		letter-spacing: normal;
		text-transform: none;
	}
	.ev :global(*),
	.ev :global(*::before),
	.ev :global(*::after) {
		box-sizing: border-box;
	}
	.ev dl,
	.ev dd,
	.ev dt,
	.ev p,
	.ev ul {
		margin: 0;
	}
	.ev ul {
		padding-left: var(--space-5);
	}
	.ev button {
		font: inherit;
	}
	.ev-muted {
		color: var(--text-muted);
	}
	.ev-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.ev-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ev-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.ev-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.ev-range {
		width: 170px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.ev-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.ev-buttons {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.ev-btn {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--topic);
		border-radius: var(--radius);
		background: var(--topic);
		color: var(--surface);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--dur) var(--ease);
	}
	.ev-btn-ghost {
		background: none;
		border-color: var(--border);
		color: var(--text);
	}
	.ev-btn:focus-visible,
	.ev-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.ev-set {
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Charts */
	.ev-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.ev-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.ev-svg {
		display: block;
		width: 100%;
		overflow: visible;
	}
	.ev-svg-acc {
		height: 124px;
	}
	.ev-svg-diff {
		height: 150px;
	}
	.ev-grid,
	.ev-zero {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.35;
	}
	.ev-zero {
		stroke: var(--text);
		opacity: 0.6;
	}
	.ev-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
		text-anchor: middle;
	}
	.ev-row-label {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.ev-cat-a {
		fill: var(--cat-1);
	}
	.ev-cat-b {
		fill: var(--cat-2);
	}
	.ev-ci {
		stroke-width: 4;
		stroke-linecap: round;
	}
	.ev-ci-a {
		stroke: var(--cat-1);
	}
	.ev-ci-b {
		stroke: var(--cat-2);
	}
	.ev-ci-paired {
		stroke: var(--topic);
	}
	.ev-ci-unpaired {
		stroke: var(--text-muted);
		stroke-dasharray: 5 4;
	}
	.ev-dot-a {
		fill: var(--cat-1);
	}
	.ev-dot-b {
		fill: var(--cat-2);
	}
	.ev-dot-paired {
		fill: var(--topic);
	}
	.ev-dot-unpaired {
		fill: var(--surface);
		stroke: var(--text-muted);
		stroke-width: 2;
	}

	/* Statistics */
	.ev-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.ev-stats dt {
		color: var(--text-muted);
	}
	.ev-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.ev-stats .ev-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-size: 12px;
	}
	.ev-stats .ev-span {
		grid-column: span 2;
		text-align: left;
	}

	.ev-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.ev-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--topic);
		background: var(--bg);
		border-radius: var(--radius);
	}
	.ev-notice-t {
		margin-bottom: var(--space-2);
		font-weight: 600;
		color: var(--text);
	}
	.ev-notice li {
		margin-bottom: var(--space-1);
	}

	@media (prefers-reduced-motion: reduce) {
		.ev *,
		.ev *::before,
		.ev *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.ev {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.ev-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.ev-ctl {
			flex-wrap: wrap;
		}
		.ev-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
