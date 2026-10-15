<script lang="ts">
	import type { SchemeId } from './stepState';

	interface Props {
		/** Elements to highlight; the rest are dimmed. */
		active: readonly SchemeId[];
		/** Show the `÷ √d` pill. */
		pill?: boolean;
	}

	let { active, pill = false }: Props = $props();

	/** Matrix cell size in SVG units. */
	const CELL = 16;

	interface Matrix {
		id: 'Q' | 'K' | 'S' | 'A' | 'V' | 'O';
		x: number;
		y: number;
		rows: number;
		cols: number;
		cls: string;
		name: string;
		dim: string;
		labelY: number;
	}

	const MATRICES: readonly Matrix[] = [
		{ id: 'Q', x: 20, y: 40, rows: 6, cols: 4, cls: 'm-q', name: 'Q', dim: 'n × d', labelY: 26 },
		{ id: 'K', x: 120, y: 56, rows: 4, cols: 6, cls: 'm-k', name: 'Kᵀ', dim: 'd × n', labelY: 26 },
		{ id: 'S', x: 244, y: 40, rows: 6, cols: 6, cls: 'm-s', name: 'S', dim: 'n × n', labelY: 26 },
		{ id: 'A', x: 244, y: 200, rows: 6, cols: 6, cls: 'm-a', name: 'A', dim: 'n × n', labelY: 186 },
		{ id: 'V', x: 372, y: 200, rows: 6, cols: 4, cls: 'm-v', name: 'V', dim: 'n × d', labelY: 186 },
		{ id: 'O', x: 464, y: 200, rows: 6, cols: 4, cls: 'm-o', name: 'O', dim: 'n × d', labelY: 186 },
	];

	/** Inner grid lines of a matrix box. */
	function gridPath(m: Matrix): string {
		const w = m.cols * CELL;
		const h = m.rows * CELL;
		let d = '';
		for (let i = 1; i < m.cols; i++) d += `M${m.x + i * CELL} ${m.y}V${m.y + h}`;
		for (let j = 1; j < m.rows; j++) d += `M${m.x} ${m.y + j * CELL}H${m.x + w}`;
		return d;
	}

	const isOn = (id: SchemeId) => active.includes(id);
</script>

<svg
	class="sc-svg"
	viewBox="0 0 540 330"
	role="img"
	aria-label="Q умножается на Kᵀ и даёт S; softmax даёт A; A умножается на V и даёт O"
>
	{#each MATRICES as m (m.id)}
		{@const w = m.cols * CELL}
		{@const h = m.rows * CELL}
		<g class="sc-m {m.cls}" class:is-on={isOn(m.id)} data-m={m.id}>
			<rect class="sc-box" x={m.x} y={m.y} width={w} height={h} rx="4" />
			<path class="sc-grid" d={gridPath(m)} />
			<text class="sc-name" x={m.x + w / 2} y={m.labelY}>{m.name}</text>
			<text class="sc-dim" x={m.x + w / 2} y={m.y + h + 18}>{m.dim}</text>
		</g>
	{/each}

	<text class="sc-op" x="100" y="96">×</text>
	<text class="sc-op" x="230" y="96">=</text>
	<text class="sc-op" x="356" y="256">×</text>
	<text class="sc-op" x="450" y="256">=</text>

	<g class="sc-m sc-arrow" class:is-on={isOn('arrow')} data-m="arrow">
		<path class="sc-line" d="M322 144V190" />
		<path class="sc-head" d="M316 190L322 199L328 190Z" />
		<text class="sc-soft" x="334" y="172">softmax</text>
	</g>

	<g class="sc-pop" class:is-on={pill}>
		<rect class="sc-pill" x="356" y="74" width="84" height="28" rx="14" />
		<text class="sc-pill-t" x="398" y="93">÷ √d</text>
	</g>
</svg>

<style>
	.sc-svg {
		display: block;
		width: 100%;
		height: auto;
		font-family: var(--font-sans);
	}

	.m-q {
		--m: var(--cat-1);
	}
	.m-k {
		--m: var(--cat-2);
	}
	.m-v {
		--m: var(--cat-3);
	}
	.m-s {
		--m: var(--topic);
	}
	.m-a {
		--m: var(--topic);
	}
	.m-o {
		--m: var(--cat-4);
	}

	.sc-m {
		opacity: 0.28;
		transition: opacity var(--dur) var(--ease);
	}

	.sc-m.is-on {
		opacity: 1;
	}

	.sc-box {
		fill: color-mix(in srgb, var(--m) 14%, transparent);
		stroke: var(--m);
		stroke-width: 1.5;
	}

	.sc-grid {
		fill: none;
		stroke: color-mix(in srgb, var(--m) 35%, transparent);
		stroke-width: 1;
	}

	.sc-name {
		fill: var(--m);
		font-size: 16px;
		font-weight: 600;
		text-anchor: middle;
	}

	.sc-dim {
		fill: var(--text-muted);
		font-size: 12px;
		text-anchor: middle;
	}

	.sc-op {
		fill: var(--text-muted);
		font-size: 22px;
		text-anchor: middle;
	}

	.sc-line {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
	}

	.sc-head {
		fill: var(--text-muted);
	}

	.sc-soft {
		fill: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	.sc-pop {
		opacity: 0;
		transition: opacity var(--dur) var(--ease);
	}

	.sc-pop.is-on {
		opacity: 1;
	}

	.sc-pill {
		fill: var(--topic-soft);
		stroke: var(--topic);
		stroke-width: 1;
	}

	.sc-pill-t {
		fill: var(--topic);
		font-size: 14px;
		font-weight: 600;
		text-anchor: middle;
	}
</style>
