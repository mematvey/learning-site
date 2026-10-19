<script lang="ts">
	import {
		CORES_MAX,
		CORES_MIN,
		MAX_THREADS,
		MIN_THREADS,
		P_MAX,
		P_MIN,
		P_STEP,
		STEP_COUNT,
		STEPS,
		amdahl,
		amdahlLimit,
		canStep,
		clampCores,
		clampP,
		createRun,
		describeEvent,
		nameOf,
		type ThreadState,
		explain,
		expectedValue,
		formatRu,
		isDone,
		isWaiting,
		lossStats,
		runRandom,
		stepThread,
		type RunState,
	} from '$lib/demos/concurrency';

	/** Race on a shared counter (chosen interleaving, optional lock) and Amdahl's law. */
	let { initial }: { initial?: { threads?: number; lock?: boolean; p?: number; cores?: number } } =
		$props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let threadCount = $state(
		initial?.threads !== undefined &&
			initial.threads >= MIN_THREADS &&
			initial.threads <= MAX_THREADS
			? Math.round(initial.threads)
			: 2,
	);
	/* svelte-ignore state_referenced_locally */
	let lock = $state(initial?.lock === true);
	/* svelte-ignore state_referenced_locally */
	let run = $state<RunState>(createRun(threadCount, lock));
	/* svelte-ignore state_referenced_locally */
	let p = $state(clampP(initial?.p ?? 0.9));
	/* svelte-ignore state_referenced_locally */
	let cores = $state(clampCores(initial?.cores ?? 8));

	const THREAD_OPTIONS = [2, 3, 4];
	/** Amdahl points for the table. */
	const TABLE_CORES = [1, 2, 4, 8, 16, 100];
	/** Loss statistics without a lock: fixed seed, computed once. */
	const LOSS = THREAD_OPTIONS.map((n) => lossStats(n, 1000, 2026));

	const expected = $derived(expectedValue(run));
	const lost = $derived(expected - run.counter);
	const done = $derived(isDone(run));
	const status = $derived(explain(run));
	const started = $derived(run.log.length > 0);

	const limit = $derived(amdahlLimit(p));
	const speedup = $derived(amdahl(p, cores));
	const table = $derived(TABLE_CORES.map((n) => ({ n, s: amdahl(p, n) })));
	const yMax = $derived(limit * 1.1);
	const curve = $derived(
		Array.from({ length: CORES_MAX - CORES_MIN + 1 }, (_, i) => {
			const n = CORES_MIN + i;
			const x = 4 + (i / (CORES_MAX - CORES_MIN)) * 292;
			const y = 120 - (amdahl(p, n) / yMax) * 108;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		}).join(' '),
	);
	const dotX = $derived(4 + ((cores - CORES_MIN) / (CORES_MAX - CORES_MIN)) * 292);
	const dotY = $derived(120 - (speedup / yMax) * 108);
	const limitY = $derived(120 - (limit / yMax) * 108);
	const amdahlDesc = $derived(
		`Ускорение при p = ${formatRu(p)} и N = ${cores}: ${formatRu(speedup)}. Предел при росте N: ${formatRu(limit, 0)}.`,
	);

	function reset(): void {
		run = createRun(threadCount, lock);
	}

	function setThreads(n: number): void {
		threadCount = n;
		reset();
	}

	function setLock(on: boolean): void {
		lock = on;
		reset();
	}

	function advance(t: number): void {
		run = stepThread(run, t);
	}

	function finishRandom(): void {
		run = runRandom(run, Math.random);
	}

	function threadStatus(th: ThreadState, t: number): string {
		if (th.pc >= STEP_COUNT) return 'готово';
		if (isWaiting(run, t)) {
			return `ждёт блокировку, держит поток ${nameOf(run, run.holder)}`;
		}
		if (th.pc === 0) return 'ещё не начал';
		return lock ? 'в критической секции' : 'прочитал значение, обновление не записано';
	}

	function stepMark(th: ThreadState, t: number, i: number): string {
		if (th.pc > i) return 'готово';
		if (th.pc === i) return isWaiting(run, t) ? 'ждёт' : 'следующий';
		return '';
	}
</script>

