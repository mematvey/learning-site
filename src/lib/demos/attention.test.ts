import { describe, expect, it } from 'vitest';
import {
	TOKEN_COUNT,
	arcLabelPos,
	arcPath,
	attentionWeights,
	makeVectors,
	rowOrder,
	snapD,
	sumOf,
} from './attention';

const vectors = makeVectors();

describe('attentionWeights', () => {
	it('every row sums to 1 for scaled and unscaled weights at several d', () => {
		for (const d of [4, 64, 256]) {
			for (const scaled of [true, false]) {
				const A = attentionWeights(vectors, d, scaled);
				expect(A).toHaveLength(TOKEN_COUNT);
				for (const row of A) expect(sumOf(row)).toBeCloseTo(1, 10);
			}
		}
	});

	it('without scaling and at large d the strongest key takes more than 0.9 of a row', () => {
		const A = attentionWeights(vectors, 256, false);
		for (const row of A) expect(Math.max(...(row ?? []))).toBeGreaterThan(0.9);
	});

	it('scaling by 1/sqrt(d) keeps the weights softer than no scaling', () => {
		const scaled = attentionWeights(vectors, 256, true);
		const raw = attentionWeights(vectors, 256, false);
		for (let i = 0; i < TOKEN_COUNT; i++) {
			expect(Math.max(...(scaled[i] ?? []))).toBeLessThan(Math.max(...(raw[i] ?? [])));
		}
	});

	it('is deterministic for the same vectors', () => {
		expect(attentionWeights(makeVectors(), 64, true)).toEqual(attentionWeights(vectors, 64, true));
	});
});

describe('helpers', () => {
	it('snapD clamps to [4, 256] and snaps to steps of 4', () => {
		expect(snapD(1)).toBe(4);
		expect(snapD(66)).toBe(68);
		expect(snapD(999)).toBe(256);
	});

	it('rowOrder puts the strongest key first', () => {
		expect(rowOrder([0.1, 0.6, 0.3])).toEqual([1, 2, 0]);
	});

	it('self-arc is a loop path and other arcs start at the query', () => {
		expect(arcPath(2, 2).startsWith('M')).toBe(true);
		expect(arcPath(0, 5)).toMatch(/^M[\d.]+ 168 Q/);
	});

	it('arc geometry follows the real width of the arcs SVG', () => {
		// Token 0 centre is width / 12 for any width, so the start point scales with the container.
		expect(arcPath(0, 5, 240)).toMatch(/^M20 168 Q/);
		expect(arcLabelPos(0, 0, 240)[0]).toBe(20);
	});
});
