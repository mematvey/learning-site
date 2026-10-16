<script lang="ts">
	import type { ProblemParams } from '$lib/prob/types';
	import { p1 } from '$lib/prob/problems/p1';
	import ProblemCard from '$lib/components/problems/ProblemCard.svelte';
	import Faculties from '$lib/components/problems/viz/Faculties.svelte';
</script>

{#snippet viz(params: ProblemParams)}
	<Faculties total={params.total ?? 0} medalists={params.medalists ?? 0} k={params.k ?? 0} />
{/snippet}

<ProblemCard problem={p1} {viz} />
