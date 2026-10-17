import { describe, expect, it } from 'vitest';
import {
	BLOCKS_DEFAULT,
	BLOCKS_MAX,
	BLOCKS_MIN,
	MAX_THREADS_PER_BLOCK,
	NODE_IDS,
	NODE_INFO,
	SMS_DEFAULT,
	SMS_MAX,
	SMS_MIN,
	THREADS_DEFAULT,
	THREADS_MAX,
	THREADS_MIN,
	WARP_SIZE,
	RESIDENT_MAX,
	describeLaunch,
	divergenceStats,
	hidingTimeline,
	hidingUtilization,
	snapBranch,
	snapResident,
	distributeBlocks,
	isNodeId,
	laneStats,
	snapBlocks,
	snapSms,
	snapThreads,
	wavesFor,
	warpsPerBlock,
} from './gpu-architecture';

describe('warps and lanes', () => {
	it('uses warp size 32 and block limit 1024', () => {
		expect(WARP_SIZE).toBe(32);
		expect(MAX_THREADS_PER_BLOCK).toBe(1024);
	});

	it('rounds a partial warp up', () => {
		expect(warpsPerBlock(1)).toBe(1);
		expect(warpsPerBlock(32)).toBe(1);
		expect(warpsPerBlock(33)).toBe(2);
		expect(warpsPerBlock(100)).toBe(4);
		expect(warpsPerBlock(1024)).toBe(32);
	});

	it('counts idle slots of the last warp', () => {
		expect(laneStats(100)).toEqual({ warps: 4, slots: 128, active: 100, idle: 28 });
		expect(laneStats(96)).toEqual({ warps: 3, slots: 96, active: 96, idle: 0 });
		expect(laneStats(1)).toEqual({ warps: 1, slots: 32, active: 1, idle: 31 });
	});

	it('clamps thread counts to the allowed range', () => {
		expect(snapThreads(0)).toBe(THREADS_MIN);
		expect(snapThreads(5000)).toBe(THREADS_MAX);
		expect(snapThreads(Number.NaN)).toBe(THREADS_DEFAULT);
		expect(snapThreads(undefined)).toBe(THREADS_DEFAULT);
		expect(snapThreads(64.4)).toBe(64);
	});
});

describe('block distribution', () => {
	it('deals blocks round-robin over SMs', () => {
		expect(distributeBlocks(10, 4)).toEqual([3, 3, 2, 2]);
		expect(distributeBlocks(3, 8)).toEqual([1, 1, 1, 0, 0, 0, 0, 0]);
		expect(distributeBlocks(8, 8)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
	});

	it('keeps the total number of blocks', () => {
		for (let b = BLOCKS_MIN; b <= BLOCKS_MAX; b++) {
			for (let s = SMS_MIN; s <= SMS_MAX; s++) {
				const counts = distributeBlocks(b, s);
				expect(counts).toHaveLength(s);
				expect(counts.reduce((a, c) => a + c, 0)).toBe(b);
			}
		}
	});

	it('counts waves as blocks divided by SMs, rounded up', () => {
		expect(wavesFor(10, 4)).toBe(3);
		expect(wavesFor(8, 4)).toBe(2);
		expect(wavesFor(1, 8)).toBe(1);
	});

	it('clamps block and SM counts', () => {
		expect(snapBlocks(0)).toBe(BLOCKS_MIN);
		expect(snapBlocks(99)).toBe(BLOCKS_MAX);
		expect(snapBlocks(undefined)).toBe(BLOCKS_DEFAULT);
		expect(snapSms(0)).toBe(SMS_MIN);
		expect(snapSms(20)).toBe(SMS_MAX);
		expect(snapSms(undefined)).toBe(SMS_DEFAULT);
	});
});

describe('node information', () => {
	it('has an entry with a source for every node', () => {
		for (const id of NODE_IDS) {
			const info = NODE_INFO[id];
			expect(info.id).toBe(id);
			expect(info.figures.length).toBeGreaterThan(0);
			expect(info.sourceUrl).toMatch(/^https:\/\/docs\.nvidia\.com\//);
		}
	});

	it('orders memories from fastest to slowest', () => {
		expect(NODE_INFO.regs.rank).toBeLessThan(NODE_INFO.shared.rank);
		expect(NODE_INFO.shared.rank).toBeLessThan(NODE_INFO.l2.rank);
		expect(NODE_INFO.l2.rank).toBeLessThan(NODE_INFO.dram.rank);
	});

	it('recognises node ids', () => {
		expect(isNodeId('dram')).toBe(true);
		expect(isNodeId('disk')).toBe(false);
		expect(isNodeId(null)).toBe(false);
	});
});

describe('launch description', () => {
	it('mentions idle slots for a partial warp', () => {
		const text = describeLaunch({ threads: 100, sms: 4, blocks: 10 });
		expect(text).toContain('4 варп');
		expect(text).toContain('28 слотов простаивают');
		expect(text).toContain('волн: 3');
	});

	it('reports full warps', () => {
		expect(describeLaunch({ threads: 96, sms: 4, blocks: 4 })).toContain(
			'Все варпы заполнены полностью',
		);
	});
});

describe('divergence and latency hiding', () => {
	it('divergent warp needs two passes', () => {
		expect(divergenceStats(0).passes).toBe(1);
		expect(divergenceStats(32).passes).toBe(1);
		expect(divergenceStats(16)).toEqual({ passes: 2, issuedSlots: 64, utilization: 0.5 });
	});
	it('more resident warps hide more waiting', () => {
		const u1 = hidingUtilization(1);
		const u4 = hidingUtilization(4);
		expect(u4).toBeGreaterThan(u1);
		expect(hidingUtilization(RESIDENT_MAX)).toBe(1);
	});
	it('a single warp idles while it waits', () => {
		const tl = hidingTimeline(1);
		expect(tl.slice(0, 4)).toEqual([0, 0, 0, 0]);
		expect(tl[4]).toBe(-1);
	});
	it('snaps inputs', () => {
		expect(snapBranch(99)).toBe(32);
		expect(snapResident(0)).toBe(1);
	});
});
