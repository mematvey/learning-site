import { describe, expect, it } from 'vitest';
import {
	DEFAULTS,
	HIT_NS,
	MISS_NS,
	applyPatch,
	cacheLines,
	clampStep,
	estimateTimeNs,
	formatTime,
	simulate,
	traversal,
	traversalStats,
	visitPositions,
} from './memory-cache';

describe('traversal order', () => {
	it('visits rows left to right, or columns top to bottom', () => {
		expect(traversal(2, 'row')).toEqual([0, 1, 2, 3]);
		expect(traversal(2, 'col')).toEqual([0, 2, 1, 3]);
	});

	it('gives every element exactly one visit position', () => {
		const pos = visitPositions(3, 'col');
		expect([...pos].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
		expect(pos[0]).toBe(0);
		expect(pos[3]).toBe(1);
	});
});

describe('LRU simulation', () => {
	it('evicts the least recently used line', () => {
		// Two lines of one element each: lines 0, 1, 0, 2, 1.
		const hits = simulate([0, 1, 0, 2, 1], 16, 8);
		expect(hits).toEqual([false, false, true, false, false]);
	});

	it('row traversal misses once per line, whatever the cache size', () => {
		const n = 64;
		const row = traversalStats(n, 'row', 512, 64);
		expect(row.misses).toBe((n * n) / (64 / 8));
		expect(traversalStats(n, 'row', 16384, 64).misses).toBe(row.misses);
	});

	it('column traversal misses every access when the cache holds fewer than n lines', () => {
		// 32 lines of 64 bytes, while one column touches 64 different lines: LRU thrashes.
		const col = traversalStats(64, 'col', 2048, 64);
		expect(col.misses).toBe(64 * 64);
		expect(col.missRate).toBe(1);
	});

	it('column traversal reuses lines when the cache holds n lines', () => {
		// 64 lines of 64 bytes: each group of 8 columns shares the same 64 lines.
		const col = traversalStats(64, 'col', 4096, 64);
		expect(col.misses).toBe(512);
	});

	it('is deterministic for the same input', () => {
		const a = traversalStats(32, 'col', 1024, 32);
		const b = traversalStats(32, 'col', 1024, 32);
		expect(a.misses).toBe(b.misses);
		expect(a.hits).toEqual(b.hits);
	});
});

describe('time estimate', () => {
	it('charges hits and misses separately', () => {
		expect(estimateTimeNs(10, 0)).toBe(10 * HIT_NS);
		expect(estimateTimeNs(10, 10)).toBe(10 * MISS_NS);
		expect(estimateTimeNs(4096, 512)).toBe(3584 * HIT_NS + 512 * MISS_NS);
	});

	it('formats time in ns, mcs and ms', () => {
		expect(formatTime(500)).toBe('500 нс');
		expect(formatTime(44544)).toBe('44.5 мкс');
		expect(formatTime(2_500_000)).toBe('2.50 мс');
	});
});

describe('state', () => {
	it('computes the number of cache lines with at least one line', () => {
		expect(cacheLines(2048, 64)).toBe(32);
		expect(cacheLines(16, 128)).toBe(1);
	});

	it('clamps the step to the matrix size', () => {
		expect(clampStep(9999, 16)).toBe(256);
		expect(clampStep(-5, 16)).toBe(0);
		expect(clampStep(Number.NaN, 16)).toBe(256);
	});

	it('snaps options to the nearest allowed value and keeps unknown values', () => {
		const st = applyPatch(DEFAULTS, { n: 50, cacheBytes: 3000, lineBytes: 100, order: 'row' });
		expect(st.n).toBe(48);
		expect(st.cacheBytes).toBe(2048);
		expect(st.lineBytes).toBe(128);
		expect(st.order).toBe('row');
		expect(applyPatch(DEFAULTS, { order: 'diag' as never }).order).toBe(DEFAULTS.order);
	});

	it('clamps the step when the matrix gets smaller', () => {
		const st = applyPatch(DEFAULTS, { n: 16 });
		expect(st.step).toBe(256);
	});
});
