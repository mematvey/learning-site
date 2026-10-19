import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	activationsGb,
	budget,
	explain,
	formatGb,
	sanitize,
	statesParts,
	storedLayers,
	verdict,
	type TrainingMemoryDemoState,
} from './training-memory';

const state = (patch: Partial<TrainingMemoryDemoState> = {}): TrainingMemoryDemoState => ({
	...DEFAULT_STATE,
	...patch,
});

const sum = (p: { weights: number; grads: number; optimizer: number }) =>
	p.weights + p.grads + p.optimizer;

describe('states per card', () => {
	it('Adam with mixed precision costs 16 bytes per parameter: 112 GB for 7 billion, no sharding', () => {
		expect(sum(statesParts(7, 0, 1))).toBeCloseTo(112, 10);
		expect(sum(statesParts(7, 0, 8))).toBeCloseTo(112, 10);
	});

	it('ZeRO-3 divides all states by N: 14 GB per card for 7 billion on 8 cards', () => {
		expect(sum(statesParts(7, 3, 8))).toBeCloseTo(14, 10);
	});

	it('ZeRO-1 and ZeRO-2 give 38.5 and 26.25 GB per card on 8 cards', () => {
		expect(sum(statesParts(7, 1, 8))).toBeCloseTo(38.5, 10);
		expect(sum(statesParts(7, 2, 8))).toBeCloseTo(26.25, 10);
	});

	it('the ZeRO paper example (7.5 billion, 64 cards) gives about 1.9 GB with ZeRO-3', () => {
		expect(sum(statesParts(7.5, 0, 1))).toBeCloseTo(120, 10);
		expect(sum(statesParts(7.5, 3, 64))).toBeCloseTo(1.875, 10);
	});

	it('the number of cards does nothing without sharding', () => {
		expect(statesParts(7, 0, 64)).toEqual(statesParts(7, 0, 1));
	});
});

describe('activations', () => {
	it('L·k·b·s·h gives about 5.4 GB for the defaults (32 layers, batch 1, length 2048, width 4096)', () => {
		expect(activationsGb(32, 1, 2048, 4096, false)).toBeCloseTo(5.369, 3);
	});

	it('batch 8 gives about 43 GB and does not change the states', () => {
		const a = budget(state({ batch: 8 }));
		expect(a.activations).toBeCloseTo(42.95, 1);
		expect(a.states).toBeCloseTo(112, 10);
	});

	it('checkpointing keeps about 2·√L layers: 11 of 32, about 2.8 times fewer activations', () => {
		expect(storedLayers(32, true)).toBeCloseTo(11.31, 2);
		expect(storedLayers(32, false) / storedLayers(32, true)).toBeCloseTo(2.83, 2);
	});

	it('checkpointing never stores more layers than there are', () => {
		expect(storedLayers(1, true)).toBe(1);
	});

	it('sharding does not change activations', () => {
		expect(budget(state({ shard: 3, cards: 8 })).activations).toBeCloseTo(
			budget(state()).activations,
			10,
		);
	});
});

describe('verdict and OOM', () => {
	it('the defaults do not fit an 80 GB card: 117.4 GB total', () => {
		const b = budget(state());
		expect(b.total).toBeCloseTo(117.37, 1);
		expect(b.fits).toBe(false);
		expect(verdict(b)).toContain('OOM');
	});

	it('ZeRO-3 on 8 cards fits the same card', () => {
		const b = budget(state({ shard: 3, cards: 8 }));
		expect(b.total).toBeCloseTo(19.37, 1);
		expect(b.fits).toBe(true);
		expect(verdict(b)).toContain('помещается');
	});

	it('the chart scale is at least the card limit and at least the total', () => {
		const b = budget(state());
		expect(b.scaleMax).toBeCloseTo(b.total, 10);
		expect(budget(state({ shard: 3, cards: 8 })).scaleMax).toBe(80);
	});
});

describe('explanations', () => {
	it('say that without sharding the card count does not matter', () => {
		const s = state({ cards: 8, shard: 0 });
		expect(explain(s, budget(s))[0]).toContain('число карт на них не влияет');
	});

	it('name the sharded parts for each stage', () => {
		const s = state({ cards: 8, shard: 2 });
		expect(explain(s, budget(s))[0]).toContain('оптимизатор и градиенты');
	});
});

describe('sanitize', () => {
	it('returns the defaults for an empty patch', () => {
		expect(sanitize({})).toEqual(DEFAULT_STATE);
	});

	it('clamps numbers, snaps options and drops invalid shard stages', () => {
		const s = sanitize({
			params: 500,
			layers: 0,
			width: 4100,
			seqLen: 3000,
			batch: 2.4,
			cards: 5,
			shard: 7 as never,
			cardGb: 30,
		});
		expect(s.params).toBe(70);
		expect(s.layers).toBe(1);
		expect(s.width).toBe(4096);
		expect(s.seqLen).toBe(2048);
		expect(s.batch).toBe(2);
		expect(s.cards).toBe(4);
		expect(s.shard).toBe(0);
		expect(s.cardGb).toBe(24);
	});

	it('formats GB with a decimal comma', () => {
		expect(formatGb(112)).toBe('112,0');
	});
});
