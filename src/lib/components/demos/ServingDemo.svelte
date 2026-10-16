<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		BATCH_MAX,
		BATCH_MIN,
		DEFAULT_STATE,
		RATE_MAX,
		RATE_MIN,
		RATE_STEP,
		SHARE_MAX,
		SHARE_MIN,
		SHARE_STEP,
		applyPatch,
		canaryMetrics,
		formatMs,
		pathMetrics,
		snapBatch,
		snapRate,
		snapShare,
		type ServingDemoState,
	} from '$lib/demos/serving';

	/** Batch vs online serving and canary rollout. Registers itself as demo `serving`. */
	let { initial }: { initial?: Partial<ServingDemoState> } = $props();

	/** Start state: defaults with the props applied. Reset returns to it. */
	/* svelte-ignore state_referenced_locally */
	const START = applyPatch(DEFAULT_STATE, initial ?? {});

	let st = $state<ServingDemoState>({ ...START });

	/** Chart width in SVG units; the SVG is drawn at this width, scaled by CSS. */
	const W = 360;
	const BAR_H = 22;
	const LABEL_W = 96;
	const PAD = 6;
	/** Latency bars are scaled to this value (ms); longer latencies are clipped. */
	const LAT_MAX_MS = 400;

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const online = $derived(pathMetrics(1, st.rate));
	const batched = $derived(pathMetrics(st.batch, st.rate));
	const canary = $derived(canaryMetrics(st.share, st.broken));

	/** Width of a latency bar in SVG units, clipped to the chart. */
	function latWidth(ms: number): number {
		if (!Number.isFinite(ms)) return W - LABEL_W - PAD;
		return Math.min(1, ms / LAT_MAX_MS) * (W - LABEL_W - PAD);
	}

	const latBars = $derived([
		{ name: 'онлайн (1)', ms: online.latencyMs, cls: 'sv-bar-online' },
		{ name: `пакет (${batched.batch})`, ms: batched.latencyMs, cls: 'sv-bar-batch' },
	]);

	const capMax = $derived(Math.max(online.capacity, batched.capacity));
	const capBars = $derived([
		{ name: 'онлайн (1)', v: online.capacity, cls: 'sv-bar-online' },
		{ name: `пакет (${batched.batch})`, v: batched.capacity, cls: 'sv-bar-batch' },
	]);

	const verdictText = $derived(
		{
			off: 'Канарейка выключена: весь трафик на текущей версии.',
			wait: 'Выборка канарейки ещё мала: вывода пока нет.',
			ok: 'Ошибки новой версии в норме: долю можно повышать.',
			rollback: 'Ошибки новой версии выше порога: откат на прежнюю версию.',
		}[canary.verdict],
	);

	const desc = $derived(
		`Онлайн: задержка ${formatMs(online.latencyMs)}, пропускная способность ${Math.round(online.capacity)} запр/с. ` +
			`Пакет ${batched.batch}: задержка ${formatMs(batched.latencyMs)}, пропускная способность ${Math.round(batched.capacity)} запр/с. ` +
			`Канарейка ${st.share}% трафика: ${verdictText}`,
	);

	const shareW = $derived((st.share / 100) * (W - 2 * PAD));

	function apply(patch: Partial<ServingDemoState>): void {
		st = applyPatch(st, patch);
	}

	function reset(): void {
		st = { ...START };
	}

	onMount(() =>
		demos?.register('serving', {
			set: (patch) => apply(patch as Partial<ServingDemoState>),
		}),
	);
</script>

