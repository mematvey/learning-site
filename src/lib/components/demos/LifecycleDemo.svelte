<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DEFAULT_STATE,
		FREQS,
		HOURS_PER_PERSON,
		INCIDENT_C,
		INCIDENT_P,
		LIMIT_SHARE,
		MODELS_MAX,
		MODELS_MIN,
		PAYBACK_EXAMPLES,
		SETUP_H,
		T_AUTO,
		T_MANUAL,
		TEAM_MAX,
		TEAM_MIN,
		computeLoad,
		describeLifecycle,
		formatFreq,
		formatRu,
		freqIndex,
		maxManualModels,
		paybackMonths,
		incidentHoursPerModel,
		snapFreq,
		snapModels,
		snapTeam,
		statusText,
		type LifecycleDemoState,
	} from '$lib/demos/lifecycle';

	/** MLOps lifecycle demo: where manual releases stop fitting into the team's time. Registers as demo `lifecycle`. */
	let { initial }: { initial?: Partial<LifecycleDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let models = $state(snapModels(initial?.models ?? DEFAULT_STATE.models));
	/* svelte-ignore state_referenced_locally */
	let freq = $state(snapFreq(initial?.freq ?? DEFAULT_STATE.freq));
	/* svelte-ignore state_referenced_locally */
	let team = $state(snapTeam(initial?.team ?? DEFAULT_STATE.team));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const current: LifecycleDemoState = $derived({ models, freq, team });
	const load = $derived(computeLoad(current));
	const manualPct = $derived(Math.round(load.manualShare * 100));
	const autoPct = $derived(Math.round(load.autoShare * 100));
	/** Bar widths are capped at the team's full time; the number next to a bar shows the real share. */
	const manualWidth = $derived(Math.min(1, load.manualShare) * 100);
	const autoWidth = $derived(Math.min(1, load.autoShare) * 100);
	const maxModels = $derived(maxManualModels(freq, team));
	const payback = $derived(paybackMonths(freq));
	const description = $derived(describeLifecycle(current, load));

	/** Index of the current frequency in FREQS (the slider position). */
	const freqPos = $derived(freqIndex(freq));

	function reset(): void {
		models = DEFAULT_STATE.models;
		freq = DEFAULT_STATE.freq;
		team = DEFAULT_STATE.team;
	}

	function apply(patch: Partial<LifecycleDemoState>): void {
		if (typeof patch.models === 'number') models = snapModels(patch.models);
		if (typeof patch.freq === 'number') freq = snapFreq(patch.freq);
		if (typeof patch.team === 'number') team = snapTeam(patch.team);
	}

	onMount(() => {
		return demos?.register('lifecycle', {
			set: (patch) => apply(patch as Partial<LifecycleDemoState>),
		});
	});
</script>

<figure class="lc" id="demo-lifecycle" data-demo="lifecycle" data-status={load.status}>
	<div class="lc-controls">
		<label class="lc-ctl">
			<span class="lc-label">Моделей в эксплуатации</span>
			<input
				class="lc-range"
				type="range"
				min={MODELS_MIN}
				max={MODELS_MAX}
				step="1"
				value={models}
				oninput={(e) => (models = snapModels(Number(e.currentTarget.value)))}
			/>
			<output class="lc-val">{models}</output>
		</label>

		<label class="lc-ctl">
			<span class="lc-label">Выкладок в месяц на модель</span>
			<input
				class="lc-range"
				type="range"
				min="0"
				max={FREQS.length - 1}
				step="1"
				value={freqPos}
				oninput={(e) => (freq = snapFreq(FREQS[Number(e.currentTarget.value)] ?? freq))}
			/>
			<output class="lc-val">{formatFreq(freq)}</output>
		</label>

		<label class="lc-ctl">
			<span class="lc-label">Людей в команде</span>
			<input
				class="lc-range"
				type="range"
				min={TEAM_MIN}
				max={TEAM_MAX}
				step="1"
				value={team}
				oninput={(e) => (team = snapTeam(Number(e.currentTarget.value)))}
			/>
			<output class="lc-val">{team}</output>
		</label>

		<button type="button" class="lc-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="lc-load">
		<p class="lc-load-t">
			Время команды в месяц: <span class="lc-muted">{HOURS_PER_PERSON} ч на человека</span>, всего
			{load.capacityH} ч
		</p>

		<div class="lc-row">
			<span class="lc-row-label">Вручную</span>
			<div class="lc-track" aria-hidden="true">
				<div class="lc-fill lc-fill-manual" style:width="{manualWidth}%"></div>
				<div class="lc-limit" style:left="{LIMIT_SHARE * 100}%"></div>
				<div class="lc-full"></div>
			</div>
			<span class="lc-row-val">{Math.round(load.manualH)} ч · {manualPct}%</span>
		</div>

		<div class="lc-row">
			<span class="lc-row-label">С автоматизацией</span>
			<div class="lc-track" aria-hidden="true">
				<div class="lc-fill lc-fill-auto" style:width="{autoWidth}%"></div>
				<div class="lc-limit" style:left="{LIMIT_SHARE * 100}%"></div>
				<div class="lc-full"></div>
			</div>
			<span class="lc-row-val">{Math.round(load.autoH)} ч · {autoPct}%</span>
		</div>

		<p class="lc-scale">
			Вертикальная черта справа — 100% времени команды. Серая черта — порог {Math.round(
				LIMIT_SHARE * 100,
			)}%, после которого ручной процесс на пределе.
		</p>
	</div>

	<div class="lc-status lc-status-{load.status}">
		<p class="lc-status-t">{statusText(load.status)}</p>
		<p class="lc-status-n">
			Ручная работа в месяц: {Math.round(load.manualH)} ч, из них выкладки {Math.round(
				load.manualReleaseH,
			)} ч и сбои {Math.round(load.incidentH)} ч. При этой частоте и команде вручную справятся не больше
			{maxModels} моделей.
		</p>
	</div>

	<div class="lc-payback">
		<p class="lc-payback-t">Окупаемость автоматизации одной модели (учебные числа)</p>
		<p class="lc-formula">
			τ = S / (f · (T<sub>m</sub> − T<sub>a</sub>)) = {SETUP_H} / ({formatFreq(freq)} · ({T_MANUAL} −
			{T_AUTO})) = <strong>{formatRu(payback, 1)} мес</strong>
		</p>
		<table class="lc-table">
			<thead>
				<tr>
					<th scope="col">Выкладок в месяц</th>
					<th scope="col">Окупаемость, мес</th>
				</tr>
			</thead>
			<tbody>
				{#each PAYBACK_EXAMPLES as ex (ex.freq)}
					<tr class:is-current={ex.freq === freq}>
						<td>{formatFreq(ex.freq)}</td>
						<td>{formatRu(ex.months, 1)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="lc-muted lc-small">
			Три строки таблицы совпадают с примером в главе. Текущая частота выделена, если совпала.
		</p>
	</div>

	<div class="lc-assume">
		<p class="lc-assume-t">Учебные допущения (не данные)</p>
		<ul>
			<li>
				ручная выкладка {T_MANUAL} ч, автоматическая {T_AUTO} ч; настройка автоматизации {SETUP_H} ч;
			</li>
			<li>
				инцидент с вероятностью {formatRu(INCIDENT_P, 2)} в месяц на модель, стоит {INCIDENT_C} ч: ожидаемо
				{formatRu(incidentHoursPerModel(), 0)} ч/мес на модель, и автоматизация выкладок их не убирает;
			</li>
			<li>{HOURS_PER_PERSON} ч рабочего времени в месяц на человека.</li>
		</ul>
		<p class="lc-muted lc-small">Замените их оценками своей команды.</p>
	</div>

	<div class="lc-note">
		<p class="lc-note-t">Что заметить</p>
		<p>
			Рост числа моделей или частоты переобучения увеличивает ручную работу быстрее, чем размер
			команды. Редкие выкладки окупают автоматизацию медленно, частые окупают быстро.
		</p>
	</div>

	<p class="lc-sr" aria-live="polite">{description}</p>
	<!-- The visible status above is aria-live-free on purpose: the sr-only paragraph announces every change once. -->
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
		min-width: 0;
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.lc :global(*),
	.lc :global(*::before),
	.lc :global(*::after) {
		box-sizing: border-box;
	}
	.lc p,
	.lc ul,
	.lc li {
		margin: 0;
	}
	.lc ul {
		padding-left: var(--space-5);
	}
	.lc button {
		font: inherit;
	}
	.lc-muted {
		color: var(--text-muted);
	}
	.lc-small {
		font-size: 12px;
		margin-top: var(--space-2);
	}
	.lc-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* Controls */
	.lc-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.lc-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}
	.lc-label {
		color: var(--text-muted);
	}
	.lc-range {
		width: 140px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.lc-val {
		min-width: 3ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.lc-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.lc-range:focus-visible,
	.lc-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Load bars */
	.lc-load {
		margin-top: var(--space-6);
	}
	.lc-load-t {
		margin-bottom: var(--space-3);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.lc-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-2);
	}
	.lc-row-label {
		color: var(--text-muted);
	}
	.lc-row-val {
		grid-column: 1 / -1;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.lc-track {
		position: relative;
		height: 18px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.lc-fill {
		height: 100%;
		transition: width var(--dur) var(--ease);
	}
	.lc-fill-manual {
		background: var(--warn);
	}
	.lc-fill-auto {
		background: var(--cat-1);
	}
	.lc-limit {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--text-muted);
	}
	.lc-full {
		position: absolute;
		top: 0;
		bottom: 0;
		right: 0;
		width: 2px;
		background: var(--text);
	}
	.lc-scale {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}

	/* Status */
	.lc-status {
		margin-top: var(--space-5);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-left: 4px solid var(--topic);
		border-radius: var(--radius);
		background: var(--bg);
	}
	.lc-status-limit {
		border-left-color: var(--warn);
	}
	.lc-status-overload {
		border-left-color: var(--warn);
		background: var(--warn-bg);
	}
	.lc-status-t {
		font-weight: 600;
	}
	.lc-status-n {
		margin-top: var(--space-1);
		color: var(--text-muted);
	}

	/* Payback */
	.lc-payback {
		margin-top: var(--space-6);
	}
	.lc-payback-t,
	.lc-assume-t,
	.lc-note-t {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		margin-bottom: var(--space-2);
	}
	.lc-formula {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	.lc-table {
		width: 100%;
		max-width: 420px;
		margin-top: var(--space-3);
		border-collapse: collapse;
		font-size: 13px;
	}
	.lc-table th,
	.lc-table td {
		padding: var(--space-1) var(--space-3);
		border-bottom: 1px solid var(--border);
		text-align: left;
	}
	.lc-table td {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.lc-table th {
		color: var(--text-muted);
		font-weight: 400;
	}
	.lc-table tr.is-current td {
		background: var(--topic-soft);
	}

	/* Assumptions and notes */
	.lc-assume,
	.lc-note {
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.lc-assume ul {
		margin-top: var(--space-1);
		color: var(--text-muted);
	}
	.lc-note p:last-child {
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.lc *,
		.lc *::before,
		.lc *::after {
			transition: none !important;
		}
	}

	@media (max-width: 559px) {
		.lc {
			padding: var(--space-4);
		}
		.lc-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.lc-ctl {
			flex-wrap: wrap;
		}
		.lc-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.lc-row {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
