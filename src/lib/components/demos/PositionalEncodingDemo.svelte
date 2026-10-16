<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DEFAULT_STATE,
		DELTA_MAX,
		DIM_MAX,
		DIM_MIN,
		DIM_STEP,
		K_BASE,
		N_POS,
		POS_MAX,
		Q_BASE,
		type PositionalEncodingDemoState,
		clampPair,
		describeState,
		encodingTable,
		rotate,
		ropeReadout,
		shadePercent,
		snapDelta,
		snapDim,
		snapPos,
	} from '$lib/demos/positional-encoding';

	/** Sinusoidal encodings and RoPE rotation of one pair. Registers itself as demo `positional-encoding`. */
	let { initial }: { initial?: Partial<PositionalEncodingDemoState> } = $props();

	/** Resolves props into a valid state. Used once for the start and for «Сбросить». */
	function resolveState(p?: Partial<PositionalEncodingDemoState>): PositionalEncodingDemoState {
		const dim = snapDim(p?.dim ?? DEFAULT_STATE.dim);
		return {
			dim,
			pos: snapPos(p?.pos ?? DEFAULT_STATE.pos),
			pair: clampPair(p?.pair ?? DEFAULT_STATE.pair, dim),
			delta: snapDelta(p?.delta ?? DEFAULT_STATE.delta),
		};
	}

	/* svelte-ignore state_referenced_locally */
	const start = resolveState(initial);

	// The props only seed the initial state: the demo owns it afterwards.
	let dim = $state(start.dim);
	let pos = $state(start.pos);
	let pair = $state(start.pair);
	let delta = $state(start.delta);

	/** Width of the heatmap box in its viewBox units. */
	const HM_W = 360;
	const HM_H = 252;
	const X0 = 40;
	const X1 = 350;
	const Y0 = 8;
	const Y1 = 208;
	const cellH = (Y1 - Y0) / N_POS;

	const RP = 240;
	const RC = 120;
	const RR = 92;

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const cellW = $derived((X1 - X0) / dim);
	const table = $derived(encodingTable(dim));
	const pairEff = $derived(clampPair(pair, dim));
	const readout = $derived(ropeReadout({ dim, pos, pair: pairEff, delta }));
	const desc = $derived(describeState({ dim, pos, pair: pairEff, delta }));
	const pairCount = $derived(dim / 2);

	/** Point of a unit vector on the rotation panel (y axis points up). */
	function pt(v: readonly [number, number]): { x: number; y: number } {
		return { x: RC + RR * v[0], y: RC - RR * v[1] };
	}
	const qRot = $derived(pt(rotate(Q_BASE, pos * readout.omega)));
	const kRot = $derived(pt(rotate(K_BASE, readout.n * readout.omega)));
	const qBase = pt(Q_BASE);

	const pairX0 = $derived(X0 + 2 * pairEff * cellW);
	const pairW = $derived(2 * cellW);
	const rowY = $derived(Y0 + pos * cellH);

	function apply(patch: Partial<PositionalEncodingDemoState>): void {
		if (typeof patch.dim === 'number') dim = snapDim(patch.dim);
		if (typeof patch.pos === 'number') pos = snapPos(patch.pos);
		if (typeof patch.pair === 'number') pair = clampPair(patch.pair, dim);
		if (typeof patch.delta === 'number') delta = snapDelta(patch.delta);
	}

	function reset(): void {
		const s = resolveState(initial);
		dim = s.dim;
		pos = s.pos;
		pair = s.pair;
		delta = s.delta;
	}

	onMount(() => {
		return demos?.register('positional-encoding', {
			set: (patch) => apply(patch as Partial<PositionalEncodingDemoState>),
		});
	});
</script>

