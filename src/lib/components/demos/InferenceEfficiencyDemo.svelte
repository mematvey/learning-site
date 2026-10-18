<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		ALPHA_MAX,
		ALPHA_MIN,
		ALPHA_STEP,
		ATTENTION_KINDS,
		ATTENTION_LABEL,
		CHART_H,
		CHART_W,
		CONTEXT_STEP,
		DEFAULT_ALPHA,
		DEFAULT_ATTENTION,
		DEFAULT_CONTEXT,
		KV_GROUPS,
		MAX_CONTEXT,
		MIN_CONTEXT,
		PAD,
		SPEC_K,
		acceptCurve,
		acceptScales,
		kvBytesPerToken,
		kvCacheBytes,
		kvSeries,
		contextScales,
		describeState,
		expectedAccepted,
		formatBytes,
		formatFixed,
		formatInt,
		isAttentionKind,
		linePath,
		snapAlpha,
		snapContext,
		type AttentionKind,
		type InferenceDemoState,
	} from '$lib/demos/inference-efficiency';

	/** KV-cache and speculative decoding demo. Registers itself as demo `inference-efficiency`. */
	let { initial }: { initial?: Partial<InferenceDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let context = $state(snapContext(initial?.context ?? DEFAULT_CONTEXT));
	/* svelte-ignore state_referenced_locally */
	let attention = $state<AttentionKind>(
		isAttentionKind(initial?.attention) ? initial.attention : DEFAULT_ATTENTION,
	);
	/* svelte-ignore state_referenced_locally */
	let alpha = $state(snapAlpha(initial?.alpha ?? DEFAULT_ALPHA));

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const snapshot = $derived<InferenceDemoState>({ context, attention, alpha });
	const accepted = $derived(expectedAccepted(alpha));
	const note = $derived(describeState(snapshot));

	// Chart geometry is fixed (domains do not depend on the sliders), so it is computed once.
	const CTX = contextScales();
	const ACC = acceptScales();
	const lines = ATTENTION_KINDS.map((kind) => ({
		kind,
		d: linePath(kvSeries(kind).map((p) => ({ x: CTX.x(p.x), y: CTX.y(p.y) }))),
	}));
	const curveD = linePath(acceptCurve().map((p) => ({ x: ACC.x(p.x), y: ACC.y(p.y) })));
	const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
		y: CTX.y(f * CTX.yMax),
		label: formatBytes(f * CTX.yMax),
	}));
	const xTicks = [0, 8192, 16384, 24576, 32768].map((v) => ({
		x: CTX.x(v),
		label: formatInt(v),
	}));
	const accYTicks = Array.from({ length: SPEC_K + 1 }, (_, i) => i + 1).map((v) => ({
		y: ACC.y(v),
		label: String(v),
	}));
	const accXTicks = [
		{ x: ACC.x(0), label: '0' },
		{ x: ACC.x(0.5), label: '0,5' },
		{ x: ACC.x(1), label: '1' },
	];

	const dotX = $derived(CTX.x(context));
	const dots = $derived(
		ATTENTION_KINDS.map((kind) => ({
			kind,
			cy: CTX.y(kvCacheBytes(context, kind)),
		})),
	);
	const markerX = $derived(ACC.x(alpha));
	const markerY = $derived(ACC.y(accepted));

	function reset(): void {
		context = DEFAULT_CONTEXT;
		attention = DEFAULT_ATTENTION;
		alpha = DEFAULT_ALPHA;
	}

	function apply(patch: Partial<InferenceDemoState>): void {
		if (typeof patch.context === 'number') context = snapContext(patch.context);
		if (isAttentionKind(patch.attention)) attention = patch.attention;
		if (typeof patch.alpha === 'number') alpha = snapAlpha(patch.alpha);
	}

	onMount(() => {
		return demos?.register('inference-efficiency', {
			set: (patch) => apply(patch as Partial<InferenceDemoState>),
		});
	});
</script>

