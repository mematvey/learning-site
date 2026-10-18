import { describe, expect, it } from 'vitest';
import {
	BYTES_PER_PARAM,
	CARD_COUNTS,
	DEFAULT_STATE,
	GPU_MEMORY_GB,
	STRATEGIES,
	bubbleFraction,
	describeBubble,
	describeMemory,
	memoryRows,
	percent,
	pipelineGrid,
	snapCards,
	snapMicro,
	snapParams,
	snapStages,
	stateGbPerGpu,
} from './distributed-training';

describe('model state bytes', () => {
	it('takes 16 bytes per parameter: 2 weights + 2 gradients + 12 optimizer', () => {
		expect(BYTES_PER_PARAM).toBe(16);
	});

	it('gives 112 GB for 7B parameters without sharding, and 14 GB on 8 GPUs with full sharding', () => {
		expect(stateGbPerGpu('dp', 7, 1)).toBeCloseTo(112, 10);
		expect(stateGbPerGpu('zero3', 7, 8)).toBeCloseTo(14, 10);
		expect(stateGbPerGpu('tensor', 7, 8)).toBeCloseTo(14, 10);
		expect(stateGbPerGpu('pipeline', 7, 8)).toBeCloseTo(14, 10);
	});

	it('matches the ZeRO paper example: 7.5B on 64 GPUs gives about 1.9 GB, data parallel about 120 GB', () => {
		expect(stateGbPerGpu('zero3', 7.5, 64)).toBeCloseTo(1.875, 10);
		expect(stateGbPerGpu('dp', 7.5, 64)).toBeCloseTo(120, 10);
	});

	it('gives the same memory for every strategy on one GPU', () => {
		for (const s of STRATEGIES) {
			expect(stateGbPerGpu(s.id, 7, 1)).toBeCloseTo(112, 10);
		}
	});

	it('computes the ZeRO stages on 8 GPUs: 38.5, 26.25 and 14 GB for 7B', () => {
		expect(stateGbPerGpu('zero1', 7, 8)).toBeCloseTo(38.5, 10);
		expect(stateGbPerGpu('zero2', 7, 8)).toBeCloseTo(26.25, 10);
		expect(stateGbPerGpu('zero3', 7, 8)).toBeCloseTo(14, 10);
	});

	it('never grows when a ZeRO stage is added or when GPUs are added', () => {
		for (const n of CARD_COUNTS) {
			const dp = stateGbPerGpu('dp', 13, n);
			const z1 = stateGbPerGpu('zero1', 13, n);
			const z2 = stateGbPerGpu('zero2', 13, n);
			const z3 = stateGbPerGpu('zero3', 13, n);
			expect(z1).toBeLessThanOrEqual(dp);
			expect(z2).toBeLessThanOrEqual(z1);
			expect(z3).toBeLessThanOrEqual(z2);
		}
		for (let i = 1; i < CARD_COUNTS.length; i++) {
			expect(stateGbPerGpu('zero3', 13, CARD_COUNTS[i] ?? 0)).toBeLessThan(
				stateGbPerGpu('zero3', 13, CARD_COUNTS[i - 1] ?? 0),
			);
		}
	});

	it('marks a row as not fitting when it is above the GPU memory', () => {
		const rows = memoryRows(7, 8);
		expect(rows.find((r) => r.id === 'dp')?.fits).toBe(false);
		expect(rows.find((r) => r.id === 'zero3')?.fits).toBe(true);
		expect(GPU_MEMORY_GB).toBe(80);
	});

	it('gives the default state an 8-GPU memory chart that matches the chapter numbers', () => {
		const rows = memoryRows(DEFAULT_STATE.paramsB, DEFAULT_STATE.cards);
		expect(rows.find((r) => r.id === 'dp')?.gb).toBeCloseTo(112, 10);
		expect(rows.find((r) => r.id === 'zero3')?.gb).toBeCloseTo(14, 10);
	});
});

describe('pipeline bubble', () => {
	it('matches the chapter: 4 stages with 4 microbatches about 43 %, with 32 about 9 %', () => {
		expect(percent(bubbleFraction(4, 4))).toBe(43);
		expect(percent(bubbleFraction(4, 32))).toBe(9);
		expect(percent(bubbleFraction(4, 16))).toBe(16);
	});

	it('is zero with one stage and falls as microbatches grow', () => {
		expect(bubbleFraction(1, 8)).toBe(0);
		expect(bubbleFraction(4, 8)).toBeGreaterThan(bubbleFraction(4, 16));
		expect(bubbleFraction(4, 16)).toBeGreaterThan(bubbleFraction(4, 32));
	});

	it('gives the same idle share in the grid as the formula', () => {
		for (const [p, m] of [
			[2, 1],
			[4, 4],
			[8, 3],
			[16, 32],
		] as const) {
			const grid = pipelineGrid(p, m);
			const cells = grid.length * (grid[0]?.length ?? 0);
			const busy = grid.flat().filter(Boolean).length;
			expect(busy).toBe(p * m);
			expect(1 - busy / cells).toBeCloseTo(bubbleFraction(p, m), 10);
		}
	});

	it('starts stage s only after stage s - 1, the diagonal shape of the schedule', () => {
		const grid = pipelineGrid(3, 2);
		expect(grid[0]?.[0]).toBe(true);
		expect(grid[1]?.[0]).toBe(false);
		expect(grid[1]?.[1]).toBe(true);
		expect(grid[2]?.[2]).toBe(true);
		expect(grid[2]?.[1]).toBe(false);
	});
});

describe('snapping and text', () => {
	it('snaps inputs to the allowed values', () => {
		expect(snapParams(7.4)).toBe(7);
		expect(snapParams(500)).toBe(70);
		expect(snapParams(Number.NaN)).toBe(7);
		expect(snapCards(5)).toBe(4);
		expect(snapCards(100)).toBe(64);
		expect(snapCards(Number.NaN)).toBe(8);
		expect(snapStages(1)).toBe(2);
		expect(snapStages(99)).toBe(16);
		expect(snapMicro(0)).toBe(1);
		expect(snapMicro(40)).toBe(32);
		expect(snapMicro(Number.POSITIVE_INFINITY)).toBe(4);
	});

	it('describes the memory with computed numbers', () => {
		const text = describeMemory(7, 8);
		expect(text).toContain('112.0 ГБ');
		expect(text).toContain('14.0 ГБ');
		expect(text).toContain('не влезает');
	});

	it('describes the bubble with computed numbers', () => {
		expect(describeBubble(4, 4)).toContain('43 %');
	});
});
