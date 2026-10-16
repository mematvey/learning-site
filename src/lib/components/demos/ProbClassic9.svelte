<script lang="ts">
	import ProblemCard from '$lib/components/problems/ProblemCard.svelte';
	import Committee from '$lib/components/problems/viz/Committee.svelte';
	import { p9 } from '$lib/prob/problems/p9';
	import type { ProblemParams } from '$lib/prob/types';
</script>

{#snippet viz(params: ProblemParams)}
	<Committee N={params.N ?? 0} K={params.K ?? 0} n={params.n ?? 0} k={params.k ?? 0} />
{/snippet}

<!-- Problem 9: the condition was cut off in the source screenshot; wording restored, see the chapter text. -->
<ProblemCard problem={p9} {viz} />
