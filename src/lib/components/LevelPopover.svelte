<script lang="ts">
	import type { LevelPopoverProps } from '$lib/contracts/component-props';
	import {
		AXIS_BOUNDS,
		AXIS_LABELS,
		AXIS_TITLES,
		levelLabel,
		type LevelState,
	} from '$lib/contracts/levels';

	/** Header button and popover with two level sliders. Changes are applied with the button. */
	let { applied, onApply, open = $bindable(false) }: LevelPopoverProps = $props();

	// Writable derived: follows `applied` (URL, saved settings, apply) and keeps unapplied slider moves.
	let draft = $derived<LevelState>({ c: applied.c, d: applied.d });
	let wrap = $state<HTMLDivElement | null>(null);
	let button = $state<HTMLButtonElement | null>(null);
	let cSlider = $state<HTMLInputElement | null>(null);

	const dirty = $derived(draft.c !== applied.c || draft.d !== applied.d);

	$effect(() => {
		if (open) cSlider?.focus({ preventScroll: true });
	});

	function close(returnFocus: boolean) {
		open = false;
		if (returnFocus) button?.focus();
	}

	function apply() {
		onApply({ c: draft.c, d: draft.d });
		close(true);
	}

	function onDocumentKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) close(true);
	}

	function onDocumentMousedown(e: MouseEvent) {
		if (open && wrap && e.target instanceof Node && !wrap.contains(e.target)) close(false);
	}
</script>

<svelte:document onkeydown={onDocumentKeydown} onmousedown={onDocumentMousedown} />

<div class="levels-wrap" bind:this={wrap}>
	<button
		bind:this={button}
		class="levels-btn"
		type="button"
		data-levels-toggle
		aria-expanded={open}
		aria-controls="levels-pop"
		title="Уровень изложения"
		onclick={() => (open = !open)}
	>
		<span class="lvl-prefix">Уровень:</span>
		<span class="lvl-label">{levelLabel('c', applied.c)} · {levelLabel('d', applied.d)}</span>
		<span class="lvl-short" aria-hidden="true">С{applied.c}·Г{applied.d}</span>
		<span class="caret" aria-hidden="true">▾</span>
		<kbd class="lvl-key">L</kbd>
	</button>

	{#if open}
		<div class="levels-pop" id="levels-pop" role="dialog" aria-label="Уровни изложения">
			<div class="level-group">
				<div class="level-head">
					<span class="level-title">{AXIS_TITLES.c}</span>
					<output for="level-c">{levelLabel('c', draft.c)}</output>
				</div>
				<input
					id="level-c"
					bind:this={cSlider}
					type="range"
					min={AXIS_BOUNDS.c.min}
					max={AXIS_BOUNDS.c.max}
					step="1"
					value={draft.c}
					oninput={(e) => (draft = { ...draft, c: Number(e.currentTarget.value) })}
					aria-label={AXIS_TITLES.c}
				/>
				<div class="ticks ticks-4" aria-hidden="true">
					{#each AXIS_LABELS.c as label, i (label)}
						<span class:on={draft.c === i + 1}>{label}</span>
					{/each}
				</div>
			</div>
			<div class="level-group">
				<div class="level-head">
					<span class="level-title">{AXIS_TITLES.d}</span>
					<output for="level-d">{levelLabel('d', draft.d)}</output>
				</div>
				<input
					id="level-d"
					type="range"
					min={AXIS_BOUNDS.d.min}
					max={AXIS_BOUNDS.d.max}
					step="1"
					value={draft.d}
					oninput={(e) => (draft = { ...draft, d: Number(e.currentTarget.value) })}
					aria-label={AXIS_TITLES.d}
				/>
				<div class="ticks ticks-3" aria-hidden="true">
					{#each AXIS_LABELS.d as label, i (label)}
						<span class:on={draft.d === i + 1}>{label}</span>
					{/each}
				</div>
			</div>
			{#if dirty}
				<div class="levels-foot">
					<button class="btn-primary" type="button" onclick={apply}>Применить</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.levels-wrap {
		position: relative;
		flex: none;
	}
	.levels-btn {
		height: 34px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
		padding: 0 10px 0 12px;
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--text);
		cursor: pointer;
		background: var(--surface);
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		transition: border-color var(--dur-fast) var(--ease);
	}
	.levels-btn:hover,
	.levels-btn[aria-expanded='true'] {
		border-color: var(--topic);
	}
	.lvl-prefix {
		color: var(--text-muted);
	}
	.lvl-label {
		font-weight: 600;
	}
	.caret {
		color: var(--topic);
		font-size: 12px;
	}
	.lvl-short {
		display: none;
	}
	.lvl-key {
		margin-left: 4px;
	}
	.levels-pop {
		position: absolute;
		right: 0;
		top: calc(100% + 8px);
		z-index: 40;
		width: min(420px, calc(100vw - 32px));
		padding: var(--space-4) var(--space-6);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
	}
	.level-group {
		margin-bottom: var(--space-4);
	}
	.level-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: var(--space-1);
	}
	.level-title {
		font-size: var(--fs-sm);
		color: var(--text-muted);
		font-weight: 550;
	}
	output {
		font-size: var(--fs-sm);
		color: var(--text);
		font-weight: 600;
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--topic);
		margin: 0;
	}
	.ticks {
		position: relative;
		height: 30px;
		margin-top: 2px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.ticks span {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		white-space: nowrap;
		transition: color var(--dur-fast) var(--ease);
	}
	.ticks span:first-child {
		transform: none;
	}
	.ticks span.on {
		color: var(--topic);
		font-weight: 600;
	}
	.ticks-4 span:nth-child(1) {
		left: 4%;
	}
	.ticks-4 span:nth-child(2) {
		left: 37%;
	}
	.ticks-4 span:nth-child(3) {
		left: 58%;
	}
	.ticks-4 span:nth-child(4) {
		left: 96%;
		transform: translateX(-100%);
	}
	.ticks-3 span:nth-child(1) {
		left: 4%;
	}
	.ticks-3 span:nth-child(2) {
		left: 50%;
	}
	.ticks-3 span:nth-child(3) {
		left: 96%;
		transform: translateX(-100%);
	}
	.levels-foot {
		display: flex;
		justify-content: flex-end;
	}
	.btn-primary {
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: 550;
		cursor: pointer;
		height: 36px;
		padding: 0 var(--space-4);
		border-radius: var(--radius);
		background: var(--topic);
		color: var(--surface);
		border: 1px solid var(--topic);
	}
	.btn-primary:hover {
		filter: brightness(1.08);
	}
	@media (max-width: 640px) {
		.lvl-prefix,
		.lvl-key {
			display: none;
		}
		/* Anchor to the header (sticky topbar is the containing block) so the popover stays inside the 16px margins. */
		.levels-wrap {
			position: static;
		}
		.levels-pop {
			left: 16px;
			right: 16px;
			width: auto;
		}
		/* Only the active tick label is shown, so the labels never overlap on narrow screens. */
		.ticks span:not(.on) {
			visibility: hidden;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ticks span {
			transition: none;
		}
	}
</style>
