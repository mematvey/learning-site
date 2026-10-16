<script lang="ts">
	import ProblemCard from '$lib/components/problems/ProblemCard.svelte';
	import Cards from '$lib/components/problems/viz/Cards.svelte';
	import { p8 } from '$lib/prob/problems/p8';
	import type { ProblemParams } from '$lib/prob/types';

	/** Problem 8: cards with repeated labels; all cards are laid out, target 111223 (sorted). */
	const copies = (value: number, count: number): number[] =>
		Array.from({ length: Math.max(0, count) }, () => value);
	const pool = (params: ProblemParams): number[] => [
		...copies(1, params.ones ?? 0),
		...copies(2, params.twos ?? 0),
		...copies(3, params.threes ?? 0),
	];
</script>

{#snippet viz(params: ProblemParams)}
	<Cards pool={pool(params)} draw={pool(params).length} target={pool(params)} mode="multinomial" />
{/snippet}

<ProblemCard problem={p8} {viz} />
