import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	N_MAX,
	N_MIN,
	TILE_OPTIONS,
	applyPatch,
	describeState,
	formatCount,
	readsPerElementNaive,
	readsPerElementTiled,
	reduction,
	snapN,
	snapTile,
	totalReadsNaive,
	totalReadsTiled,
} from './matmul-optimization';

/**
 * Brute-force count of global reads for a tiled product, independent of the formulas:
 * for each output tile, each K-tile loads its in-bounds A and B elements once.
 */
function simulateTiledReads(n: number, tile: number): number {
	let reads = 0;
	for (let I = 0; I < n; I += tile) {
		for (let J = 0; J < n; J += tile) {
			for (let P = 0; P < n; P += tile) {
				for (let i = I; i < Math.min(I + tile, n); i++) {
					for (let k = P; k < Math.min(P + tile, n); k++) reads++; // A[i][k]
				}
				for (let k = P; k < Math.min(P + tile, n); k++) {
					for (let j = J; j < Math.min(J + tile, n); j++) reads++; // B[k][j]
				}
			}
		}
	}
	return reads;
}

/** Brute-force count of the naive product: every output element reads a row of A and a column of B. */
function simulateNaiveReads(n: number): number {
	let reads = 0;
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			for (let k = 0; k < n; k++) reads += 2; // A[i][k] and B[k][j]
		}
	}
	return reads;
}

describe('read counts', () => {
	it('match a brute-force count of loads for small sizes, including sizes not divisible by tile', () => {
		for (const n of [8, 12, 16, 20]) {
			expect(totalReadsNaive(n)).toBe(simulateNaiveReads(n));
			for (const tile of TILE_OPTIONS) {
				expect(totalReadsTiled(n, tile)).toBe(simulateTiledReads(n, tile));
			}
		}
	});

	it('tile 1 is the naive algorithm', () => {
		for (const n of [8, 24, 64]) {
			expect(totalReadsTiled(n, 1)).toBe(totalReadsNaive(n));
			expect(readsPerElementTiled(n, 1)).toBe(readsPerElementNaive(n));
		}
	});

	it('an element is read ceil(n / tile) times', () => {
		expect(readsPerElementTiled(64, 8)).toBe(8);
		expect(readsPerElementTiled(64, 32)).toBe(2);
		expect(readsPerElementTiled(10, 4)).toBe(3);
	});

	it('reduction equals the tile side when the tile divides n, and never exceeds it', () => {
		for (const tile of TILE_OPTIONS) {
			expect(reduction(64, tile)).toBeCloseTo(tile, 10);
			for (const n of [10, 17, 100]) {
				expect(reduction(n, tile)).toBeLessThanOrEqual(tile + 1e-9);
			}
		}
	});

	it('a tile at least as large as n leaves one read per element', () => {
		expect(readsPerElementTiled(8, 32)).toBe(1);
		expect(readsPerElementTiled(8, 8)).toBe(1);
		expect(reduction(8, 32)).toBe(8);
	});
});

describe('snapping and state', () => {
	it('clamps n to its range and snaps it to the step', () => {
		expect(snapN(1)).toBe(N_MIN);
		expect(snapN(1000)).toBe(N_MAX);
		expect(snapN(61)).toBe(64);
		expect(snapN(Number.NaN)).toBe(DEFAULT_STATE.n);
	});

	it('snaps tile to the nearest option', () => {
		expect(snapTile(5)).toBe(4);
		expect(snapTile(100)).toBe(32);
		expect(snapTile(0)).toBe(1);
		expect(snapTile(Number.NaN)).toBe(DEFAULT_STATE.tile);
	});

	it('applyPatch changes only the given fields and ignores bad values', () => {
		const s = applyPatch(DEFAULT_STATE, { tile: 16 });
		expect(s).toEqual({ n: DEFAULT_STATE.n, tile: 16 });
		expect(applyPatch(DEFAULT_STATE, { n: 'big' })).toEqual(DEFAULT_STATE);
		expect(applyPatch(DEFAULT_STATE, {})).toEqual(DEFAULT_STATE);
	});
});

describe('text', () => {
	it('formats counts deterministically with spaces between groups', () => {
		expect(formatCount(2 * 64 ** 3)).toBe('524 288');
		expect(formatCount(999)).toBe('999');
	});

	it('describes the state with the per-element reads and the reduction', () => {
		const text = describeState({ n: 64, tile: 8 });
		expect(text).toContain('читается из глобальной памяти 8 раз вместо 64');
		expect(text).toContain('в 8.0 раза');
	});
});
