<script lang="ts">
	import type { MatrixDiagramProps } from '$lib/contracts/component-props';
	import { ENTITY_COLOR_VAR } from '$lib/contracts/context';
	import { catVar, CHART_LABEL_PX } from '$lib/charts/scales';
	import ChartFrame from './ChartFrame.svelte';

	/** Schematic of matrices (cells as a grid); highlighted ones are drawn in full colour. */
	let { title, desc, height = 220, matrices, highlight }: MatrixDiagramProps = $props();

	const M = { top: 40, right: 16, bottom: 16, left: 16 };
	const GAP = 56;
	const MAX_UNIT = 22;

	const rows = $derived(matrices.map((m) => [m.label, `${m.rows} × ${m.cols}`]));

	function fill(i: number, entity: string | undefined): string {
		if (entity && entity in ENTITY_COLOR_VAR) {
			return `var(${ENTITY_COLOR_VAR[entity as keyof typeof ENTITY_COLOR_VAR]})`;
		}
		return catVar(i + 1);
	}
</script>

<ChartFrame {title} {desc} {height} head={['Матрица', 'Размер']} {rows}>
	{#snippet children(width: number, h: number)}
		{@const innerW = width - M.left - M.right}
		{@const totalCols = matrices.reduce((s, m) => s + m.cols, 0)}
		{@const gaps = GAP * Math.max(0, matrices.length - 1)}
		{@const unit = Math.max(4, Math.min(MAX_UNIT, (innerW - gaps) / Math.max(1, totalCols)))}
		{@const maxRows = Math.max(1, ...matrices.map((m) => m.rows))}
		{@const unitY = Math.min(unit, (h - M.top - M.bottom) / maxRows)}
		<g transform={`translate(${M.left},${M.top})`}>
			{#each matrices as m, i (m.id)}
				{@const x = matrices.slice(0, i).reduce((s, p) => s + p.cols * unit + GAP, 0)}
				{@const active = !highlight || highlight.includes(m.id)}
				{@const w = m.cols * unit}
				{@const hgt = m.rows * unitY}
				<g opacity={active ? 1 : 0.28} transform={`translate(${x},0)`}>
					<text
						x={w / 2}
						y="-14"
						text-anchor="middle"
						style={`font-size: ${CHART_LABEL_PX}px; fill: var(--text)`}>{m.label}</text
					>
					<rect
						x="0"
						y="0"
						width={w}
						height={hgt}
						rx="4"
						style={`fill: color-mix(in srgb, ${fill(i, m.entity)} 22%, var(--surface-2)); stroke: ${fill(i, m.entity)}`}
						stroke-width="1.5"
					/>
					{#each Array.from({ length: m.cols - 1 }, (_, c) => c + 1) as c (c)}
						<line x1={c * unit} x2={c * unit} y1="0" y2={hgt} style="stroke: var(--border)" />
					{/each}
					{#each Array.from({ length: m.rows - 1 }, (_, r) => r + 1) as r (r)}
						<line x1="0" x2={w} y1={r * unitY} y2={r * unitY} style="stroke: var(--border)" />
					{/each}
				</g>
			{/each}
		</g>
	{/snippet}
</ChartFrame>
