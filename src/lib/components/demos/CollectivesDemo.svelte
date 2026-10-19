<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		ALPHA_MAX,
		ALPHA_MIN,
		ALPHA_STEP,
		B_MAX,
		B_MIN,
		B_STEP,
		DEFAULT_ALPHA_US,
		DEFAULT_B_GBS,
		DEFAULT_N,
		DEFAULT_S_BYTES,
		GB,
		LOG_MAX,
		LOG_MIN,
		N_MAX,
		N_MIN,
		REF_BYTES,
		S_EXP_MAX,
		S_EXP_MIN,
		S_EXP_STEP,
		type CollectivesDemoState,
		completeChunks,
		contribAfter,
		crossoverBytes,
		formatBytes,
		formatDuration,
		latencyCurve,
		logY,
		ringSchedule,
		ringSteps,
		ringTime,
		sBytesFromExp,
		snapAlpha,
		snapB,
		snapN,
		snapSExp,
		timeCurve,
	} from '$lib/demos/collectives';

	/** Ring all-reduce demo: time against N and message size, and the ring step by step. Registers as demo `collectives`. */
	let { initial }: { initial?: Partial<CollectivesDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let n = $state(snapN(initial?.n ?? DEFAULT_N));
	/* svelte-ignore state_referenced_locally */
	let sExp = $state(snapSExp(Math.log10(initial?.sBytes ?? DEFAULT_S_BYTES)));
	/* svelte-ignore state_referenced_locally */
	let bGbs = $state(snapB(initial?.bGbs ?? DEFAULT_B_GBS));
	/* svelte-ignore state_referenced_locally */
	let alphaUs = $state(snapAlpha(initial?.alphaUs ?? DEFAULT_ALPHA_US));
	/** Completed ring steps; clamped to the schedule length when N changes. */
	let step = $state(0);
	let playing = $state(false);
	/** Real widths in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wChart = $state(0);
	let wRing = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const sBytes = $derived(sBytesFromExp(sExp));
	const bBytes = $derived(bGbs * GB);
	const alpha = $derived(alphaUs * 1e-6);
	const t = $derived(ringTime(n, sBytes, bBytes, alpha));
	const total = $derived(ringSteps(n));
	const k = $derived(Math.min(step, total));
	const schedule = $derived(ringSchedule(n));
	const lastStep = $derived(k > 0 ? (schedule[k - 1] ?? null) : null);
	const contrib = $derived(contribAfter(n, k));
	const complete = $derived(completeChunks(contrib, n));
	const elapsed = $derived(k * t.stepTime);
	const crossover = $derived(crossoverBytes(n, bBytes, alpha));
	const latencyDominates = $derived(t.latency > t.transfer);
	const latShare = $derived(t.total > 0 ? (t.latency / t.total) * 100 : 0);

	/* ---------- Chart: time against N, log scale ---------- */

	const NS: number[] = Array.from({ length: N_MAX - N_MIN + 1 }, (_, i) => N_MIN + i);
	const TICK_NS = [2, 8, 16, 32, 48, 64];
	const CHART_H = 240;
	const PAD_L = 64;
	const PAD_R = 16;
	const PAD_T = 14;
	const PAD_B = 34;
	const plotW = $derived(wChart >= 280 ? wChart : 560);
	const innerW = $derived(plotW - PAD_L - PAD_R);
	const innerH = CHART_H - PAD_T - PAD_B;

	function xOf(gpus: number): number {
		return PAD_L + ((gpus - N_MIN) / (N_MAX - N_MIN)) * innerW;
	}
	function yOf(seconds: number): number {
		return PAD_T + innerH - ((logY(seconds) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * innerH;
	}
	function pathOf(values: number[]): string {
		return values
			.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i + N_MIN).toFixed(1)} ${yOf(v).toFixed(1)}`)
			.join(' ');
	}

	const curveNow = $derived(timeCurve(NS, sBytes, bBytes, alpha));
	const curveRef = $derived(timeCurve(NS, REF_BYTES, bBytes, alpha));
	const curveLat = $derived(latencyCurve(NS, alpha));
	const pathNow = $derived(pathOf(curveNow));
	const pathRef = $derived(pathOf(curveRef));
	const pathLat = $derived(pathOf(curveLat));
	const markX = $derived(xOf(n));
	const markY = $derived(yOf(t.total));

	const yTicks = Array.from({ length: LOG_MAX - LOG_MIN + 1 }, (_, i) => {
		const e = LOG_MIN + i;
		return { y: yOf(Math.pow(10, e)), label: formatDuration(Math.pow(10, e)) };
	});

	const chartDesc = $derived(
		`Время all-reduce при N от 2 до 64. Текущий размер сообщения ${formatBytes(sBytes)}: ` +
			`при N = ${n} время ${formatDuration(t.total)}. Для сравнения 1 МБ: ${formatDuration(ringTime(n, REF_BYTES, bBytes, alpha).total)}. ` +
			`Пунктир: только задержка ${formatDuration(t.latency)}.`,
	);

	/* ---------- Comparison table: fixed N = 8 and N = 64 ---------- */

	const compareRows = $derived([
		{ label: `Текущий S = ${formatBytes(sBytes)}`, size: sBytes },
		{ label: '1 МБ', size: REF_BYTES },
	]);

	/* ---------- Ring diagram ---------- */

	const ringPx = $derived(Math.max(220, Math.min(wRing || 300, 320)));
	const ringC = $derived(ringPx / 2);
	const ringR = $derived(ringC - (n <= 16 ? 30 : 12));
	const nodeR = $derived(n <= 16 ? 14 : 3.5);
	const showLabels = $derived(n <= 16);
	const showChunkLabels = $derived(n <= 12);

	function nodeAt(i: number): { x: number; y: number } {
		const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
		return { x: ringC + ringR * Math.cos(a), y: ringC + ringR * Math.sin(a) };
	}

	/** Arrow from one node to the next, shortened so it starts and ends at the node edges. */
	function arrowOf(
		from: number,
		to: number,
	): { x1: number; y1: number; x2: number; y2: number; mx: number; my: number } {
		const p = nodeAt(from);
		const q = nodeAt(to);
		const dx = q.x - p.x;
		const dy = q.y - p.y;
		const len = Math.hypot(dx, dy) || 1;
		const off = nodeR + 3;
		const ux = dx / len;
		const uy = dy / len;
		const x1 = p.x + ux * off;
		const y1 = p.y + uy * off;
		const x2 = q.x - ux * off;
		const y2 = q.y - uy * off;
		// Label sits a little towards the centre so it does not cover the arrow.
		const midX = (p.x + q.x) / 2;
		const midY = (p.y + q.y) / 2;
		const mx = midX + (ringC - midX) * 0.15;
		const my = midY + (ringC - midY) * 0.15;
		return { x1, y1, x2, y2, mx, my };
	}

	const arrows = $derived(
		lastStep
			? lastStep.sends.map((s) => ({ ...arrowOf(s.from, s.to), chunk: s.chunk, from: s.from }))
			: [],
	);
	const sendingFrom = $derived(new Set(lastStep ? lastStep.sends.map((s) => s.from) : []));

	const stepText = $derived.by(() => {
		if (k === 0 || lastStep === null) {
			return 'Шагов ещё не было. Каждая карта держит свои данные по всем N кускам; полных сумм нет.';
		}
		if (k === total) {
			return `Готово: за ${total} шагов у каждой карты все ${n} кусков полные. Время ${formatDuration(t.total)}.`;
		}
		const sub = lastStep.sub + 1;
		const phaseLabel =
			lastStep.phase === 'reduce-scatter'
				? `reduce-scatter, шаг ${sub} из ${n - 1}: каждая карта отправила соседу кусок S/N и прибавила полученный к своей сумме`
				: `all-gather, шаг ${sub} из ${n - 1}: каждая карта отправила соседу готовый кусок, тот его скопировал`;
		return `Фаза ${phaseLabel}. Полных кусков сейчас ${complete} из ${n * n}.`;
	});

	const note = $derived(
		latencyDominates
			? `Здесь задержка шагов (${formatDuration(t.latency)}) больше передачи (${formatDuration(t.transfer)}): сообщение меньше границы ${formatBytes(crossover)}. Ниже границы сначала объединяют мелкие тензоры в один буфер.`
			: `Здесь передача данных (${formatDuration(t.transfer)}) важнее задержки (${formatDuration(t.latency)}). Объём на карту ${formatBytes(t.volume)} почти не зависит от N, поэтому рост числа карт почти не меняет время.`,
	);

	function apply(patch: Partial<CollectivesDemoState>): void {
		if (typeof patch.n === 'number') n = snapN(patch.n);
		if (typeof patch.sBytes === 'number') sExp = snapSExp(Math.log10(patch.sBytes));
		if (typeof patch.bGbs === 'number') bGbs = snapB(patch.bGbs);
		if (typeof patch.alphaUs === 'number') alphaUs = snapAlpha(patch.alphaUs);
	}

	function reset(): void {
		n = DEFAULT_N;
		sExp = snapSExp(Math.log10(DEFAULT_S_BYTES));
		bGbs = DEFAULT_B_GBS;
		alphaUs = DEFAULT_ALPHA_US;
		step = 0;
		playing = false;
	}

	function togglePlay(): void {
		if (!playing && k >= total) step = 0;
		playing = !playing;
	}

	$effect(() => {
		if (!playing) return;
		const id = setInterval(() => {
			if (step >= total) {
				playing = false;
				return;
			}
			step += 1;
		}, 700);
		return () => clearInterval(id);
	});

	onMount(() => {
		return demos?.register('collectives', {
			set: (patch) => apply(patch as Partial<CollectivesDemoState>),
		});
	});
</script>

<figure class="cl" id="demo-collectives" data-demo="collectives">
	<div class="cl-controls">
		<label class="cl-ctl">
			<span class="cl-label">N (число GPU)</span>
			<input
				class="cl-range"
				type="range"
				min={N_MIN}
				max={N_MAX}
				step="1"
				value={n}
				oninput={(e) => (n = snapN(Number(e.currentTarget.value)))}
			/>
			<output class="cl-val">{n}</output>
		</label>

		<label class="cl-ctl">
			<span class="cl-label">S (размер сообщения)</span>
			<input
				class="cl-range"
				type="range"
				min={S_EXP_MIN}
				max={S_EXP_MAX}
				step={S_EXP_STEP}
				value={sExp}
				oninput={(e) => (sExp = snapSExp(Number(e.currentTarget.value)))}
			/>
			<output class="cl-val">{formatBytes(sBytes)}</output>
		</label>

		<label class="cl-ctl">
			<span class="cl-label">B (пропускная способность)</span>
			<input
				class="cl-range"
				type="range"
				min={B_MIN}
				max={B_MAX}
				step={B_STEP}
				value={bGbs}
				oninput={(e) => (bGbs = snapB(Number(e.currentTarget.value)))}
			/>
			<output class="cl-val">{bGbs} ГБ/с</output>
		</label>

		<label class="cl-ctl">
			<span class="cl-label">α (задержка шага)</span>
			<input
				class="cl-range"
				type="range"
				min={ALPHA_MIN}
				max={ALPHA_MAX}
				step={ALPHA_STEP}
				value={alphaUs}
				oninput={(e) => (alphaUs = snapAlpha(Number(e.currentTarget.value)))}
			/>
			<output class="cl-val">{alphaUs} мкс</output>
		</label>
	</div>

	<p class="cl-formula">
		<i>T</i> ≈ 2(<i>N</i>−1)·<i>α</i> + 2(<i>N</i>−1)/<i>N</i> · <i>S</i>/<i>B</i>
	</p>

	<section class="cl-panel" aria-label="Разбор времени при текущих значениях">
		<p class="cl-readout">
			N = {n}: объём на карту {formatBytes(t.volume)}, шагов {t.steps}, время {formatDuration(
				t.total,
			)}.
		</p>
		<div class="cl-split" aria-hidden="true">
			<span class="cl-seg cl-seg-lat" style="width: {latShare.toFixed(2)}%"></span>
			<span class="cl-seg cl-seg-data" style="width: {(100 - latShare).toFixed(2)}%"></span>
		</div>
		<p class="cl-split-legend">
			<span class="cl-key cl-key-lat"></span> задержка {formatDuration(t.latency)}
			<span class="cl-key cl-key-data"></span> передача {formatDuration(t.transfer)}
		</p>
		<p class="cl-note">{note}</p>
	</section>

	<div class="cl-chart-panel" bind:clientWidth={wChart}>
		<p class="cl-panel-t">Время all-reduce против числа GPU</p>
		<svg
			class="cl-svg"
			width={plotW}
			height={CHART_H}
			viewBox="0 0 {plotW} {CHART_H}"
			role="img"
			aria-labelledby="cl-chart-title cl-chart-desc"
		>
			<title id="cl-chart-title">Время all-reduce по кольцу</title>
			<desc id="cl-chart-desc">{chartDesc}</desc>
			{#each yTicks as tk (tk.label)}
				<line class="cl-grid" x1={PAD_L} x2={plotW - PAD_R} y1={tk.y} y2={tk.y} />
				<text class="cl-tick" x={PAD_L - 6} y={tk.y + 4} text-anchor="end">{tk.label}</text>
			{/each}
			{#each TICK_NS as g (g)}
				<text class="cl-tick" x={xOf(g)} y={CHART_H - 12} text-anchor="middle">{g}</text>
			{/each}
			<line
				class="cl-axis"
				x1={PAD_L}
				x2={plotW - PAD_R}
				y1={CHART_H - PAD_B}
				y2={CHART_H - PAD_B}
			/>
			<path class="cl-lat" d={pathLat} />
			<path class="cl-ref" d={pathRef} />
			<path class="cl-now" d={pathNow} />
			<line class="cl-mark" x1={markX} x2={markX} y1={PAD_T} y2={CHART_H - PAD_B} />
			<circle class="cl-dot" cx={markX} cy={markY} r="5" />
		</svg>
		<ul class="cl-legend">
			<li><span class="cl-sw cl-sw-now"></span>S = {formatBytes(sBytes)}</li>
			<li><span class="cl-sw cl-sw-ref"></span>1 МБ</li>
			<li><span class="cl-sw cl-sw-lat"></span>только задержка 2(N−1)·α</li>
		</ul>
	</div>

	<table class="cl-table">
		<caption>Сравнение при текущих S, B и α</caption>
		<thead>
			<tr>
				<th scope="col">Сообщение</th>
				<th scope="col">N = 8</th>
				<th scope="col">N = 64</th>
			</tr>
		</thead>
		<tbody>
			{#each compareRows as row (row.label)}
				<tr>
					<th scope="row">{row.label}</th>
					<td>{formatDuration(ringTime(8, row.size, bBytes, alpha).total)}</td>
					<td>{formatDuration(ringTime(64, row.size, bBytes, alpha).total)}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<section
		class="cl-panel cl-ring-panel"
		bind:clientWidth={wRing}
		aria-label="Кольцевой all-reduce по шагам"
	>
		<p class="cl-panel-t">Кольцо, шаг за шагом</p>
		<svg
			class="cl-ring"
			width={ringPx}
			height={ringPx}
			viewBox="0 0 {ringPx} {ringPx}"
			role="img"
			aria-label="Карты на кольце; стрелки показывают передачи последнего шага"
		>
			<defs>
				<marker
					id="cl-arrow"
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					markerWidth="6"
					markerHeight="6"
					orient="auto-start-reverse"
				>
					<path d="M0 0 L10 5 L0 10 z" class="cl-head" />
				</marker>
			</defs>
			{#each arrows as a, idx (idx)}
				<line
					class="cl-arrow"
					x1={a.x1}
					y1={a.y1}
					x2={a.x2}
					y2={a.y2}
					marker-end="url(#cl-arrow)"
				/>
				{#if showChunkLabels}
					<text class="cl-chunk" x={a.mx} y={a.my} text-anchor="middle" dominant-baseline="middle"
						>{a.chunk}</text
					>
				{/if}
			{/each}
			{#each Array.from({ length: n }, (_, i) => i) as i (i)}
				{@const p = nodeAt(i)}
				<circle class="cl-node" class:is-send={sendingFrom.has(i)} cx={p.x} cy={p.y} r={nodeR} />
				{#if showLabels}
					<text class="cl-node-t" x={p.x} y={p.y + 4} text-anchor="middle">{i}</text>
				{/if}
			{/each}
		</svg>

		<div class="cl-steps">
			<div class="cl-btns">
				<button
					type="button"
					class="cl-btn"
					onclick={() => (step = Math.max(0, k - 1))}
					disabled={k === 0}>Назад</button
				>
				<button
					type="button"
					class="cl-btn"
					onclick={() => (step = Math.min(total, k + 1))}
					disabled={k >= total}>Вперёд</button
				>
				<button type="button" class="cl-btn" aria-pressed={playing} onclick={togglePlay}
					>{playing ? 'Пауза' : 'Играть'}</button
				>
				<button type="button" class="cl-btn cl-btn-reset" onclick={reset}>Сброс</button>
			</div>
			<label class="cl-ctl">
				<span class="cl-label">Шаг</span>
				<input
					class="cl-range"
					type="range"
					min="0"
					max={total}
					step="1"
					value={k}
					oninput={(e) => (step = Number(e.currentTarget.value))}
				/>
				<output class="cl-val">{k} из {total}</output>
			</label>
		</div>

		<p class="cl-step-live" aria-live="polite">{stepText}</p>
		<p class="cl-step-time">
			Прошло {formatDuration(elapsed)} из {formatDuration(t.total)}: по {formatDuration(t.stepTime)} на
			шаг.
		</p>
	</section>
</figure>

<style>
	.cl {
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
	.cl :global(*),
	.cl :global(*::before),
	.cl :global(*::after) {
		box-sizing: border-box;
	}
	.cl p,
	.cl ul,
	.cl table {
		margin: 0;
	}
	.cl button {
		font: inherit;
	}

	/* Controls */
	.cl-controls {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.cl-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.cl-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cl-range {
		flex: 1 1 140px;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.cl-val {
		min-width: 6ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.cl-range:focus-visible,
	.cl-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.cl-formula {
		margin-top: var(--space-4);
		font-family: var(--font-serif);
		font-size: var(--fs-base);
		color: var(--text);
		overflow-wrap: anywhere;
	}

	/* Breakdown */
	.cl-panel {
		margin-top: var(--space-5);
		padding: var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.cl-readout {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.cl-split {
		display: flex;
		height: 14px;
		margin-top: var(--space-3);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--surface-2);
	}
	.cl-seg {
		display: block;
		min-width: 0;
		transition: width var(--dur) var(--ease);
	}
	.cl-seg-lat {
		background: var(--cat-4);
	}
	.cl-seg-data {
		background: var(--topic);
	}
	.cl-split-legend {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.cl-key {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin: 0 var(--space-1) 0 var(--space-3);
		border-radius: 2px;
	}
	.cl-key-lat {
		background: var(--cat-4);
	}
	.cl-key-data {
		background: var(--topic);
	}
	.cl-note {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}

	/* Chart */
	.cl-chart-panel {
		margin-top: var(--space-6);
	}
	.cl-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.cl-svg {
		display: block;
		max-width: 100%;
		height: auto;
		overflow: visible;
	}
	.cl-grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.cl-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
	}
	.cl-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.cl-now {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2.5;
	}
	.cl-ref {
		fill: none;
		stroke: var(--cat-4);
		stroke-width: 2;
		stroke-dasharray: 6 4;
	}
	.cl-lat {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
		stroke-dasharray: 2 3;
	}
	.cl-mark {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.cl-dot {
		fill: var(--topic);
		stroke: var(--surface);
		stroke-width: 2;
	}
	.cl-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-6);
		margin-top: var(--space-2);
		padding: 0;
		list-style: none;
		color: var(--text-muted);
		font-size: 13px;
	}
	.cl-sw {
		display: inline-block;
		width: 16px;
		height: 0;
		margin-right: var(--space-2);
		vertical-align: middle;
		border-top: 2.5px solid var(--topic);
	}
	.cl-sw-ref {
		border-top: 2px dashed var(--cat-4);
	}
	.cl-sw-lat {
		border-top: 1.5px dotted var(--text-muted);
	}

	/* Table */
	.cl-table {
		width: 100%;
		margin-top: var(--space-6);
		border-collapse: collapse;
		font-size: 13px;
	}
	.cl-table caption {
		margin-bottom: var(--space-2);
		text-align: left;
		color: var(--text-muted);
	}
	.cl-table th,
	.cl-table td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border);
		text-align: left;
	}
	.cl-table td {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.cl-table th[scope='row'] {
		font-weight: 400;
		color: var(--text-muted);
	}

	/* Ring */
	.cl-ring-panel {
		margin-top: var(--space-6);
	}
	.cl-ring {
		display: block;
		max-width: 100%;
		height: auto;
		margin: 0 auto;
	}
	.cl-node {
		fill: var(--surface-2);
		stroke: var(--topic);
		stroke-width: 1.5;
	}
	.cl-node.is-send {
		fill: var(--topic);
	}
	.cl-node-t {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.cl-arrow {
		stroke: var(--cat-3);
		stroke-width: 2;
		animation: cl-in var(--dur) var(--ease);
	}
	.cl-head {
		fill: var(--cat-3);
	}
	.cl-chunk {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	@keyframes cl-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.cl-steps {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-6);
		margin-top: var(--space-4);
	}
	.cl-btns {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.cl-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.cl-btn[aria-pressed='true'] {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
	}
	.cl-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.cl-step-live {
		margin-top: var(--space-3);
		color: var(--text);
	}
	.cl-step-time {
		margin-top: var(--space-1);
		color: var(--text-muted);
		font-size: 13px;
	}

	@media (prefers-reduced-motion: reduce) {
		.cl *,
		.cl *::before,
		.cl *::after {
			transition: none !important;
			animation: none !important;
		}
	}

	@media (max-width: 720px) {
		.cl {
			padding: var(--space-4);
		}
		.cl-controls {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
