<script lang="ts">
	import {
		B_MAX,
		B_MIN,
		DEFAULT_STATE,
		MODES,
		MODE_LABEL,
		N_MAX,
		N_MIN,
		W_STEPS,
		allTotals,
		wAt,
		explain,
		fmt,
		formulaText,
		modeOf,
		snapB,
		snapN,
		summaryText,
		timeline,
		wIndexOf,
		type CompileGraphsState,
	} from '$lib/demos/compile-graphs';

	/**
	 * Eager / compile / CUDA graph on one chain of small operations, in abstract time units.
	 * The props only seed the initial state: the demo owns it afterwards.
	 */
	let { initial }: { initial?: Partial<CompileGraphsState> } = $props();

	/* svelte-ignore state_referenced_locally */
	let compile = $state(initial?.compile ?? DEFAULT_STATE.compile);
	/* svelte-ignore state_referenced_locally */
	let graph = $state(initial?.graph ?? DEFAULT_STATE.graph);
	/* svelte-ignore state_referenced_locally */
	let n = $state(snapN(initial?.n ?? DEFAULT_STATE.n));
	/* svelte-ignore state_referenced_locally */
	let wIdx = $state(wIndexOf(initial?.w ?? DEFAULT_STATE.w));
	/* svelte-ignore state_referenced_locally */
	let b = $state(snapB(initial?.b ?? DEFAULT_STATE.b));

	const w = $derived(wAt(wIdx));
	const p = $derived({ n, w, b });
	const mode = $derived(modeOf(compile, graph));
	const totals = $derived(allTotals(p));
	/** One scale for all modes and the timeline, so the modes can be compared by length. */
	const scale = $derived(Math.max(...MODES.map((m) => totals[m])));
	const tl = $derived(timeline(mode, p));
	const formula = $derived(formulaText(mode, p));
	const why = $derived(explain(mode, p));
	const live = $derived(summaryText(mode, p));

	function pct(x: number): string {
		return `${(x / scale) * 100}%`;
	}

	function reset(): void {
		compile = DEFAULT_STATE.compile;
		graph = DEFAULT_STATE.graph;
		n = DEFAULT_STATE.n;
		wIdx = wIndexOf(DEFAULT_STATE.w);
		b = DEFAULT_STATE.b;
	}
</script>

