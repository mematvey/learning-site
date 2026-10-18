<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		CQ_DEFAULT,
		CQ_N_MAX,
		CQ_N_MIN,
		CQ_P_MAX,
		CQ_P_MIN,
		CQ_P_STEP,
		CQ_SAMPLE_MAX,
		CQ_SAMPLE_MIN,
		CQ_SAMPLE_STEP,
		CQ_U_MAX,
		CQ_U_MIN,
		CQ_U_STEP,
		type CdfQuantileState,
		binomCdf,
		binomQuantile,
		mergeCdfState,
		sampleCounts,
	} from '$lib/demos/cdf-quantile';
	import { binomPmf, formatNumber } from '$lib/demos/distributions';

	/** CDF step, quantile F^-1(u) and inverse-transform sample of Bin(n, p). Registers itself as demo `cdf-quantile`. */
	let { initial }: { initial?: Partial<CdfQuantileState> } = $props();

	/* svelte-ignore state_referenced_locally */
	const start = mergeCdfState(CQ_DEFAULT, initial ?? {});
	let s = $state<CdfQuantileState>(start);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	// Chart geometry in viewBox units.
	const W = 320;
	const L = 34;
	const R = 312;
	const T = 12;
	const B = 168;
	const plotW = R - L;
	const plotH = B - T;

	const slot = $derived(plotW / (s.n + 1));
	const xAt = (k: number) => L + (k + 0.5) * slot;
	const yAt = (v: number) => B - v * plotH;

	const q = $derived(binomQuantile(s.n, s.p, s.u));
	const fAtQ = $derived(binomCdf(s.n, s.p, q));
	const fBefore = $derived(binomCdf(s.n, s.p, q - 1));
	const counts = $derived(sampleCounts(s.n, s.p, s.m));
	const countMax = $derived(Math.max(1, ...counts));

	/** Steps of F: a horizontal segment for each k, the jump at the border to the next value. */
	const steps = $derived.by(() => {
		const segs: { x1: number; x2: number; y: number }[] = [];
		for (let k = 0; k <= s.n; k++) {
			const left = k === 0 ? L : xAt(k) - slot / 2;
			const right = k === s.n ? R : xAt(k) + slot / 2;
			segs.push({ x1: left, x2: right, y: yAt(binomCdf(s.n, s.p, k)) });
		}
		return segs;
	});
	const jumps = $derived(
		steps.slice(0, -1).map((seg, i) => ({ x: seg.x2, y1: seg.y, y2: (steps[i + 1] ?? seg).y })),
	);
	const tickStep = $derived(Math.ceil((s.n + 1) / 10));

	const summary = $derived(
		`Bin(n = ${s.n}, p = ${formatNumber(s.p, 2)}): F(${q}) = ${formatNumber(fAtQ, 3)} ≥ u = ${formatNumber(s.u, 2)}, F(${q - 1}) = ${formatNumber(fBefore, 3)}; квантиль F⁻¹(u) = ${q}.`,
	);

	function update(patch: Partial<CdfQuantileState>): void {
		s = mergeCdfState(s, patch);
	}

	function reset(): void {
		s = start;
	}

	onMount(() => {
		return demos?.register('cdf-quantile', {
			set: (patch) => update(patch as Partial<CdfQuantileState>),
		});
	});
</script>

{#snippet slider(
	label: string,
	min: number,
	max: number,
	step: number,
	value: number,
	shown: string,
	set: (v: number) => void,
)}
	<label class="cq-ctl">
		<span class="cq-label">{label}</span>
		<input
			class="cq-range"
			type="range"
			{min}
			{max}
			{step}
			{value}
			oninput={(e) => set(Number(e.currentTarget.value))}
		/>
		<output class="cq-val">{shown}</output>
	</label>
{/snippet}

