<script lang="ts">
	import type { BarChartProps } from '$lib/contracts/component-props';
	import { bandScale, catVar, linearScale, niceExtent, CHART_LABEL_PX } from '$lib/charts/scales';
	import ChartFrame from './ChartFrame.svelte';

	/** Bar chart on the category scale; values are drawn from zero. */
	let {
		title,
		desc,
		height = 280,
		bars,
		xLabel = '',
		yLabel = '',
		orientation = 'vertical',
	}: BarChartProps = $props();

	const M = { top: 20, right: 16, bottom: 44, left: 56 };
	const labels = $derived(bars.map((b) => b.label));
	const rows = $derived(bars.map((b) => [b.label, b.value]));
	const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
</script>

<ChartFrame {title} {desc} {height} head={['Категория', yLabel || 'Значение']} {rows}>
	{#snippet children(width: number, h: number)}
		{@const vertical = orientation === 'vertical'}
		{@const innerW = width - M.left - M.right}
		{@const innerH = h - M.top - M.bottom}
		{@const valueDomain = niceExtent(
			bars.map((b) => b.value),
			0.1,
			true,
		)}
		{#if vertical}
			{@const band = bandScale(labels, [0, innerW])}
			{@const yScale = linearScale(valueDomain, [innerH, 0])}
			<g transform={`translate(${M.left},${M.top})`}>
				{#each yScale.ticks(5) as t (t)}
					<line class="grid" x1="0" x2={innerW} y1={yScale(t)} y2={yScale(t)} />
					<text x="-8" y={yScale(t)} dy="0.32em" text-anchor="end">{t}</text>
				{/each}
				<line class="axis-line" x1="0" x2={innerW} y1={yScale(0)} y2={yScale(0)} />
				{#each bars as b (b.label)}
					{@const x = band(b.label) ?? 0}
					{@const y0 = yScale(0)}
					{@const y1 = yScale(b.value)}
					<rect
						{x}
						y={Math.min(y0, y1)}
						width={band.bandwidth()}
						height={Math.abs(y0 - y1)}
						style={`fill: ${catVar(b.cat ?? 1)}`}
					/>
					<text class="value" x={x + band.bandwidth() / 2} y={y1 - 6} text-anchor="middle"
						>{fmt(b.value)}</text
					>
					<text x={x + band.bandwidth() / 2} y={innerH + 18} text-anchor="middle">{b.label}</text>
				{/each}
				<text
					x={innerW / 2}
					y={innerH + 38}
					text-anchor="middle"
					style={`font-size: ${CHART_LABEL_PX}px`}>{xLabel}</text
				>
			</g>
		{:else}
			{@const band = bandScale(labels, [0, innerH])}
			{@const xScale = linearScale(valueDomain, [0, innerW])}
			<g transform={`translate(${M.left},${M.top})`}>
				{#each xScale.ticks(5) as t (t)}
					<line class="grid" x1={xScale(t)} x2={xScale(t)} y1="0" y2={innerH} />
					<text x={xScale(t)} y={innerH + 18} text-anchor="middle">{t}</text>
				{/each}
				<line class="axis-line" x1={xScale(0)} x2={xScale(0)} y1="0" y2={innerH} />
				{#each bars as b (b.label)}
					{@const y = band(b.label) ?? 0}
					{@const x0 = xScale(0)}
					{@const x1 = xScale(b.value)}
					<rect
						x={Math.min(x0, x1)}
						{y}
						width={Math.abs(x1 - x0)}
						height={band.bandwidth()}
						style={`fill: ${catVar(b.cat ?? 1)}`}
					/>
					<text class="value" x={x1 + 6} y={y + band.bandwidth() / 2} dy="0.32em"
						>{fmt(b.value)}</text
					>
					<text x="-8" y={y + band.bandwidth() / 2} dy="0.32em" text-anchor="end">{b.label}</text>
				{/each}
				<text
					x={innerW / 2}
					y={innerH + 38}
					text-anchor="middle"
					style={`font-size: ${CHART_LABEL_PX}px`}>{yLabel}</text
				>
			</g>
		{/if}
	{/snippet}
</ChartFrame>
