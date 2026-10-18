<script lang="ts">
	import katex from 'katex';
	import {
		AMDAHL_PRESETS,
		FRACTION_MAX,
		FRACTION_MIN,
		FRACTION_STEP,
		SPEEDUP_MAX,
		SPEEDUP_MIN,
		SPEEDUP_STEP,
		type AmdahlState,
		amdahlLimit,
		amdahlSpeedup,
		amdahlTime,
		buildTimeline,
		kernelBox,
		loadPercent,
		savedShare,
		snapFraction,
		snapSpeedup,
	} from '$lib/demos/profiling';

	/** Profiling demo: a modelled GPU timeline of one training step and Amdahl's law. */
	let { initial }: { initial?: Partial<AmdahlState> } = $props();

	const timeline = buildTimeline();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let fraction = $state(snapFraction(initial?.fraction ?? 0.3));
	/* svelte-ignore state_referenced_locally */
	let speedup = $state(snapSpeedup(initial?.speedup ?? 2));
	/** Index of the kernel selected on the timeline, or null. */
	let selected = $state<number | null>(null);

	const selectedKernel = $derived(selected === null ? null : timeline.kernels[selected]);
	const load = $derived(loadPercent(timeline));
	const newTime = $derived(amdahlTime(fraction, speedup));
	const newPercent = $derived(Math.round(newTime * 1000) / 10);
	const speedupValue = $derived(amdahlSpeedup(fraction, speedup));
	const limitValue = $derived(amdahlLimit(fraction));
	const saved = $derived(savedShare(fraction, speedup));
	const isActivePreset = (p: AmdahlState) => p.fraction === fraction && p.speedup === speedup;

	/** Russian decimal comma, with a fixed number of digits. */
	function ru(v: number, digits: number): string {
		return v.toFixed(digits).replace('.', ',');
	}

	const TEX = "T' = T\\left((1 - f) + \\dfrac{f}{s}\\right)";
	const TEX_FALLBACK = "T' = T((1 − f) + f / s)";

	/** Renders the formula with KaTeX; without a successful render the fallback text stays. */
	function tex(node: HTMLElement) {
		try {
			katex.render(TEX, node, { strict: 'ignore', throwOnError: false });
		} catch {
			/* keep fallback text */
		}
		return {};
	}

	const timelineDesc = $derived(
		selectedKernel
			? `Ядро ${selectedKernel.index + 1}: ${ru(selectedKernel.duration, 1)} мс, перед ним простой ${ru(selectedKernel.gapBefore, 1)} мс.`
			: `Шаг ${timeline.stepMs} мс: ядра занимают ${ru(timeline.busyMs, 0)} мс, простой ${ru(timeline.idleMs, 0)} мс, загрузка ${load}%.`,
	);
	const amdahlDesc = $derived(
		`Участок занимает ${Math.round(fraction * 100)}% времени и ускорен в ${speedup} раз. ` +
			`Новое время ${newPercent.toFixed(1).replace('.', ',')}% от старого, ускорение всей программы ×${ru(speedupValue, 2)}. ` +
			`Предел при бесконечном ускорении участка ×${ru(limitValue, 2)}.`,
	);

	function applyPreset(state: AmdahlState): void {
		fraction = snapFraction(state.fraction);
		speedup = snapSpeedup(state.speedup);
	}

	function toggleKernel(i: number): void {
		selected = selected === i ? null : i;
	}
</script>

