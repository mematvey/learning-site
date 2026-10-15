<script lang="ts">
	import type { HeatmapProps } from '$lib/contracts/component-props';
	import { bandScale } from '$lib/charts/scales';
	import { inkVarFor, normalize, seqFill, type Theme } from '$lib/charts/colors';
	import { currentTheme, watchTheme } from '$lib/charts/observe';
	import ChartFrame from './ChartFrame.svelte';
	import { onMount } from 'svelte';

	/** Heatmap of a matrix on the sequential scale (`--seq-0` to `--seq-1`). */
	let {
		title,
		desc,
		height,
		matrix,
		rowLabels,
		colLabels,
		showValues = false,
		domain,
		highlightRow,
	}: HeatmapProps = $props();

	const colCount = $derived(matrix[0]?.length ?? 0);
	const flat = $derived(matrix.flat());
	const colorDomain = $derived<[number, number]>(domain ?? [Math.min(...flat), Math.max(...flat)]);
	const rowNames = $derived(rowLabels ?? matrix.map((_, i) => String(i + 1)));
	const colNames = $derived(colLabels ?? Array.from({ length: colCount }, (_, j) => String(j + 1)));
	const rows = $derived(
		matrix.map((r, i) => [rowNames[i] ?? String(i + 1), ...r.map((v) => +v.toFixed(3))]),
	);

	let theme = $state<Theme>('light');
	onMount(() => {
		theme = currentTheme();
		return watchTheme((t) => (theme = t));
	});

	const M = { top: 28, right: 8, bottom: 8, left: 56 };
	const fmt = (v: number) => v.toFixed(2);
</script>

<ChartFrame {title} {desc} height={height ?? 320} head={['Строка', ...colNames]} {rows}>
	{#snippet children(width: number, h: number)}
		{@const innerW = width - M.left - M.right}
		{@const innerH = h - M.top - M.bottom}
		{@const colBand = bandScale(colNames, [0, innerW], 0.04)}
		{@const rowBand = bandScale(rowNames, [0, innerH], 0.04)}
		<g transform={`translate(${M.left},${M.top})`}>
			{#each matrix as row, i (i)}
				{#each row as v, j (j)}
					{@const t = normalize(v, colorDomain)}
					{@const x = colBand(colNames[j] ?? '') ?? 0}
					{@const y = rowBand(rowNames[i] ?? '') ?? 0}
					<rect
						{x}
						{y}
						width={colBand.bandwidth()}
						height={rowBand.bandwidth()}
						rx="3"
						style={`fill: ${seqFill(t)}`}
						stroke={highlightRow === i ? 'var(--text)' : 'none'}
						stroke-width={highlightRow === i ? 2 : 0}
					>
						<title>{`${rowNames[i]}, ${colNames[j]}: ${fmt(v)}`}</title>
					</rect>
					{#if showValues}
						<text
							x={x + colBand.bandwidth() / 2}
							y={y + rowBand.bandwidth() / 2}
							dy="0.32em"
							text-anchor="middle"
							style={`fill: ${inkVarFor(t, theme)}; font-size: 13px`}>{fmt(v)}</text
						>
					{/if}
				{/each}
			{/each}
			{#each colNames as c (c)}
				<text x={(colBand(c) ?? 0) + colBand.bandwidth() / 2} y="-10" text-anchor="middle">{c}</text
				>
			{/each}
			{#each rowNames as r (r)}
				<text x="-8" y={(rowBand(r) ?? 0) + rowBand.bandwidth() / 2} dy="0.32em" text-anchor="end"
					>{r}</text
				>
			{/each}
		</g>
	{/snippet}
</ChartFrame>
