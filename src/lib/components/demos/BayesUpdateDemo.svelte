<script lang="ts">
	import {
		PARAM_MAX,
		PARAM_MIN,
		PARAM_STEP,
		SIM_SEED,
		type BayesDemoState,
		credibleInterval,
		densityCurve,
		describeState,
		fmt,
		intervalCurve,
		makeRng,
		posterior,
		simulateHeads,
		snapParam,
		summarize,
	} from '$lib/demos/bayesian-inference';

	/**
	 * Coin with a Beta(a, b) prior on the heads probability, updated flip by flip.
	 * The reader does not know the coin's bias; "+10" and "+100" simulate a hidden coin.
	 */
	let { initial }: { initial?: Partial<BayesDemoState> } = $props();

	/* svelte-ignore state_referenced_locally */
	let a = $state(snapParam(initial?.a ?? 1, 1));
	/* svelte-ignore state_referenced_locally */
	let b = $state(snapParam(initial?.b ?? 1, 1));
	/* svelte-ignore state_referenced_locally */
	let heads = $state(Math.max(0, Math.floor(initial?.heads ?? 0)));
	/* svelte-ignore state_referenced_locally */
	let tails = $state(Math.max(0, Math.floor(initial?.tails ?? 0)));

	/** Width of the chart in px; 480 until the first measurement. */
	let wPlot = $state(0);
	const plotW = $derived(wPlot >= 200 ? wPlot : 480);
	const H = 240;
	const PAD = { l: 36, r: 12, t: 16, b: 34 };

	const rng = makeRng(SIM_SEED);

	const n = $derived(heads + tails);
	const post = $derived(posterior(a, b, heads, tails));
	const priorSum = $derived(summarize(a, b));
	const postSum = $derived(summarize(post.a, post.b));
	const postCi = $derived(credibleInterval(post.a, post.b));

	const priorCurve = $derived(densityCurve(a, b));
	const postCurve = $derived(densityCurve(post.a, post.b));
	const shade = $derived(intervalCurve(post.a, post.b, postCi.lo, postCi.hi));
	const yMax = $derived(
		Math.max(1, ...priorCurve.map((p) => p.y), ...postCurve.map((p) => p.y)) * 1.08,
	);

	const innerW = $derived(plotW - PAD.l - PAD.r);
	const innerH = $derived(H - PAD.t - PAD.b);
	const sx = (x: number) => PAD.l + x * innerW;
	const sy = (y: number) => PAD.t + innerH - (y / yMax) * innerH;

	function linePath(pts: { x: number; y: number }[]): string {
		return pts
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
			.join(' ');
	}
	const priorPath = $derived(linePath(priorCurve));
	const postPath = $derived(linePath(postCurve));
	const shadePath = $derived(
		linePath(shade) +
			` L${sx(postCi.hi).toFixed(1)} ${sy(0).toFixed(1)} L${sx(postCi.lo).toFixed(1)} ${sy(0).toFixed(1)} Z`,
	);

	const note = $derived(describeState({ a, b, heads, tails }));
	const desc = $derived(
		`Априор Beta(${a}, ${b}), после ${n} бросков (орёл ${heads}): апостериор Beta(${post.a}, ${post.b}), ` +
			`среднее ${fmt(postSum.mean)}, 95%-интервал ${fmt(postSum.lo)}–${fmt(postSum.hi)}.`,
	);
	function flip(isHeads: boolean): void {
		if (isHeads) heads++;
		else tails++;
	}
	function simulate(count: number): void {
		const h = simulateHeads(rng, count);
		heads += h;
		tails += count - h;
	}
	function reset(): void {
		heads = 0;
		tails = 0;
	}
</script>