<figure class="pf" data-demo="profiling">
	<p class="pf-model">
		Модельный таймлайн одного шага: длины ядер и промежутки заданы для иллюстрации, это не замер.
	</p>

	<section class="pf-section" aria-labelledby="pf-tl-title">
		<h3 id="pf-tl-title" class="pf-title">Таймлайн GPU</h3>

		<div class="pf-track-row">
			<span class="pf-row-label">GPU</span>
			<div class="pf-track">
				{#each timeline.kernels as k (k.index)}
					{@const box = kernelBox(k, timeline.stepMs)}
					<button
						type="button"
						class="pf-kernel"
						class:is-selected={selected === k.index}
						style="left: {box.left}%; width: {box.width}%"
						aria-pressed={selected === k.index}
						aria-label="Ядро {k.index + 1}: {ru(k.duration, 1)} мс, перед ним простой {ru(
							k.gapBefore,
							1,
						)} мс"
						onclick={() => toggleKernel(k.index)}
					>
						<span class="pf-kernel-fill"></span>
					</button>
				{/each}
			</div>
		</div>

		<div class="pf-axis" aria-hidden="true">
			<span>0</span><span>25</span><span>50</span><span>75</span><span>{timeline.stepMs} мс</span>
		</div>

		<dl class="pf-stats">
			<dt>Шаг</dt>
			<dd>{timeline.stepMs} мс</dd>
			<dt>Ядра</dt>
			<dd>{ru(timeline.busyMs, 0)} мс</dd>
			<dt>Простой</dt>
			<dd>{ru(timeline.idleMs, 0)} мс</dd>
			<dt>Загрузка</dt>
			<dd>{load}%</dd>
		</dl>

		<p class="pf-note">
			Пустые промежутки между полосами это простой GPU. Нажмите на ядро, чтобы увидеть его длину и
			простой перед ним.
		</p>
		<p class="pf-live" aria-live="polite">{timelineDesc}</p>
	</section>

	<section class="pf-section" aria-labelledby="pf-amdahl-title">
		<h3 id="pf-amdahl-title" class="pf-title">Закон Амдала</h3>

		<div class="pf-formula">
			<span class="pf-tex" use:tex aria-hidden="true">{TEX_FALLBACK}</span>
		</div>

		<div class="pf-controls">
			<label class="pf-ctl">
				<span class="pf-label">Доля участка <span class="pf-sym">f</span></span>
				<input
					class="pf-range"
					type="range"
					min={FRACTION_MIN}
					max={FRACTION_MAX}
					step={FRACTION_STEP}
					value={fraction}
					oninput={(e) => (fraction = snapFraction(Number(e.currentTarget.value)))}
				/>
				<output class="pf-val">{Math.round(fraction * 100)}%</output>
			</label>

			<label class="pf-ctl">
				<span class="pf-label">Ускорение участка <span class="pf-sym">s</span></span>
				<input
					class="pf-range"
					type="range"
					min={SPEEDUP_MIN}
					max={SPEEDUP_MAX}
					step={SPEEDUP_STEP}
					value={speedup}
					oninput={(e) => (speedup = snapSpeedup(Number(e.currentTarget.value)))}
				/>
				<output class="pf-val">×{speedup}</output>
			</label>
		</div>

		<div class="pf-presets" role="group" aria-label="Примеры из текста">
			{#each AMDAHL_PRESETS as p (p.id)}
				<button
					type="button"
					class="pf-preset"
					aria-pressed={isActivePreset(p.state)}
					onclick={() => applyPreset(p.state)}>{p.label}</button
				>
			{/each}
		</div>

		<div class="pf-bars" aria-hidden="true">
			<div class="pf-bar-row">
				<span class="pf-bar-label">было</span>
				<div class="pf-bar"><span class="pf-bar-old" style="width: 100%"></span></div>
			</div>
			<div class="pf-bar-row">
				<span class="pf-bar-label">стало</span>
				<div class="pf-bar">
					<span class="pf-bar-new" style="width: {newPercent}%"></span>
				</div>
			</div>
		</div>

		<dl class="pf-stats">
			<dt>Новое время T′/T</dt>
			<dd>{newPercent.toFixed(1).replace('.', ',')}%</dd>
			<dt>Сэкономлено</dt>
			<dd>{ru(saved * 100, 1)}%</dd>
			<dt>Ускорение программы</dt>
			<dd>×{ru(speedupValue, 2)}</dd>
			<dt>Предел при s → ∞</dt>
			<dd>×{ru(limitValue, 2)}</dd>
		</dl>

		<p class="pf-live" aria-live="polite">{amdahlDesc}</p>
	</section>
</figure>

<style>
	.pf {
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
	.pf :global(*),
	.pf :global(*::before),
	.pf :global(*::after) {
		box-sizing: border-box;
	}
	.pf dl,
	.pf dd,
	.pf dt,
	.pf p,
	.pf h3 {
		margin: 0;
	}
	.pf button {
		font: inherit;
	}
	.pf-model {
		padding: var(--space-2) var(--space-3);
		background: var(--topic-soft);
		color: var(--text-muted);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.pf-section + .pf-section {
		margin-top: var(--space-8);
		padding-top: var(--space-8);
		border-top: 1px solid var(--border);
	}
	.pf-title {
		margin-bottom: var(--space-4);
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
	}
	.pf-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Timeline */
	.pf-track-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.pf-row-label {
		flex: 0 0 auto;
		width: 36px;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.pf-track {
		position: relative;
		flex: 1 1 auto;
		min-width: 0;
		height: 56px;
		background: repeating-linear-gradient(
			135deg,
			var(--surface-2) 0 6px,
			color-mix(in srgb, var(--surface-2) 70%, var(--border)) 6px 7px
		);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.pf-kernel {
		position: absolute;
		top: 0;
		bottom: 0;
		min-width: 4px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.pf-kernel-fill {
		position: absolute;
		inset: 8px 0;
		background: var(--topic);
		border-radius: 2px;
		transition: opacity var(--dur) var(--ease);
	}
	.pf-kernel:not(.is-selected) .pf-kernel-fill {
		opacity: 0.85;
	}
	.pf-kernel.is-selected .pf-kernel-fill {
		opacity: 1;
		outline: 2px solid var(--text);
		outline-offset: 1px;
	}
	.pf-kernel:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.pf-axis {
		display: flex;
		justify-content: space-between;
		margin: var(--space-1) 0 0 calc(36px + var(--space-3));
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	/* Amdahl controls */
	.pf-formula {
		margin-bottom: var(--space-4);
		font-size: var(--fs-base);
	}
	.pf-tex {
		white-space: nowrap;
	}
	.pf-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3) var(--space-8);
	}
	.pf-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.pf-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.pf-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.pf-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.pf-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.pf-presets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.pf-preset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.pf-preset[aria-pressed='true'] {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.pf-preset:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Amdahl bars */
	.pf-bars {
		margin-top: var(--space-6);
		display: grid;
		gap: var(--space-2);
	}
	.pf-bar-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.pf-bar-label {
		flex: 0 0 auto;
		width: 52px;
		color: var(--text-muted);
		font-size: 12px;
	}
	.pf-bar {
		flex: 1 1 auto;
		min-width: 0;
		height: 16px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.pf-bar-old,
	.pf-bar-new {
		display: block;
		height: 100%;
		transition: width var(--dur) var(--ease);
	}
	.pf-bar-old {
		background: var(--border);
	}
	.pf-bar-new {
		background: var(--topic);
	}

	.pf-stats {
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
	.pf-stats dt {
		color: var(--text-muted);
	}
	.pf-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.pf-note,
	.pf-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.pf-live {
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.pf *,
		.pf *::before,
		.pf *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.pf {
			padding: var(--space-4);
		}
		.pf-range {
			width: 120px;
		}
	}

	@media (max-width: 559px) {
		.pf-controls {
			flex-direction: column;
			gap: var(--space-3);
		}
		.pf-ctl {
			flex-wrap: wrap;
		}
		.pf-range {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}
	}
</style>
