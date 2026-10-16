<script lang="ts">
	import type { ProblemParams } from '$lib/prob/types';
	import ProblemCard from '$lib/components/problems/ProblemCard.svelte';
	import FruitVase from '$lib/components/problems/viz/FruitVase.svelte';
	import { p4 } from '$lib/prob/problems/p4';
</script>

{#snippet viz(params: ProblemParams)}
	<FruitVase {params} />
{/snippet}

<ProblemCard problem={p4} {viz} />
