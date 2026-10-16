<script lang="ts">
	import type { ProblemParams } from '$lib/prob/types';

	/** Problem 6 visual: table of outcomes of two dice, condition shaded, even sums outlined. */
	let { params }: { params: ProblemParams } = $props();

	const faces = $derived(Math.max(1, Math.min(12, Math.floor(params.faces ?? 6))));
	const target = $derived(Math.floor(params.target ?? 6));
	const values = $derived(Array.from({ length: faces }, (_, i) => i + 1));

	const hasTarget = (a: number, b: number): boolean => a === target || b === target;
	const isEven = (a: number, b: number): boolean => (a + b) % 2 === 0;

	/** Number of outcomes where the condition holds: total minus those with no target face. */
	const condCount = $derived(
		target >= 1 && target <= faces ? faces * faces - (faces - 1) * (faces - 1) : 0,
	);

	const favorable = $derived(
		values.reduce(
			(sum, a) => sum + values.filter((b) => hasTarget(a, b) && isEven(a, b)).length,
			0,
		),
	);
</script>

<div class="dice">
	<table class="dice-table" aria-label="Исходы двух кубиков: сумма в каждой клетке">
		<thead>
			<tr>
				<th scope="col" class="corner">1-й \ 2-й</th>
				{#each values as b (b)}
					<th scope="col">{b}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each values as a (a)}
				<tr>
					<th scope="row">{a}</th>
					{#each values as b (b)}
						<td
							class:cond={hasTarget(a, b)}
							class:even={isEven(a, b)}
							title="{a} и {b}, сумма {a + b}"
						>
							{a + b}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	<ul class="legend">
		<li><span class="swatch cond"></span> хотя бы на одном кубике {target}</li>
		<li><span class="swatch even"></span> сумма чётная</li>
	</ul>

	<p class="counts" aria-live="polite">
		условие: <strong>{condCount}</strong>, благоприятных (условие и чётная сумма):
		<strong>{favorable}</strong>
	</p>
</div>

<style>
	.dice {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		align-items: stretch;
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
	}
	.dice-table {
		width: 100%;
		max-width: 360px;
		border-collapse: separate;
		border-spacing: 3px;
		table-layout: fixed;
	}
	.dice-table th,
	.dice-table td {
		text-align: center;
		padding: 0;
		height: 40px;
		font-variant-numeric: tabular-nums;
	}
	.dice-table th {
		font-weight: 600;
		color: var(--text-muted);
		font-size: 12px;
	}
	.dice-table .corner {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: clip;
	}
	.dice-table td {
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.dice-table td.cond {
		background: var(--topic-soft);
	}
	.dice-table td.even {
		box-shadow: inset 0 0 0 2px var(--topic);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-3);
		list-style: none;
		margin: 0;
		padding: 0;
		color: var(--text-muted);
	}
	.legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.swatch {
		display: inline-block;
		width: 14px;
		height: 14px;
		border-radius: 3px;
		box-sizing: border-box;
	}
	.swatch.cond {
		background: var(--topic-soft);
		border: 1px solid var(--border);
	}
	.swatch.even {
		background: var(--surface-2);
		box-shadow: inset 0 0 0 2px var(--topic);
	}
	.counts {
		margin: 0;
		text-align: center;
	}
	.counts strong {
		color: var(--topic);
	}
</style>
