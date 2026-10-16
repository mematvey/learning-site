<script lang="ts">
	import type { ProblemParams } from '$lib/prob/types';
	import ProblemCard from '$lib/components/problems/ProblemCard.svelte';
	import DiceGrid from '$lib/components/problems/viz/DiceGrid.svelte';
	import { p6 } from '$lib/prob/problems/p6';
</script>

{#snippet viz(params: ProblemParams)}
	<DiceGrid {params} />
{/snippet}

<ProblemCard problem={p6} {viz} />
