<script lang="ts">
	import ProblemCard from '$lib/components/problems/ProblemCard.svelte';
	import Cards from '$lib/components/problems/viz/Cards.svelte';
	import { p7 } from '$lib/prob/problems/p7';
	import type { ProblemParams } from '$lib/prob/types';

	/**
	 * Problem 7: child builds a number from cards 1…cards.
	 * Part a: ordered draw of `len` cards; part b: all `cards` cards laid in a row.
	 */
	const range = (n: number): number[] => Array.from({ length: Math.max(0, n) }, (_, i) => i + 1);
</script>

{#snippet viz(params: ProblemParams)}
	<div class="p7-viz">
		<div class="p7-part">
			<p class="p7-label">а) {range(params.len ?? 0).join(' ')}</p>
			<Cards
				pool={range(params.cards ?? 0)}
				draw={params.len ?? 0}
				target={range(params.len ?? 0)}
				mode="arrangement"
			/>
		</div>
		<div class="p7-part">
			<p class="p7-label">б) все карточки в ряд</p>
			<Cards
				pool={range(params.cards ?? 0)}
				draw={params.cards ?? 0}
				target={range(params.cards ?? 0)}
				mode="arrangement"
			/>
		</div>
	</div>
{/snippet}

<ProblemCard problem={p7} {viz} />

<style>
	.p7-viz {
		display: grid;
		gap: var(--space-5);
	}
	.p7-label {
		margin: 0 0 var(--space-2);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		font-weight: 600;
		color: var(--text-muted);
	}
</style>
