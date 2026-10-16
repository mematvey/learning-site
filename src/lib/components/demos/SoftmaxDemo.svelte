<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import katex from 'katex';
	import {
		DEMOS_CONTEXT,
		HIGHLIGHT_CONTEXT,
		type DemosContext,
		type HighlightContext,
	} from '$lib/contracts/context';
	import {
		BIG_SHIFT,
		DEFAULT_STATE,
		LOGIT_MAX,
		LOGIT_MIN,
		LOGIT_STEP,
		SOFTMAX_SIZE,
		T_MAX,
		T_MIN,
		T_STEP,
		clampTemperature,
		clampLogit,
		describeSoftmax,
		normalizeLogits,
		probabilities,
		sumOf,
		type SoftmaxDemoState,
	} from '$lib/demos/softmax';

	/** Softmax demo: five logit sliders, temperature, naive vs stable. Registers as demo `softmax`. */
	let { initial }: { initial?: Partial<SoftmaxDemoState> } = $props();

	/** Formula for KaTeX; the text fallback stays if rendering fails. */
	const TEX = 'p_i = \\dfrac{\\exp(z_i / T)}{\\sum_j \\exp(z_j / T)}';

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let logits: number[] = $state(
		normalizeLogits(initial?.logits ?? []) ?? [...DEFAULT_STATE.logits],
	);
	/* svelte-ignore state_referenced_locally */
	let temperature = $state(clampTemperature(initial?.temperature ?? DEFAULT_STATE.temperature));
	/* svelte-ignore state_referenced_locally */
	let stable = $state(initial?.stable ?? DEFAULT_STATE.stable);
	/* svelte-ignore state_referenced_locally */
	let big = $state(initial?.big ?? DEFAULT_STATE.big);

	let root: HTMLElement | undefined = $state();

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	const highlight = getContext<HighlightContext | undefined>(HIGHLIGHT_CONTEXT);
	const hl = $derived(highlight?.hl ?? null);

	const demo: SoftmaxDemoState = $derived({ logits, temperature, stable, big });
	const probs = $derived(probabilities(demo));
	const sum = $derived(sumOf(probs));
	const note = $derived(describeSoftmax(demo));
	const indices = Array.from({ length: SOFTMAX_SIZE }, (_, i) => i);

	const fmt = (p: number): string => (Number.isFinite(p) ? p.toFixed(3) : 'NaN');
	const fill = (p: number): string => (Number.isFinite(p) ? p.toFixed(4) : '0');

	function apply(patch: Partial<SoftmaxDemoState>): void {
		if (Array.isArray(patch.logits)) {
			const next = normalizeLogits(patch.logits);
			if (next) logits = next;
		}
		if (typeof patch.temperature === 'number') temperature = clampTemperature(patch.temperature);
		if (typeof patch.stable === 'boolean') stable = patch.stable;
		if (typeof patch.big === 'boolean') big = patch.big;
	}

	function setLogit(i: number, raw: string): void {
		const next = logits.slice();
		next[i] = clampLogit(Number(raw));
		logits = next;
	}

	onMount(() => {
		// Renders the formula; without a successful render the static fallback text stays.
		const el = root?.querySelector<HTMLElement>('.sd-tex');
		if (el) {
			try {
				katex.render(TEX, el, { strict: 'ignore', throwOnError: false });
			} catch {
				/* keep fallback text */
			}
		}
		return demos?.register('softmax', {
			set: (patch) => apply(patch as Partial<SoftmaxDemoState>),
		});
	});
</script>

<figure
	class="sd"
	id="demo-softmax"
	data-demo="softmax"
	class:is-naive={!stable}
	class:hl-q={hl === 'q'}
	class:hl-v={hl === 'v'}
	bind:this={root}
