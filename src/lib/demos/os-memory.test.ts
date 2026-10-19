import { describe, expect, it } from 'vitest';
import type { AccessResult } from './os-memory';
import {
	DEFAULT_ADDR,
	countStats,
	describeLoop,
	hex,
	joinAddress,
	loopAccesses,
	pageTableBytes,
	pageTableEntries,
	pageUniverse,
	parseAddress,
	residentAt,
	simulate,
	snapFrames,
	snapLoop,
	splitAddress,
	translate,
} from './os-memory';

describe('address split', () => {
	it('splits 0x12345678 into page 0x12345 and offset 0x678 for 4 KB pages', () => {
		expect(splitAddress(0x12345678)).toEqual({ page: 0x12345, offset: 0x678 });
		expect(splitAddress(DEFAULT_ADDR)).toEqual({ page: 0x12345, offset: 0x678 });
	});

	it('keeps the offset when the frame changes', () => {
		expect(joinAddress(0, 0x678)).toBe(0x678);
		expect(joinAddress(3, 0x678)).toBe(3 * 4096 + 0x678);
	});

	it('parses hex with or without the prefix and rejects bad input', () => {
		expect(parseAddress('0x12345678')).toBe(0x12345678);
		expect(parseAddress(' 12345678 ')).toBe(0x12345678);
		expect(parseAddress('0xFFFFFFFF')).toBe(0xffffffff);
		expect(parseAddress('0x100000000')).toBeNull();
		expect(parseAddress('0x')).toBeNull();
		expect(parseAddress('xyz')).toBeNull();
		expect(parseAddress('')).toBeNull();
	});

	it('formats hex with zero padding', () => {
		expect(hex(0x678, 8)).toBe('0x00000678');
		expect(hex(0x12345)).toBe('0x12345');
	});
});

describe('page table size', () => {
	it('has 2^20 entries and 4 MiB for a 32-bit address with 4 KB pages and 4-byte entries', () => {
		expect(pageTableEntries(32)).toBe(2 ** 20);
		expect(pageTableBytes(32)).toBe(4 * 1024 * 1024);
	});

	it('has 2^36 entries for a 48-bit address', () => {
		expect(pageTableEntries(48)).toBe(2 ** 36);
	});
});

describe('translate', () => {
	it('gives the physical address when the page is in RAM', () => {
		const t = translate(0x12345678, [{ page: 0x12345, frame: 2 }]);
		expect(t.frame).toBe(2);
		expect(t.physical).toBe(2 * 4096 + 0x678);
	});

	it('gives no frame when the page is not in RAM', () => {
		const t = translate(0x12345678, [{ page: 0, frame: 0 }]);
		expect(t.frame).toBeNull();
		expect(t.physical).toBeNull();
	});
});

/** Access result at index i; fails the test when the index is out of range. */
function at(steps: AccessResult[], i: number): AccessResult {
	const s = steps[i];
	if (!s) throw new Error(`no step ${i}`);
	return s;
}

describe('simulate (demand paging, LRU)', () => {
	it('a page is a fault on its first access and a hit afterwards', () => {
		const steps = simulate([7, 7, 7], 4);
		expect(steps.map((s) => s.fault)).toEqual([true, false, false]);
		expect(at(steps, 0).frame).toBe(0);
	});

	it('uses the lowest free frame first', () => {
		const steps = simulate([5, 9, 2], 4);
		expect(steps.map((s) => s.frame)).toEqual([0, 1, 2]);
	});

	it('evicts the least recently used page when no frame is free', () => {
		// frames 2: 1 -> f0, 2 -> f1, 3 evicts 1 (oldest), reuses f0
		const steps = simulate([1, 2, 3], 2);
		expect(at(steps, 2).fault).toBe(true);
		expect(at(steps, 2).evicted).toBe(1);
		expect(at(steps, 2).frame).toBe(0);
	});

	it('a hit refreshes recency, so another page is evicted', () => {
		// 1 -> f0, 2 -> f1, hit on 1 (now 2 is the oldest), 3 evicts 2
		const steps = simulate([1, 2, 1, 3], 2);
		expect(at(steps, 2).fault).toBe(false);
		expect(at(steps, 3).evicted).toBe(2);
		expect(at(steps, 3).frame).toBe(1);
	});

	it('a loop of 5 pages in 4 frames faults on every access', () => {
		const steps = simulate(loopAccesses(5, 3), 4);
		expect(countStats(steps)).toEqual({ accesses: 15, faults: 15, hits: 0 });
	});

	it('the example from the text: 40 pages in a loop, 32 frames, every access faults', () => {
		const steps = simulate(loopAccesses(40, 2), 32);
		expect(countStats(steps).faults).toBe(80);
	});

	it('a loop that fits into RAM faults only on the first pass', () => {
		const steps = simulate(loopAccesses(4, 3), 4);
		expect(countStats(steps)).toEqual({ accesses: 12, faults: 4, hits: 8 });
	});

	it('residentAt returns the pages after pos accesses', () => {
		const steps = simulate([1, 2, 3], 2);
		expect(residentAt(steps, 0)).toEqual([]);
		expect(residentAt(steps, 2)).toEqual([
			{ page: 1, frame: 0 },
			{ page: 2, frame: 1 },
		]);
	});

	it('pageUniverse merges the address page, the loop pages and the accessed pages', () => {
		expect(pageUniverse(0x12345, 3, [7])).toEqual([0, 1, 2, 7, 0x12345]);
		expect(pageUniverse(null, 2, [])).toEqual([0, 1]);
	});
});

describe('texts and clamps', () => {
	it('describes a loop that does not fit as a fault on every access', () => {
		expect(describeLoop(4, 5)).toContain('каждое обращение');
		expect(describeLoop(4, 4)).toContain('прерываний нет');
	});

	it('clamps the sliders', () => {
		expect(snapFrames(0)).toBe(1);
		expect(snapFrames(99)).toBe(8);
		expect(snapLoop(Number.NaN)).toBe(5);
		expect(snapLoop(1)).toBe(2);
	});
});
