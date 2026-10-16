import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	WARP_SIZE,
	analyse,
	applyPatch,
	describeAccess,
	efficiencyPercent,
	snapOffset,
	snapStride,
	transactions,
	warpAccesses,
	type CoalescingDemoState,
	type SegmentBytes,
} from './memory-coalescing';

const st = (stride: number, offset = 0, segmentBytes: SegmentBytes = 128): CoalescingDemoState => ({
	stride,
	offset,
	segmentBytes,
});

describe('warpAccesses and transactions', () => {
	it('stride 1 from an aligned base fills one 128-byte segment', () => {
		const a = analyse(st(1));
		expect(a.transactionCount).toBe(1);
		expect(a.transactions[0]?.lanes).toHaveLength(WARP_SIZE);
		expect(a.efficiency).toBe(1);
	});

	it('stride 2 spreads the warp over two segments, half the bytes are useful', () => {
		const a = analyse(st(2));
		expect(a.transactionCount).toBe(2);
		expect(a.efficiency).toBe(0.5);
	});

	it('stride 32 gives one segment per thread', () => {
		const a = analyse(st(32));
		expect(a.transactionCount).toBe(32);
		expect(a.efficiency).toBeCloseTo(1 / 32, 10);
		for (const tr of a.transactions) expect(tr.lanes).toHaveLength(1);
	});

	it('efficiency for strides 1..32 with 128-byte segments follows 1 / min(stride, 32)', () => {
		const effs = [1, 2, 4, 8, 16, 32].map((s) => analyse(st(s)).efficiency);
		expect(effs).toEqual([1, 0.5, 0.25, 0.125, 0.0625, 0.03125]);
	});

	it('a misaligned start (offset 1) splits a contiguous warp into two transactions', () => {
		const a = analyse(st(1, 1));
		expect(a.transactionCount).toBe(2);
		expect(a.efficiency).toBe(0.5);
	});

	it('32-byte segments need four transactions for contiguous data', () => {
		const a = analyse(st(1, 0, 32));
		expect(a.minTransactions).toBe(4);
		expect(a.transactionCount).toBe(4);
		expect(a.efficiency).toBe(1);
	});

	it('the minimum transaction count is the same bytes packed into aligned segments', () => {
		expect(analyse(st(1, 0, 128)).minTransactions).toBe(1);
		expect(analyse(st(4, 0, 128)).minTransactions).toBe(1);
	});

	it('cell slots are unique inside each transaction and every thread is served once', () => {
		for (const segmentBytes of [32, 128] as const) {
			for (let stride = 1; stride <= 32; stride++) {
				for (let offset = 0; offset <= 31; offset += 5) {
					const a = analyse(st(stride, offset, segmentBytes));
					const seen = new Set<number>();
					for (const tr of a.transactions) {
						const cells = new Set(tr.lanes.map((l) => l.cell));
						expect(cells.size).toBe(tr.lanes.length);
						for (const l of tr.lanes) {
							expect(l.cell).toBeGreaterThanOrEqual(0);
							expect(l.cell).toBeLessThan(a.cellsPerSegment);
							seen.add(l.thread);
						}
					}
					expect(seen.size).toBe(WARP_SIZE);
					expect(a.movedBytes).toBeGreaterThanOrEqual(a.usefulBytes);
				}
			}
		}
	});

	it('transactions are numbered by increasing address', () => {
		const trs = transactions(warpAccesses(3, 0, 128));
		expect(trs.map((t) => t.index)).toEqual(trs.map((_, i) => i));
		for (let i = 1; i < trs.length; i++) {
			expect(trs[i]!.segment).toBeGreaterThan(trs[i - 1]!.segment);
		}
	});
});

describe('snapping and patches', () => {
	it('clamps stride and offset, and falls back to defaults for non-numbers', () => {
		expect(snapStride(0)).toBe(1);
		expect(snapStride(100)).toBe(32);
		expect(snapStride(Number.NaN)).toBe(DEFAULT_STATE.stride);
		expect(snapOffset(-3)).toBe(0);
		expect(snapOffset(99)).toBe(31);
		expect(snapOffset(undefined)).toBe(DEFAULT_STATE.offset);
	});

	it('applyPatch changes only the given fields and ignores an unknown segment size', () => {
		const next = applyPatch(DEFAULT_STATE, { stride: 8 });
		expect(next).toEqual({ ...DEFAULT_STATE, stride: 8 });
		const bad = applyPatch(DEFAULT_STATE, { segmentBytes: 64 as unknown as SegmentBytes });
		expect(bad.segmentBytes).toBe(DEFAULT_STATE.segmentBytes);
	});
});

describe('analyse and text', () => {
	it('is deterministic for the same state', () => {
		expect(analyse(st(5, 3))).toEqual(analyse(st(5, 3)));
	});

	it('efficiency is shown as a percent with one decimal', () => {
		expect(efficiencyPercent(1)).toBe(100);
		expect(efficiencyPercent(0.5)).toBe(50);
		expect(efficiencyPercent(1 / 32)).toBe(3.1);
	});

	it('the description mentions the transaction count and the useful share', () => {
		const text = describeAccess(st(2));
		expect(text).toContain('транзакций 2');
		expect(text).toContain('50%');
	});
});