<figure class="ie" id="demo-inference-efficiency" data-demo="inference-efficiency">
	<div class="ie-controls">
		<div class="ie-group" role="group" aria-label="Вариант внимания">
			{#each ATTENTION_KINDS as kind (kind)}
				<button
					type="button"
					class="ie-seg"
					aria-pressed={attention === kind}
					onclick={() => (attention = kind)}>{ATTENTION_LABEL[kind]}</button
				>
			{/each}
		</div>

		<label class="ie-ctl">
			<span class="ie-label">Длина контекста</span>
			<input
				class="ie-range"
				type="range"
				min={MIN_CONTEXT}
				max={MAX_CONTEXT}
				step={CONTEXT_STEP}
				value={context}
				oninput={(e) => (context = snapContext(Number(e.currentTarget.value)))}
			/>
			<output class="ie-val">{formatInt(context)}</output>
		</label>

		<label class="ie-ctl">
			<span class="ie-label">Доля принятия <span class="ie-sym">α</span></span>
			<input
				class="ie-range"
				type="range"
				min={ALPHA_MIN}
				max={ALPHA_MAX}
				step={ALPHA_STEP}
				value={alpha}
				oninput={(e) => (alpha = snapAlpha(Number(e.currentTarget.value)))}
			/>
			<output class="ie-val">{formatFixed(alpha, 2)}</output>
		</label>

		<button type="button" class="ie-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="ie-plots">
		<div class="ie-panel">
			<p class="ie-panel-t">Размер KV-кэша</p>
			<svg
				class="ie-svg"
				viewBox="0 0 {CHART_W} {CHART_H}"
				role="img"
				aria-labelledby="ie-kv-title ie-kv-desc"
			>
				<title id="ie-kv-title">Размер KV-кэша от длины контекста</title>
				<desc id="ie-kv-desc">
					Три прямые: MHA, GQA и MQA. Кэш растёт линейно с длиной контекста; при MHA он в 4 раза
					больше, чем при GQA, и в 32 раза больше, чем при MQA.
				</desc>
				<line
					class="ie-axis"
					x1={PAD.left}
					x2={CHART_W - PAD.right}
					y1={CHART_H - PAD.bottom}
					y2={CHART_H - PAD.bottom}
				/>
				<line class="ie-axis" x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={CHART_H - PAD.bottom} />
				{#each yTicks as t (t.label)}
					<text class="ie-tick" x={PAD.left - 6} y={t.y + 4} text-anchor="end">{t.label}</text>
				{/each}
				{#each xTicks as t (t.label)}
					<text class="ie-tick" x={t.x} y={CHART_H - 10} text-anchor="middle">{t.label}</text>
				{/each}
				{#each lines as ln (ln.kind)}
					<path
						class="ie-line ie-line-{ln.kind}"
						class:is-sel={attention === ln.kind}
						d={ln.d}
						fill="none"
					/>
				{/each}
				{#each dots as dot (dot.kind)}
					<circle
						class="ie-dot ie-line-{dot.kind}"
						class:is-sel={attention === dot.kind}
						cx={dotX.toFixed(1)}
						cy={dot.cy.toFixed(1)}
						r={attention === dot.kind ? 4.5 : 3}
					/>
				{/each}
			</svg>
			<div class="ie-legend" aria-hidden="true">
				{#each ATTENTION_KINDS as kind (kind)}
					<span class="ie-key ie-line-{kind}" class:is-sel={attention === kind}
						>{ATTENTION_LABEL[kind]}</span
					>
				{/each}
			</div>
		</div>

		<div class="ie-panel">
			<p class="ie-panel-t">Токенов за один вызов</p>
			<svg
				class="ie-svg"
				viewBox="0 0 {CHART_W} {CHART_H}"
				role="img"
				aria-labelledby="ie-spec-title ie-spec-desc"
			>
				<title id="ie-spec-title">Принятые токены при спекулятивном декодировании</title>
				<desc id="ie-spec-desc">
					Кривая среднего числа токенов за один вызов большой модели при {SPEC_K} черновых токенах и доле
					принятия от 0 до 1.
				</desc>
				<line
					class="ie-axis"
					x1={PAD.left}
					x2={CHART_W - PAD.right}
					y1={CHART_H - PAD.bottom}
					y2={CHART_H - PAD.bottom}
				/>
				<line class="ie-axis" x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={CHART_H - PAD.bottom} />
				{#each accYTicks as t (t.label)}
					<text class="ie-tick" x={PAD.left - 6} y={t.y + 4} text-anchor="end">{t.label}</text>
				{/each}
				{#each accXTicks as t (t.label)}
					<text class="ie-tick" x={t.x} y={CHART_H - 10} text-anchor="middle">{t.label}</text>
				{/each}
				<path class="ie-curve" d={curveD} fill="none" />
				<line
					class="ie-guide"
					x1={markerX.toFixed(1)}
					x2={markerX.toFixed(1)}
					y1={CHART_H - PAD.bottom}
					y2={markerY.toFixed(1)}
				/>
				<circle class="ie-marker" cx={markerX.toFixed(1)} cy={markerY.toFixed(1)} r="4.5" />
			</svg>
			<p class="ie-accepted">
				<span class="ie-big">{formatFixed(accepted, 2)}</span>
				<span class="ie-muted"
					>токена за вызов при α = {formatFixed(alpha, 2)} и {SPEC_K} черновых</span
				>
			</p>
		</div>
	</div>

	<p class="ie-formula">
		M<sub>KV</sub> = 2 · L · n · h<sub>kv</sub> · d<sub>k</sub> · b · &nbsp;(L = 32, d<sub>k</sub> = 128,
		b = 2)
	</p>

	<table class="ie-table">
		<caption class="ie-sr">Размер кэша для текущей длины контекста</caption>
		<thead>
			<tr>
				<th scope="col">Вариант</th>
				<th scope="col">Групп K/V</th>
				<th scope="col">На токен</th>
				<th scope="col">На {formatInt(context)} токенов</th>
			</tr>
		</thead>
		<tbody>
			{#each ATTENTION_KINDS as kind (kind)}
				<tr class:is-sel={attention === kind}>
					<th scope="row">{ATTENTION_LABEL[kind]}</th>
					<td>{KV_GROUPS[kind]}</td>
					<td>{formatBytes(kvBytesPerToken(KV_GROUPS[kind]))}</td>
					<td>{formatBytes(kvCacheBytes(context, kind))}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<p class="ie-note" aria-live="polite">{note}</p>

	<p class="ie-what">
		<strong>Что заметить:</strong> кэш растёт линейно с длиной, вариант внимания задаёт наклон прямой.
		Чем выше доля принятия, тем больше токенов за один вызов большой модели.
	</p>
</figure>

<style>
	.ie {
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
	.ie :global(*),
	.ie :global(*::before),
	.ie :global(*::after) {
		box-sizing: border-box;
	}
	.ie p,
	.ie table {
		margin: 0;
	}
	.ie button {
		font: inherit;
	}
	.ie-muted {
		color: var(--text-muted);
	}
	.ie-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}
	.ie-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* Controls */
	.ie-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ie-group {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.ie-seg,
	.ie-reset {
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
	.ie-reset {
		border: 1px solid var(--border);
		color: var(--text);
	}
	.ie-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.ie-seg:focus-visible,
	.ie-reset:focus-visible,
	.ie-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.ie-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.ie-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.ie-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.ie-val {
		min-width: 5ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	/* Charts */
	.ie-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.ie-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.ie-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.ie-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.6;
	}
	.ie-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.ie-line {
		stroke-width: 1.5;
		opacity: 0.45;
		transition:
			opacity var(--dur) var(--ease),
			stroke-width var(--dur) var(--ease);
	}
	.ie-line.is-sel {
		stroke-width: 3;
		opacity: 1;
	}
	.ie-line-mha {
		stroke: var(--cat-4);
	}
	.ie-line-gqa {
		stroke: var(--cat-2);
	}
	.ie-line-mqa {
		stroke: var(--cat-1);
	}
	.ie-dot {
		stroke: var(--surface);
		stroke-width: 1.5;
		opacity: 0.6;
	}
	.ie-dot.is-sel {
		opacity: 1;
	}
	.ie-dot.ie-line-mha {
		fill: var(--cat-4);
	}
	.ie-dot.ie-line-gqa {
		fill: var(--cat-2);
	}
	.ie-dot.ie-line-mqa {
		fill: var(--cat-1);
	}
	.ie-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-2);
		font-size: 12px;
	}
	.ie-key {
		color: var(--text-muted);
		padding-left: var(--space-4);
		position: relative;
	}
	.ie-key::before {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		width: 12px;
		height: 3px;
		border-radius: 2px;
		transform: translateY(-50%);
		background: currentColor;
	}
	.ie-key.ie-line-mha {
		color: var(--cat-4);
	}
	.ie-key.ie-line-gqa {
		color: var(--cat-2);
	}
	.ie-key.ie-line-mqa {
		color: var(--cat-1);
	}
	.ie-key.is-sel {
		font-weight: 600;
		color: var(--text);
	}
	.ie-key.is-sel.ie-line-mha {
		color: var(--cat-4);
	}
	.ie-key.is-sel.ie-line-gqa {
		color: var(--cat-2);
	}
	.ie-key.is-sel.ie-line-mqa {
		color: var(--cat-1);
	}
	.ie-curve {
		stroke: var(--topic);
		stroke-width: 2.5;
	}
	.ie-guide {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.ie-marker {
		fill: var(--topic);
		stroke: var(--surface);
		stroke-width: 2;
	}
	.ie-accepted {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-2);
	}
	.ie-big {
		font-family: var(--font-mono);
		font-size: 22px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}

	.ie-formula {
		margin-top: var(--space-6);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 13px;
	}

	/* Table of cache sizes */
	.ie-table {
		width: 100%;
		margin-top: var(--space-3);
		border-collapse: collapse;
		font-size: 13px;
	}
	.ie-table th,
	.ie-table td {
		padding: var(--space-1) var(--space-3);
		border-bottom: 1px solid var(--border);
		text-align: left;
		font-variant-numeric: tabular-nums;
	}
	.ie-table thead th {
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 500;
	}
	.ie-table tbody th {
		font-weight: 600;
	}
	.ie-table td {
		font-family: var(--font-mono);
	}
	.ie-table tr.is-sel th,
	.ie-table tr.is-sel td {
		color: var(--text);
		background: var(--surface-2);
	}

	.ie-note {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.ie-what {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.ie-what strong {
		color: var(--text);
	}

	@media (max-width: 720px) {
		.ie {
			padding: var(--space-4);
		}
		.ie-plots {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (max-width: 559px) {
		.ie-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.ie-ctl {
			flex-wrap: wrap;
		}
		.ie-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
		.ie-table {
			font-size: 12px;
		}
		.ie-table th,
		.ie-table td {
			padding: var(--space-1) var(--space-2);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ie *,
		.ie *::before,
		.ie *::after {
			transition: none !important;
		}
	}
</style>