>
	<div class="sd-controls">
		<label class="sd-ctl sd-temp">
			<span class="sd-label">Температура <i>T</i></span>
			<input
				class="sd-range"
				type="range"
				min={T_MIN}
				max={T_MAX}
				step={T_STEP}
				value={temperature}
				oninput={(e) => (temperature = clampTemperature(Number(e.currentTarget.value)))}
			/>
			<output class="sd-out">T = {temperature.toFixed(1)}</output>
		</label>
		<div class="sd-ctl">
			<span class="sd-label" id="sd-stable-label">Устойчивый вариант</span>
			<button
				type="button"
				class="sd-switch"
				role="switch"
				aria-labelledby="sd-stable-label"
				aria-checked={stable}
				onclick={() => (stable = !stable)}
			>
				<span class="sd-knob"></span>
			</button>
			<span class="sd-state">{stable ? 'вкл' : 'выкл'}</span>
		</div>
		<div class="sd-ctl">
			<span class="sd-label" id="sd-big-label">Большие логиты +{BIG_SHIFT}</span>
			<button
				type="button"
				class="sd-switch"
				role="switch"
				aria-labelledby="sd-big-label"
				aria-checked={big}
				onclick={() => (big = !big)}
			>
				<span class="sd-knob"></span>
			</button>
			<span class="sd-state">{big ? 'вкл' : 'выкл'}</span>
		</div>
	</div>

	<p class="sd-formula">
		<span class="sd-tex"
			>p<sub>i</sub> = exp(z<sub>i</sub>/T) / Σ<sub>j</sub> exp(z<sub>j</sub>/T)</span
		>
	</p>

	<div class="sd-body">
		<div class="sd-logits" role="group" aria-label="Логиты z">
			<p class="sd-col-t">Логиты <i>z</i></p>
			{#each indices as i (i)}
				<label class="sd-row">
					<span class="sd-name">z<sub>{i + 1}</sub></span>
					<input
						class="sd-range"
						type="range"
						min={LOGIT_MIN}
						max={LOGIT_MAX}
						step={LOGIT_STEP}
						value={logits[i]}
						aria-label="Логит z{i + 1}"
						oninput={(e) => setLogit(i, e.currentTarget.value)}
					/>
					<output class="sd-val">{(logits[i] ?? 0).toFixed(1)}</output>
				</label>
			{/each}
		</div>

		<div class="sd-probs">
			<p class="sd-col-t">Вероятности <i>p</i></p>
			{#each indices as i (i)}
				{@const p = probs[i] ?? 0}
				<div class="sd-prow">
					<span class="sd-name">p<sub>{i + 1}</sub></span>
					<div class="sd-track">
						<div class="sd-fill" style:--p={fill(p)}></div>
					</div>
					<span class="sd-val" class:is-nan={!Number.isFinite(p)}>{fmt(p)}</span>
				</div>
			{/each}
			<p class="sd-sum">Σ p = <b>{fmt(sum)}</b></p>
		</div>
	</div>

	<!-- Caption, number and text alternative come from the enclosing Figure; this line only describes the state. -->
	<p class="sd-note">{note}</p>
</figure>

<style>
	.sd {
		margin: 0;
		padding: var(--space-6) var(--space-8) var(--space-8);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.5;
		text-align: left;
		letter-spacing: normal;
		text-transform: none;
	}
	.sd :global(*),
	.sd :global(*::before),
	.sd :global(*::after) {
		box-sizing: border-box;
	}
	.sd p {
		margin: 0;
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.5;
	}
	.sd sub {
		font-size: 0.75em;
		line-height: 0;
	}
	.sd button {
		font: inherit;
	}
	.sd-tex {
		white-space: nowrap;
	}

	/* Controls */
	.sd-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.sd-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.sd-temp {
		flex: 1 1 260px;
	}
	.sd-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.sd-state,
	.sd-out {
		white-space: nowrap;
		min-width: 6ch;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
	.sd-range {
		width: 160px;
		min-width: 0;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.sd-temp .sd-range {
		flex: 1 1 120px;
		width: auto;
	}
	.sd-switch {
		position: relative;
		width: 40px;
		height: 22px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}
	.sd-switch[aria-checked='true'] {
		background: var(--accent);
		border-color: var(--accent);
	}
	.sd-switch:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.sd-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--surface);
		transition: transform var(--dur) var(--ease);
	}
	.sd-switch[aria-checked='true'] .sd-knob {
		transform: translateX(18px);
	}

	.sd-formula {
		margin-top: var(--space-4);
		color: var(--text);
		font-size: var(--fs-body);
		text-align: center;
	}

	/* Two columns: logits (inputs) and probabilities (bars) */
	.sd-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-8);
		margin-top: var(--space-6);
		align-items: start;
	}
	.sd-col-t {
		margin: 0 0 var(--space-3);
		color: var(--text-muted);
		font-size: 12px;
	}
	.sd-logits,
	.sd-probs {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}
	.sd-logits {
		transition: box-shadow var(--dur) var(--ease);
		border-radius: var(--radius);
	}
	.sd-row,
	.sd-prow {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr) 52px;
		align-items: center;
		gap: var(--space-3);
	}
	.sd-name {
		color: var(--cat-1);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.sd-val {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.sd-val.is-nan {
		color: var(--fail);
		font-weight: 600;
	}
	.sd-track {
		position: relative;
		height: 18px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		overflow: hidden;
	}
	.sd-fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: calc(var(--p, 0) * 100%);
		background: var(--cat-3);
		transition: width var(--dur) var(--ease);
	}
	.sd.is-naive .sd-fill {
		background: var(--cat-2);
	}
	.sd-sum {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
		text-align: right;
	}
	.sd-sum b {
		color: var(--text);
		font-family: var(--font-mono);
		font-weight: 600;
	}
	.sd-note {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
		color: var(--text-muted);
	}

	/* Entity highlight from the text (HIGHLIGHT_CONTEXT) */
	.sd.hl-q .sd-logits {
		box-shadow: 0 0 0 2px var(--cat-1);
		padding: var(--space-2);
	}
	.sd.hl-v .sd-probs {
		outline: 2px dashed var(--cat-3);
		outline-offset: 6px;
		border-radius: var(--radius);
	}

	@media (prefers-reduced-motion: reduce) {
		.sd *,
		.sd *::before,
		.sd *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.sd {
			padding: var(--space-4);
		}
		.sd-body {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (max-width: 559px) {
		.sd-controls {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
		.sd-temp {
			flex: none;
		}
		.sd-temp .sd-range {
			width: 100%;
			flex: 1 1 auto;
		}
		.sd-range {
			width: 100%;
		}
		.sd-row,
		.sd-prow {
			grid-template-columns: 36px minmax(0, 1fr) 48px;
		}
	}
</style>
