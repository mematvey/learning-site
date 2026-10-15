<script lang="ts">
	import type { LevelProps } from '$lib/contracts/component-props';
	import { isLevelVisible } from '$lib/contracts/levels';
	import { FALLBACK_LEVELS, useLevels } from '$lib/levels';

	/** Additive layer: shown when the applied levels reach `c` and `d` (missing prop = no condition). */
	let { c, d, children }: LevelProps = $props();

	const levels = useLevels();
	const applied = $derived(levels?.applied ?? FALLBACK_LEVELS);
	const visible = $derived(isLevelVisible({ c, d }, applied));
	const hardware = $derived(d !== undefined && d >= 3);
</script>

<div class="level-layer" class:is-hw={hardware} hidden={!visible} data-level-c={c} data-level-d={d}>
	{#if hardware}
		<span class="badge-hw">⚙ Железо</span>
	{/if}
	{@render children()}
</div>

<style>
	.level-layer {
		position: relative;
	}
	.level-layer[hidden] {
		display: none;
	}
	.level-layer:not([hidden]) {
		animation: level-in var(--dur, 200ms) var(--ease, ease-out);
	}
	.level-layer.is-hw {
		background: var(--surface-2);
		border-radius: var(--radius);
		padding: var(--space-4) var(--space-6);
	}
	.badge-hw {
		position: absolute;
		top: var(--space-2);
		right: var(--space-3);
		font-size: var(--fs-sm);
		color: var(--topic);
		background: var(--topic-soft);
		border-radius: 999px;
		padding: 2px var(--space-2);
	}
	@keyframes level-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.level-layer:not([hidden]) {
			animation: none;
		}
	}
</style>
