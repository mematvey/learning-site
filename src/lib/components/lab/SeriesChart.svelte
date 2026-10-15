<script lang="ts">
	import type { Series } from '$lib/contracts';
	import { extent } from './format';

	/** Line chart of one or more series. Drawn at the real container width; text stays 12px. */
	interface Props {
		title: string;
		series: Series[];
	}

	let { title, series }: Props = $props();

	const H = 220;
	const L = 44;
	const R = 12;
	const T = 12;
	const B = 30;

	let box: HTMLElement | undefined = $state();
	let width = $state(480);

	$effect(() => {
		if (!box) return;
		const el = box;
		const ro = new ResizeObserver(() => {
			width = Math.max(280, Math.floor(el.clientWidth));
		});
		ro.observe(el);
		return () => ro.disconnect();
	});

	const ext = $derived(extent(series));
	const sx = (x: number) => L + ((x - ext.x0) / (ext.x1 - ext.x0)) * (width - L - R);
	const sy = (y: number) => T + (H - T - B) * (1 - (y - ext.y0) / (ext.y1 - ext.y0));
	const path = (s: Series) =>
		s.x
			.map((x, i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)} ${sy(s.y[i] ?? 0).toFixed(1)}`)
			.join(' ');
	const yTicks = $derived([0, 1, 2, 3].map((i) => ext.y0 + ((ext.y1 - ext.y0) * i) / 3));
</script>

<figure class="series" bind:this={box}>
	<svg {width} height={H} role="img" aria-label={title}>
		<title>{title}</title>
		{#each yTicks as v (v)}
			<line class="grid" x1={L} x2={width - R} y1={sy(v)} y2={sy(v)} />
			<text class="tick" x={L - 8} y={sy(v) + 4} text-anchor="end">{v.toFixed(2)}</text>
		{/each}
		<text class="tick" x={L} y={H - 8}>{ext.x0.toFixed(0)}</text>
		<text class="tick" x={width - R} y={H - 8} text-anchor="end">{ext.x1.toFixed(0)}</text>
		{#each series as s, i (i)}
			<path class="line" d={path(s)} style:stroke={`var(--cat-${(i % 6) + 1})`} />
		{/each}
	</svg>
	<figcaption>
		{#each series as s, i (i)}
			<span class="legend"
				><span class="sw" style:background={`var(--cat-${(i % 6) + 1})`}></span>{s.label ??
					title}</span
			>
		{/each}
	</figcaption>
</figure>

<style>
	.series {
		margin: 0;
		padding: 12px 12px 8px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	svg {
		display: block;
		max-width: 100%;
		height: 220px;
	}
	.grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.tick {
		fill: var(--text-muted);
		font: 12px var(--font-sans);
	}
	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		margin-top: 8px;
		font: 12.5px/1.4 var(--font-sans);
		color: var(--text-muted);
	}
	.legend {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.sw {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
</style>
