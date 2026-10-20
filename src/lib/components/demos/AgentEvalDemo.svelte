<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		CRITERION_LABEL,
		K_MAX,
		K_MIN,
		K_DEFAULT,
		P_DEFAULT,
		P_MAX,
		P_MIN,
		P_PRESETS,
		P_STEP,
		type AgentEvalDemoState,
		type Criterion,
		type Metric,
		curve,
		formatNum,
		isMetric,
		makeRuns,
		passAtK,
		passHatK,
		sampleSummary,
		snapK,
		snapP,
	} from '$lib/demos/agent-evaluation';

	/** Pass@k / pass^k demo: curves, a fixed series of agent runs and their trajectories. Registers as `agent-eval`. */
	let { initial }: { initial?: Partial<AgentEvalDemoState> } = $props();

	const CHART_H = 200;
	const PAD = { l: 40, r: 12, t: 12, b: 28 };
	const CRITERIA: Criterion[] = ['args', 'order', 'grounded'];

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let metric = $state<Metric>(isMetric(initial?.metric) ? initial.metric : 'pass-at-k');
	/* svelte-ignore state_referenced_locally */
	let p = $state(snapP(initial?.p ?? P_DEFAULT));
	/* svelte-ignore state_referenced_locally */
	let k = $state(snapK(initial?.k ?? K_DEFAULT));
	/** Run chosen by click; null means the first failing run among the shown ones. */
	let picked = $state<number | null>(null);
	/** Real width of the chart in px; the SVG is drawn at this width (no viewBox scaling). */
	let plotW = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const W = $derived(plotW >= 200 ? plotW : 320);
	const innerW = $derived(W - PAD.l - PAD.r);
	const innerH = CHART_H - PAD.t - PAD.b;
	const other = $derived<Metric>(metric === 'pass-at-k' ? 'pass-hat-k' : 'pass-at-k');

	const runs = $derived(makeRuns(p));
	const shown = $derived(runs.slice(0, k));
	const summary = $derived(sampleSummary(runs, k));
	const activeIndex = $derived(
		picked !== null && picked < k
			? picked
			: Math.max(
					0,
					shown.findIndex((r) => !r.success),
				),
	);
	const activeRun = $derived(runs[activeIndex]);

	const valAt = $derived(passAtK(p, k));
	const valHat = $derived(passHatK(p, k));

	function px(kk: number): number {
		return PAD.l + ((kk - K_MIN) / (K_MAX - K_MIN)) * innerW;
	}
	function py(v: number): number {
		return PAD.t + (1 - v) * innerH;
	}
	function pathOf(pp: number, m: Metric): string {
		return curve(pp, m)
			.map((pt, i) => `${i === 0 ? 'M' : 'L'}${px(pt.k).toFixed(1)} ${py(pt.value).toFixed(1)}`)
			.join(' ');
	}

	const pathMain = $derived(pathOf(p, metric));
	const pathOther = $derived(pathOf(p, other));
	const pathPresets = $derived(P_PRESETS.map((pp) => pathOf(pp, metric)));
	const dotAt = $derived({ x: px(k), yAt: py(valAt), yHat: py(valHat) });

	const metricName = (m: Metric) => (m === 'pass-at-k' ? 'pass@k' : 'pass^k');
	const note = $derived(
		k === 1
			? `При k = 1 обе метрики равны p = ${formatNum(p, 2)}: запуск один, и он или успешен, или нет.`
			: `При p = ${formatNum(p, 2)} и k = ${k}: pass^k = ${formatNum(valHat)}, pass@k = ${formatNum(valAt)}. ` +
					`Разрыв между ними ${formatNum(valAt - valHat)}: метрика «хотя бы один успешен» скрывает нестабильность.`,
	);
	const summaryText = $derived(
		`Первые ${summary.k} запусков: успешных ${summary.successes}. ` +
			`Все успешны: ${summary.allSucceeded ? 'да' : 'нет'}. ` +
			`Хотя бы один успешен: ${summary.anySucceeded ? 'да' : 'нет'}.`,
	);
	const chartDesc = $derived(
		`Кривые pass@k и pass^k по k от 1 до ${K_MAX} при p = ${formatNum(p, 2)}. ` +
			`При k = ${k}: pass@k = ${formatNum(valAt)}, pass^k = ${formatNum(valHat)}.`,
	);

	function reset(): void {
		metric = 'pass-at-k';
		p = P_DEFAULT;
		k = K_DEFAULT;
		picked = null;
	}

	function apply(patch: Partial<AgentEvalDemoState>): void {
		if (isMetric(patch.metric)) metric = patch.metric;
		if (typeof patch.p === 'number') p = snapP(patch.p);
		if (typeof patch.k === 'number') k = snapK(patch.k);
	}

	onMount(() => {
		return demos?.register('agent-eval', {
			set: (patch) => apply(patch as Partial<AgentEvalDemoState>),
		});
	});
