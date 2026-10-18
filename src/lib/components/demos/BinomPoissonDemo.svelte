<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		BP_DEFAULT,
		BP_LAMBDA_MAX,
		BP_LAMBDA_MIN,
		BP_LAMBDA_STEP,
		BP_N_MAX,
		type BinomPoissonState,
		bpBars,
		mergeBpState,
		totalVariation,
	} from '$lib/demos/binom-poisson';
	import { formatNumber } from '$lib/demos/distributions';

	/** Bin(n, lambda / n) against Pois(lambda). Registers itself as demo `binom-poisson`. */
	let { initial }: { initial?: Partial<BinomPoissonState> } = $props();

	/* svelte-ignore state_referenced_locally */
	const start = mergeBpState(BP_DEFAULT, initial ?? {});
	let s = $state<BinomPoissonState>(start);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const W = 320;
	const L = 34;
	const R = 312;
	const B = 168;
	const plotW = R - L;
	const plotH = B - 12;

	const bars = $derived(bpBars(s.lambda, s.n));
	const top = $derived(Math.max(0.01, ...bars.flatMap((b) => [b.binom, b.poisson])) * 1.1);
	const slot = $derived(plotW / bars.length);
	const tv = $derived(totalVariation(s.lambda, s.n));
	const p = $derived(s.lambda / s.n);
	const tickStep = $derived(Math.ceil(bars.length / 12));

	const summary = $derived(
		`Bin(n = ${s.n}, p = ${formatNumber(p, 3)}) и Pois(λ = ${formatNumber(s.lambda, 1)}): расстояние между ними (половина суммы модулей разностей вероятностей) равно ${formatNumber(tv, 4)}.`,
	);

	function update(patch: Partial<BinomPoissonState>): void {
		s = mergeBpState(s, patch);
	}

	function reset(): void {
		s = start;
	}

	onMount(() => {
		return demos?.register('binom-poisson', {
			set: (patch) => update(patch as Partial<BinomPoissonState>),
		});
	});
</script>

<figure class="bp" id="demo-binom-poisson" data-demo="binom-poisson">
	<div class="bp-controls">
		<label class="bp-ctl">
			<span class="bp-label">λ</span>
			<input
				class="bp-range"
				type="range"
				min={BP_LAMBDA_MIN}
				max={BP_LAMBDA_MAX}
				step={BP_LAMBDA_STEP}
				value={s.lambda}
				oninput={(e) => update({ lambda: Number(e.currentTarget.value) })}
			/>
			<output class="bp-val">{formatNumber(s.lambda, 1)}</output>
		</label>
		<label class="bp-ctl">
			<span class="bp-label">n</span>
			<input
				class="bp-range"
				type="range"
				min="1"
				max={BP_N_MAX}
				step="1"
				value={s.n}
				oninput={(e) => update({ n: Number(e.currentTarget.value) })}
			/>
			<output class="bp-val">{s.n}</output>
		</label>
	</div>

	<svg class="bp-svg" viewBox="0 0 {W} 190" role="img" aria-labelledby="bp-title bp-desc">
		<title id="bp-title">Биномиальное распределение против распределения Пуассона</title>
		<desc id="bp-desc">{summary}</desc>
		<line class="bp-axis" x1={L} x2={R} y1={B} y2={B} />
		{#each bars as b, i (b.k)}
			{@const x = L + i * slot}
			{@const hb = (b.binom / top) * plotH}
			{@const hp = (b.poisson / top) * plotH}
			<rect
				class="bp-bin"
				x={(x + slot * 0.08).toFixed(1)}
				y={(B - hb).toFixed(1)}
				width={(slot * 0.4).toFixed(1)}
				height={hb.toFixed(1)}
			/>
			<rect
				class="bp-poi"
				x={(x + slot * 0.52).toFixed(1)}
				y={(B - hp).toFixed(1)}
				width={(slot * 0.4).toFixed(1)}
				height={hp.toFixed(1)}
			/>
			{#if b.k % tickStep === 0}
				<text class="bp-tick" x={(x + slot / 2).toFixed(1)} y="182">{b.k}</text>
			{/if}
		{/each}
	</svg>

	<p class="bp-legend">
		<span><span class="bp-key bp-key-bin"></span>Bin(n, λ/n)</span>
		<span><span class="bp-key bp-key-poi"></span>Pois(λ)</span>
	</p>
	<p class="bp-state" aria-live="polite">{summary}</p>

	<div class="bp-foot">
		<button type="button" class="bp-reset" onclick={reset}>Сбросить</button>
	</div>

	<p class="bp-notice">
		<strong>Что заметить:</strong> при малом n парные столбцы заметно различаются, а при n в десятки и
		сотни почти совпадают. При том же λ расстояние между распределениями падает вместе с ростом n.
	</p>
</figure>

<style>
	.bp {
		margin: 0;
		padding: var(--space-6);
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
	.bp :global(*),
	.bp :global(*::before),
	.bp :global(*::after) {
		box-sizing: border-box;
	}
	.bp p {
		margin: 0;
	}
	.bp button {
		font: inherit;
	}
	.bp-controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-2) var(--space-6);
	}
	.bp-ctl {
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 1fr) 3.5rem;
		align-items: center;
		gap: var(--space-2);
	}
	.bp-label {
		color: var(--text-muted);
		font-family: var(--font-serif);
		font-size: 15px;
	}
	.bp-range {
		width: 100%;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.bp-val {
		text-align: right;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.bp-range:focus-visible,
	.bp-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.bp-svg {
		display: block;
		width: 100%;
		max-width: 560px;
		height: auto;
		overflow: visible;
		margin: var(--space-4) auto var(--space-2);
	}
	.bp-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.bp-bin {
		fill: var(--cat-1);
	}
	.bp-poi {
		fill: var(--cat-2);
	}
	.bp-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
		text-anchor: middle;
	}
	.bp-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		color: var(--text-muted);
		font-size: 12px;
	}
	.bp-key {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: 4px;
		border-radius: 2px;
	}
	.bp-key-bin {
		background: var(--cat-1);
	}
	.bp-key-poi {
		background: var(--cat-2);
	}
	.bp-state {
		margin-top: var(--space-2);
		font-size: 13px;
		font-family: var(--font-mono);
		word-break: break-word;
	}
	.bp-foot {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-4);
	}
	.bp-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: border-color var(--dur) var(--ease);
	}
	.bp-reset:hover {
		border-color: var(--topic);
	}
	.bp-notice {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		color: var(--text);
	}
	@media (prefers-reduced-motion: reduce) {
		.bp-reset {
			transition: none;
		}
	}
</style>
