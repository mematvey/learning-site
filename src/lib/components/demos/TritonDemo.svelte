<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		BLOCK_SIZES,
		DEFAULT_STATE,
		N_MAX,
		N_MIN,
		applyPatch,
		describeGrid,
		lastBlockUseful,
		maskedLanes,
		programCount,
		programLanes,
		uncoveredByFloor,
		type TritonDemoState,
	} from '$lib/demos/triton-intro';

	/** Triton grid demo: a vector cut into blocks, one program per block, mask on the tail. Registers itself as demo `triton-intro`. */
	let { initial }: { initial?: Partial<TritonDemoState> } = $props();

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const START = applyPatch(DEFAULT_STATE, initial ?? {});

	let st = $state<TritonDemoState>({ ...START });
	/** Real width of the chart in px; the SVG is drawn at this width (no viewBox scaling). */
	let plotW = $state(0);

	const LABEL_W = 56;
	const ROW_H = 16;
	const CELL_H = 12;
	const MIN_W = 320;

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const W = $derived(plotW >= 120 ? plotW : MIN_W);
	const P = $derived(programCount(st.n, st.block));
	const cell = $derived(Math.max(3, Math.min(22, Math.floor((W - LABEL_W - 4) / st.block))));
	const svgH = $derived(P * ROW_H);
	const rows = $derived(
		Array.from({ length: P }, (_, pid) => ({
			pid,
			lanes: programLanes(st.n, st.block, pid),
		})),
	);
	const masked = $derived(maskedLanes(st.n, st.block));
	const useful = $derived(lastBlockUseful(st.n, st.block));
	const lost = $derived(uncoveredByFloor(st.n, st.block));
	const desc = $derived(describeGrid(st.n, st.block));
	const chartDesc = $derived(
		`Вектор из ${st.n} элементов разбит на ${P} программ по ${st.block} позиций. Серые клетки замаскированы.`,
	);

	function apply(patch: Partial<TritonDemoState>): void {
		st = applyPatch(st, patch);
	}

	function reset(): void {
		st = { ...START };
	}

	onMount(() =>
		demos?.register('triton-intro', {
			set: (patch) => apply(patch as Partial<TritonDemoState>),
		}),
	);
</script>

<figure class="tr" id="demo-triton-intro" data-demo="triton-intro" class:hl-q={hl === 'q'}>
	<div class="tr-controls">
		<label class="tr-ctl">
			<span class="tr-label-t"><span class="tr-sym">n</span> (длина вектора)</span>
			<input
				class="tr-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step="1"
				value={st.n}
				oninput={(e) => apply({ n: Number(e.currentTarget.value) })}
			/>
			<output class="tr-val">{st.n}</output>
		</label>

		<div class="tr-group" role="group" aria-label="Размер блока B">
			{#each BLOCK_SIZES as b (b)}
				<button
					type="button"
					class="tr-seg"
					aria-pressed={st.block === b}
					onclick={() => apply({ block: b })}>B = {b}</button
				>
			{/each}
		</div>

		<button type="button" class="tr-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="tr-formula" aria-hidden="true">
		P = ⌈n / B⌉ = ⌈{st.n} / {st.block}⌉ = {P}
	</div>

	<div class="tr-panel" bind:clientWidth={plotW}>
		<svg
			class="tr-svg"
			viewBox="0 0 {W} {svgH}"
			height={svgH}
			role="img"
			aria-labelledby="tr-title tr-desc"
		>
			<title id="tr-title">Блоки программ Triton над вектором</title>
			<desc id="tr-desc">{chartDesc}</desc>
			<defs>
				<pattern id="tr-mask-pat" width="6" height="6" patternUnits="userSpaceOnUse">
					<rect class="tr-pat-bg" width="6" height="6" />
					<line class="tr-pat-line" x1="0" y1="0" x2="0" y2="6" />
				</pattern>
			</defs>
			{#each rows as row (row.pid)}
				<text class="tr-tick" x={LABEL_W - 8} y={row.pid * ROW_H + CELL_H - 2}>pid {row.pid}</text>
				{#each row.lanes as lane (lane.offset)}
					<rect
						class={lane.active ? 'tr-cell' : 'tr-cell tr-cell-masked'}
						x={(LABEL_W + lane.t * cell).toFixed(1)}
						y={row.pid * ROW_H}
						width={Math.max(1, cell - 1)}
						height={CELL_H}
					>
						<title
							>программа {row.pid}, позиция {lane.offset}{lane.active
								? ''
								: ' (замаскирована)'}</title
						>
					</rect>
				{/each}
			{/each}
		</svg>
	</div>

	<dl class="tr-stats">
		<dt>Величина</dt>
		<dd class="tr-h">значение</dd>
		<dt>Программ в сетке</dt>
		<dd>{P}</dd>
		<dt>Полезных позиций в последней</dt>
		<dd>{useful} из {st.block}</dd>
		<dt>Замаскировано всего</dt>
		<dd>{masked}</dd>
		<dt>Потерял бы хвост при // вместо ⌈ ⌉</dt>
		<dd>{lost}</dd>
	</dl>

	<p class="tr-note" aria-live="polite">{desc}</p>
</figure>

<style>
	.tr {
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
	.tr :global(*),
	.tr :global(*::before),
	.tr :global(*::after) {
		box-sizing: border-box;
	}
	.tr dl,
	.tr dd,
	.tr dt,
	.tr p,
	.tr ul {
		margin: 0;
	}
	.tr ul {
		padding-left: var(--space-4);
	}
	.tr button {
		font: inherit;
	}
	.tr-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.tr-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.tr-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.tr-label-t {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.tr-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.tr-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.tr-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.tr-seg,
	.tr-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.tr-reset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.tr-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.tr-seg:focus-visible,
	.tr-reset:focus-visible,
	.tr-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.tr-formula {
		margin-top: var(--space-4);
		color: var(--text);
		font-family: var(--font-serif);
		font-size: var(--fs-base);
		line-height: 1.3;
	}

	/* Chart: one row per program, one cell per lane */
	.tr-panel {
		margin-top: var(--space-6);
	}
	.tr-svg {
		display: block;
		width: 100%;
		overflow: visible;
	}
	.tr-cell {
		fill: var(--topic);
	}
	.tr-cell-masked {
		fill: url(#tr-mask-pat);
		stroke: var(--border);
		stroke-width: 1;
	}
	.tr-pat-bg {
		fill: var(--surface-2);
	}
	.tr-pat-line {
		stroke: var(--text-muted);
		stroke-width: 2;
	}
	.tr-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	/* Statistics */
	.tr-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.tr-stats dt {
		color: var(--text-muted);
	}
	.tr-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.tr-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	.tr.hl-q .tr-stats {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.tr *,
		.tr *::before,
		.tr *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.tr {
			padding: var(--space-4);
		}
		.tr-range {
			width: 120px;
		}
	}

	@media (max-width: 559px) {
		.tr-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.tr-ctl {
			flex-wrap: wrap;
		}
		.tr-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
