<script lang="ts">
	import type { VariantProps } from '$lib/contracts/component-props';
	import { FALLBACK_LEVELS, useLevels, variantVisible } from '$lib/levels';

	/** Replaceable block: a group of adjacent variants shows exactly one, chosen by the applied levels. */
	let { c, d, group, children }: VariantProps = $props();

	const levels = useLevels();
	const applied = $derived(levels?.applied ?? FALLBACK_LEVELS);
	const visible = $derived(variantVisible({ c, d }, applied));
</script>

<div
	class="level-variant"
	hidden={!visible}
	data-variant-c={c}
	data-variant-d={d}
	data-variant-group={group}
>
	{@render children()}
</div>

<style>
	.level-variant[hidden] {
		display: none;
	}
	.level-variant:not([hidden]) {
		animation: variant-in var(--dur, 200ms) var(--ease, ease-out);
	}
	@keyframes variant-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.level-variant:not([hidden]) {
			animation: none;
		}
	}
</style>
