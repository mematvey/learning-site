<script lang="ts">
	import ProblemCard from '$lib/components/problems/ProblemCard.svelte';
	import Cards from '$lib/components/problems/viz/Cards.svelte';
	import { p7 } from '$lib/prob/problems/p7';
	import type { ProblemParams } from '$lib/prob/types';

	/** Problem 7: child builds a number from cards 1…cards; ordered draw of len cards. */
	const range = (n: number): number[] => Array.from({ length: Math.max(0, n) }, (_, i) => i + 1);
</script>

{#snippet viz(params: ProblemParams)}
	<Cards
		pool={range(params.cards ?? 0)}
		draw={params.len ?? 0}
		target={range(params.len ?? 0)}
		mode="arrangement"
	/>
{/snippet}

<ProblemCard problem={p7} {viz} />