<div class="cc" id="demo-concurrency" data-demo="concurrency">
	<section class="cc-part" aria-labelledby="cc-race-title">
		<p class="cc-title" id="cc-race-title">Гонка на счётчике</p>

		<div class="cc-controls">
			<div class="cc-group" role="group" aria-label="Число потоков">
				{#each THREAD_OPTIONS as n (n)}
					<button
						type="button"
						class="cc-seg"
						aria-pressed={threadCount === n}
						onclick={() => setThreads(n)}>{n} потока</button
					>
				{/each}
			</div>
			<label class="cc-check">
				<input type="checkbox" checked={lock} onchange={(e) => setLock(e.currentTarget.checked)} />
				<span>Блокировка (lock) вокруг обновления</span>
			</label>
		</div>

		<div class="cc-actions">
			<button type="button" class="cc-btn" onclick={reset}>Сбросить</button>
			<button type="button" class="cc-btn" disabled={done} onclick={finishRandom}
				>Случайный порядок до конца</button
			>
		</div>

		<div class="cc-stats">
			<div class="cc-stat">
				<span class="cc-stat-l">counter</span>
				<output class="cc-stat-v" class:is-bad={done && lost > 0}>{run.counter}</output>
			</div>
			<div class="cc-stat">
				<span class="cc-stat-l">ожидаем</span>
				<output class="cc-stat-v">{expected}</output>
			</div>
			<div class="cc-stat">
				<span class="cc-stat-l">потеряно</span>
				<output class="cc-stat-v" class:is-bad={lost > 0}>{done ? lost : '—'}</output>
			</div>
		</div>

		<div class="cc-threads">
			{#each run.threads as th, t (t)}
				<div
					class="cc-thread"
					class:is-wait={isWaiting(run, t)}
					class:is-done={th.pc >= STEP_COUNT}
				>
					<div class="cc-thread-head">
						<span class="cc-thread-name">Поток {th.name}</span>
						<span class="cc-thread-state">{threadStatus(th, t)}</span>
					</div>
					<ol class="cc-steps">
						{#each STEPS as label, i (label)}
							<li
								class="cc-step"
								class:is-done={th.pc > i}
								class:is-cur={th.pc === i && !isWaiting(run, t)}
							>
								<code class="cc-code">{label}</code>
								<span class="cc-mark">{stepMark(th, t, i)}</span>
							</li>
						{/each}
					</ol>
					<p class="cc-regs">
						читает: <span class="cc-num">{th.read ?? '—'}</span>
						· считает: <span class="cc-num">{th.sum ?? '—'}</span>
					</p>
					<button
						type="button"
						class="cc-btn cc-btn-step"
						disabled={!canStep(run, t)}
						onclick={() => advance(t)}>Шаг потока {th.name}</button
					>
				</div>
			{/each}
		</div>

		<div class="cc-status-box">
			<p class="cc-status" role="status" aria-live="polite">{status}</p>
		</div>

		{#if started}
			<ol class="cc-log" aria-label="Журнал шагов">
				{#each run.log as e, i (i)}
					<li class:is-stale={e.stale}>{describeEvent(e, run)}</li>
				{/each}
			</ol>
		{/if}

		<p class="cc-note">
			<span class="cc-note-h">Что заметить.</span> Порядок шагов задаёте вы. Без блокировки одно из обновлений
			стирается, и итог меньше ожидаемого. С блокировкой потоки ждут друг друга, и итог совпадает.
		</p>

		<table class="cc-table">
			<caption>Без блокировки, 1000 случайных порядков на прогон (фиксированный seed)</caption>
			<thead>
				<tr>
					<th scope="col">потоков</th>
					<th scope="col">прогонов с потерей</th>
					<th scope="col">в среднем потеряно</th>
				</tr>
			</thead>
			<tbody>
				{#each LOSS as s (s.threads)}
					<tr>
						<th scope="row">{s.threads}</th>
						<td>{Math.round(s.share * 100)}%</td>
						<td>{formatRu(s.meanLost)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="cc-part" aria-labelledby="cc-amdahl-title">
		<p class="cc-title" id="cc-amdahl-title">Закон Амдала</p>

		<div class="cc-sliders">
			<label class="cc-slider">
				<span class="cc-slider-l">Доля параллельной части <span class="cc-sym">p</span></span>
				<span class="cc-slider-row">
					<input
						class="cc-range"
						type="range"
						min={P_MIN}
						max={P_MAX}
						step={P_STEP}
						value={p}
						oninput={(e) => (p = clampP(Number(e.currentTarget.value)))}
					/>
					<output class="cc-val">{formatRu(p)}</output>
				</span>
			</label>
			<label class="cc-slider">
				<span class="cc-slider-l">Ядер <span class="cc-sym">N</span></span>
				<span class="cc-slider-row">
					<input
						class="cc-range"
						type="range"
						min={CORES_MIN}
						max={CORES_MAX}
						step="1"
						value={cores}
						oninput={(e) => (cores = clampCores(Number(e.currentTarget.value)))}
					/>
					<output class="cc-val">{cores}</output>
				</span>
			</label>
		</div>

		<p class="cc-formula">
			<span class="cc-sym">S(N)</span> = {formatRu(speedup)} при N = {cores}; предел при N → ∞: {formatRu(
				limit,
				0,
			)}
		</p>

		<svg class="cc-svg" viewBox="0 0 300 124" role="img" aria-labelledby="cc-am-t cc-am-d">
			<title id="cc-am-t">Ускорение от числа ядер</title>
			<desc id="cc-am-d">{amdahlDesc}</desc>
			<line class="cc-limit" x1="4" x2="296" y1={limitY.toFixed(1)} y2={limitY.toFixed(1)} />
			<line class="cc-axis" x1="4" x2="296" y1="120" y2="120" />
			<polyline class="cc-curve" points={curve} />
			<circle class="cc-dot" cx={dotX.toFixed(1)} cy={dotY.toFixed(1)} r="4" />
		</svg>
		<p class="cc-axis-note">Число ядер от 1 до 100; пунктир — предел 1/(1 − p).</p>

		<table class="cc-table">
			<caption>Ускорение S(N) при p = {formatRu(p)}</caption>
			<thead>
				<tr>
					<th scope="col">N</th>
					{#each table as row (row.n)}
						<th scope="col">{row.n}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row">S(N)</th>
					{#each table as row (row.n)}
						<td>{formatRu(row.s)}</td>
					{/each}
				</tr>
			</tbody>
		</table>
	</section>
</div>

<style>
	.cc {
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
	.cc :global(*),
	.cc :global(*::before),
	.cc :global(*::after) {
		box-sizing: border-box;
	}
	.cc p,
	.cc ol {
		margin: 0;
	}
	.cc button {
		font: inherit;
	}
	.cc-part + .cc-part {
		margin-top: var(--space-8);
		padding-top: var(--space-6);
		border-top: 1px solid var(--border);
	}
	.cc-title {
		margin-bottom: var(--space-4);
		font-family: var(--font-serif);
		font-size: var(--fs-h3);
		font-weight: 600;
		line-height: 1.3;
	}
	.cc-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		font-style: italic;
	}
	.cc-note-h {
		font-weight: 600;
	}
	/* Controls */
	.cc-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-6);
	}
	.cc-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.cc-seg,
	.cc-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.cc-seg {
		min-height: 32px;
		border-color: transparent;
		background: none;
		color: var(--text-muted);
	}
	.cc-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.cc-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.cc-seg:focus-visible,
	.cc-btn:focus-visible,
	.cc-check input:focus-visible,
	.cc-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.cc-check {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
	}
	.cc-check input {
		width: 18px;
		height: 18px;
		accent-color: var(--topic);
	}
	.cc-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	/* Counter */
	.cc-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.cc-stat {
		display: flex;
		flex-direction: column;
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.cc-stat-l {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.cc-stat-v {
		font-family: var(--font-mono);
		font-size: var(--fs-base);
		font-variant-numeric: tabular-nums;
	}
	.cc-stat-v.is-bad {
		color: var(--fail);
		font-weight: 600;
	}
	/* Threads */
	.cc-threads {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.cc-thread {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		transition: border-color var(--dur) var(--ease);
	}
	.cc-thread.is-wait {
		border-color: var(--warn);
		background: var(--warn-bg);
	}
	.cc-thread.is-done {
		border-color: var(--ok);
	}
	.cc-thread-head {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.cc-thread-name {
		font-weight: 600;
	}
	.cc-thread-state {
		color: var(--text-muted);
		font-size: 13px;
	}
	.cc-steps {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 0;
		list-style: none;
	}
	.cc-step {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: 4px 6px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.cc-step.is-cur {
		outline: 2px solid var(--topic);
		outline-offset: -2px;
	}
	.cc-step.is-done {
		color: var(--text-muted);
	}
	.cc-code {
		font-family: var(--font-mono);
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.cc-mark {
		color: var(--text-muted);
		font-size: 12px;
		white-space: nowrap;
	}
	.cc-regs {
		color: var(--text-muted);
		font-size: 13px;
	}
	.cc-num {
		font-family: var(--font-mono);
		color: var(--text);
	}
	.cc-btn-step {
		width: 100%;
	}
	/* Status and log */
	.cc-status-box {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--topic);
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}
	.cc-status {
		font-size: var(--fs-sm);
	}
	.cc-log {
		max-height: 180px;
		overflow-y: auto;
		margin-top: var(--space-3);
		padding-left: var(--space-6);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.cc-log li.is-stale {
		color: var(--fail);
	}
	.cc-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
	/* Tables */
	.cc-table {
		width: 100%;
		margin-top: var(--space-4);
		border-collapse: collapse;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}
	.cc-table caption {
		margin-bottom: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
		text-align: left;
	}
	.cc-table th,
	.cc-table td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: left;
	}
	.cc-table td {
		font-family: var(--font-mono);
	}
	/* Amdahl */
	.cc-sliders {
		display: grid;
		gap: var(--space-3);
	}
	.cc-slider {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.cc-slider-l {
		color: var(--text-muted);
	}
	.cc-slider-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.cc-range {
		flex: 1;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cc-val {
		min-width: 4ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.cc-formula {
		margin-top: var(--space-4);
		font-size: var(--fs-base);
	}
	.cc-svg {
		display: block;
		width: 100%;
		height: auto;
		margin-top: var(--space-4);
		overflow: visible;
	}
	.cc-axis {
		stroke: var(--border);
		stroke-width: 1;
	}
	.cc-limit {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 4 3;
	}
	.cc-curve {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	.cc-dot {
		fill: var(--topic);
		stroke: var(--surface);
		stroke-width: 2;
	}
	.cc-axis-note {
		margin-top: var(--space-1);
		color: var(--text-muted);
		font-size: 13px;
	}

	@media (max-width: 480px) {
		.cc {
			padding: var(--space-4);
		}
		.cc-stats {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cc *,
		.cc *::before,
		.cc *::after {
			transition: none !important;
		}
	}
</style>
