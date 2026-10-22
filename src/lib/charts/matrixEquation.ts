/**
 * Pure logic of the MatrixEquation figure: number formatting, layout and cell highlight state.
 * No Svelte and no DOM here, so the rules are testable in Vitest.
 */
import type { EquationMatrix, EquationOp } from '$lib/contracts/component-props';

/** Smallest and largest cell size in SVG units. */
export const CELL_MIN = 18;
export const CELL_MAX = 40;
/** Space above the matrices (matrix labels) and below them (dimension captions). */
export const LABEL_H = 24;
export const DIM_H = 22;
export const PAD_X = 16;

const OP_MIN_W = 36;
const OP_CHAR_W = 10;
const OP_PAD = 12;

/** Highlight state of one cell. `focus` is a cell listed in `highlightCells`. */
export type CellState = 'cell' | 'row' | 'col' | 'both' | 'focus';

/** Fill of a cell: percent of the matrix colour mixed into `--surface`. */
export const FILL_PCT: Record<CellState, number> = {
	cell: 10,
	row: 22,
	col: 22,
	both: 36,
	focus: 40,
};

/**
 * Formats a cell value. Integers (also after rounding) are printed without a fraction,
 * other numbers with exactly `decimals` digits. Negative zero prints as "0".
 */
export function formatCell(value: number, decimals = 2): string {
	if (!Number.isFinite(value)) return String(value);
	const d = Math.min(10, Math.max(0, Math.floor(decimals)));
	const rounded = Number(value.toFixed(d));
	if (Number.isInteger(rounded)) return String(rounded);
	return rounded.toFixed(d);
}

export function matrixRows(m: EquationMatrix): number {
	return m.values.length;
}

export function matrixCols(m: EquationMatrix): number {
	return Math.max(0, ...m.values.map((r) => r.length));
}

export function opWidth(op: EquationOp): number {
	return Math.max(OP_MIN_W, op.text.length * OP_CHAR_W + OP_PAD);
}

/** Longest formatted cell text over all matrices (used to fit the value font). */
export function maxCellLength(items: Array<EquationMatrix | EquationOp>, decimals = 2): number {
	let max = 1;
	for (const it of items) {
		if (it.kind !== 'matrix') continue;
		for (const row of it.values) {
			for (const v of row) max = Math.max(max, formatCell(v, decimals).length);
		}
	}
	return max;
}

/** Font size (SVG units, 9–13) for cell values, so the longest value fits the cell. */
export function valueFontSize(cell: number, maxLen: number): number {
	const fit = Math.floor((cell * 0.92) / (Math.max(1, maxLen) * 0.62));
	return Math.min(13, Math.max(9, fit));
}

export interface LaidMatrix {
	kind: 'matrix';
	matrix: EquationMatrix;
	/** Index among matrices only (drives the neutral categorical colour). */
	index: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface LaidOp {
	kind: 'op';
	text: string;
	/** Centre of the glyph. */
	cx: number;
	cy: number;
}

export interface EquationLayout {
	items: Array<LaidMatrix | LaidOp>;
	/** Cell size in SVG units, within [CELL_MIN, CELL_MAX] before scaling. */
	cell: number;
	/** Unscaled content size. */
	width: number;
	height: number;
	/** Factor to apply to the whole figure so it fits the available box (<= 1). */
	scale: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/**
 * Lays out the row `matrix op matrix = matrix` in one line. The cell size follows the available
 * width (all columns of all matrices plus the operator glyphs) within [CELL_MIN, CELL_MAX].
 * If even the minimal cell does not fit, the figure is scaled down by `scale`.
 */
export function layoutItems(
	items: Array<EquationMatrix | EquationOp>,
	availableWidth: number,
	availableHeight = Infinity,
): EquationLayout {
	const matrices = items.filter((it): it is EquationMatrix => it.kind === 'matrix');
	const ops = items.filter((it): it is EquationOp => it.kind === 'op');
	const totalCols = matrices.reduce((s, m) => s + matrixCols(m), 0);
	const maxRows = Math.max(1, ...matrices.map(matrixRows));
	const opsWidth = ops.reduce((s, o) => s + opWidth(o), 0);

	const room = Math.max(0, availableWidth - 2 * PAD_X - opsWidth);
	const cell = totalCols > 0 ? clamp(Math.floor(room / totalCols), CELL_MIN, CELL_MAX) : CELL_MIN;

	const midY = LABEL_H + (maxRows * cell) / 2;
	const out: Array<LaidMatrix | LaidOp> = [];
	let x = PAD_X;
	let index = 0;
	for (const it of items) {
		if (it.kind === 'matrix') {
			const width = matrixCols(it) * cell;
			const height = matrixRows(it) * cell;
			out.push({ kind: 'matrix', matrix: it, index, x, y: LABEL_H, width, height });
			index++;
			x += width;
		} else {
			const w = opWidth(it);
			out.push({ kind: 'op', text: it.text, cx: x + w / 2, cy: midY });
			x += w;
		}
	}

	const width = 2 * PAD_X + opsWidth + totalCols * cell;
	const height = LABEL_H + maxRows * cell + DIM_H;
	const scale = Math.max(0.2, Math.min(1, availableWidth / width, availableHeight / height));
	return { items: out, cell, width, height, scale };
}

/**
 * Highlight state of cell (r, c). A cell listed in `highlightCells` is `focus` (it wins over
 * row and column); otherwise `both`, `row`, `col`, or the plain `cell`.
 */
export function cellState(m: EquationMatrix, r: number, c: number): CellState {
	if (m.highlightCells?.some(([hr, hc]) => hr === r && hc === c)) return 'focus';
	const inRow = m.highlightRows?.includes(r) ?? false;
	const inCol = m.highlightCols?.includes(c) ?? false;
	if (inRow && inCol) return 'both';
	if (inRow) return 'row';
	if (inCol) return 'col';
	return 'cell';
}
