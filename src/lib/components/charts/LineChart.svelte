<script lang="ts">
	import { line } from 'd3';
	import type { LineChartProps } from '$lib/contracts/component-props';
	import { catVar, linearScale, niceExtent, CHART_LABEL_PX } from '$lib/charts/scales';
	import ChartFrame from './ChartFrame.svelte';

	/** Line chart for series (D3 scales, tokens only). */
	let { title, desc, height = 280, series, xLabel, yLabel }: LineChartProps = $props();

	const M = { top: 16, right: 16, bottom: 44, left: 56 };
	const showLegend = $derived(series.length > 1);
	const topPad = $derived(showLegend ? M.top + 20 : M.top);

	const rows = $derived(series.flatMap((s) => s.x.map((x, i) => [s.label, x, s.y[i] ?? ''])));
</script>

<ChartFrame {title} {desc} {height} head={['Серия', xLabel, yLabel]} {rows}>
	{#snippet children(width: number, h: number)}
		{@const innerW = width - M.left - M.right}
		{@const innerH = h - topPad - M.bottom}
		{@const xs = series.flatMap((s) => s.x)}
		{@const ys = series.flatMap((s) => s.y)}
		{@const xScale = linearScale(niceExtent(xs, 0), [0, innerW])}
		{@const yScale = linearScale(niceExtent(ys, 0.08, true), [innerH, 0])}
		<g transform={`translate(${M.left},${topPad})`}>
			{#each yScale.ticks(5) as t (t)}
				<line class="grid" x1="0" x2={innerW} y1={yScale(t)} y2={yScale(t)} />
				<text x="-8" y={yScale(t)} dy="0.32em" text-anchor="end">{t}</text>
			{/each}
			{#each xScale.ticks(6) as t (t)}
				<text x={xScale(t)} y={innerH + 18} text-anchor="middle">{t}</text>
			{/each}
			<line class="axis-line" x1="0" x2={innerW} y1={innerH} y2={innerH} />
			{#each series as s, i (s.id)}
				{@const pts = s.x.map((x, k) => [xScale(x), yScale(s.y[k] ?? 0)] as [number, number])}
				<path
					d={line()(pts) ?? ''}
					fill="none"
					stroke-width="2"
					stroke-linejoin="round"
					style={`stroke: ${catVar(s.cat ?? i + 1)}`}
				/>
			{/each}
			<text
				x={innerW / 2}
				y={innerH + 38}
				text-anchor="middle"
				style={`font-size: ${CHART_LABEL_PX}px`}>{xLabel}</text
			>
			<text
				x={-M.left + 12}
				y={innerH / 2}
				text-anchor="middle"
				transform={`rotate(-90, ${-M.left + 12}, ${innerH / 2})`}
				style={`font-size: ${CHART_LABEL_PX}px`}>{yLabel}</text
			>
		</g>
		{#if showLegend}
			{#each series as s, i (s.id)}
				<g transform={`translate(${M.left + i * 160},${M.top})`}>
					<line
						x1="0"
						x2="18"
						y1="6"
						y2="6"
						stroke-width="3"
						style={`stroke: ${catVar(s.cat ?? i + 1)}`}
					/>
					<text x="24" y="10">{s.label}</text>
				</g>
			{/each}
		{/if}
	{/snippet}
</ChartFrame>
