import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	N_MAX,
	addWithMask,
	applyPatch,
	describeGrid,
	hasTail,
	laneMask,
	lastBlockUseful,
	maskedLanes,
	programCount,
	programLanes,
	snapBlock,
	snapN,
	uncoveredByFloor,
	usefulLanes,
} from './triton-intro';

describe('programCount', () => {
	it('rounds the number of blocks up, as triton.cdiv does', () => {
		expect(programCount(98432, 1024)).toBe(97);
		expect(programCount(10, 4)).toBe(3);
		expect(programCount(8, 4)).toBe(2);
		expect(programCount(1, 4)).toBe(1);
	});
});

describe('masks on the tail block', () => {
	it('keeps the last block partially masked for n = 10, B = 4', () => {
		expect(laneMask(10, 4, 2)).toEqual([true, true, false, false]);
		expect(programLanes(10, 4, 2).map((l) => l.offset)).toEqual([8, 9, 10, 11]);
		expect(usefulLanes(10, 4, 0)).toBe(4);
	});

	it('reports 128 useful lanes in the last block for n = 98432, B = 1024', () => {
		expect(lastBlockUseful(98432, 1024)).toBe(128);
		expect(maskedLanes(98432, 1024)).toBe(896);
	});

	it('masks nothing when n is a multiple of B', () => {
		expect(hasTail(64, 16)).toBe(false);
		expect(maskedLanes(64, 16)).toBe(0);
		expect(laneMask(64, 16, 3).every(Boolean)).toBe(true);
	});

	it('floor division loses the tail, ceil division keeps it', () => {
		expect(uncoveredByFloor(98432, 1024)).toBe(128);
		expect(Math.floor(98432 / 1024)).toBe(96);
	});
});

describe('addWithMask', () => {
	it('matches the elementwise sum for many lengths and block sizes', () => {
		for (const B of [4, 8, 16, 32, 64]) {
			for (let n = 1; n <= 70; n += 3) {
				const x = Array.from({ length: n }, (_, i) => i * 0.5 + 1);
				const y = Array.from({ length: n }, (_, i) => 3 - i);
				const expected = x.map((v, i) => v + (y[i] ?? 0));
				expect(addWithMask(x, y, B)).toEqual(expected);
			}
		}
	});

	it('rejects vectors of different length', () => {
		expect(() => addWithMask([1, 2], [1], 4)).toThrow();
	});
});

describe('snapping and state', () => {
	it('clamps n to the slider range and rounds it', () => {
		expect(snapN(0)).toBe(1);
		expect(snapN(10.4)).toBe(10);
		expect(snapN(10_000)).toBe(N_MAX);
		expect(snapN(Number.NaN)).toBe(DEFAULT_STATE.n);
	});

	it('snaps the block size to the nearest allowed value', () => {
		expect(snapBlock(7)).toBe(8);
		expect(snapBlock(100)).toBe(64);
		expect(snapBlock(Number.NaN)).toBe(32);
	});

	it('applies a partial patch and keeps the other field', () => {
		const next = applyPatch(DEFAULT_STATE, { block: 16 });
		expect(next).toEqual({ n: DEFAULT_STATE.n, block: 16 });
		expect(applyPatch(next, { n: 20 })).toEqual({ n: 20, block: 16 });
	});
});

describe('describeGrid', () => {
	it('names the masked positions when there is a tail', () => {
		expect(describeGrid(10, 4)).toContain('программ 3');
		expect(describeGrid(10, 4)).toContain('замаскировано 2');
	});

	it('says there is no tail when n is a multiple of B', () => {
		expect(describeGrid(64, 16)).toContain('хвоста нет');
	});
});
