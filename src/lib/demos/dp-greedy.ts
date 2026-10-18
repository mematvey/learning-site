/**
 * Math of the DP demo: edit distance and 0/1 knapsack tables filled step by step,
 * path restoration, and a coin-change counterexample for greedy.
 * Pure functions only: no DOM, no Svelte.
 */

export type DpMode = 'edit' | 'knap';

export interface DpTableDemoState {
	/** Which table is shown. */
	mode: DpMode;
	/** Number of steps already shown (fill steps first, then restore steps). */
	step: number;
}

export function isDpMode(v: unknown): v is DpMode {
	return v === 'edit' || v === 'knap';
}

export interface KnapItem {
	value: number;
	weight: number;
}

/** One cell of a table, addressed as row i and column j. */
export interface DpCell {
	i: number;
	j: number;
}

export interface DpStep {
	phase: 'fill' | 'restore';
	/** Cell that this step touches. */
	cell: DpCell;
	/** Value stored in the cell. */
	value: number;
	/** Human-readable explanation, in Russian. */
	text: string;
}

export interface PathCell extends DpCell {
	/** 'start' for the origin; otherwise the operation that moved the walk into this cell. */
	label: 'start' | 'match' | 'replace' | 'delete' | 'insert' | 'take' | 'skip';
}

export interface DpRun {
	table: number[][];
	/** Fill order: row by row for edit distance, item by item for knapsack. */
	fillOrder: DpCell[];
	/** Walk from the origin to the final cell. */
	path: PathCell[];
	/** Answer: edit distance or maximum value. */
	answer: number;
	steps: DpStep[];
}

/** Returns arr[i] and throws if the index is outside the array. */
export function at<T>(arr: readonly T[], i: number): T {
	const v = arr[i];
	if (v === undefined) throw new RangeError(`index ${i} is out of range`);
	return v;
}

/** Returns table[i][j] and throws if either index is outside the table. */
export function cellOf(table: readonly (readonly number[])[], i: number, j: number): number {
	return at(at(table, i), j);
}

/** Edit distance table D[i][j] for prefixes a[0..i) and b[0..j). */
export function editTable(a: string, b: string): number[][] {
	const m = a.length;
	const n = b.length;
	const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
	for (let i = 0; i <= m; i++) at(d, i)[0] = i;
	for (let j = 0; j <= n; j++) at(d, 0)[j] = j;
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			at(d, i)[j] = Math.min(
				cellOf(d, i - 1, j) + 1,
				cellOf(d, i, j - 1) + 1,
				cellOf(d, i - 1, j - 1) + cost,
			);
		}
	}
	return d;
}

/**
 * Restores the edit operations from the final cell back to (0, 0).
 * Returned in forward order: the first cell is (0, 0) with label 'start', and each next cell
 * carries the operation that moved the walk into it.
 */
export function restoreEditPath(d: number[][], a: string, b: string): PathCell[] {
	let i = a.length;
	let j = b.length;
	const back: PathCell[] = [];
	while (i > 0 || j > 0) {
		if (
			i > 0 &&
			j > 0 &&
			cellOf(d, i, j) === cellOf(d, i - 1, j - 1) + (a[i - 1] === b[j - 1] ? 0 : 1)
		) {
			back.push({ i, j, label: a[i - 1] === b[j - 1] ? 'match' : 'replace' });
			i--;
			j--;
		} else if (i > 0 && cellOf(d, i, j) === cellOf(d, i - 1, j) + 1) {
			back.push({ i, j, label: 'delete' });
			i--;
		} else {
			back.push({ i, j, label: 'insert' });
			j--;
		}
	}
	back.push({ i: 0, j: 0, label: 'start' });
	return back.reverse();
}

function pushRestoreSteps(steps: DpStep[], path: PathCell[], table: number[][]): void {
	for (const p of path) {
		const value = cellOf(table, p.i, p.j);
		const text =
			p.label === 'start'
				? `Старт восстановления: ячейка (${p.i}, ${p.j}).`
				: p.label === 'match'
					? `Совпадение: пришли по диагонали из (${p.i - 1}, ${p.j - 1}).`
					: p.label === 'replace'
						? `Замена: пришли по диагонали из (${p.i - 1}, ${p.j - 1}).`
						: p.label === 'delete'
							? `Удаление: пришли сверху из (${p.i - 1}, ${p.j}).`
							: p.label === 'insert'
								? `Вставка: пришли слева из (${p.i}, ${p.j - 1}).`
								: p.label === 'take'
									? `Предмет ${p.i} взят: пришли из строки ${p.i - 1}, ёмкость уменьшена на его вес.`
									: `Предмет ${p.i} не взят: пришли сверху из (${p.i - 1}, ${p.j}).`;
		steps.push({ phase: 'restore', cell: { i: p.i, j: p.j }, value, text });
	}
}

