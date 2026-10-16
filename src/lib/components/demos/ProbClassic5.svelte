<script lang="ts">
	import type { ProblemParams } from '$lib/prob/types';
	import ProblemCard from '$lib/components/problems/ProblemCard.svelte';
	import PartsUrn from '$lib/components/problems/viz/PartsUrn.svelte';
	import { p5 } from '$lib/prob/problems/p5';
</script>

{#snippet viz(params: ProblemParams)}
	<PartsUrn {params} />
{/snippet}

<ProblemCard problem={p5} {viz} />