<figure class="pe" id="demo-positional-encoding" data-demo="positional-encoding">
	<div class="pe-controls">
		<label class="pe-ctl">
			<span class="pe-label"><span class="pe-sym">d</span> (размерность)</span>
			<input
				class="pe-range"
				type="range"
				min={DIM_MIN}
				max={DIM_MAX}
				step={DIM_STEP}
				value={dim}
				oninput={(e) => (dim = snapDim(Number(e.currentTarget.value)))}
			/>
			<output class="pe-val">{dim}</output>
		</label>

		<label class="pe-ctl">
			<span class="pe-label">Позиция <span class="pe-sym">m</span></span>
			<input
				class="pe-range"
				type="range"
				min="0"
				max={POS_MAX}
				step="1"
				value={pos}
				oninput={(e) => (pos = snapPos(Number(e.currentTarget.value)))}
			/>
			<output class="pe-val">{pos}</output>
		</label>

		<label class="pe-ctl">
			<span class="pe-label">Пара <span class="pe-sym">i</span></span>
			<input
				class="pe-range"
				type="range"
				min="0"
				max={pairCount - 1}
				step="1"
				value={pairEff}
				oninput={(e) => (pair = clampPair(Number(e.currentTarget.value), dim))}
			/>
			<output class="pe-val">{pairEff + 1}</output>
		</label>

		<label class="pe-ctl">
			<span class="pe-label">Смещение <span class="pe-sym">Δ</span> = n − m</span>
			<input
				class="pe-range"
				type="range"
				min="0"
				max={DELTA_MAX}
				step="1"
				value={delta}
				oninput={(e) => (delta = snapDelta(Number(e.currentTarget.value)))}
			/>
			<output class="pe-val">{delta}</output>
		</label>

		<button type="button" class="pe-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="pe-plots">
		<div class="pe-panel">
			<p class="pe-panel-t">Синусоидальные кодирования <span class="pe-muted">PE(pos,·)</span></p>
			<svg
				class="pe-svg"
				viewBox="0 0 {HM_W} {HM_H}"
				role="img"
				aria-labelledby="pe-hm-title pe-hm-desc"
			>
				<title id="pe-hm-title">Тепловая карта синусоидальных кодирований</title>
				<desc id="pe-hm-desc">
					Строки: позиции от 0 до {N_POS - 1}. Столбцы: {dim} компонент вектора. Левые пары меняются быстро,
					правые почти постоянны. Выделены строка позиции {pos} и пара {pairEff + 1}.
				</desc>
				{#each table as row, p (p)}
					{#each row as v, c (c)}
						<rect
							class="pe-cell"
							x={(X0 + c * cellW).toFixed(2)}
							y={(Y0 + p * cellH).toFixed(2)}
							width={(cellW + 0.4).toFixed(2)}
							height={(cellH + 0.4).toFixed(2)}
							style="fill: color-mix(in srgb, var(--seq-1) {shadePercent(v).toFixed(
								1,
							)}%, var(--seq-0))"
						>
							<title>позиция {p}, компонента {c}: {v.toFixed(2)}</title>
						</rect>
					{/each}
				{/each}

				<rect
					class="pe-hl-row"
					x={X0}
					y={rowY.toFixed(2)}
					width={X1 - X0}
					height={cellH.toFixed(2)}
				/>
				<rect
					class="pe-hl-pair"
					x={pairX0.toFixed(2)}
					y={Y0}
					width={pairW.toFixed(2)}
					height={Y1 - Y0}
				/>

				{#each [0, 10, 20, 30, 40] as p (p)}
					<text class="pe-tick" x={X0 - 6} y={(Y0 + (p + 0.5) * cellH).toFixed(1)} text-anchor="end"
						>{p}</text
					>
				{/each}
				{#each Array.from({ length: dim / 2 }, (_, i) => i * 2) as c (c)}
					<text class="pe-tick" x={(X0 + (c + 0.5) * cellW).toFixed(1)} y="222" text-anchor="middle"
						>{c}</text
					>
				{/each}
				<text class="pe-axis" x={X0} y="240">← быстрые пары</text>
				<text class="pe-axis" x={X1} y="240" text-anchor="end">медленные пары →</text>
			</svg>
			<p class="pe-legend-t">
				<span class="pe-swatch" aria-hidden="true"></span>
				значение от −1 до +1: цвет ячейки плавно меняется по шкале
			</p>
		</div>

		<div class="pe-panel">
			<p class="pe-panel-t">Поворот пары <span class="pe-muted">RoPE, R(mω) q и R(nω) k</span></p>
			<svg
				class="pe-svg pe-svg-round"
				viewBox="0 0 {RP} {RP}"
				role="img"
				aria-labelledby="pe-rp-title pe-rp-desc"
			>
				<title id="pe-rp-title">Пара компонент, повернутая на угол, растущий с позицией</title>
				<desc id="pe-rp-desc">{desc}</desc>
				<circle class="pe-ring" cx={RC} cy={RC} r={RR} />
				<line class="pe-axis-line" x1="6" x2="234" y1={RC} y2={RC} />
				<line class="pe-axis-line" x1={RC} x2={RC} y1="6" y2="234" />
				<line class="pe-base" x1={RC} y1={RC} x2={qBase.x} y2={qBase.y} />
				<line class="pe-q" x1={RC} y1={RC} x2={qRot.x} y2={qRot.y} />
				<circle class="pe-q-dot" cx={qRot.x} cy={qRot.y} r="5" />
				<line class="pe-k" x1={RC} y1={RC} x2={kRot.x} y2={kRot.y} />
				<circle class="pe-k-dot" cx={kRot.x} cy={kRot.y} r="5" />
				<text class="pe-q-txt" x={qRot.x + 8} y={qRot.y - 6}>q</text>
				<text class="pe-k-txt" x={kRot.x + 8} y={kRot.y - 6}>k</text>
			</svg>

			<dl class="pe-stats">
				<dt>частота ω</dt>
				<dd>{readout.omega.toFixed(4)}</dd>
				<dt>угол запроса m·ω</dt>
				<dd>{readout.angleQ.toFixed(0)}°</dd>
				<dt>угол ключа n·ω</dt>
				<dd>{readout.angleK.toFixed(0)}°</dd>
				<dt>q·k после RoPE</dt>
				<dd>{readout.score.toFixed(3)}</dd>
				<dt>то же при m = 0</dt>
				<dd>{readout.scoreAtZero.toFixed(3)}</dd>
			</dl>
		</div>
	</div>

	<p class="pe-live" aria-live="polite">{desc}</p>

	<p class="pe-notice">
		<strong>Что заметить:</strong> соседние строки похожи, далёкие заметно различаются. Левые пары (малые
		номера) вращаются быстро, правые почти стоят на месте. Поворот пары растёт с позицией, а q·k после
		RoPE зависит только от Δ: сдвиньте m, значение не меняется.
	</p>
</figure>

<style>
	.pe {
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
	.pe :global(*),
	.pe :global(*::before),
	.pe :global(*::after) {
		box-sizing: border-box;
	}
	.pe dl,
	.pe dd,
	.pe dt,
	.pe p {
		margin: 0;
	}
	.pe button {
		font: inherit;
	}
	.pe-muted {
		color: var(--text-muted);
	}
	.pe-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.pe-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.pe-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.pe-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.pe-range {
		width: 130px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.pe-range:focus-visible,
	.pe-reset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.pe-val {
		min-width: 3ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.pe-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}

	/* Charts */
	.pe-plots {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.pe-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.pe-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.pe-svg-round {
		max-width: 260px;
		margin: 0 auto;
	}
	.pe-cell {
		transition: opacity var(--dur) var(--ease);
	}
	.pe-hl-row,
	.pe-hl-pair {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2;
		pointer-events: none;
	}
	.pe-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.pe-axis {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.pe-legend-t {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.pe-swatch {
		display: inline-block;
		width: 48px;
		height: 8px;
		border-radius: 2px;
		background: linear-gradient(to right, var(--seq-0), var(--seq-1));
		border: 1px solid var(--border);
	}
	.pe-ring {
		fill: none;
		stroke: var(--text-muted);
		stroke-dasharray: 3 4;
		opacity: 0.6;
	}
	.pe-axis-line {
		stroke: var(--border);
		stroke-width: 1;
	}
	.pe-base {
		stroke: var(--text-muted);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
	}
	.pe-q {
		stroke: var(--cat-1);
		stroke-width: 3;
		transition: all var(--dur) var(--ease);
	}
	.pe-k {
		stroke: var(--cat-2);
		stroke-width: 3;
		transition: all var(--dur) var(--ease);
	}
	.pe-q-dot {
		fill: var(--cat-1);
	}
	.pe-k-dot {
		fill: var(--cat-2);
	}
	.pe-q-txt,
	.pe-k-txt {
		font-family: var(--font-serif);
		font-size: 16px;
		font-style: italic;
	}
	.pe-q-txt {
		fill: var(--cat-1);
	}
	.pe-k-txt {
		fill: var(--cat-2);
	}

	/* Statistics */
	.pe-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.pe-stats dt {
		color: var(--text-muted);
	}
	.pe-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.pe-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-size: 13px;
	}
	.pe-notice {
		margin-top: var(--space-3);
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.pe *,
		.pe *::before,
		.pe *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.pe {
			padding: var(--space-4);
		}
		.pe-plots {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (max-width: 559px) {
		.pe-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.pe-ctl {
			flex-wrap: wrap;
		}
		.pe-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