</script>

<figure class="ae" id="demo-agent-eval" data-demo="agent-eval">
	<div class="ae-controls">
		<div class="ae-group" role="group" aria-label="Метрика">
			<button
				type="button"
				class="ae-seg"
				aria-pressed={metric === 'pass-at-k'}
				onclick={() => (metric = 'pass-at-k')}>pass@k</button
			>
			<button
				type="button"
				class="ae-seg"
				aria-pressed={metric === 'pass-hat-k'}
				onclick={() => (metric = 'pass-hat-k')}>pass^k</button
			>
		</div>

		<label class="ae-ctl">
			<span class="ae-label"><span class="ae-sym">p</span> (успех одного запуска)</span>
			<input
				class="ae-range"
				type="range"
				min={P_MIN}
				max={P_MAX}
				step={P_STEP}
				value={p}
				oninput={(e) => (p = snapP(Number(e.currentTarget.value)))}
			/>
			<output class="ae-val">{formatNum(p, 2)}</output>
		</label>

		<label class="ae-ctl">
			<span class="ae-label"><span class="ae-sym">k</span> (число запусков)</span>
			<input
				class="ae-range"
				type="range"
				min={K_MIN}
				max={K_MAX}
				step="1"
				value={k}
				oninput={(e) => (k = snapK(Number(e.currentTarget.value)))}
			/>
			<output class="ae-val">{k}</output>
		</label>

		<button type="button" class="ae-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="ae-cards">
		<div class="ae-card" class:is-main={metric === 'pass-at-k'}>
			<p class="ae-card-t">pass@k</p>
			<p class="ae-card-f">1 − (1 − p)<sup>k</sup></p>
			<p class="ae-card-v">{formatNum(valAt)}</p>
			<p class="ae-card-h">хотя бы один из {k} запусков успешен</p>
		</div>
		<div class="ae-card" class:is-main={metric === 'pass-hat-k'}>
			<p class="ae-card-t">pass^k</p>
			<p class="ae-card-f">p<sup>k</sup></p>
			<p class="ae-card-v">{formatNum(valHat)}</p>
			<p class="ae-card-h">все {k} запусков успешны</p>
		</div>
	</div>

	<div class="ae-chart" bind:clientWidth={plotW}>
		<svg
			class="ae-svg"
			viewBox="0 0 {W} {CHART_H}"
			role="img"
			aria-labelledby="ae-chart-title ae-chart-desc"
		>
			<title id="ae-chart-title">Pass@k и pass^k по числу запусков</title>
			<desc id="ae-chart-desc">{chartDesc}</desc>
			<line class="ae-grid" x1={PAD.l} x2={W - PAD.r} y1={py(0.5)} y2={py(0.5)} />
			<line class="ae-axis" x1={PAD.l} x2={W - PAD.r} y1={py(0)} y2={py(0)} />
			<line class="ae-axis" x1={PAD.l} x2={PAD.l} y1={py(1)} y2={py(0)} />
			<text class="ae-tick" x={PAD.l - 6} y={py(1) + 4} text-anchor="end">1</text>
			<text class="ae-tick" x={PAD.l - 6} y={py(0.5) + 4} text-anchor="end">0,5</text>
			<text class="ae-tick" x={PAD.l - 6} y={py(0) + 4} text-anchor="end">0</text>
			{#each Array.from({ length: K_MAX - K_MIN + 1 }, (_, i) => i + K_MIN) as kk (kk)}
				<text class="ae-tick" x={px(kk)} y={CHART_H - 8} text-anchor="middle">{kk}</text>
			{/each}

			{#each pathPresets as d, i (i)}
				<path class="ae-preset" {d} />
			{/each}
			<path class="ae-line ae-other" d={pathOther} />
			<path class="ae-line ae-main" class:is-hat={metric === 'pass-hat-k'} d={pathMain} />
			<circle class="ae-dot ae-dot-at" cx={dotAt.x} cy={dotAt.yAt} r="4" />
			<circle class="ae-dot ae-dot-hat" cx={dotAt.x} cy={dotAt.yHat} r="4" />
		</svg>
	</div>
	<p class="ae-legend">
		Сплошная линия: {metricName(metric)} при p = {formatNum(p, 2)}. Штриховая: {metricName(other)} при
		том же p. Бледные: {metricName(metric)} при p = {P_PRESETS.map((v) => formatNum(v, 1)).join(
			', ',
		)}. По оси x: k.
	</p>

	<div class="ae-runs-head">
		<p class="ae-runs-t">Серия запусков одной задачи: первые {k} из {runs.length}</p>
		<p class="ae-sum" aria-live="polite">{summaryText}</p>
	</div>
	<ol class="ae-runs" aria-label="Запуски агента">
		{#each shown as r (r.index)}
			<li>
				<button
					type="button"
					class="ae-run"
					class:is-fail={!r.success}
					aria-pressed={activeIndex === r.index}
					onclick={() => (picked = r.index)}
				>
					<span class="ae-run-n">Запуск {r.index + 1}</span>
					<span class="ae-run-s">{r.success ? 'успех' : 'провал'}</span>
				</button>
			</li>
		{/each}
	</ol>

	{#if activeRun}
		<div class="ae-detail">
			<p class="ae-detail-t">
				Запуск {activeRun.index + 1}: {activeRun.success ? 'успешен' : 'не пройден'}
			</p>
			<ol class="ae-steps">
				{#each activeRun.trajectory.steps as s, i (i)}
					<li class="ae-step" class:is-issue={activeRun.verdict.issueStep === i}>
						<code class="ae-tool">{s.tool}({Object.values(s.args).join(', ')})</code>
						<span class="ae-obs">→ {s.observation}</span>
						{#if activeRun.verdict.issueStep === i && activeRun.verdict.reason}
							<span class="ae-cause">Причина: {activeRun.verdict.reason}</span>
						{/if}
					</li>
				{/each}
			</ol>
			<p class="ae-answer">Ответ: {activeRun.trajectory.answer}</p>
			<ul class="ae-checks">
				{#each CRITERIA as c (c)}
					<li class:is-ok={activeRun.verdict.checks[c]} class:is-bad={!activeRun.verdict.checks[c]}>
						{activeRun.verdict.checks[c] ? '✓' : '✗'}
						{CRITERION_LABEL[c]}
					</li>
				{/each}
			</ul>
			<p class="ae-consequence">
				Следствие:
				{#if activeRun.success}
					запуск засчитан как успешный и входит в pass^k и в pass@k.
				{:else}
					запуск засчитан как неуспешный. В pass^k он делает серию неуспешной; в pass@k он
					учитывается, только если среди запусков есть другой успешный.
				{/if}
			</p>
		</div>
	{/if}

	<p class="ae-note" aria-live="polite">{note}</p>
</figure>

<style>
	.ae {
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
	.ae :global(*),
	.ae :global(*::before),
	.ae :global(*::after) {
		box-sizing: border-box;
	}
	.ae p,
	.ae ol,
	.ae ul {
		margin: 0;
		padding: 0;
	}
	.ae button {
		font: inherit;
	}
	.ae-sym {
		font-family: var(--font-serif);
		font-size: 16px;
	}

	/* Controls */
	.ae-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ae-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.ae-seg,
	.ae-reset {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.ae-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.ae-reset {
		margin-left: auto;
		border: 1px solid var(--border);
		color: var(--text);
		background: var(--surface-2);
	}
	.ae-seg:focus-visible,
	.ae-reset:focus-visible,
	.ae-range:focus-visible,
	.ae-run:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.ae-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.ae-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.ae-range {
		width: 140px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.ae-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Metric cards */
	.ae-cards {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.ae-card {
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		opacity: 0.85;
		transition: opacity var(--dur) var(--ease);
	}
	.ae-card.is-main {
		opacity: 1;
		border-color: var(--topic);
	}
	.ae-card-t {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.ae-card-f {
		color: var(--text-muted);
		font-size: 13px;
	}
	.ae-card-f sup {
		font-size: 12px;
	}
	.ae-card-v {
		font-family: var(--font-mono);
		font-size: 22px;
		font-variant-numeric: tabular-nums;
	}
	.ae-card-h {
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Chart */
	.ae-chart {
		margin-top: var(--space-6);
	}
	.ae-svg {
		display: block;
		width: 100%;
		height: 200px;
		overflow: visible;
	}
	.ae-grid {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		opacity: 0.4;
	}
	.ae-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.6;
	}
	.ae-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.ae-preset {
		fill: none;
		stroke: var(--cat-1);
		stroke-width: 1.5;
		opacity: 0.3;
		transition: d var(--dur) var(--ease);
	}
	.ae-line {
		fill: none;
		stroke-linejoin: round;
		transition: d var(--dur) var(--ease);
	}
	.ae-main {
		stroke: var(--cat-1);
		stroke-width: 2.5;
	}
	.ae-main.is-hat {
		stroke: var(--cat-2);
	}
	.ae-other {
		stroke: var(--cat-2);
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
		opacity: 0.7;
	}
	.ae-dot-at {
		fill: var(--cat-1);
	}
	.ae-dot-hat {
		fill: var(--cat-2);
	}
	.ae-legend {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}

	/* Runs */
	.ae-runs-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-6);
	}
	.ae-runs-t {
		font-weight: 600;
	}
	.ae-sum {
		color: var(--text-muted);
	}
	.ae-runs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
		list-style: none;
	}
	.ae-run {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		min-height: 44px;
		min-width: 84px;
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		text-align: left;
		cursor: pointer;
	}
	.ae-run[aria-pressed='true'] {
		border-color: var(--topic);
		box-shadow: inset 0 0 0 1px var(--topic);
	}
	.ae-run-n {
		font-size: 13px;
	}
	.ae-run-s {
		font-size: 12px;
		color: #166534;
	}
	:global([data-theme='dark']) .ae-run-s {
		color: var(--ok);
	}
	.ae-run.is-fail .ae-run-s {
		color: var(--fail);
	}

	/* Trajectory detail */
	.ae-detail {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.ae-detail-t {
		font-weight: 600;
	}
	.ae-steps {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-2);
		list-style: none;
	}
	.ae-step {
		display: grid;
		gap: 2px;
		padding: var(--space-1) var(--space-2);
		border-left: 3px solid var(--border);
	}
	.ae-step.is-issue {
		border-left-color: var(--fail);
		background: var(--surface-2);
	}
	.ae-tool {
		font-family: var(--font-mono);
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.ae-obs {
		color: var(--text-muted);
		overflow-wrap: anywhere;
	}
	.ae-cause {
		color: var(--fail);
		font-size: 13px;
	}
	.ae-answer {
		margin-top: var(--space-2);
	}
	.ae-checks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-2);
		list-style: none;
		font-size: 13px;
	}
	.ae-checks .is-ok {
		color: var(--ok);
	}
	.ae-checks .is-bad {
		color: var(--fail);
	}
	.ae-consequence {
		margin-top: var(--space-2);
		color: var(--text-muted);
	}

	.ae-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.ae *,
		.ae *::before,
		.ae *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.ae {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.ae-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.ae-ctl {
			flex-wrap: wrap;
		}
		.ae-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.ae-reset {
			margin-left: 0;
		}
		.ae-cards {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
