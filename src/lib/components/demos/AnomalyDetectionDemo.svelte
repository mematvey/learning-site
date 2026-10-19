<script lang="ts">
	import {
		DOMAIN,
		GAMMA_MAX,
		GAMMA_MIN,
		GAMMA_STEP,
		GAMMA_DEFAULT,
		NUDGE,
		NUDGE_FAST,
		type AnomalyDemoState,
		type Point,
		averagePrecision,
		chapterExample,
		movedTo,
		confusion,
		describeState,
		flagCount,
		flagTop,
		fmt,
		makeCloud,
		prCurve,
		quality,
		scores,
		snapGamma,
		spread,
	} from '$lib/demos/anomaly-detection';

	/** Anomaly detection on a 2-D cloud: the threshold is set by the share of flagged points. */
	let { initial }: { initial?: Partial<AnomalyDemoState> } = $props();

	/* The props only seed the initial state: the demo owns it afterwards. */
	let points = $state<Point[]>(makeCloud());
	/* svelte-ignore state_referenced_locally */
	let gamma = $state(snapGamma(initial?.gamma ?? GAMMA_DEFAULT));
	/** Index of the point under the pointer, -1 when none. */
	let drag = $state(-1);
	/** Real widths of the two plots in px; the SVGs are drawn at this width (no viewBox scaling). */
	let wScatter = $state(0);
	let wPr = $state(0);

	const PR_H = 180;
	const PR_PAD = { l: 36, r: 10, t: 10, b: 28 };
	/** Hit radius for pointer picking, in data units. */
	const PICK = 0.4;

	const n = $derived(points.length);
	const sc = $derived(scores(points));
	const k = $derived(flagCount(n, gamma));
	const flagging = $derived(flagTop(sc, k));
	const conf = $derived(confusion(points, flagging.flags));
	const q = $derived(quality(conf));
	const curve = $derived(prCurve(points, sc));
	const ap = $derived(averagePrecision(curve));
	const sp = $derived(spread(points));
	const size = $derived(wScatter >= 200 ? Math.min(wScatter, 340) : 300);
	const prW = $derived(wPr >= 200 ? wPr : 300);
	const ex = chapterExample();
	const summary = $derived(describeState(conf, q, k, n));
	const shareText = $derived(`${Math.round(gamma * 100)}%`);

	/** Data coordinates to pixels inside the square plot of width `size`. */
	function px(x: number): number {
		return ((x + DOMAIN) / (2 * DOMAIN)) * size;
	}
	function py(y: number): number {
		return ((DOMAIN - y) / (2 * DOMAIN)) * size;
	}

	/** Pointer position in data units, from the rendered size of the SVG. */
	function toData(e: PointerEvent, el: SVGSVGElement): { x: number; y: number } {
		const r = el.getBoundingClientRect();
		return {
			x: ((e.clientX - r.left) / r.width) * 2 * DOMAIN - DOMAIN,
			y: DOMAIN - ((e.clientY - r.top) / r.height) * 2 * DOMAIN,
		};
	}

	/** Nearest point within the pick radius, or -1. */
	function pick(d: { x: number; y: number }): number {
		let best = -1;
		let bestD = PICK;
		points.forEach((p, i) => {
			const dist = Math.hypot(p.x - d.x, p.y - d.y);
			if (dist < bestD) {
				bestD = dist;
				best = i;
			}
		});
		return best;
	}

	function onPointerDown(e: PointerEvent): void {
		const el = e.currentTarget as SVGSVGElement;
		const i = pick(toData(e, el));
		if (i < 0) return;
		drag = i;
		el.setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onPointerMove(e: PointerEvent): void {
		if (drag < 0) return;
		const d = toData(e, e.currentTarget as SVGSVGElement);
		setPoint(drag, d.x, d.y);
	}

	/** Moves point i to (x, y); the label of the point stays with it. */
	function setPoint(i: number, x: number, y: number): void {
		const p = points[i];
		if (p) points[i] = movedTo(p, x, y);
	}

	function endDrag(): void {
		drag = -1;
	}

	/** Anomalies move with the arrow keys; Shift makes the step larger. */
	function onKey(e: KeyboardEvent, i: number): void {
		const s = e.shiftKey ? NUDGE_FAST : NUDGE;
		let dx = 0;
		let dy = 0;
		if (e.key === 'ArrowLeft') dx = -s;
		else if (e.key === 'ArrowRight') dx = s;
		else if (e.key === 'ArrowUp') dy = s;
		else if (e.key === 'ArrowDown') dy = -s;
		else return;
		e.preventDefault();
		const p = points[i];
		if (p) points[i] = movedTo(p, p.x + dx, p.y + dy);
	}

	function reset(): void {
		points = makeCloud();
		gamma = snapGamma(GAMMA_DEFAULT);
		drag = -1;
	}

	/** Pixel path of the PR curve. Recall runs along x, precision along y. */
	const prPath = $derived.by(() => {
		const iw = prW - PR_PAD.l - PR_PAD.r;
		const ih = PR_H - PR_PAD.t - PR_PAD.b;
		return curve
			.map((c, j) => {
				const X = PR_PAD.l + c.recall * iw;
				const Y = PR_PAD.t + (1 - c.precision) * ih;
				return `${j === 0 ? 'M' : 'L'}${X.toFixed(1)} ${Y.toFixed(1)}`;
			})
			.join(' ');
	});
	const prCur = $derived.by(() => {
		const iw = prW - PR_PAD.l - PR_PAD.r;
		const ih = PR_H - PR_PAD.t - PR_PAD.b;
		const c = curve[k - 1];
		if (!c) return null;
		return {
			x: PR_PAD.l + c.recall * iw,
			y: PR_PAD.t + (1 - c.precision) * ih,
		};
	});
	const prBase = $derived.by(() => {
		const ih = PR_H - PR_PAD.t - PR_PAD.b;
		const base = conf.tp + conf.fn > 0 ? (conf.tp + conf.fn) / n : 0;
		return PR_PAD.t + (1 - base) * ih;
	});
</script>

<figure class="ad" id="demo-anomaly-detection" data-demo="anomaly-detection">
	<div class="ad-controls">
		<label class="ad-ctl">
			<span class="ad-label">Доля помеченных точек</span>
			<input
				class="ad-range"
				type="range"
				min={GAMMA_MIN}
				max={GAMMA_MAX}
				step={GAMMA_STEP}
				value={gamma}
				oninput={(e) => (gamma = snapGamma(Number(e.currentTarget.value)))}
			/>
			<output class="ad-val">{shareText}</output>
		</label>
		<button type="button" class="ad-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="ad-plots">
		<div class="ad-panel" bind:clientWidth={wScatter}>
			<p class="ad-panel-t">Облако точек</p>
			<svg
				class="ad-svg ad-scatter"
				style="height: {size}px"
				viewBox="0 0 {size} {size}"
				role="group"
				aria-label="Двумерное облако точек. Перетаскивайте точки мышью или пальцем. Аномалии двигаются стрелками на клавиатуре."
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={endDrag}
				onpointercancel={endDrag}
			>
				<rect class="ad-frame" x="0.5" y="0.5" width={size - 1} height={size - 1} />
				<line class="ad-axis" x1="0" x2={size} y1={py(0)} y2={py(0)} />
				<line class="ad-axis" x1={px(0)} x2={px(0)} y1="0" y2={size} />
				<text class="ad-tick" x={size - 4} y={py(0) - 4} text-anchor="end">x₁</text>
				<text class="ad-tick" x={px(0) + 4} y="12">x₂</text>

				<ellipse
					class="ad-thr"
					cx={px(sp.mx)}
					cy={py(sp.my)}
					rx={(flagging.tau * sp.sx * size) / (2 * DOMAIN)}
					ry={(flagging.tau * sp.sy * size) / (2 * DOMAIN)}
				/>

				{#each points as p, i (i)}
					{#if p.anomaly}
						<circle
							class="ad-pt ad-pt--truth"
							class:ad-pt--flag={flagging.flags[i]}
							class:ad-pt--drag={drag === i}
							cx={px(p.x).toFixed(1)}
							cy={py(p.y).toFixed(1)}
							r="5"
							role="button"
							tabindex="0"
							aria-label="Аномалия {i + 1}: x₁ {fmt(p.x, 1)}, x₂ {fmt(p.y, 1)}, {flagging.flags[i]
								? 'помечена'
								: 'не помечена'}"
							onkeydown={(e) => onKey(e, i)}
						/>
					{:else}
						<circle
							class="ad-pt"
							class:ad-pt--flag={flagging.flags[i]}
							cx={px(p.x).toFixed(1)}
							cy={py(p.y).toFixed(1)}
							r="3"
							aria-hidden="true"
						/>
					{/if}
				{/each}
			</svg>
			<p class="ad-legend">
				<span class="ad-key ad-key--flag"></span> помечена
				<span class="ad-key ad-key--truth"></span> аномалия по правде
				<span class="ad-key ad-key--thr"></span> граница порога
			</p>
		</div>

		<div class="ad-panel" bind:clientWidth={wPr}>
			<p class="ad-panel-t">Точность и полнота при разных порогах</p>
			<svg
				class="ad-svg"
				style="height: {PR_H}px"
				viewBox="0 0 {prW} {PR_H}"
				role="img"
				aria-labelledby="ad-pr-title ad-pr-desc"
			>
				<title id="ad-pr-title">Кривая точности и полноты</title>
				<desc id="ad-pr-desc">
					Точка на кривой соответствует текущему порогу. Пунктир: случайное ранжирование, точность
					равна доле аномалий {fmt((conf.tp + conf.fn) / n, 2)}.
				</desc>
				<line
					class="ad-axis"
					x1={PR_PAD.l}
					x2={prW - PR_PAD.r}
					y1={PR_H - PR_PAD.b}
					y2={PR_H - PR_PAD.b}
				/>
				<line class="ad-axis" x1={PR_PAD.l} x2={PR_PAD.l} y1={PR_PAD.t} y2={PR_H - PR_PAD.b} />
				<text class="ad-tick" x={PR_PAD.l - 6} y={PR_PAD.t + 4} text-anchor="end">1</text>
				<text class="ad-tick" x={PR_PAD.l - 6} y={PR_H - PR_PAD.b} text-anchor="end">0</text>
				<text class="ad-tick" x={PR_PAD.l} y={PR_H - 6}>0</text>
				<text class="ad-tick" x={prW - PR_PAD.r} y={PR_H - 6} text-anchor="end">полнота 1</text>
				<line class="ad-base" x1={PR_PAD.l} x2={prW - PR_PAD.r} y1={prBase} y2={prBase} />
				<path class="ad-curve" d={prPath} />
				{#if prCur}
					<circle class="ad-cur" cx={prCur.x.toFixed(1)} cy={prCur.y.toFixed(1)} r="5" />
				{/if}
			</svg>
			<p class="ad-legend">
				Пунктир: случайное ранжирование. Средняя точность (PR AUC) {fmt(ap, 2)}.
			</p>
		</div>
	</div>

	<dl class="ad-stats">
		<dt>Помечено точек</dt>
		<dd>{k} из {n}</dd>
		<dt>Порог, в σ</dt>
		<dd>{fmt(flagging.tau, 2)}</dd>
		<dt>Найдено аномалий</dt>
		<dd>{conf.tp} из {q.positives}</dd>
		<dt>Ложные срабатывания</dt>
		<dd>{conf.fp}</dd>
		<dt>Точность (precision)</dt>
		<dd>{fmt(q.precision, 2)}</dd>
		<dt>Полнота (recall)</dt>
		<dd>{fmt(q.recall, 2)}</dd>
		<dt>Доля верных ответов</dt>
		<dd>{fmt(q.accuracy * 100, 1)}%</dd>
		<dt>«Всё норма» даёт</dt>
		<dd>{fmt(q.baseline * 100, 1)}%</dd>
	</dl>

	<p class="ad-live" aria-live="polite">{summary}</p>

	<div class="ad-example">
		<p class="ad-ex-t">Пример из главы</p>
		<p>
			10 000 объектов, 100 аномалий. Детектор нашёл 80 и дал 495 ложных срабатываний: точность 80 /
			(80 + 495) = {fmt(ex.precision, 3)}, полнота {fmt(ex.recall, 2)}, доля верных ответов
			{fmt(ex.accuracy * 100, 2)}%.
		</p>
		<p>Те же свойства детектора при 10% аномалий дают точность {fmt(ex.precisionCommon, 2)}.</p>
	</div>

	<p class="ad-hint">
		Перетащите точку мышью или пальцем. Аномалии ещё и с клавиатуры: Tab выбирает, стрелки двигают,
		Shift двигает быстрее.
	</p>
</figure>

<style>
	.ad {
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
		overflow-wrap: anywhere;
	}
	.ad :global(*),
	.ad :global(*::before),
	.ad :global(*::after) {
		box-sizing: border-box;
	}
	.ad dl,
	.ad dd,
	.ad dt,
	.ad p {
		margin: 0;
	}
	.ad button {
		font: inherit;
	}
	.ad-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.ad-ctl {
		display: flex;
		flex: 1 1 260px;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}
	.ad-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.ad-range {
		flex: 1 1 140px;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.ad-val {
		min-width: 3.5ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.ad-reset {
		height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.ad-range:focus-visible,
	.ad-reset:focus-visible,
	.ad-svg circle[tabindex]:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.ad-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.ad-panel {
		min-width: 0;
	}
	.ad-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.ad-svg {
		display: block;
		width: 100%;
		overflow: hidden;
		touch-action: none;
		user-select: none;
	}
	.ad-scatter {
		cursor: crosshair;
	}
	.ad-frame {
		fill: var(--bg);
		stroke: var(--border);
	}
	.ad-axis {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.5;
	}
	.ad-tick {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.ad-pt {
		fill: var(--text-muted);
		fill-opacity: 0.5;
		stroke: none;
	}
	.ad-pt--flag {
		fill: var(--cat-2);
		fill-opacity: 0.9;
	}
	.ad-pt--truth {
		fill: var(--text-muted);
		stroke: var(--text);
		stroke-width: 1.5;
		cursor: grab;
	}
	.ad-pt--truth.ad-pt--flag {
		fill: var(--cat-2);
	}
	.ad-pt--drag {
		cursor: grabbing;
	}
	.ad-thr {
		fill: none;
		stroke: var(--topic);
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
	}
	.ad-curve {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2;
	}
	.ad-base {
		stroke: var(--text-muted);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
	}
	.ad-cur {
		fill: var(--cat-2);
		stroke: var(--text);
		stroke-width: 1.5;
	}
	.ad-legend {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.ad-key {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin: 0 4px 0 8px;
		border-radius: 50%;
		vertical-align: -1px;
	}
	.ad-key--flag {
		background: var(--cat-2);
	}
	.ad-key--truth {
		border: 1.5px solid var(--text);
		background: var(--text-muted);
		box-sizing: border-box;
	}
	.ad-key--thr {
		border-radius: 0;
		height: 0;
		border-top: 1.5px dashed var(--topic);
	}

	.ad-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.ad-stats dt {
		color: var(--text-muted);
	}
	.ad-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.ad-live {
		margin-top: var(--space-4);
		color: var(--text);
	}
	.ad-example {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--topic);
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}
	.ad-ex-t {
		margin-bottom: var(--space-1);
		font-weight: 600;
	}
	.ad-hint {
		margin-top: var(--space-4);
		color: var(--text-muted);
		font-size: 12px;
	}

	@media (prefers-reduced-motion: reduce) {
		.ad *,
		.ad *::before,
		.ad *::after {
			transition: none !important;
		}
	}

	@media (max-width: 640px) {
		.ad {
			padding: var(--space-4);
		}
		.ad-plots {
			grid-template-columns: minmax(0, 1fr);
		}
		.ad-ctl {
			flex-basis: 100%;
			flex-wrap: wrap;
		}
		.ad-label {
			flex: 1 1 100%;
			white-space: normal;
		}
	}
</style>