<div class="cg" data-demo="compile-graphs">
	<div class="cg-controls">
		<div class="cg-switches" role="group" aria-label="Режим выполнения">
			<button
				type="button"
				class="cg-switch"
				aria-pressed={compile}
				onclick={() => (compile = !compile)}>torch.compile</button
			>
			<button type="button" class="cg-switch" aria-pressed={graph} onclick={() => (graph = !graph)}
				>CUDA graph</button
			>
		</div>
		<button type="button" class="cg-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="cg-sliders">
		<label class="cg-ctl">
			<span class="cg-label"><span class="cg-sym">N</span> операций</span>
			<input
				class="cg-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step="1"
				value={n}
				oninput={(e) => (n = snapN(Number(e.currentTarget.value)))}
			/>
			<output class="cg-val">{n}</output>
		</label>

		<label class="cg-ctl">
			<span class="cg-label"><span class="cg-sym">w</span> работа ядра</span>
			<input
				class="cg-range"
				type="range"
				min="0"
				max={W_STEPS.length - 1}
				step="1"
				value={wIdx}
				oninput={(e) => (wIdx = Number(e.currentTarget.value))}
			/>
			<output class="cg-val">{fmt(w)}</output>
		</label>

		<label class="cg-ctl">
			<span class="cg-label"><span class="cg-sym">B</span> разрывы графа</span>
			<input
				class="cg-range"
				type="range"
				min={B_MIN}
				max={B_MAX}
				step="1"
				value={b}
				oninput={(e) => (b = snapB(Number(e.currentTarget.value)))}
			/>
			<output class="cg-val">{b}</output>
		</label>
	</div>

	<p class="cg-formula">{formula}</p>

	<ul class="cg-bars" aria-label="Время четырёх режимов, условные единицы">
		{#each MODES as m (m)}
			<li
				class="cg-bar-row"
				class:is-current={m === mode}
				aria-current={m === mode ? 'true' : undefined}
			>
				<span class="cg-bar-name">{MODE_LABEL[m]}</span>
				<span class="cg-bar-track">
					<span class="cg-bar-fill" style:width={pct(totals[m])}></span>
				</span>
				<span class="cg-bar-val">{fmt(totals[m])}</span>
			</li>
		{/each}
	</ul>

	<div
		class="cg-tl"
		role="img"
		aria-label={`Шкала запусков, режим ${MODE_LABEL[mode]}, общее время ${fmt(tl.total)}`}
	>
		<div class="cg-row">
			<span class="cg-row-name">CPU</span>
			<div class="cg-lane">
				{#each tl.cpu as s, i (i)}
					<span class="cg-block cg-cpu" style:left={pct(s.start)} style:width={pct(s.end - s.start)}
					></span>
				{/each}
			</div>
		</div>
		<div class="cg-row">
			<span class="cg-row-name">GPU</span>
			<div class="cg-lane">
				{#each tl.gpu as s, i (i)}
					<span class="cg-block cg-gpu" style:left={pct(s.start)} style:width={pct(s.end - s.start)}
					></span>
				{/each}
			</div>
		</div>
		<p class="cg-axis">
			<span>0</span>
			<span>конец: {fmt(tl.total)}</span>
		</p>
	</div>

	<p class="cg-why">{why}</p>

	<p class="cg-tip">
		<strong>Что заметить:</strong> при w = 0,25 eager тратит почти всё время на запуски. Поставьте w =
		20: граф перестанет что-либо менять, а compile останется выгодным. Поставьте B = 2 и сравните compile
		с eager.
	</p>

	<p class="cg-sr" aria-live="polite">{live}</p>
</div>

<style>
	.cg {
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
		position: relative;
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.cg :global(*),
	.cg :global(*::before),
	.cg :global(*::after) {
		box-sizing: border-box;
	}
	.cg p,
	.cg ul {
		margin: 0;
		padding: 0;
	}
	.cg button {
		font: inherit;
	}
	.cg-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.cg-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cg-switches {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.cg-switch,
	.cg-reset {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.cg-switch[aria-pressed='true'] {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.cg-reset {
		background: none;
		color: var(--text);
	}
	.cg-switch:focus-visible,
	.cg-reset:focus-visible,
	.cg-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.cg-sliders {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3) var(--space-6);
		margin-top: var(--space-4);
	}
	.cg-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		min-width: 0;
	}
	.cg-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cg-range {
		flex: 1 1 110px;
		min-width: 0;
		width: 100%;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cg-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}

	.cg-formula {
		margin-top: var(--space-4);
		padding: var(--space-2) var(--space-3);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 13px;
		overflow-wrap: anywhere;
	}

	/* Bars: totals of all four modes */
	.cg-bars {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-4);
		list-style: none;
	}
	.cg-bar-row {
		display: grid;
		grid-template-columns: minmax(0, 11rem) minmax(0, 1fr) 4.5rem;
		align-items: center;
		gap: var(--space-3);
		color: var(--text-muted);
	}
	.cg-bar-row.is-current {
		color: var(--text);
		font-weight: 600;
	}
	.cg-bar-track {
		display: block;
		height: 14px;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.cg-bar-fill {
		display: block;
		height: 100%;
		min-width: 2px;
		background: var(--cat-1);
		transition: width var(--dur) var(--ease);
	}
	.cg-bar-row.is-current .cg-bar-fill {
		background: var(--topic);
	}
	.cg-bar-val {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-align: right;
		color: var(--text);
	}

	/* Timeline: CPU launches and GPU kernels on one scale */
	.cg-tl {
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.cg-row {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}
	.cg-row-name {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}
	.cg-lane {
		position: relative;
		height: 22px;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}
	.cg-block {
		position: absolute;
		top: 0;
		bottom: 0;
		min-width: 2px;
		border-radius: 2px;
	}
	.cg-cpu {
		background: var(--cat-3);
	}
	.cg-gpu {
		background: var(--topic);
	}
	.cg-axis {
		display: flex;
		justify-content: space-between;
		margin-left: calc(40px + var(--space-3));
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}

	.cg-why {
		margin-top: var(--space-4);
		color: var(--text);
	}
	.cg-tip {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}

	/* Visually hidden, read by screen readers on change */
	.cg-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.cg *,
		.cg *::before,
		.cg *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.cg {
			padding: var(--space-4);
		}
		.cg-sliders {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 559px) {
		.cg-bar-row {
			grid-template-columns: minmax(0, 7.5rem) minmax(0, 1fr) 3.5rem;
		}
		.cg-bar-name {
			font-size: 12px;
		}
	}
</style>
