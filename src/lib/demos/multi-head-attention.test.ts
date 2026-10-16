import { describe, expect, it } from 'vitest';
import {
	D_MODEL,
	HEAD_COUNTS,
	TOKEN_COUNT,
	argmaxRow,
	headWeights,
	isHeadCount,
	makeModel,
	matmul,
	mergeHeads,
	shapeInfo,
	snapHeads,
	softmaxRows,
	splitHeads,
	transpose,
} from './multi-head-attention';

const model = makeModel();

describe('splitHeads and mergeHeads', () => {
	it('splits into h heads of width d_model / h and merges back to the same matrix', () => {
		for (const h of HEAD_COUNTS) {
			const heads = splitHeads(model.X, h);
			expect(heads).toHaveLength(h);
			for (const H of heads) {
				expect(H).toHaveLength(TOKEN_COUNT);
				expect(H[0]).toHaveLength(D_MODEL / h);
			}
			expect(mergeHeads(heads)).toEqual(model.X);
		}
	});

	it('head t takes the columns [t·d_k, (t+1)·d_k)', () => {
		const heads = splitHeads(model.X, 4);
		expect(heads[2]?.[1]).toEqual(model.X[1]?.slice(32, 48));
	});
});

describe('headWeights', () => {
	it('every row of every head sums to 1', () => {
		for (const h of HEAD_COUNTS) {
			const A = headWeights(model, h);
			expect(A).toHaveLength(h);
			for (const H of A) {
				expect(H).toHaveLength(TOKEN_COUNT);
				for (const row of H) {
					expect(row.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 10);
				}
			}
		}
	});

	it('with h = 1 the single head equals one-head attention of full width', () => {
		const Q = matmul(model.X, model.WQ);
		const K = matmul(model.X, model.WK);
		const direct = softmaxRows(
			matmul(Q, transpose(K)).map((row) => row.map((v) => v / Math.sqrt(D_MODEL))),
		);
		const [only] = headWeights(model, 1);
		expect(only).toHaveLength(direct.length);
		only?.forEach((row, i) => {
			row.forEach((v, j) => expect(v).toBeCloseTo(direct[i]?.[j] ?? NaN, 10));
		});
	});

	it('the weights stay finite for all head counts', () => {
		for (const h of HEAD_COUNTS) {
			for (const H of headWeights(model, h)) {
				for (const row of H) for (const v of row) expect(Number.isFinite(v)).toBe(true);
			}
		}
	});
});

describe('softmaxRows', () => {
	it('stays finite for large logits (max subtraction)', () => {
		const [row] = softmaxRows([[1000, 1001, 999]]);
		expect(row?.every((v) => Number.isFinite(v))).toBe(true);
		expect(row?.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
	});
});

describe('head counts and shapes', () => {
	it('snapHeads picks the nearest allowed count', () => {
		expect(snapHeads(1)).toBe(1);
		expect(snapHeads(5)).toBe(4);
		expect(snapHeads(7)).toBe(8);
		expect(snapHeads(100)).toBe(8);
		expect(isHeadCount(3)).toBe(false);
		expect(isHeadCount(8)).toBe(true);
	});

	it('the cost of QKᵀ and the parameter count do not depend on h', () => {
		const base = shapeInfo(1);
		for (const h of HEAD_COUNTS) {
			const info = shapeInfo(h);
			expect(info.dk * h).toBe(D_MODEL);
			expect(info.scoreMacs).toBe(base.scoreMacs);
			expect(info.params).toBe(base.params);
		}
		expect(base.params).toBe(4 * D_MODEL * D_MODEL);
	});

	it('argmaxRow returns the first largest index', () => {
		expect(argmaxRow([0.1, 0.5, 0.5, 0.2])).toBe(1);
	});
});
