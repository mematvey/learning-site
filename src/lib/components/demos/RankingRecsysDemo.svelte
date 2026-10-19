<script lang="ts">
	import {
		DEFAULT_ORDER,
		DEFAULT_RATINGS,
		ITEMS,
		K,
		RANK_MAX,
		RANK_MIN,
		RATING_MAX,
		RATING_MIN,
		clamp,
		dcg,
		formatNum,
		frobenius,
		frobeniusDiff,
		idealRel,
		lowRank,
		moveItem,
		ndcg,
		rankError,
		relInOrder,
		resolveState,
		setRating,
		singularValues,
		snapRank,
		weight,
		type RankingRecsysState,
	} from '$lib/demos/ranking-recsys';

	/** Ranking (NDCG@5 of one list) and rank-k approximation of a rating matrix. Accepts a partial state as a prop. */
	let { initial }: { initial?: Partial<RankingRecsysState> } = $props();

	/* svelte-ignore state_referenced_locally */
	const start = resolveState(initial);

	let order = $state<number[]>(start.order);
	let ratings = $state<number[][]>(start.ratings);
	let rank = $state(start.rank);

	/** Text for screen readers only; updated on user actions, not on every pointer move. */
	let live = $state('');

	/** Position in the list being dragged, or null. */
	let listDrag = $state<number | null>(null);
	let listStartY = 0;
	/** Matrix cell being dragged vertically, or null. */
	let cellDrag = $state<{ r: number; c: number; startY: number; startVal: number } | null>(null);

	/** Row height of the list in px; drag steps are measured in it. */
	const ROW_H = 44;
	/** Pointer px per one rating step while dragging a matrix cell. */
	const CELL_PX = 14;
	const RANKS = Array.from({ length: RANK_MAX - RANK_MIN + 1 }, (_, i) => RANK_MIN + i);
	const COLS = ITEMS.map((_, i) => i);

	// Ranking
	const rels = $derived(relInOrder(ITEMS, order));
	const dcgNow = $derived(dcg(rels, K));
	const idealNow = $derived(idealRel(rels));
	const idcgNow = $derived(dcg(idealNow, K));
	const ndcgNow = $derived(ndcg(rels, K));
	const ndcgStr = $derived(formatNum(ndcgNow, 3));
	const relevantCount = $derived(rels.filter((r) => r > 0).length);
	const listHint = $derived.by(() => {
		if (idcgNow === 0)
			return 'Релевантных объектов нет, поэтому NDCG не определён и показан как 0.';
		if (ndcgNow >= 1 - 1e-12) return 'Порядок идеальный: NDCG@5 = 1. Выше поднять уже нечего.';
		const posB = order.indexOf(1) + 1;
		const contrib = 2 * weight(posB);
		return (
			`Объект B с оценкой 2 стоит на позиции ${posB}: его вклад ${formatNum(contrib, 3)}, ` +
			`а на первой позиции был бы 2,000. Разрыв до идеала: ${formatNum(idcgNow - dcgNow, 3)}.`
		);
	});

	// Rating matrix and rank
	const approx = $derived(lowRank(ratings, rank));
	const approxErr = $derived(frobeniusDiff(ratings, approx));
	const normR = $derived(frobenius(ratings));
	const errs = $derived(RANKS.map((k) => rankError(ratings, k)));
	const svals = $derived(singularValues(ratings));
	const storage = $derived((ratings.length + (ratings[0]?.length ?? 0)) * rank);
	const matrixHint = $derived(
		`Ранг ${rank} хранит ${storage} чисел против ${ratings.length * (ratings[0]?.length ?? 0)} клеток. ` +
			(rank === RANK_MAX
				? 'Полный ранг восстанавливает матрицу точно: ошибка 0.'
				: 'Меньший ранг сглаживает оценки и теряет различия между строками.'),
	);

	function tint(v: number): number {
		return Math.round(
			((clamp(v, RATING_MIN, RATING_MAX) - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 45,
		);
	}

	function setCell(r: number, c: number, value: number): void {
		const next = setRating(ratings, r, c, value);
		if (next[r]![c]! === ratings[r]![c]!) return;
		ratings = next;
		live = `u${r + 1}, объект i${c + 1}: оценка ${next[r]![c]!}. Ошибка при ранге ${rank}: ${formatNum(rankError(next, rank), 4)}.`;
	}

	function cellKey(e: KeyboardEvent, r: number, c: number): void {
		const v = ratings[r]![c]!;
		let target: number | null = null;
		if (e.key === 'ArrowUp' || e.key === 'ArrowRight') target = v + 1;
		else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') target = v - 1;
		else if (e.key === 'Home') target = RATING_MAX;
		else if (e.key === 'End') target = RATING_MIN;
		if (target === null) return;
		e.preventDefault();
		setCell(r, c, target);
	}

	function cellDown(e: PointerEvent, r: number, c: number): void {
		e.preventDefault();
		(e.currentTarget as HTMLElement).focus();
		cellDrag = { r, c, startY: e.clientY, startVal: ratings[r]![c]! };
	}

	function resetRatings(): void {
		ratings = DEFAULT_RATINGS.map((row) => [...row]);
		live = `Оценки возвращены. Ошибка при ранге ${rank}: ${formatNum(rankError(ratings, rank), 4)}.`;
	}

	function setRank(value: number): void {
		rank = snapRank(value);
		live = `Ранг ${rank}: ошибка ${formatNum(rankError(ratings, rank), 4)} при норме ${formatNum(normR, 4)}.`;
	}

	// List order
	function moveTo(from: number, to: number): void {
		if (to < 0 || to >= order.length || from === to) return;
		const id = ITEMS[order[from]!]!.id;
		order = moveItem(order, from, to);
		const ndcgAfter = ndcg(relInOrder(ITEMS, order), K);
		live = `Объект ${id} на позиции ${to + 1}. NDCG@5 = ${formatNum(ndcgAfter, 3)}.`;
	}

	function handleKey(e: KeyboardEvent, pos: number): void {
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			moveTo(pos, pos - 1);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			moveTo(pos, pos + 1);
		}
	}

	function handleDown(e: PointerEvent, pos: number): void {
		e.preventDefault();
		listDrag = pos;
		listStartY = e.clientY;
	}

	function resetOrder(): void {
		order = [...DEFAULT_ORDER];
		live = `Порядок возвращён. NDCG@5 = ${formatNum(ndcg(relInOrder(ITEMS, order), K), 3)}.`;
	}

	// Window-level pointer tracking: drags continue when the pointer leaves the element.
	function windowMove(e: PointerEvent): void {
		if (cellDrag) {
			const { r, c, startY, startVal } = cellDrag;
			setCell(r, c, startVal + Math.round((startY - e.clientY) / CELL_PX));
		}
		if (listDrag !== null) {
			const delta = Math.round((e.clientY - listStartY) / ROW_H);
			const to = clamp(listDrag + delta, 0, order.length - 1);
			const applied = to - listDrag;
			if (applied !== 0) {
				const from = listDrag;
				moveTo(from, to);
				listDrag = to;
				listStartY += applied * ROW_H;
			}
		}
	}

	function endDrags(): void {
		cellDrag = null;
		listDrag = null;
	}
</script>

<svelte:window onpointermove={windowMove} onpointerup={endDrags} onpointercancel={endDrags} />

<section class="rr" data-demo="ranking-recsys" aria-label="Рекомендации и ранжирование">
	<div class="rr-grid">
		<div class="rr-panel" role="group" aria-labelledby="rr-list-title">
			<p class="rr-title" id="rr-list-title">Порядок выдачи, NDCG@5</p>
			<p class="rr-meta">
				Перетащите объект за ручку или выберите ручку и нажмите стрелки вверх и вниз.
			</p>

			<div class="rr-thead" aria-hidden="true">
				<span></span>
				<span>№</span>
				<span>Объект</span>
				<span>Оценка</span>
				<span>Вклад</span>
			</div>
			<ol class="rr-list">
				{#each order as idx, pos (idx)}
					{@const item = ITEMS[idx]!}
					<li class="rr-row" class:is-drag={listDrag === pos} class:is-rel={item.rel > 0}>
						<button
							type="button"
							class="rr-handle"
							aria-label="Объект {item.id}, позиция {pos +
								1}, оценка {item.rel}. Стрелки вверх и вниз меняют позицию."
							onpointerdown={(e) => handleDown(e, pos)}
							onkeydown={(e) => handleKey(e, pos)}>⋮⋮</button
						>
						<span class="rr-pos">{pos + 1}</span>
						<span class="rr-name">Объект {item.id}</span>
						<span class="rr-rel">{item.rel}</span>
						<span class="rr-gain">{formatNum(item.rel * weight(pos + 1), 3)}</span>
					</li>
				{/each}
			</ol>

			<dl class="rr-sum">
				<dt>DCG@5</dt>
				<dd>{formatNum(dcgNow, 3)}</dd>
				<dt>IDCG@5</dt>
				<dd>{formatNum(idcgNow, 3)}</dd>
				<dt>NDCG@5</dt>
				<dd class="rr-big">{ndcgStr}</dd>
			</dl>
			<p class="rr-meta">
				Идеальный порядок оценок: {idealNow.join(', ')}. Релевантных объектов в списке:
				{relevantCount} из {rels.length}.
			</p>
			<p class="rr-hint">{listHint}</p>
			<button type="button" class="rr-btn" onclick={resetOrder}>Вернуть порядок</button>
		</div>

		<div class="rr-panel" role="group" aria-labelledby="rr-matrix-title">
			<p class="rr-title" id="rr-matrix-title">Матрица оценок R и ранг</p>
			<p class="rr-meta">
				Строки: пользователи u1–u4. Столбцы: объекты i1–i4. Потяните оценку вверх или вниз, или
				выберите клетку и нажмите стрелки. Оценки от {RATING_MIN} до {RATING_MAX}.
			</p>

			<div class="rr-tables">
				<table class="rr-table">
					<caption>Оценки R</caption>
					<thead>
						<tr>
							<th scope="col"><span class="rr-sr">пользователь</span></th>
							{#each COLS as c (c)}
								<th scope="col">i{c + 1}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each ratings as row, r (r)}
							<tr>
								<th scope="row">u{r + 1}</th>
								{#each row as v, c (c)}
									<td>
										<div
											class="rr-cell"
											role="spinbutton"
											tabindex="0"
											aria-label="Оценка пользователя u{r + 1} объекту i{c + 1}"
											aria-valuemin={RATING_MIN}
											aria-valuemax={RATING_MAX}
											aria-valuenow={v}
											style="background: color-mix(in srgb, var(--topic) {tint(
												v,
											)}%, var(--surface));"
											onpointerdown={(e) => cellDown(e, r, c)}
											onkeydown={(e) => cellKey(e, r, c)}
										>
											{v}
										</div>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>

				<table class="rr-table rr-approx">
					<caption>Восстановление при ранге {rank}</caption>
					<thead>
						<tr>
							<th scope="col"><span class="rr-sr">пользователь</span></th>
							{#each COLS as c (c)}
								<th scope="col">i{c + 1}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each approx as row, r (r)}
							<tr>
								<th scope="row">u{r + 1}</th>
								{#each row as v, c (c)}
									<td>
										<div
											class="rr-cell is-read"
											style="background: color-mix(in srgb, var(--topic) {tint(
												v,
											)}%, var(--surface));"
										>
											{formatNum(v, 1)}
										</div>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<label class="rr-ctl">
				<span class="rr-label">ранг k = <output class="rr-val">{rank}</output></span>
				<input
					class="rr-range"
					type="range"
					min={RANK_MIN}
					max={RANK_MAX}
					step="1"
					value={rank}
					oninput={(e) => setRank(Number(e.currentTarget.value))}
				/>
			</label>

			<p class="rr-meta">
				Ошибка ‖R − R<sub>k</sub>‖<sub>F</sub> = <b class="rr-big-s">{formatNum(approxErr, 4)}</b>
				при норме ‖R‖<sub>F</sub> = {formatNum(normR, 4)}.
			</p>
			<dl class="rr-errs">
				{#each errs as e, i (i)}
					<dt class:is-current={i + RANK_MIN === rank}>ранг {i + RANK_MIN}</dt>
					<dd class:is-current={i + RANK_MIN === rank}>{formatNum(e, 4)}</dd>
				{/each}
			</dl>
			<p class="rr-hint">{matrixHint}</p>
			<p class="rr-meta">Сингулярные значения: {svals.map((v) => formatNum(v, 2)).join(', ')}.</p>
			<button type="button" class="rr-btn" onclick={resetRatings}>Вернуть оценки</button>
		</div>
	</div>

	<p class="rr-sr" aria-live="polite">{live}</p>
</section>

<style>
	.rr {
		position: relative;
		margin: 0;
		padding: var(--space-4);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
		text-align: left;
		letter-spacing: normal;
		text-transform: none;
	}
	.rr :global(*),
	.rr :global(*::before),
	.rr :global(*::after) {
		box-sizing: border-box;
	}
	.rr p,
	.rr dl,
	.rr dd,
	.rr dt,
	.rr ol,
	.rr li {
		margin: 0;
		padding: 0;
	}
	.rr ol {
		list-style: none;
	}
	.rr button {
		font: inherit;
	}
	.rr-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
		gap: var(--space-6);
	}
	.rr-panel {
		min-width: 0;
		padding: var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.rr-title {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.rr-meta {
		margin-bottom: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}
	.rr-hint {
		margin: var(--space-3) 0;
		padding: var(--space-2) var(--space-3);
		background: var(--topic-soft);
		border-left: 3px solid var(--topic);
		border-radius: var(--radius-sm);
		color: var(--text);
		font-size: 14px;
	}
	.rr-btn {
		height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		font-size: 14px;
		cursor: pointer;
		transition: background var(--dur-fast) var(--ease);
	}
	.rr-btn:hover {
		background: var(--surface-2);
	}
	.rr :focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.rr-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* Ranking list */
	.rr-thead,
	.rr-row {
		display: grid;
		grid-template-columns: 32px 24px minmax(0, 1fr) 52px 56px;
		align-items: center;
		column-gap: var(--space-2);
	}
	.rr-thead {
		padding: 0 0 var(--space-1);
		color: var(--text-muted);
		font-size: 12px;
	}
	.rr-list {
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}
	.rr-row {
		height: 44px;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.rr-row:last-child {
		border-bottom: 0;
	}
	.rr-row.is-rel .rr-name {
		font-weight: 600;
	}
	.rr-row.is-drag {
		background: var(--topic-soft);
	}
	.rr-handle {
		width: 32px;
		height: 36px;
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-muted);
		font-size: 14px;
		line-height: 1;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.rr-pos,
	.rr-rel,
	.rr-gain,
	.rr-sum dd,
	.rr-errs dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.rr-pos {
		color: var(--text-muted);
	}
	.rr-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rr-rel,
	.rr-gain {
		text-align: right;
	}
	.rr-gain {
		color: var(--topic);
		font-weight: 600;
	}
	.rr-sum {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin-top: var(--space-4);
		font-size: 13px;
	}
	.rr-sum dt,
	.rr-errs dt {
		color: var(--text-muted);
	}
	.rr-sum dd {
		text-align: right;
	}
	.rr-big {
		font-size: 18px;
		font-weight: 700;
		color: var(--text);
	}

	/* Matrix */
	.rr-tables {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
	}
	.rr-table {
		width: 100%;
		table-layout: fixed;
		border-collapse: separate;
		border-spacing: 3px;
		font-size: 13px;
	}
	.rr-table caption {
		caption-side: top;
		margin-bottom: var(--space-1);
		text-align: left;
		color: var(--text-muted);
		font-size: 12px;
	}
	.rr-table th {
		padding: 0;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 400;
		text-align: center;
	}
	.rr-table th[scope='row'] {
		width: 40px;
		text-align: left;
	}
	.rr-table td {
		padding: 0;
	}
	.rr-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 40px;
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
		cursor: ns-resize;
		touch-action: none;
		user-select: none;
	}
	.rr-cell.is-read {
		border-style: dashed;
		border-color: var(--border);
		cursor: default;
	}
	.rr-approx caption {
		color: var(--text-muted);
	}
	.rr-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-4);
	}
	.rr-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.rr-val {
		color: var(--text);
		font-family: var(--font-mono);
		font-weight: 600;
	}
	.rr-range {
		flex: 1 1 160px;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.rr-big-s {
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 16px;
	}
	.rr-errs {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-1) var(--space-2);
		margin-bottom: var(--space-3);
		font-size: 13px;
	}
	.rr-errs dt {
		font-size: 12px;
	}
	.rr-errs dd {
		font-size: 14px;
	}
	.rr-errs .is-current {
		color: var(--topic);
		font-weight: 600;
	}

	@media (max-width: 719px) {
		.rr-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (min-width: 560px) {
		.rr-tables {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}

	@media (max-width: 559px) {
		.rr {
			padding: var(--space-2);
		}
		.rr-panel {
			padding: var(--space-3);
		}
		.rr-thead,
		.rr-row {
			grid-template-columns: 32px 20px minmax(0, 1fr) 40px 48px;
			column-gap: var(--space-1);
		}
		.rr-errs {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.rr *,
		.rr *::before,
		.rr *::after {
			transition: none !important;
			scroll-behavior: auto !important;
		}
	}
</style>