/** Edit distance run: table, fill order, restored path and step list. */
export function editDp(a: string, b: string): DpRun {
	const table = editTable(a, b);
	const fillOrder: DpCell[] = [];
	const steps: DpStep[] = [];
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			fillOrder.push({ i, j });
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			const up = cellOf(table, i - 1, j) + 1;
			const left = cellOf(table, i, j - 1) + 1;
			const diag = cellOf(table, i - 1, j - 1) + cost;
			const v = cellOf(table, i, j);
			const reason =
				cost === 0
					? `символы «${a[i - 1]}» совпадают, диагональ даёт ${diag}`
					: `символы «${a[i - 1]}» и «${b[j - 1]}» различаются`;
			steps.push({
				phase: 'fill',
				cell: { i, j },
				value: v,
				text: `D[${i}][${j}] = min(${up}, ${left}, ${diag}) = ${v}; ${reason}`,
			});
		}
	}
	const path = restoreEditPath(table, a, b);
	const answer = cellOf(table, a.length, b.length);
	pushRestoreSteps(steps, path, table);
	return { table, fillOrder, path, answer, steps };
}

/**
 * Knapsack table F[k][c]: best value using the first k items with capacity c (0..W).
 * Row 0 is all zeros.
 */
export function knapTable(items: KnapItem[], W: number): number[][] {
	const n = items.length;
	const f: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(W + 1).fill(0));
	for (let k = 1; k <= n; k++) {
		const { value, weight } = at(items, k - 1);
		for (let c = 0; c <= W; c++) {
			const skip = cellOf(f, k - 1, c);
			at(f, k)[c] = c >= weight ? Math.max(skip, cellOf(f, k - 1, c - weight) + value) : skip;
		}
	}
	return f;
}

/** Restores the path from (n, W) back to row 0. Labels 'take' and 'skip' mark item decisions. */
export function restoreKnapPath(f: number[][], items: KnapItem[], W: number): PathCell[] {
	const back: PathCell[] = [];
	let c = W;
	for (let k = items.length; k >= 1; k--) {
		if (cellOf(f, k, c) !== cellOf(f, k - 1, c)) {
			back.push({ i: k, j: c, label: 'take' });
			c -= at(items, k - 1).weight;
		} else {
			back.push({ i: k, j: c, label: 'skip' });
		}
	}
	back.push({ i: 0, j: c, label: 'start' });
	return back.reverse();
}

/** Knapsack run. The table has n + 1 rows and W + 1 columns. */
export function knapDp(items: KnapItem[], W: number): DpRun {
	const table = knapTable(items, W);
	const fillOrder: DpCell[] = [];
	const steps: DpStep[] = [];
	for (let k = 1; k <= items.length; k++) {
		const { value, weight } = at(items, k - 1);
		for (let c = 0; c <= W; c++) {
			fillOrder.push({ i: k, j: c });
			const v = cellOf(table, k, c);
			const text =
				c >= weight
					? `F(${k}, ${c}) = max(${cellOf(table, k - 1, c)}, ${cellOf(table, k - 1, c - weight)} + ${value}) = ${v}`
					: `предмет ${k} (вес ${weight}) не влезает, F(${k}, ${c}) = ${v}`;
			steps.push({ phase: 'fill', cell: { i: k, j: c }, value: v, text });
		}
	}
	const path = restoreKnapPath(table, items, W);
	const answer = cellOf(table, items.length, W);
	pushRestoreSteps(steps, path, table);
	return { table, fillOrder, path, answer, steps };
}

/** Greedy change: always take the largest coin that fits. Returns null if the sum is not reached. */
export function greedyCoins(coins: number[], sum: number): number[] | null {
	const sorted = [...coins].sort((x, y) => y - x);
	const picked: number[] = [];
	let rest = sum;
	while (rest > 0) {
		const coin = sorted.find((c) => c <= rest);
		if (coin === undefined) return null;
		picked.push(coin);
		rest -= coin;
	}
	return picked;
}

/** Optimal change by DP over the sum: f[s] = 1 + min f[s - c]. Returns the coins in one optimum. */
export function minCoinsDp(coins: number[], sum: number): number[] | null {
	const f: number[] = new Array<number>(sum + 1).fill(Infinity);
	const last: number[] = new Array<number>(sum + 1).fill(-1);
	f[0] = 0;
	for (let s = 1; s <= sum; s++) {
		for (const c of coins) {
			const prev = f[s - c];
			if (c <= s && prev !== undefined && prev + 1 < at(f, s)) {
				f[s] = prev + 1;
				last[s] = c;
			}
		}
	}
	if (!Number.isFinite(at(f, sum))) return null;
	const picked: number[] = [];
	for (let s = sum; s > 0; s -= at(last, s)) picked.push(at(last, s));
	return picked;
}
