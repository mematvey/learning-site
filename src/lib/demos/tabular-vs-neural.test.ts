import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	ROW_STEPS,
	describeChoice,
	formatRows,
	normalizeState,
	recommend,
	rowsOf,
} from './tabular-vs-neural';

const rowIndexOf = (rows: number): number => ROW_STEPS.indexOf(rows as (typeof ROW_STEPS)[number]);

describe('recommend', () => {
	it('suggests a tabular foundation model for the default 2 000 rows', () => {
		expect(recommend(DEFAULT_STATE).kind).toBe('tabpfn');
	});

	it('switches to boosting at 200 000 rows with the other answers unchanged', () => {
		const rec = recommend({ rowIndex: rowIndexOf(200000) });
		expect(rec.kind).toBe('boosting');
	});

	it('treats 10 000 rows as the upper bound of the foundation-model range', () => {
		expect(recommend({ rowIndex: rowIndexOf(10000) }).kind).toBe('tabpfn');
	});

	it('uses boosting above 50 000 rows', () => {
		expect(recommend({ rowIndex: rowIndexOf(100000) }).kind).toBe('boosting');
		expect(recommend({ rowIndex: rowIndexOf(500000) }).kind).toBe('boosting');
	});

	it('points raw text or images to a pretrained neural network first', () => {
		expect(recommend({ ...DEFAULT_STATE, raw: true }).kind).toBe('nn-pretrained');
	});

	it('asks for an explainable model when every decision must be explained', () => {
		expect(recommend({ ...DEFAULT_STATE, interpret: true }).kind).toBe('explainable');
	});

	it('prefers trees when half or more of the features are uninformative', () => {
		expect(recommend({ ...DEFAULT_STATE, noise: 50 }).kind).toBe('boosting');
		expect(recommend({ ...DEFAULT_STATE, noise: 40 }).kind).toBe('tabpfn');
	});

	it('does not suggest the foundation model under a strict latency requirement', () => {
		expect(recommend({ ...DEFAULT_STATE, latency: 2 }).kind).toBe('boosting');
		expect(recommend({ ...DEFAULT_STATE, latency: 1 }).kind).toBe('tabpfn');
	});

	it('gives at least one reason for every outcome', () => {
		const variants: Partial<typeof DEFAULT_STATE>[] = [
			DEFAULT_STATE,
			{ raw: true },
			{ interpret: true },
			{ noise: 60 },
			{ rowIndex: rowIndexOf(200000) },
			{ latency: 2 },
		];
		for (const v of variants) {
			expect(recommend(v).reasons.length).toBeGreaterThan(0);
		}
	});
});

describe('normalizeState', () => {
	it('clamps out-of-range values and replaces invalid ones with defaults', () => {
		const s = normalizeState({ rowIndex: 99, latency: 7 as 0, noise: Number.NaN });
		expect(s.rowIndex).toBe(ROW_STEPS.length - 1);
		expect(s.latency).toBe(2);
		expect(s.noise).toBe(0);
	});

	it('rounds the noise to the 10-percent step', () => {
		expect(normalizeState({ noise: 46 }).noise).toBe(50);
	});

	it('returns the default state for empty input', () => {
		expect(normalizeState({})).toEqual(DEFAULT_STATE);
	});
});

describe('formatting', () => {
	it('formats row counts with spaces as thousands separators', () => {
		expect(formatRows(200000)).toBe('200 000');
		expect(formatRows(2000)).toBe('2 000');
	});

	it('maps a slider index to a row count', () => {
		expect(rowsOf(0)).toBe(300);
		expect(rowsOf(2)).toBe(2000);
	});

	it('describes the current choice for the live region', () => {
		expect(describeChoice(DEFAULT_STATE)).toContain('Табличная foundation-модель');
	});
});