<figure class="cq" id="demo-cdf-quantile" data-demo="cdf-quantile">
	<div class="cq-controls">
		{@render slider('n', CQ_N_MIN, CQ_N_MAX, 1, s.n, String(s.n), (v) => update({ n: v }))}
		{@render slider('p', CQ_P_MIN, CQ_P_MAX, CQ_P_STEP, s.p, formatNumber(s.p, 2), (v) =>
			update({ p: v }),
		)}
		{@render slider('u', CQ_U_MIN, CQ_U_MAX, CQ_U_STEP, s.u, formatNumber(s.u, 2), (v) =>
			update({ u: v }),
		)}
		{@render slider(
			'выборка',
			CQ_SAMPLE_MIN,
			CQ_SAMPLE_MAX,
			CQ_SAMPLE_STEP,
			s.m,
			String(s.m),
			(v) => update({ m: v }),
		)}
	</div>

	<svg class="cq-svg" viewBox="0 0 {W} 190" role="img" aria-labelledby="cq-title cq-desc">
		<title id="cq-title">Функция распределения биномиальной величины и квантиль</title>
		<desc id="cq-desc">{summary}</desc>
		<line class="cq-axis" x1={L} x2={R} y1={B} y2={B} />
		<line class="cq-axis" x1={L} x2={L} y1={T} y2={B} />
		<text class="cq-tick" x={L - 4} y={yAt(1) + 3} text-anchor="end">1</text>
		<text class="cq-tick" x={L - 4} y={yAt(0) + 3} text-anchor="end">0</text>

		{#each counts as c, k (k)}
			<rect
				class="cq-bar"
				x={(xAt(k) - slot * 0.4).toFixed(1)}
				y={(B - (c / countMax) * plotH * 0.5).toFixed(1)}
				width={(slot * 0.8).toFixed(1)}
				height={((c / countMax) * plotH * 0.5).toFixed(1)}
			/>
		{/each}

		{#each steps as seg, i (i)}
			<line class="cq-step" x1={seg.x1} x2={seg.x2} y1={seg.y} y2={seg.y} />
		{/each}
		{#each jumps as j, i (i)}
			<line class="cq-jump" x1={j.x} x2={j.x} y1={j.y1} y2={j.y2} />
		{/each}

		<line class="cq-level" x1={L} x2={xAt(q)} y1={yAt(s.u)} y2={yAt(s.u)} />
		<line class="cq-level" x1={xAt(q)} x2={xAt(q)} y1={yAt(s.u)} y2={B} />
		<circle class="cq-dot" cx={xAt(q)} cy={yAt(s.u)} r="3.5" />
		<text class="cq-tick" x={L + 3} y={yAt(s.u) - 4}>u</text>

		{#each Array.from({ length: s.n + 1 }, (_, k) => k) as k (k)}
			{#if k % tickStep === 0}
				<text class="cq-tick" x={xAt(k).toFixed(1)} y="182" text-anchor="middle">{k}</text>
			{/if}
		{/each}
	</svg>

	<p class="cq-state" aria-live="polite">{summary}</p>
	<p class="cq-sum">
		Голубые столбики показывают частоты выборки из {s.m} значений F⁻¹(U), где U равномерна на (0, 1).
		Для значения {q} вероятность равна {formatNumber(binomPmf(s.n, s.p, q), 3)}, а доля выборки в
		нём равна {formatNumber((counts[q] ?? 0) / s.m, 3)}.
	</p>

	<div class="cq-foot">
		<button type="button" class="cq-reset" onclick={reset}>Сбросить</button>
	</div>

	<p class="cq-notice">
		<strong>Что заметить:</strong> уровень u идёт по горизонтали до ступеньки F и опускается на значение
		F⁻¹(u). Широкая ступенька захватывает много уровней u, поэтому такое значение выпадает чаще, и высота
		столбиков выборки повторяет высоту скачков F.
	</p>
</figure>

<style>
	.cq {
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
	.cq :global(*),
	.cq :global(*::before),
	.cq :global(*::after) {
		box-sizing: border-box;
	}
	.cq p {
		margin: 0;
	}
	.cq button {
		font: inherit;
	}
	.cq-controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-2) var(--space-6);
	}
	.cq-ctl {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr) 3.5rem;
		align-items: center;
		gap: var(--space-2);
	}
	.cq-label {
		color: var(--text-muted);
		font-family: var(--font-serif);
		font-size: 15px;
	}
	.cq-range {
		width: 100%;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cq-val {
		text-align: right;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.cq-range:focus-visible,
	.cq-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.cq-svg {
		display: block;
		width: 100%;
		max-width: 560px;
		height: auto;
		overflow: visible;
		margin: var(--space-4) auto var(--space-2);
	}
	.cq-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.cq-bar {
		fill: var(--cat-1);
		opacity: 0.45;
	}
	.cq-step {
		stroke: var(--cat-3);
		stroke-width: 2.5;
	}
	.cq-jump {
		stroke: var(--cat-3);
		stroke-width: 1;
		stroke-dasharray: 3 2;
	}
	.cq-level {
		stroke: var(--cat-2);
		stroke-width: 1.5;
	}
	.cq-dot {
		fill: var(--cat-2);
	}
	.cq-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.cq-state {
		font-size: 13px;
		font-family: var(--font-mono);
		word-break: break-word;
	}
	.cq-sum {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.cq-foot {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-4);
	}
	.cq-reset {
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
	.cq-reset:hover {
		border-color: var(--topic);
	}
	.cq-notice {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		color: var(--text);
	}
	@media (prefers-reduced-motion: reduce) {
		.cq-reset {
			transition: none;
		}
	}
</style>
