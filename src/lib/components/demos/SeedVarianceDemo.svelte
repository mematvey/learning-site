<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		SEED_COUNT,
		describeSeeds,
		makeSeedRuns,
		sanitizeSeedState,
		snapSeeds,
		summarizeSeeds,
		type SeedState,
	} from '$lib/demos/seed-variance';

	/** Seed variance demo: val_acc of two configurations over several seeds. Registers as `seed-variance`. */
	let { initial }: { initial?: Partial<SeedState> } = $props();

	/* svelte-ignore state_referenced_locally */
	const start = sanitizeSeedState(initial);
	let state = $state<SeedState>({ ...start });

	const RUNS = makeSeedRuns();
	const s = $derived(summarizeSeeds(RUNS, state));
	const note = $derived(describeSeeds(s));

	const W = 400;
	const H = 150;
	const X0 = 40;
	const X1 = 380;
	const LO = 0.865;
	const HI = 0.9;
	const ROWS = [
		{ id: 'A' as const, y: 45, cls: 'sv-a' },
		{ id: 'B' as const, y: 105, cls: 'sv-b' },
	];
	const px = (v: number): number => X0 + ((v - LO) / (HI - LO)) * (X1 - X0);
	const ticks = [0.87, 0.88, 0.89, 0.9];

	function reset(): void {
		state = { ...start };
	}

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	onMount(() =>
		demos?.register('seed-variance', {
			set: (patch) => {
				state = sanitizeSeedState({ ...state, ...(patch as Partial<SeedState>) });
			},
		}),
	);
</script>

<figure class="sv" id="demo-seed-variance" data-demo="seed-variance">
	<div class="sv-controls">
		<label class="sv-field">
			<span>Сидов на конфигурацию: {state.seeds}</span>
			<input
				type="range"
				min="1"
				max={SEED_COUNT}
				step="1"
				value={state.seeds}
				oninput={(e) => (state.seeds = snapSeeds(Number(e.currentTarget.value)))}
			/>
		</label>
		<button type="button" class="sv-reset" onclick={reset}>Сбросить</button>
	</div>

	<svg class="sv-plot" viewBox="0 0 {W} {H}" role="img" aria-labelledby="sv-title sv-desc">
		<title id="sv-title">Точность на валидации для двух конфигураций по нескольким сидам</title>
		<desc id="sv-desc">{note}</desc>
		{#each ticks as t (t)}
			<line class="sv-grid" x1={px(t)} x2={px(t)} y1="15" y2="125" />
			<text class="sv-tick" x={px(t)} y="142">{(t * 100).toFixed(0)} %</text>
		{/each}
		{#each ROWS as row (row.id)}
			{@const sp = row.id === 'A' ? s.a : s.b}
			{@const vals = RUNS[row.id].slice(0, state.seeds)}
			<text class="sv-label" x="14" y={row.y + 5}>{row.id}</text>
			{#if sp.n > 1}
				<rect
					class="sv-band {row.cls}"
					x={px(sp.min)}
					y={row.y - 14}
					width={px(sp.max) - px(sp.min)}
					height="28"
					rx="4"
				/>
			{/if}
			{#each vals as v, i (i)}
				<circle class="sv-dot {row.cls}" cx={px(v)} cy={row.y} r="4.5" />
			{/each}
			<line
				class="sv-mean {row.cls}"
				x1={px(sp.mean)}
				x2={px(sp.mean)}
				y1={row.y - 20}
				y2={row.y + 20}
			/>
		{/each}
	</svg>

	<dl class="sv-stats">
		<dt>A: среднее ± sd</dt>
		<dd>{(s.a.mean * 100).toFixed(2)} ± {(s.a.sd * 100).toFixed(2)} %</dd>
		<dt>B: среднее ± sd</dt>
		<dd>{(s.b.mean * 100).toFixed(2)} ± {(s.b.sd * 100).toFixed(2)} %</dd>
		<dt>Победитель по первому сиду</dt>
		<dd>{s.firstSeedWinner}</dd>
		<dt>Победитель по среднему</dt>
		<dd>{s.meanWinner}</dd>
	</dl>

	<p class="sv-note" aria-live="polite">{note}</p>

	<div class="sv-notice">
		<p class="sv-h">Что заметить</p>
		<ul>
			<li>
				Точки одной конфигурации лежат в полосе, ширина которой сравнима с разницей между A и B.
				Числа смоделированы: у A истинная точность 88.4 %, у B 88.0 %.
			</li>
			<li>
				По первому сиду выигрывает B, хотя по среднему пяти сидов лучше A. Один запуск не отличает
				лучшую конфигурацию от удачного сида.
			</li>
		</ul>
	</div>
</figure>

<style>
	.sv {
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
	.sv dl,
	.sv dd,
	.sv dt,
	.sv p,
	.sv ul {
		margin: 0;
	}
	.sv ul {
		padding-left: var(--space-4);
	}
	.sv-h {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.sv-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.sv-field {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
	}
	.sv-field input {
		accent-color: var(--topic);
		min-height: 32px;
	}
	.sv-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}
	.sv-reset:focus-visible,
	.sv-field input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.sv-plot {
		display: block;
		width: 100%;
		max-width: 560px;
		height: auto;
		margin: var(--space-4) 0;
	}
	.sv-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.sv-tick,
	.sv-label {
		fill: var(--text-muted);
		font-size: 11px;
		text-anchor: middle;
	}
	.sv-label {
		font-size: 14px;
		font-weight: 600;
		fill: var(--text);
	}
	.sv-a {
		--c: var(--cat-1);
	}
	.sv-b {
		--c: var(--cat-2);
	}
	.sv-band {
		fill: var(--c);
		opacity: 0.18;
	}
	.sv-dot {
		fill: var(--c);
	}
	.sv-mean {
		stroke: var(--c);
		stroke-width: 2;
	}
	.sv-stats {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-4);
	}
	.sv-stats dt {
		color: var(--text-muted);
	}
	.sv-stats dd {
		font-family: var(--font-mono);
	}
	.sv-note {
		margin-top: var(--space-3);
	}
	.sv-notice {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
</style>
