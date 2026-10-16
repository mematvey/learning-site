<script lang="ts">
	import type { ProblemParams } from '$lib/prob/types';
	import { p3 } from '$lib/prob/problems/p3';
	import ProblemCard from '$lib/components/problems/ProblemCard.svelte';
	import Urn from '$lib/components/problems/viz/Urn.svelte';
</script>

{#snippet viz(params: ProblemParams)}
	<Urn N={params.N ?? 0} K={params.K ?? 0} n={params.n ?? 0} />
{/snippet}

<ProblemCard problem={p3} {viz} />
