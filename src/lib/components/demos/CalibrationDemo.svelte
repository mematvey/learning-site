<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		COST_MAX,
		COST_MIN,
		COST_STEP,
		DEFAULT_STATE,
		OVER_MAX,
		OVER_MIN,
		OVER_STEP,
		PREV_MAX,
		PREV_MIN,
		PREV_STEP,
		type CalMethod,
		type CalibrationDemoState,
		type Group,
		computeDemo,
		isCalMethod,
		snapCost,
		snapOverconfidence,
		snapPrevalence,
	} from '$lib/demos/calibration-imbalance';

	/** Calibration demo: reliability diagram, calibration methods and a cost-based threshold. Registers as demo `calibration-imbalance`. */
	let { initial }: { initial?: Partial<CalibrationDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let prevalence = $state(snapPrevalence(initial?.prevalence ?? DEFAULT_STATE.prevalence));
	/* svelte-ignore state_referenced_locally */
	let overconfidence = $state(
		snapOverconfidence(initial?.overconfidence ?? DEFAULT_STATE.overconfidence),
	);
	/* svelte-ignore state_referenced_locally */
	let costFn = $state(snapCost(initial?.costFn ?? DEFAULT_STATE.costFn));
	/* svelte-ignore state_referenced_locally */
	let method = $state<CalMethod>(
		isCalMethod(initial?.method) ? initial.method : DEFAULT_STATE.method,
	);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const result = $derived(computeDemo({ prevalence, overconfidence, costFn, method }));

	/** Chart geometry in the SVG viewBox. */
	const W = 320;
	const H = 300;
	const PL = 40;
	const PR = 12;
	const PT = 12;
	const PB = 36;

	function px(v: number): number {
		return PL + v * (W - PL - PR);
	}
	function py(v: number): number {
		return H - PB - v * (H - PT - PB);
	}
	function radius(count: number, groups: readonly Group[]): number {
		const maxCount = Math.max(1, ...groups.map((g) => g.count));
		return 3 + 6 * Math.sqrt(count / maxCount);
	}
	function polyline(groups: readonly Group[]): string {
		return groups.map((g) => `${px(g.conf).toFixed(1)},${py(g.acc).toFixed(1)}`).join(' ');
	}

	const beforeLine = $derived(polyline(result.before));
	const afterLine = $derived(result.after ? polyline(result.after) : '');
	const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
	const methodName: Record<CalMethod, string> = {
		none: 'без калибровки',
		platt: 'масштабирование по Платту',
		isotonic: 'изотоническая регрессия',
	};

	const liveText = $derived(
		`Доля положительных ${pct(result.positiveShare)}. ` +
			`Ожидаемая ошибка калибровки до калибровки ${result.eceBefore.toFixed(3)}` +
			(result.eceAfter !== null
				? `, после (${methodName[method]}) ${result.eceAfter.toFixed(3)}. `
				: '. Калибровка выключена. ') +
			`Порог по стоимости ${result.threshold.toFixed(3)}: поймано ${result.atThreshold.caught} из ${
				result.atThreshold.caught + result.atThreshold.missed
			} положительных, суммарная цена ${result.atThreshold.cost}. ` +
			`Порог 0.5: поймано ${result.atHalf.caught}, цена ${result.atHalf.cost}.`,
	);

	const note = $derived(
		result.eceAfter === null
			? 'Калибровка выключена: точки на диаграмме остаются там, где их дала модель. Выберите Платта или изотоническую регрессию.'
			: result.eceAfter < result.eceBefore
				? 'Калибровка вернула точки к диагонали: ошибка калибровки упала. Порядок объектов при этом не менялся.'
				: 'Калибровка почти не помогла: модель уже была откалибрована.',
	);

	function apply(patch: Partial<CalibrationDemoState>): void {
		if (typeof patch.prevalence === 'number') prevalence = snapPrevalence(patch.prevalence);
		if (typeof patch.overconfidence === 'number')
			overconfidence = snapOverconfidence(patch.overconfidence);
		if (typeof patch.costFn === 'number') costFn = snapCost(patch.costFn);
		if (isCalMethod(patch.method)) method = patch.method;
	}

	function reset(): void {
		apply(DEFAULT_STATE);
	}

	onMount(() => {
		return demos?.register('calibration-imbalance', {
			set: (patch) => apply(patch as Partial<CalibrationDemoState>),
		});
	});
</script>

<figure class="cal" id="demo-calibration-imbalance" data-demo="calibration-imbalance">
	<div class="cal-controls">
		<div class="cal-group" role="group" aria-label="Калибровка">
			<button
				type="button"
				class="cal-seg"
				aria-pressed={method === 'none'}
				onclick={() => (method = 'none')}>Без калибровки</button
			>
			<button
				type="button"
				class="cal-seg"
				aria-pressed={method === 'platt'}
				onclick={() => (method = 'platt')}>Платт</button
			>
			<button
				type="button"
				class="cal-seg"
				aria-pressed={method === 'isotonic'}
				onclick={() => (method = 'isotonic')}>Изотоническая</button
			>
		</div>

		<label class="cal-ctl">
			<span class="cal-label">Базовый уровень положительных</span>
			<input
				class="cal-range"
				type="range"
				min={PREV_MIN}
				max={PREV_MAX}
				step={PREV_STEP}
				value={prevalence}
				oninput={(e) => (prevalence = snapPrevalence(Number(e.currentTarget.value)))}
			/>
			<output class="cal-val">{pct(prevalence)}</output>
		</label>

		<label class="cal-ctl">
			<span class="cal-label">Самоуверенность</span>
			<input
				class="cal-range"
				type="range"
				min={OVER_MIN}
				max={OVER_MAX}
				step={OVER_STEP}
				value={overconfidence}
				oninput={(e) => (overconfidence = snapOverconfidence(Number(e.currentTarget.value)))}
			/>
			<output class="cal-val">{overconfidence.toFixed(2)}</output>
		</label>

		<label class="cal-ctl">
			<span class="cal-label">Цена пропуска c<sub>FN</sub> (ложная тревога = 1)</span>
			<input
				class="cal-range"
				type="range"
				min={COST_MIN}
				max={COST_MAX}
				step={COST_STEP}
				value={costFn}
				oninput={(e) => (costFn = snapCost(Number(e.currentTarget.value)))}
			/>
			<output class="cal-val">{costFn}</output>
		</label>

		<button type="button" class="cal-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="cal-plot">
		<svg class="cal-svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="cal-title cal-desc">
			<title id="cal-title">Диаграмма надёжности</title>
			<desc id="cal-desc">
				По горизонтали выданная вероятность, по вертикали доля положительных в группе. До калибровки
				ломаная уходит от диагонали, после калибровки {method === 'none'
					? 'калибровки нет'
					: methodName[method]}
				ближе к ней. Ожидаемая ошибка до {result.eceBefore.toFixed(3)}.
			</desc>
			<rect class="cal-frame" x={PL} y={PT} width={W - PL - PR} height={H - PT - PB} />
			{#each [0, 0.5, 1] as t (t)}
				<line class="cal-grid" x1={px(t)} x2={px(t)} y1={py(0)} y2={py(1)} />
				<line class="cal-grid" x1={px(0)} x2={px(1)} y1={py(t)} y2={py(t)} />
				<text class="cal-tick" x={px(t)} y={H - PB + 14} text-anchor="middle">{t}</text>
				<text class="cal-tick" x={PL - 6} y={py(t) + 4} text-anchor="end">{t}</text>
			{/each}
			<line class="cal-diag" x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} />
			<text class="cal-axis" x={(PL + W - PR) / 2} y={H - 4} text-anchor="middle"
				>выданная вероятность</text
			>
			<text
				class="cal-axis"
				x="12"
				y={(PT + H - PB) / 2}
				text-anchor="middle"
				transform="rotate(-90 12 {(PT + H - PB) / 2})">доля положительных</text
			>

			<polyline class="cal-line cal-line-before" points={beforeLine} />
			{#each result.before as g, i (i)}
				<circle
					class="cal-dot cal-dot-before"
					cx={px(g.conf).toFixed(1)}
					cy={py(g.acc).toFixed(1)}
					r={radius(g.count, result.before).toFixed(1)}
				>
					<title>{g.count} объектов: выдано {pct(g.conf)}, положительных {pct(g.acc)}</title>
				</circle>
			{/each}

			{#if result.after}
				<polyline class="cal-line cal-line-after" points={afterLine} />
				{#each result.after as g, i (i)}
					<circle
						class="cal-dot cal-dot-after"
						cx={px(g.conf).toFixed(1)}
						cy={py(g.acc).toFixed(1)}
						r={radius(g.count, result.after).toFixed(1)}
					>
						<title>после калибровки: выдано {pct(g.conf)}, положительных {pct(g.acc)}</title>
					</circle>
				{/each}
			{/if}
		</svg>
		<p class="cal-legend">
			<span class="cal-key cal-key-before"></span> до калибровки
			{#if result.after}
				<span class="cal-key cal-key-after"></span> после: {methodName[method]}
			{/if}
		</p>
	</div>

	<dl class="cal-stats">
		<dt>Ожидаемая ошибка калибровки</dt>
		<dd>
			до {result.eceBefore.toFixed(3)}{result.eceAfter !== null
				? `, после ${result.eceAfter.toFixed(3)}`
				: ''}
		</dd>
		<dt>Положительных в проверочной половине</dt>
		<dd>{pct(result.positiveShare)} из {result.evalSize}</dd>
		<dt>Порог по стоимости</dt>
		<dd>t* = 1 / (1 + {costFn}) = {result.threshold.toFixed(3)}</dd>
	</dl>

	<table class="cal-table">
		<thead>
			<tr>
				<th scope="col">Решение</th>
				<th scope="col">порог t*</th>
				<th scope="col">порог 0.5</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<th scope="row">отмечено «да»</th>
				<td>{result.atThreshold.flagged}</td>
				<td>{result.atHalf.flagged}</td>
			</tr>
			<tr>
				<th scope="row">поймано положительных</th>
				<td>{result.atThreshold.caught}</td>
				<td>{result.atHalf.caught}</td>
			</tr>
			<tr>
				<th scope="row">пропущено положительных</th>
				<td>{result.atThreshold.missed}</td>
				<td>{result.atHalf.missed}</td>
			</tr>
			<tr>
				<th scope="row">ложных тревог</th>
				<td>{result.atThreshold.falseAlarms}</td>
				<td>{result.atHalf.falseAlarms}</td>
			</tr>
			<tr>
				<th scope="row">суммарная цена</th>
				<td>{result.atThreshold.cost}</td>
				<td>{result.atHalf.cost}</td>
			</tr>
		</tbody>
	</table>

	<p class="cal-note">{note}</p>
	<p class="cal-live" aria-live="polite">{liveText}</p>
</figure>

<style>
	.cal {
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
	}
	.cal dl,
	.cal dd,
	.cal dt,
	.cal p {
		margin: 0;
	}
	.cal button {
		font: inherit;
	}

	/* Controls */
	.cal-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cal-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.cal-seg,
	.cal-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.cal-reset {
		border: 1px solid var(--border);
		color: var(--text);
	}
	.cal-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.cal-seg:focus-visible,
	.cal-reset:focus-visible,
	.cal-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.cal-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.cal-label {
		color: var(--text-muted);
	}
	.cal-range {
		width: 140px;
		max-width: 100%;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cal-val {
		min-width: 4ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Chart */
	.cal-plot {
		margin-top: var(--space-6);
		max-width: 420px;
	}
	.cal-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.cal-frame {
		fill: none;
		stroke: var(--border);
	}
	.cal-grid {
		stroke: var(--border);
		stroke-width: 0.5;
	}
	.cal-diag {
		stroke: var(--text-muted);
		stroke-dasharray: 4 4;
	}
	.cal-tick,
	.cal-axis {
		fill: var(--text-muted);
		font-size: 11px;
		font-family: var(--font-mono);
	}
	.cal-line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.cal-line-before {
		stroke: var(--warn);
	}
	.cal-line-after {
		stroke: var(--topic);
	}
	.cal-dot {
		fill-opacity: 0.85;
	}
	.cal-dot-before {
		fill: var(--warn);
	}
	.cal-dot-after {
		fill: var(--topic);
	}
	.cal-legend {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.cal-key {
		display: inline-block;
		width: 12px;
		height: 3px;
		margin: 0 4px 2px 8px;
		vertical-align: middle;
	}
	.cal-key-before {
		background: var(--warn);
	}
	.cal-key-after {
		background: var(--topic);
	}

	/* Stats and table */
	.cal-stats {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-6);
	}
	.cal-stats dt {
		color: var(--text-muted);
	}
	.cal-stats dd {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.cal-table {
		width: 100%;
		margin-top: var(--space-6);
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.cal-table th,
	.cal-table td {
		padding: var(--space-2) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: left;
	}
	.cal-table td {
		font-family: var(--font-mono);
		font-size: 13px;
		text-align: right;
	}
	.cal-table thead th {
		color: var(--text-muted);
		font-weight: 500;
	}
	.cal-table thead th:not(:first-child) {
		text-align: right;
	}
	.cal-table tbody th {
		font-weight: 400;
		color: var(--text);
	}

	.cal-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	/* Read by screen readers through aria-live; visually hidden. */
	.cal-live {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 480px) {
		.cal {
			padding: var(--space-4);
		}
		.cal-range {
			width: 110px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cal-seg,
		.cal-reset {
			transition: none;
		}
	}
</style>