<figure class="bu" id="demo-bayes-update" data-demo="bayes-update">
	<div class="bu-controls">
		<label class="bu-ctl">
			<span class="bu-label"><span class="bu-sym">a</span> (априорные орлы)</span>
			<input
				class="bu-range"
				type="range"
				min={PARAM_MIN}
				max={PARAM_MAX}
				step={PARAM_STEP}
				value={a}
				oninput={(e) => (a = snapParam(Number(e.currentTarget.value), a))}
			/>
			<output class="bu-val">{a}</output>
		</label>
		<label class="bu-ctl">
			<span class="bu-label"><span class="bu-sym">b</span> (априорные решки)</span>
			<input
				class="bu-range"
				type="range"
				min={PARAM_MIN}
				max={PARAM_MAX}
				step={PARAM_STEP}
				value={b}
				oninput={(e) => (b = snapParam(Number(e.currentTarget.value), b))}
			/>
			<output class="bu-val">{b}</output>
		</label>
	</div>

	<div class="bu-actions">
		<button type="button" class="bu-btn bu-btn-heads" onclick={() => flip(true)}>Орёл</button>
		<button type="button" class="bu-btn" onclick={() => flip(false)}>Решка</button>
		<button type="button" class="bu-btn" onclick={() => simulate(10)}>+10 бросков</button>
		<button type="button" class="bu-btn" onclick={() => simulate(100)}>+100 бросков</button>
		<button type="button" class="bu-btn bu-btn-ghost" onclick={reset}>Сброс</button>
	</div>

	<div class="bu-plot" bind:clientWidth={wPlot}>
		<svg
			class="bu-svg"
			width={plotW}
			height={H}
			viewBox="0 0 {plotW} {H}"
			role="img"
			aria-labelledby="bu-title bu-desc"
		>
			<title id="bu-title">Априорное и апостериорное распределение доли орлов</title>
			<desc id="bu-desc">{desc}</desc>

			<line class="bu-axis" x1={PAD.l} x2={plotW - PAD.r} y1={sy(0)} y2={sy(0)} />
			{#each [0, 0.25, 0.5, 0.75, 1] as t (t)}
				<line class="bu-grid" x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={sy(0)} />
				<text class="bu-tick" x={sx(t)} y={H - 12} text-anchor="middle"
					>{t.toFixed(2).replace('.', ',')}</text
				>
			{/each}
			<text class="bu-tick" x={PAD.l - 6} y={PAD.t + 10} text-anchor="end">θ</text>

			<path class="bu-shade" d={shadePath} />
			<path class="bu-prior" d={priorPath} />
			<path class="bu-post" d={postPath} />
		</svg>
		<ul class="bu-legend" aria-hidden="true">
			<li><span class="bu-sw bu-sw-prior"></span>априор Beta({a}, {b})</li>
			<li><span class="bu-sw bu-sw-post"></span>апостериор Beta({post.a}, {post.b})</li>
			<li><span class="bu-sw bu-sw-shade"></span>95%-интервал</li>
		</ul>
	</div>

	<dl class="bu-stats">
		<dt>Распределение</dt>
		<dd class="bu-h">среднее</dd>
		<dd class="bu-h">95%-интервал</dd>
		<dt>Априор</dt>
		<dd>{fmt(priorSum.mean)}</dd>
		<dd>{fmt(priorSum.lo)}–{fmt(priorSum.hi)}</dd>
		<dt>Апостериор</dt>
		<dd>{fmt(postSum.mean)}</dd>
		<dd>{fmt(postSum.lo)}–{fmt(postSum.hi)}</dd>
		<dt>Бросков</dt>
		<dd>{n}</dd>
		<dd>орлов {heads}, решек {tails}</dd>
	</dl>

	<p class="bu-note" aria-live="polite">{note}</p>
</figure>

<style>
	.bu {
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
	.bu :global(*),
	.bu :global(*::before),
	.bu :global(*::after) {
		box-sizing: border-box;
	}
	.bu dl,
	.bu dd,
	.bu dt,
	.bu p,
	.bu ul {
		margin: 0;
		padding: 0;
	}
	.bu button {
		font: inherit;
	}
	.bu-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.bu-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.bu-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.bu-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.bu-range {
		width: 130px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.bu-val {
		min-width: 2ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.bu-range:focus-visible,
	.bu-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.bu-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.bu-btn {
		height: 34px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.bu-btn-heads {
		border-color: var(--topic);
		color: var(--topic);
		font-weight: 600;
	}
	.bu-btn-ghost {
		background: none;
		color: var(--text-muted);
	}

	/* Chart */
	.bu-plot {
		margin-top: var(--space-6);
	}
	.bu-svg {
		display: block;
		width: 100%;
		height: 240px;
		overflow: visible;
	}
	.bu-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.bu-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.bu-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.bu-shade {
		fill: var(--topic);
		fill-opacity: 0.18;
		stroke: none;
	}
	.bu-prior {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
	}
	.bu-post {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2.5;
	}
	.bu-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
		list-style: none;
		color: var(--text-muted);
		font-size: 12px;
	}
	.bu-sw {
		display: inline-block;
		width: 16px;
		height: 0;
		margin-right: 6px;
		vertical-align: middle;
		border-top: 2px solid var(--text-muted);
	}
	.bu-sw-post {
		border-top-color: var(--topic);
		border-top-width: 3px;
	}
	.bu-sw-shade {
		height: 10px;
		border: 0;
		background: color-mix(in srgb, var(--topic) 18%, transparent);
	}

	/* Stats */
	.bu-stats {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		gap: var(--space-2) var(--space-6);
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.bu-stats dt {
		font-family: var(--font-sans);
		color: var(--text-muted);
	}
	.bu-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
	}

	.bu-note {
		margin-top: var(--space-4);
		color: var(--text);
	}

	@media (max-width: 480px) {
		.bu {
			padding: var(--space-4);
		}
		.bu-stats {
			grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
			gap: var(--space-1) var(--space-3);
		}
		.bu-range {
			width: 110px;
		}
	}
</style>
