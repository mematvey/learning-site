<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DEFAULT_STATE,
		PERCENT_MAX,
		PERCENT_MIN,
		VERIFIER_MIN,
		allowedN,
		curves,
		describeState,
		fmt3,
		polyline,
		readouts,
		sanitize,
		snapN,
		xPixel,
		yPixel,
		type StepMode,
		type TtcDemoState,
	} from '$lib/demos/test-time-compute';

	/**
	 * Test-time compute demo: voting and best-of-N accuracy against the number of samples N.
	 * Registers itself as demo `test-time-compute`.
	 */
	let { initial }: { initial?: Partial<TtcDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	const seed = sanitize(initial, DEFAULT_STATE);
	let n = $state(seed.n);
	let pVote = $state(seed.pVote);
	let pBest = $state(seed.pBest);
	let verifier = $state(seed.verifier);
	let step = $state<StepMode>(seed.step);
	/** Real width of the chart in px; the SVG is drawn at this width (no viewBox scaling). */
	let plotWidth = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const H = 220;
	const PAD = 32;

	const current: TtcDemoState = $derived({ n, pVote, pBest, verifier, step });
	const nList = $derived(allowedN(step));
	const sliderIndex = $derived(Math.max(0, nList.indexOf(n)));
	const r = $derived(readouts(current));
	const curve = $derived(curves(current));
	const text = $derived(describeState(current));
	const W = $derived(plotWidth >= 200 ? plotWidth : 360);
	const xN = $derived(xPixel(n, W, PAD));
	const yVote = $derived(yPixel(r.vote, H, PAD));
	const yBest = $derived(yPixel(r.best, H, PAD));
	const votePoints = $derived(polyline(curve.vote, W, H, PAD));
	const bestPoints = $derived(polyline(curve.best, W, H, PAD));
	const xTicks = [1, 16, 32, 48, 64];
	const yTicks = [0, 0.5, 1];
	const liveText = $derived(`${text.vote} ${text.best}`);

	function apply(patch: Partial<TtcDemoState>): void {
		const next = sanitize(patch, current);
		n = next.n;
		pVote = next.pVote;
		pBest = next.pBest;
		verifier = next.verifier;
		step = next.step;
	}

	function setStep(s: StepMode): void {
		step = s;
		n = snapN(n, s);
	}

	function reset(): void {
		apply(DEFAULT_STATE);
	}

	onMount(() => {
		return demos?.register('test-time-compute', {
			set: (patch) => apply(patch as Partial<TtcDemoState>),
		});
	});
</script>

<figure class="ttc" id="demo-test-time-compute" data-demo="test-time-compute">
	<div class="ttc-controls">
		<div class="ttc-row">
			<span class="ttc-label" id="ttc-step-label">Шаг по N</span>
			<div class="ttc-group" role="group" aria-labelledby="ttc-step-label">
				<button
					type="button"
					class="ttc-seg"
					aria-pressed={step === 'one'}
					onclick={() => setStep('one')}>каждое N</button
				>
				<button
					type="button"
					class="ttc-seg"
					aria-pressed={step === 'double'}
					onclick={() => setStep('double')}>удвоение</button
				>
			</div>
		</div>

		<label class="ttc-ctl">
			<span class="ttc-label">N, выборок</span>
			<input
				class="ttc-range"
				type="range"
				min="0"
				max={nList.length - 1}
				step="1"
				value={sliderIndex}
				oninput={(e) => (n = nList[Number(e.currentTarget.value)] ?? n)}
			/>
			<output class="ttc-val">{n}</output>
		</label>

		<label class="ttc-ctl">
			<span class="ttc-label">p голосования</span>
			<input
				class="ttc-range"
				type="range"
				min={PERCENT_MIN}
				max={PERCENT_MAX}
				step="1"
				value={pVote}
				oninput={(e) => (pVote = Number(e.currentTarget.value))}
			/>
			<output class="ttc-val">{pVote}%</output>
		</label>

		<label class="ttc-ctl">
			<span class="ttc-label">p выбора</span>
			<input
				class="ttc-range"
				type="range"
				min={PERCENT_MIN}
				max={PERCENT_MAX}
				step="1"
				value={pBest}
				oninput={(e) => (pBest = Number(e.currentTarget.value))}
			/>
			<output class="ttc-val">{pBest}%</output>
		</label>

		<label class="ttc-ctl">
			<span class="ttc-label">Качество проверки</span>
			<input
				class="ttc-range"
				type="range"
				min={VERIFIER_MIN}
				max="100"
				step="1"
				value={verifier}
				oninput={(e) => (verifier = Number(e.currentTarget.value))}
			/>
			<output class="ttc-val">{verifier}%</output>
		</label>

		<div class="ttc-row">
			<button type="button" class="ttc-reset" onclick={reset}>Сбросить</button>
		</div>
	</div>

	<div class="ttc-plot" bind:clientWidth={plotWidth}>
		<svg class="ttc-svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="ttc-title ttc-desc">
			<title id="ttc-title">Точность против числа выборок N</title>
			<desc id="ttc-desc">{liveText}</desc>

			{#each yTicks as t (t)}
				<line
					class="ttc-grid"
					x1={PAD}
					x2={W - PAD}
					y1={yPixel(t, H, PAD)}
					y2={yPixel(t, H, PAD)}
				/>
				<text class="ttc-tick" x={PAD - 6} y={yPixel(t, H, PAD) + 4} text-anchor="end"
					>{t === 1 ? '1' : t === 0.5 ? '0,5' : '0'}</text
				>
			{/each}
			{#each xTicks as t (t)}
				<text class="ttc-tick" x={xPixel(t, W, PAD)} y={H - 8} text-anchor="middle">{t}</text>
			{/each}

			<line class="ttc-cursor" x1={xN} x2={xN} y1={PAD} y2={H - PAD} />
			<polyline class="ttc-line ttc-line-vote" points={votePoints} />
			<polyline class="ttc-line ttc-line-best" points={bestPoints} />
			<circle class="ttc-dot ttc-dot-vote" cx={xN} cy={yVote} r="5" />
			<circle class="ttc-dot ttc-dot-best" cx={xN} cy={yBest} r="5" />
		</svg>
	</div>

	<ul class="ttc-legend">
		<li><span class="ttc-sw ttc-sw-vote"></span>голосование большинством, p = {pVote}%</li>
		<li>
			<span class="ttc-sw ttc-sw-best"></span>выбор лучшего, p = {pBest}%, проверка {verifier}%
		</li>
	</ul>

	<dl class="ttc-stats">
		<dt>Статистика</dt>
		<dd class="ttc-h">голосование</dd>
		<dd class="ttc-h">выбор лучшего</dd>
		<dt>Точность при N = {n}</dt>
		<dd>{fmt3(r.vote)}</dd>
		<dd>{fmt3(r.best)}</dd>
		<dt>Выборок (стоимость, ×N)</dt>
		<dd>{n}</dd>
		<dd>{n}</dd>
		<dt>Прирост при удвоении N</dt>
		<dd>{r.voteGainDouble === null ? '—' : `+${fmt3(r.voteGainDouble)}`}</dd>
		<dd>{r.bestGainDouble === null ? '—' : `+${fmt3(r.bestGainDouble)}`}</dd>
	</dl>

	<div class="ttc-live" aria-live="polite">
		<p>{text.vote}</p>
		<p>{text.best}</p>
	</div>
</figure>

<style>
	.ttc {
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
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.ttc :global(*),
	.ttc :global(*::before),
	.ttc :global(*::after) {
		box-sizing: border-box;
	}
	.ttc dl,
	.ttc dd,
	.ttc dt,
	.ttc p,
	.ttc ul {
		margin: 0;
		padding: 0;
	}
	.ttc ul {
		list-style: none;
	}
	.ttc button {
		font: inherit;
	}

	/* Controls */
	.ttc-controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ttc-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.ttc-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.ttc-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.ttc-range {
		flex: 1 1 120px;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.ttc-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.ttc-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.ttc-seg,
	.ttc-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.ttc-group .ttc-seg {
		border: 0;
		background: none;
		color: var(--text-muted);
	}
	.ttc-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.ttc-seg:focus-visible,
	.ttc-reset:focus-visible,
	.ttc-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.ttc-reset:hover {
		border-color: var(--topic);
	}

	/* Chart */
	.ttc-plot {
		margin-top: var(--space-6);
		width: 100%;
	}
	.ttc-svg {
		display: block;
		width: 100%;
		height: 220px;
		overflow: visible;
	}
	.ttc-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.ttc-cursor {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 4 3;
	}
	.ttc-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.ttc-line {
		fill: none;
		stroke-width: 2.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.ttc-line-vote {
		stroke: var(--cat-1);
	}
	.ttc-line-best {
		stroke: var(--cat-2);
	}
	.ttc-dot {
		stroke: var(--surface);
		stroke-width: 2;
		transition:
			cx var(--dur) var(--ease),
			cy var(--dur) var(--ease);
	}
	.ttc-dot-vote {
		fill: var(--cat-1);
	}
	.ttc-dot-best {
		fill: var(--cat-2);
	}

	.ttc-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
		margin-top: var(--space-4);
		font-size: 13px;
		color: var(--text-muted);
	}
	.ttc-legend li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.ttc-sw {
		display: inline-block;
		width: 16px;
		height: 4px;
		border-radius: 2px;
	}
	.ttc-sw-vote {
		background: var(--cat-1);
	}
	.ttc-sw-best {
		background: var(--cat-2);
	}

	/* Statistics */
	.ttc-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.ttc-stats dt {
		color: var(--text-muted);
	}
	.ttc-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.ttc-stats .ttc-h {
		font-family: var(--font-sans);
		color: var(--text-muted);
		font-size: 12px;
		overflow-wrap: normal;
		hyphens: manual;
	}
	.ttc-stats dt:first-child {
		color: var(--text);
		font-weight: 600;
	}

	.ttc-live {
		margin-top: var(--space-4);
		color: var(--text);
		font-size: 13px;
	}
	.ttc-live p + p {
		margin-top: var(--space-1);
	}
	@media (prefers-reduced-motion: reduce) {
		.ttc *,
		.ttc *::before,
		.ttc *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.ttc {
			padding: var(--space-4);
		}
		.ttc-controls {
			grid-template-columns: minmax(0, 1fr);
		}
		.ttc-stats {
			grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr) minmax(0, 1.2fr);
			gap: var(--space-1) var(--space-2);
			font-size: 12px;
		}
	}
</style>