<figure class="sv" id="demo-serving" data-demo="serving" class:hl-q={hl === 'q'}>
	<div class="sv-controls">
		<label class="sv-ctl">
			<span class="sv-label"><span class="sv-sym">B</span> (размер пакета)</span>
			<input
				class="sv-range"
				type="range"
				min={BATCH_MIN}
				max={BATCH_MAX}
				step="1"
				value={st.batch}
				oninput={(e) => apply({ batch: snapBatch(Number(e.currentTarget.value)) })}
			/>
			<output class="sv-val">{st.batch}</output>
		</label>

		<label class="sv-ctl">
			<span class="sv-label"><span class="sv-sym">λ</span> (запр/с)</span>
			<input
				class="sv-range"
				type="range"
				min={RATE_MIN}
				max={RATE_MAX}
				step={RATE_STEP}
				value={st.rate}
				oninput={(e) => apply({ rate: snapRate(Number(e.currentTarget.value)) })}
			/>
			<output class="sv-val">{st.rate}</output>
		</label>

		<label class="sv-ctl">
			<span class="sv-label">доля новой версии</span>
			<input
				class="sv-range"
				type="range"
				min={SHARE_MIN}
				max={SHARE_MAX}
				step={SHARE_STEP}
				value={st.share}
				oninput={(e) => apply({ share: snapShare(Number(e.currentTarget.value)) })}
			/>
			<output class="sv-val">{st.share}%</output>
		</label>

		<div class="sv-group" role="group" aria-label="Состояние новой версии">
			<button
				type="button"
				class="sv-seg"
				aria-pressed={!st.broken}
				onclick={() => apply({ broken: false })}>исправна</button
			>
			<button
				type="button"
				class="sv-seg"
				aria-pressed={st.broken}
				onclick={() => apply({ broken: true })}>с ошибкой</button
			>
		</div>

		<button type="button" class="sv-reset" onclick={() => apply({ share: 0 })}>Откатить</button>
		<button type="button" class="sv-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="sv-plots">
		<div class="sv-panel">
			<p class="sv-panel-t">Задержка на запрос <span class="sv-muted">(мс)</span></p>
			<svg
				class="sv-svg"
				viewBox="0 0 {W} {2 * BAR_H + 2 * PAD + 8}"
				role="img"
				aria-labelledby="sv-lat-title sv-lat-desc"
			>
				<title id="sv-lat-title">Задержка онлайн и пакетного пути</title>
				<desc id="sv-lat-desc">
					Онлайн {formatMs(online.latencyMs)}, пакет {batched.batch}: {formatMs(batched.latencyMs)}.
				</desc>
				{#each latBars as b, i (b.name)}
					{@const y = PAD + i * (BAR_H + 8)}
					<text class="sv-name" x="0" y={y + BAR_H / 2 + 4}>{b.name}</text>
					<rect class="sv-track" x={LABEL_W} {y} width={W - LABEL_W - PAD} height={BAR_H} />
					<rect
						class="sv-bar {b.cls}"
						x={LABEL_W}
						{y}
						width={latWidth(b.ms).toFixed(1)}
						height={BAR_H}
					/>
					<text class="sv-num" x={W - PAD} y={y + BAR_H / 2 + 4}>{formatMs(b.ms)}</text>
				{/each}
			</svg>
		</div>

		<div class="sv-panel">
			<p class="sv-panel-t">Пропускная способность <span class="sv-muted">(запр/с)</span></p>
			<svg
				class="sv-svg"
				viewBox="0 0 {W} {2 * BAR_H + 2 * PAD + 8}"
				role="img"
				aria-labelledby="sv-cap-title sv-cap-desc"
			>
				<title id="sv-cap-title">Предел пропускной способности двух путей</title>
				<desc id="sv-cap-desc">
					Онлайн до {Math.round(online.capacity)} запр/с, пакет {batched.batch} до {Math.round(
						batched.capacity,
					)} запр/с.
				</desc>
				{#each capBars as b, i (b.name)}
					{@const y = PAD + i * (BAR_H + 8)}
					<text class="sv-name" x="0" y={y + BAR_H / 2 + 4}>{b.name}</text>
					<rect class="sv-track" x={LABEL_W} {y} width={W - LABEL_W - PAD} height={BAR_H} />
					<rect
						class="sv-bar {b.cls}"
						x={LABEL_W}
						{y}
						width={((b.v / capMax) * (W - LABEL_W - PAD)).toFixed(1)}
						height={BAR_H}
					/>
					<text class="sv-num" x={W - PAD} y={y + BAR_H / 2 + 4}>{Math.round(b.v)}</text>
				{/each}
			</svg>
		</div>
	</div>

	<div class="sv-canary">
		<p class="sv-panel-t">
			Канареечная выкладка <span class="sv-muted">({st.share}% трафика)</span>
		</p>
		<svg class="sv-split" viewBox="0 0 {W} 24" role="img" aria-labelledby="sv-split-title">
			<title id="sv-split-title">Доля трафика на новой версии</title>
			<rect class="sv-old" x={PAD} y="2" width={W - 2 * PAD} height="20" rx="4" />
			<rect
				class="sv-new sv-new-{canary.verdict}"
				x={PAD}
				y="2"
				width={shareW.toFixed(1)}
				height="20"
				rx="4"
			/>
		</svg>
		<dl class="sv-stats">
			<dt>Запросов к новой версии в час</dt>
			<dd>{Math.round(canary.canaryRequests)}</dd>
			<dt>Ошибок в час при текущей доле</dt>
			<dd>{Math.round(canary.errorsPerHour)}</dd>
			<dt>Ошибок в час после отката</dt>
			<dd>{Math.round(canary.errorsAfterRollback)}</dd>
		</dl>
		<p class="sv-note" aria-live="polite">{verdictText}</p>
	</div>

	<dl class="sv-stats">
		<dt>Величина</dt>
		<dd class="sv-h">онлайн / пакет {st.batch}</dd>
		<dt>Ожидание сбора пакета</dt>
		<dd>{formatMs(batched.fillMs)}</dd>
		<dt>Загрузка рабочих</dt>
		<dd>
			{Math.round(batched.utilisation * 100)}%
			<span class="sv-muted">(онлайн {Math.round(online.utilisation * 100)}%)</span>
		</dd>
	</dl>

	<p class="sv-desc" aria-live="polite">{desc}</p>

	<div class="sv-notice">
		<p class="sv-h2">Что заметить</p>
		<ul>
			<li>
				Пакет поднимает пропускную способность, но каждый запрос ждёт, пока соберётся пакет:
				задержка растёт вместе с B.
			</li>
			<li>
				При большой λ онлайн-путь не справляется: очередь растёт без предела. Пакет выдерживает ту
				же нагрузку.
			</li>
			<li>
				Канарейка на малой доле не даёт вывода: выборки мало. Слишком малая доля долго не показывает
				ошибку, слишком большая задевает много пользователей.
			</li>
			<li>
				Откат возвращает ошибки к уровню прежней версии. Поэтому новую версию выкатывают на малую
				долю и сравнивают метрики с базовой.
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
		letter-spacing: normal;
		text-transform: none;
	}
	.sv :global(*),
	.sv :global(*::before),
	.sv :global(*::after) {
		box-sizing: border-box;
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
	.sv button {
		font: inherit;
	}
	.sv-muted {
		color: var(--text-muted);
	}
	.sv-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.sv-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.sv-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.sv-seg,
	.sv-reset {
		height: 32px;
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
	.sv-reset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.sv-reset:hover {
		background: var(--surface-2);
	}
	.sv-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.sv-seg:focus-visible,
	.sv-reset:focus-visible,
	.sv-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.sv-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.sv-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.sv-range {
		width: 140px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.sv-val {
		min-width: 4ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Charts */
	.sv-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.sv-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.sv-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.sv-track {
		fill: var(--surface-2);
		stroke: var(--border);
		stroke-width: 1;
	}
	.sv-bar {
		transition: width var(--dur) var(--ease);
	}
	.sv-bar-online {
		fill: var(--text-muted);
	}
	.sv-bar-batch {
		fill: var(--topic);
	}
	.sv-name,
	.sv-num {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.sv-num {
		fill: var(--text);
		text-anchor: end;
	}

	/* Canary */
	.sv-canary {
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.sv-split {
		display: block;
		width: 100%;
		height: auto;
	}
	.sv-old {
		fill: var(--surface-2);
		stroke: var(--border);
	}
	.sv-new {
		fill: var(--topic);
		transition: width var(--dur) var(--ease);
	}
	.sv-new-rollback {
		fill: var(--fail);
	}
	.sv-new-ok {
		fill: var(--ok);
	}

	.sv-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.sv-stats dt {
		color: var(--text-muted);
	}
	.sv-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.sv-desc,
	.sv-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* What to notice */
	.sv-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.sv-h2 {
		margin-bottom: var(--space-1);
		font-family: var(--font-serif);
		font-weight: 600;
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.sv.hl-q .sv-stats {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.sv *,
		.sv *::before,
		.sv *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.sv {
			padding: var(--space-4);
		}
		.sv-plots {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (max-width: 559px) {
		.sv-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.sv-ctl {
			flex-wrap: wrap;
		}
		.sv-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
