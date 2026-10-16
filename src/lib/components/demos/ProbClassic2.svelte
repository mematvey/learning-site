<script lang="ts">
	import type { ProblemParams } from '$lib/prob/types';
	import { p2 } from '$lib/prob/problems/p2';
	import ProblemCard from '$lib/components/problems/ProblemCard.svelte';
	import EventsTable from '$lib/components/problems/viz/EventsTable.svelte';
</script>

{#snippet viz(params: ProblemParams)}
	<EventsTable
		pA={params.pA ?? 0}
		pB={params.pB ?? 0}
		pAB={params.pAB ?? 0}
		labelA="A"
		labelB="B"
	/>
{/snippet}

<ProblemCard problem={p2} {viz} />
