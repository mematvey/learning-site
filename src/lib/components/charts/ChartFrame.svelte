<script lang="ts">
	import type { Snippet } from 'svelte';
	import { observeSize, uid } from '$lib/charts/observe';
	import { clampChartWidth } from '$lib/charts/scales';

	/** Shared frame: width from ResizeObserver, accessible svg, optional data table. */
	interface Props {
		title: string;
		desc: string;
		height: number;
		/** Table header and rows: the text alternative to the drawing. */
		head?: string[];
		rows?: Array<Array<string | number>>;
		children: Snippet<[number, number]>;
	}

	let { title, desc, height, head, rows, children }: Props = $props();

	// Server render and first client frame use a fixed width; the observer corrects it.
	let width = $state(640);
	const id = uid();
	const titleId = `${id}-title`;
	const descId = `${id}-desc`;
</script>

<figure class="chart">
	<div class="chart-box" use:observeSize={(w: number) => (width = clampChartWidth(w))}>
		<svg
			class="chart-svg"
			role="img"
			{width}
			{height}
			viewBox={`0 0 ${width} ${height}`}
			aria-labelledby="{titleId} {descId}"
		>
			<title id={titleId}>{title}</title>
			<desc id={descId}>{desc}</desc>
			{@render children(width, height)}
		</svg>
	</div>
	{#if head && rows && rows.length > 0}
		<details class="chart-data">
			<summary>Данные графика</summary>
			<table>
				<thead>
					<tr>
						{#each head as h (h)}<th scope="col">{h}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as row, i (i)}
						<tr>
							{#each row as cell, j (j)}<td>{cell}</td>{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</details>
	{/if}
</figure>

<style>
	.chart {
		margin: var(--space-6) 0;
		max-width: 100%;
	}
	.chart-box {
		width: 100%;
	}
	.chart-svg {
		display: block;
		max-width: 100%;
		height: auto;
		overflow: visible;
	}
	.chart-svg :global(text) {
		font-family: var(--font-sans);
		font-size: 12px;
		fill: var(--text-muted);
	}
	.chart-svg :global(.axis-line) {
		stroke: var(--border);
	}
	.chart-svg :global(.grid) {
		stroke: var(--border);
		stroke-opacity: 0.6;
	}
	.chart-svg :global(.value) {
		fill: var(--text);
		font-size: 13px;
	}
	.chart-data {
		margin-top: var(--space-2);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.chart-data table {
		width: 100%;
		border-collapse: collapse;
	}
	.chart-data th,
	.chart-data td {
		text-align: left;
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border);
	}
</style>
