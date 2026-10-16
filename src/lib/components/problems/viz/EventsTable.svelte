<script lang="ts">
	/**
	 * Venn diagram of two events A and B plus the 2×2 table of joint probabilities.
	 * The cell «neither A nor B» is the question of the problem and is highlighted.
	 */
	let {
		pA,
		pB,
		pAB,
		labelA = 'A',
		labelB = 'B',
	}: { pA: number; pB: number; pAB: number; labelA?: string; labelB?: string } = $props();

	/** Picture area that stands for probability 1, in px². Circles are sized to match. */
	const AREA = 60000;
	const W = 320;
	const H = 220;
	const CX = W / 2;
	const CY = H / 2;

	/** Overlap area of two circles at distance d. */
	function lens(r1: number, r2: number, d: number): number {
		if (d >= r1 + r2) return 0;
		if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
		const a1 = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
		const a2 = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
		const tri = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
		return r1 * r1 * a1 + r2 * r2 * a2 - tri;
	}

	/** Distance between centres that gives the overlap area `target` (bisection). */
	function distanceFor(r1: number, r2: number, target: number): number {
		let lo = Math.abs(r1 - r2);
		let hi = r1 + r2;
		for (let i = 0; i < 60; i++) {
			const mid = (lo + hi) / 2;
			if (lens(r1, r2, mid) > target) lo = mid;
			else hi = mid;
		}
		return (lo + hi) / 2;
	}

	const geo = $derived.by(() => {
		const rA = Math.sqrt((Math.max(pA, 0) * AREA) / Math.PI);
		const rB = Math.sqrt((Math.max(pB, 0) * AREA) / Math.PI);
		const target = Math.min(Math.max(pAB, 0), Math.min(pA, pB)) * AREA;
		const d = rA > 0 && rB > 0 ? distanceFor(rA, rB, target) : rA + rB;
		return {
			rA,
			rB,
			ax: CX - d / 2,
			bx: CX + d / 2,
		};
	});

	const fmt = (x: number): string => String(Number(x.toFixed(4)));

	const cells = $derived({
		ab: pAB,
		aNb: pA - pAB,
		naB: pB - pAB,
		naNb: 1 - pA - pB + pAB,
	});
</script>

<figure class="ev">
	<svg
		class="venn"
		width={W}
		height={H}
		viewBox="0 0 {W} {H}"
		role="img"
		aria-label="Диаграмма Эйлера: события {labelA} и {labelB}; P({labelA}) = {fmt(
			pA,
		)}, P({labelB}) = {fmt(pB)}, P({labelA} и {labelB}) = {fmt(pAB)}"
	>
		<rect x="2" y="2" width={W - 4} height={H - 4} class="universe" />
		<circle cx={geo.ax} cy={CY} r={geo.rA} class="set set-a" />
		<circle cx={geo.bx} cy={CY} r={geo.rB} class="set set-b" />
		<text x="8" y="18" class="lbl">Ω</text>
		<text x={geo.ax - geo.rA * 0.55} y={CY - geo.rA * 0.55} class="lbl" text-anchor="middle">
			{labelA}\{labelB}
		</text>
		<text x={geo.bx + geo.rB * 0.55} y={CY - geo.rB * 0.55} class="lbl" text-anchor="middle">
			{labelB}\{labelA}
		</text>
		<text x={(geo.ax + geo.bx) / 2} y={CY + 4} class="lbl" text-anchor="middle"
			>{labelA}∩{labelB}</text
		>
		<text x={W - 10} y={H - 10} class="lbl" text-anchor="end">ни A, ни B</text>
	</svg>

	<table class="tbl">
		<caption>Совместные вероятности (площади на рисунке)</caption>
		<thead>
			<tr>
				<th scope="col"></th>
				<th scope="col">{labelB}</th>
				<th scope="col">не {labelB}</th>
				<th scope="col">Σ</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<th scope="row">{labelA}</th>
				<td>{fmt(cells.ab)}</td>
				<td>{fmt(cells.aNb)}</td>
				<td>{fmt(pA)}</td>
			</tr>
			<tr>
				<th scope="row">не {labelA}</th>
				<td>{fmt(cells.naB)}</td>
				<td class="target">{fmt(cells.naNb)}</td>
				<td>{fmt(1 - pA)}</td>
			</tr>
			<tr>
				<th scope="row">Σ</th>
				<td>{fmt(pB)}</td>
				<td>{fmt(1 - pB)}</td>
				<td>1</td>
			</tr>
		</tbody>
	</table>
	<figcaption>
		Что заметить: искомая клетка «не {labelA} и не {labelB}» (выделена) — это всё, что лежит вне
		кругов.
	</figcaption>
</figure>

<style>
	.ev {
		margin: 0;
		display: grid;
		gap: var(--space-3);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
	}
	.venn {
		display: block;
		max-width: 100%;
		height: auto;
	}
	.universe {
		fill: var(--topic-soft);
		stroke: var(--border);
		stroke-width: 1;
	}
	.set {
		stroke-width: 2;
		fill-opacity: 0.3;
	}
	.set-a {
		fill: var(--cat-1);
		stroke: var(--cat-1);
	}
	.set-b {
		fill: var(--cat-2);
		stroke: var(--cat-2);
		stroke-dasharray: 6 3;
	}
	.lbl {
		font-size: 13px;
		fill: var(--text);
		font-family: var(--font-sans);
	}
	.tbl {
		border-collapse: collapse;
		width: 100%;
		max-width: 360px;
	}
	caption {
		text-align: left;
		color: var(--text-muted);
		padding-bottom: var(--space-2);
		font-size: 12px;
	}
	th,
	td {
		border: 1px solid var(--border);
		padding: var(--space-2) var(--space-3);
		text-align: right;
		font-family: var(--font-mono);
	}
	th {
		font-family: var(--font-sans);
		font-weight: 600;
		text-align: center;
		background: var(--surface-2);
	}
	td.target {
		background: var(--topic-soft);
		color: var(--text);
		font-weight: 700;
		box-shadow: inset 0 0 0 2px var(--topic);
	}
	figcaption {
		color: var(--text-muted);
	}
	@media (prefers-reduced-motion: reduce) {
		.set {
			transition: none;
		}
	}
</style>
