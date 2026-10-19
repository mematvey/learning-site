<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		CACHE_STEP,
		DEFAULT_STATE,
		ROUTE_STEP,
		SUCCESS_MAX,
		SUCCESS_MIN,
		SUCCESS_STEP,
		type LlmCostDemoState,
		computeBreakdown,
		describeBreakdown,
		formatUnits,
		normalizeState,
		percent,
		summarize,
	} from '$lib/demos/llm-cost-finops';

	/** Cost per successful task: routing, prefix cache, success rates. Registers as demo `llm-cost-finops`. */
	let { initial }: { initial?: Partial<LlmCostDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let state = $state<LlmCostDemoState>(normalizeState(initial ?? {}));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const model = $derived(computeBreakdown(state));
	const lines = $derived(describeBreakdown(state, model));
	const live = $derived(summarize(model));
	const inShare = $derived((model.perSuccess.input / model.perSuccess.total) * 100);
	const outShare = $derived(100 - inShare);
	const isSaving = $derived(model.saving >= 0);

	function update(patch: Partial<LlmCostDemoState>): void {
		state = normalizeState({ ...state, ...patch }, DEFAULT_STATE);
	}

	function reset(): void {
		state = { ...DEFAULT_STATE };
	}

	onMount(() => {
		return demos?.register('llm-cost-finops', {
			set: (patch) => update(patch as Partial<LlmCostDemoState>),
		});
	});
</script>

<figure
	class="lc"
	id="demo-llm-cost-finops"
	data-demo="llm-cost-finops"
	aria-label="Калькулятор цены за успешную задачу"
>
	<div class="lc-controls">
		<label class="lc-ctl">
			<span class="lc-label">Доля дешёвого маршрута</span>
			<output class="lc-val">{state.routeShare}%</output>
			<input
				class="lc-range"
				type="range"
				min="0"
				max="100"
				step={ROUTE_STEP}
				value={state.routeShare}
				oninput={(e) => update({ routeShare: Number(e.currentTarget.value) })}
			/>
		</label>

		<label class="lc-ctl">
			<span class="lc-label">Входные токены в кэше</span>
			<output class="lc-val">{state.cacheShare}%</output>
			<input
				class="lc-range"
				type="range"
				min="0"
				max="100"
				step={CACHE_STEP}
				value={state.cacheShare}
				oninput={(e) => update({ cacheShare: Number(e.currentTarget.value) })}
			/>
		</label>

		<label class="lc-ctl">
			<span class="lc-label">Успешность дешёвого маршрута</span>
			<output class="lc-val">{state.successLow}%</output>
			<input
				class="lc-range"
				type="range"
				min={SUCCESS_MIN}
				max={SUCCESS_MAX}
				step={SUCCESS_STEP}
				value={state.successLow}
				oninput={(e) => update({ successLow: Number(e.currentTarget.value) })}
			/>
		</label>

		<label class="lc-ctl">
			<span class="lc-label">Успешность дорогого маршрута</span>
			<output class="lc-val">{state.successHigh}%</output>
			<input
				class="lc-range"
				type="range"
				min={SUCCESS_MIN}
				max={SUCCESS_MAX}
				step={SUCCESS_STEP}
				value={state.successHigh}
				oninput={(e) => update({ successHigh: Number(e.currentTarget.value) })}
			/>
		</label>
	</div>

	<div class="lc-result" aria-live="polite">
		<p class="lc-big">
			<span class="lc-big-num">{formatUnits(model.perSuccess.total)}</span>
			<span class="lc-big-unit">у.е. за успешную задачу</span>
		</p>
		<p class="lc-ref">
			Дорогая модель без маршрутизации: {formatUnits(model.reference)} у.е.
			<span class="lc-save" class:is-cost={!isSaving}
				>{isSaving ? 'экономия' : 'перерасход'} {percent(Math.abs(model.saving))}%</span
			>
		</p>
		<span class="lc-sr">{live}</span>
	</div>

	<div class="lc-bar" aria-hidden="true">
		<span class="lc-seg lc-seg-in" style:width="{inShare}%"></span>
		<span class="lc-seg lc-seg-out" style:width="{outShare}%"></span>
	</div>

	<dl class="lc-split">
		<dt><span class="lc-sw lc-sw-in" aria-hidden="true"></span>Входные токены</dt>
		<dd>{formatUnits(model.perSuccess.input)}</dd>
		<dt><span class="lc-sw lc-sw-out" aria-hidden="true"></span>Выходные токены</dt>
		<dd>{formatUnits(model.perSuccess.output)}</dd>
		<dt class="lc-muted">в том числе на неудачные задачи</dt>
		<dd class="lc-muted">{formatUnits(model.failed)}</dd>
	</dl>

	<table class="lc-table">
		<caption class="lc-cap">Цена по маршрутам, у.е.</caption>
		<thead>
			<tr>
				<th scope="col">Маршрут</th>
				<th scope="col">Вызов</th>
				<th scope="col">Задача</th>
				<th scope="col">Успешность</th>
				<th scope="col">За успех</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<th scope="row">Дешёвый</th>
				<td>{formatUnits(model.low.call.total)}</td>
				<td>{formatUnits(model.low.task.total)}</td>
				<td>{percent(model.low.success)}%</td>
				<td>{formatUnits(model.low.task.total / model.low.success)}</td>
			</tr>
			<tr>
				<th scope="row">Дорогой</th>
				<td>{formatUnits(model.high.call.total)}</td>
				<td>{formatUnits(model.high.task.total)}</td>
				<td>{percent(model.high.success)}%</td>
				<td>{formatUnits(model.high.task.total / model.high.success)}</td>
			</tr>
			<tr class="lc-mix">
				<th scope="row">Смесь</th>
				<td>—</td>
				<td>{formatUnits(model.avg.total)}</td>
				<td>{percent(model.success)}%</td>
				<td>{formatUnits(model.perSuccess.total)}</td>
			</tr>
		</tbody>
	</table>

	<section class="lc-why" aria-labelledby="lc-why-title">
		<p id="lc-why-title" class="lc-h">Причина и следствие</p>
		<ul class="lc-list">
			{#each lines as line, i (i)}
				<li>{line}</li>
			{/each}
		</ul>
	</section>

	<div class="lc-actions">
		<button type="button" class="lc-btn" onclick={reset}>Сбросить к значениям по умолчанию</button>
	</div>
</figure>

<style>
	.lc {
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
	.lc :global(*),
	.lc :global(*::before),
	.lc :global(*::after) {
		box-sizing: border-box;
	}
	.lc dl,
	.lc dd,
	.lc dt,
	.lc p,
	.lc ul,
	.lc table {
		margin: 0;
	}
	.lc button {
		font: inherit;
	}
	.lc-muted {
		color: var(--text-muted);
	}
	.lc-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* Sliders */
	.lc-controls {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.lc-ctl {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.lc-label {
		grid-column: 1;
		color: var(--text-muted);
	}
	.lc-val {
		grid-column: 2;
		min-width: 4ch;
		text-align: right;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.lc-range {
		grid-column: 1 / -1;
		width: 100%;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.lc-range:focus-visible,
	.lc-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Result */
	.lc-result {
		margin-top: var(--space-6);
	}
	.lc-big {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
	}
	.lc-big-num {
		font-family: var(--font-mono);
		font-size: 28px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--topic);
	}
	.lc-big-unit {
		color: var(--text-muted);
	}
	.lc-ref {
		margin-top: var(--space-1);
		color: var(--text-muted);
	}
	.lc-save {
		margin-left: var(--space-2);
		color: var(--ok);
		font-weight: 600;
	}
	.lc-save.is-cost {
		color: var(--fail);
	}

	/* Breakdown bar */
	.lc-bar {
		display: flex;
		height: 16px;
		margin-top: var(--space-4);
		overflow: hidden;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.lc-seg {
		display: block;
		height: 100%;
		transition: width var(--dur) var(--ease);
	}
	.lc-seg-in {
		background: var(--cat-1);
	}
	.lc-seg-out {
		background: var(--cat-3);
	}
	.lc-split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-3);
	}
	.lc-split dt {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text);
	}
	.lc-split dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.lc-sw {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
	.lc-sw-in {
		background: var(--cat-1);
	}
	.lc-sw-out {
		background: var(--cat-3);
	}

	/* Route table */
	.lc-table {
		width: 100%;
		margin-top: var(--space-6);
		table-layout: fixed;
		border-collapse: collapse;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.lc-cap {
		caption-side: top;
		padding-bottom: var(--space-2);
		text-align: left;
		color: var(--text-muted);
	}
	.lc-table th,
	.lc-table td {
		padding: var(--space-2) var(--space-1);
		border-bottom: 1px solid var(--border);
		text-align: right;
		overflow-wrap: anywhere;
	}
	.lc-table th {
		color: var(--text-muted);
		font-weight: 600;
		font-size: 12px;
	}
	.lc-table th:first-child,
	.lc-table tbody th {
		text-align: left;
		color: var(--text);
		font-weight: 600;
	}
	.lc-table td {
		font-family: var(--font-mono);
		color: var(--text);
	}
	.lc-mix td,
	.lc-mix th {
		background: var(--surface-2);
	}

	/* Cause and effect */
	.lc-why {
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.lc-h {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: var(--space-2);
	}
	.lc-list {
		padding-left: var(--space-4);
		display: grid;
		gap: var(--space-1);
		color: var(--text);
	}
	.lc-list li {
		transition: opacity var(--dur) var(--ease);
	}
	.lc-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-4);
	}
	.lc-btn {
		min-height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--dur) var(--ease);
	}
	.lc-btn:hover {
		background: var(--surface-2);
	}

	@media (prefers-reduced-motion: reduce) {
		.lc *,
		.lc *::before,
		.lc *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.lc {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.lc-controls {
			grid-template-columns: minmax(0, 1fr);
		}
		.lc-big-num {
			font-size: 24px;
		}
		.lc-table {
			font-size: 12px;
		}
	}
</style>
