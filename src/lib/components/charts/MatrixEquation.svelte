<script lang="ts">
	import type { EquationMatrix, MatrixEquationProps } from '$lib/contracts/component-props';
	import { ENTITY_COLOR_VAR } from '$lib/contracts/context';
	import { catVar, CHART_LABEL_PX, CHART_TICK_PX } from '$lib/charts/scales';
	import {
		cellState,
		DIM_H,
		FILL_PCT,
		formatCell,
		LABEL_H,
		layoutItems,
		matrixCols,
		matrixRows,
		maxCellLength,
		valueFontSize,
	} from '$lib/charts/matrixEquation';
	import ChartFrame from './ChartFrame.svelte';

	/** Static row of matrices joined by operators: `M1 op M2 = M3`, with highlighted rows/cells. */
	let { title, desc, height = 220, items, decimals = 2 }: MatrixEquationProps = $props();

	const maxCols = $derived(
		Math.max(0, ...items.filter((it) => it.kind === 'matrix').map((m) => matrixCols(m))),
	);
	const head = $derived([
		'Матрица',
		...Array.from({ length: maxCols }, (_, j) => `Столбец ${j + 1}`),
	]);
	const rows = $derived(
		items.flatMap((it) =>
			it.kind === 'matrix'
				? it.values.map((row, r) => [
						`${it.label} (${dimOf(it)}), строка ${r + 1}`,
						...row.map((v) => formatCell(v, decimals)),
					])
				: [],
		),
	);

	function dimOf(m: EquationMatrix): string {
		return m.dim ?? `${matrixRows(m)} × ${matrixCols(m)}`;
	}

	function colorOf(m: EquationMatrix, index: number): string {
		if (m.entity) return `var(${ENTITY_COLOR_VAR[m.entity]})`;
		return catVar(index + 1);
	}

	const maxLen = $derived(maxCellLength(items, decimals));
</script>

<ChartFrame {title} {desc} {height} {head} {rows}>
	{#snippet children(width: number, h: number)}
		{@const layout = layoutItems(items, width, h)}
		{@const fs = valueFontSize(layout.cell, maxLen)}
		{@const x0 = (width - layout.width * layout.scale) / 2}
		{@const y0 = (h - layout.height * layout.scale) / 2}
		<g transform={`translate(${x0},${y0}) scale(${layout.scale})`}>
			{#each layout.items as it, k (k)}
				{#if it.kind === 'matrix'}
					{@const m = it.matrix}
					{@const col = colorOf(m, it.index)}
					<g opacity={m.dimmed ? 0.35 : 1}>
						<text
							x={it.x + it.width / 2}
							y={LABEL_H - 8}
							text-anchor="middle"
							style={`font-size: ${CHART_LABEL_PX}px; fill: var(--text)`}>{m.label}</text
						>
						{#each m.values as row, r (r)}
							{#each row as v, c (c)}
								{@const st = cellState(m, r, c)}
								{@const cx = it.x + c * layout.cell}
								{@const cy = it.y + r * layout.cell}
								<rect
									x={cx}
									y={cy}
									width={layout.cell}
									height={layout.cell}
									style={`fill: color-mix(in srgb, ${col} ${FILL_PCT[st]}%, var(--surface)); stroke: ${st === 'focus' ? 'var(--text)' : `color-mix(in srgb, ${col} 50%, var(--surface))`}`}
									stroke-width={st === 'focus' ? 2 : 1}
								/>
								<text
									x={cx + layout.cell / 2}
									y={cy + layout.cell / 2}
									dy="0.32em"
									text-anchor="middle"
									style={`font-family: var(--font-mono); font-size: ${fs}px; fill: var(--text)`}
									>{formatCell(v, decimals)}</text
								>
							{/each}
						{/each}
						{#if m.dim}
							<text
								x={it.x + it.width / 2}
								y={it.y + it.height + DIM_H - 6}
								text-anchor="middle"
								style={`font-size: ${CHART_TICK_PX}px; fill: var(--text-muted)`}>{m.dim}</text
							>
						{/if}
					</g>
				{:else}
					<text
						x={it.cx}
						y={it.cy}
						dy="0.35em"
						text-anchor="middle"
						style="font-size: 20px; fill: var(--text)">{it.text}</text
					>
				{/if}
			{/each}
		</g>
	{/snippet}
</ChartFrame>
