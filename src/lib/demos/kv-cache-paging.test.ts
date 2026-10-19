import { describe, expect, it } from 'vitest';
import {
	BLOCK,
	DEFAULT_STATE,
	blocksFor,
	buildLayout,
	describeChange,
	emptySlots,
	makeState,
	type PhysicalBlock,
	snapPrefix,
	snapRequests,
	stepState,
	statsFor,
	staticIdle,
} from '$lib/demos/kv-cache-paging';

describe('block arithmetic', () => {
	it('takes a whole block for a partly filled last block', () => {
		expect(blocksFor(300)).toBe(19);
		expect(emptySlots(300)).toBe(4);
		expect(blocksFor(16)).toBe(1);
		expect(emptySlots(16)).toBe(0);
		expect(blocksFor(0)).toBe(0);
	});

	it('gives the static idle share of the chapter example', () => {
		expect(Math.round(staticIdle(300) * 100)).toBe(85);
	});

	it('keeps the empty part of the last block below BLOCK', () => {
		for (let t = 1; t <= 200; t++) {
			expect(emptySlots(t)).toBeGreaterThanOrEqual(0);
			expect(emptySlots(t)).toBeLessThan(BLOCK);
		}
	});
});

describe('default state matches the chapter', () => {
	const layout = buildLayout(DEFAULT_STATE);
	const stats = statsFor(DEFAULT_STATE);
	const blockOf = (id: number | undefined): PhysicalBlock => {
		const b = id === undefined ? undefined : layout.blocks[id];
		if (!b) throw new Error('no block ' + id);
		return b;
	};

	it('has 15 blocks with sharing and 27 without', () => {
		expect(stats.withShare).toBe(15);
		expect(stats.withoutShare).toBe(27);
		expect(stats.saved).toBe(12);
		expect(Math.round(stats.savedPct * 100)).toBe(44);
	});

	it('shares 6 prefix blocks across all 3 requests', () => {
		expect(stats.sharedBlocks).toBe(6);
		for (const table of layout.tables) {
			expect(table.slice(0, 6)).toEqual([0, 1, 2, 3, 4, 5]);
			expect(table).toHaveLength(9);
		}
	});

	it('fills 8 slots in the last tail block of each request', () => {
		for (const table of layout.tables) {
			const last = blockOf(table[table.length - 1]);
			expect(last.slots.filter((k) => k !== 'empty')).toHaveLength(8);
			expect(last.slots.filter((k) => k === 'empty')).toHaveLength(8);
		}
		expect(stats.emptySlots).toBe(3 * 8);
	});
});

describe('block tables', () => {
	it('gives every request its own private blocks when sharing is off', () => {
		const layout = buildLayout({ ...DEFAULT_STATE, share: false });
		const ids = layout.tables.flat();
		expect(new Set(ids).size).toBe(ids.length);
		expect(layout.blocks.some((b) => b.shared)).toBe(false);
	});

	it('keeps a partial prefix block private', () => {
		const stats = statsFor({ requests: 2, prefix: 100, tail: 0, share: true });
		// 6 full shared blocks, then 4 prefix tokens in a private block per request.
		expect(stats.sharedBlocks).toBe(6);
		expect(stats.withShare).toBe(6 + 2);
		expect(stats.withoutShare).toBe(14);
	});

	it('matches the single-request count when there is one request', () => {
		const s = statsFor({ requests: 1, prefix: 96, tail: 40, share: true });
		expect(s.withShare).toBe(s.withoutShare);
	});
});

describe('state handling', () => {
	it('snaps and clamps input', () => {
		expect(snapRequests(0)).toBe(1);
		expect(snapRequests(99)).toBe(6);
		expect(snapPrefix(101)).toBe(104);
		expect(snapPrefix(Number.NaN)).toBe(DEFAULT_STATE.prefix);
		expect(makeState({ requests: 2 })).toEqual({ ...DEFAULT_STATE, requests: 2 });
	});

	it('steps controls and stops at the limits', () => {
		const max = stepState({ ...DEFAULT_STATE, requests: 6 }, 'requests', 1);
		expect(max.requests).toBe(6);
		const tail = stepState(DEFAULT_STATE, 'tail', 1);
		expect(tail.tail).toBe(48);
	});
});

describe('describeChange', () => {
	it('says nothing when nothing changed', () => {
		expect(describeChange(DEFAULT_STATE, { ...DEFAULT_STATE })).toBe('');
	});

	it('explains that a short tail step adds no block', () => {
		const text = describeChange(DEFAULT_STATE, { ...DEFAULT_STATE, tail: 48 });
		expect(text).toContain('не прибавилось');
		expect(text).toContain('свободные слоты');
	});

	it('explains that a full last block needs a new one', () => {
		const text = describeChange(DEFAULT_STATE, { ...DEFAULT_STATE, tail: 56 });
		expect(text).toContain('15 → 18');
	});

	it('explains the sharing toggle with both counts', () => {
		const text = describeChange(DEFAULT_STATE, { ...DEFAULT_STATE, share: false });
		expect(text).toContain('Разделение выключено');
		expect(text).toContain('15 → 27');
	});
});
