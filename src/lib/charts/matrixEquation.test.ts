import { describe, expect, it } from 'vitest';
import type { EquationMatrix, EquationOp } from '$lib/contracts/component-props';
import {
	CELL_MIN,
	cellState,
	formatCell,
	layoutItems,
	maxCellLength,
	valueFontSize,
} from './matrixEquation';

const Q: EquationMatrix = {
	kind: 'matrix',
	id: 'Q',
	label: 'Q',
	values: [
		[1, 0, 1],
		[0, 1, 1],
	],
	highlightRows: [1],
	highlightCols: [2],
	highlightCells: [[1, 2]],
};
const times: EquationOp = { kind: 'op', text: '×' };
const K: EquationMatrix = {
	kind: 'matrix',
	id: 'K',
	label: 'K',
	values: [
		[1, 0, 1, 0],
		[0, 1, 1, 0],
		[1, 1, 0, 1],
	],
};
const eq: EquationOp = { kind: 'op', text: '=' };
const S: EquationMatrix = {
	kind: 'matrix',
	id: 'S',
	label: 'S',
	values: [
		[2, 1, 1, 1],
		[1, 2, 1, 1],
	],
};

describe('formatCell', () => {
	it('prints integers without a fraction', () => {
		expect(formatCell(2, 2)).toBe('2');
		expect(formatCell(-3, 2)).toBe('-3');
		expect(formatCell(2.001, 0)).toBe('2');
	});

	it('keeps the requested number of digits', () => {
		expect(formatCell(1.5, 2)).toBe('1.50');
		expect(formatCell(0.25, 3)).toBe('0.250');
	});

	it('handles negatives and rounds half-way values', () => {
		expect(formatCell(-1.456, 2)).toBe('-1.46');
		expect(formatCell(-0.001, 2)).toBe('0');
		expect(formatCell(2.5, 0)).toBe('3');
	});
});

describe('layoutItems', () => {
	it('keeps the figure inside the available width at normal sizes', () => {
		const layout = layoutItems([Q, times, K, eq, S], 600);
		expect(layout.width).toBeLessThanOrEqual(600);
		expect(layout.scale).toBe(1);
		expect(layout.cell).toBeGreaterThanOrEqual(CELL_MIN);
	});

	it('never goes below the minimal cell and scales down instead', () => {
		const layout = layoutItems([Q, times, K, eq, S], 120);
		expect(layout.cell).toBe(CELL_MIN);
		expect(layout.scale).toBeLessThan(1);
		expect(layout.width * layout.scale).toBeLessThanOrEqual(120 + 0.5);
	});

	it('caps the cell size at the maximum', () => {
		const layout = layoutItems([Q], 4000);
		expect(layout.cell).toBe(40);
		expect(layout.scale).toBe(1);
	});

	it('places matrices left to right with operators between them', () => {
		const layout = layoutItems([Q, times, K], 600);
		const [a, op, b] = layout.items;
		expect(a?.kind).toBe('matrix');
		expect(op?.kind).toBe('op');
		if (a?.kind !== 'matrix' || b?.kind !== 'matrix') throw new Error('unexpected layout');
		expect(b.x).toBeGreaterThan(a.x + a.width);
		expect(b.index).toBe(1);
	});
});

describe('cellState', () => {
	it('marks a listed cell as focus, even inside its row and column', () => {
		expect(cellState(Q, 1, 2)).toBe('focus');
	});

	it('distinguishes row, column, both and plain cells', () => {
		expect(cellState(Q, 1, 0)).toBe('row');
		expect(cellState(K, 0, 2)).toBe('cell');
		const both: EquationMatrix = { ...K, highlightRows: [0], highlightCols: [2] };
		expect(cellState(both, 0, 2)).toBe('both');
		expect(cellState(both, 0, 1)).toBe('row');
		expect(cellState(both, 2, 2)).toBe('col');
	});
});

describe('value font', () => {
	it('fits the longest value and stays within 9–13', () => {
		expect(maxCellLength([Q, times, S], 2)).toBe(1);
		expect(maxCellLength([{ ...S, values: [[1.5, -0.25]] }], 2)).toBe(5);
		expect(valueFontSize(40, 4)).toBe(13);
		expect(valueFontSize(18, 5)).toBe(9);
	});
});
