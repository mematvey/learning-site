import { describe, expect, it } from 'vitest';
import { checkpoints, runSimulation } from './simulate';

describe('checkpoints', () => {
	it('is ascending, unique, ends with trials and has about 150 points', () => {
		const cps = checkpoints(1_000_000);
		expect(cps.at(-1)).toBe(1_000_000);
		expect(cps.at(0)).toBe(1);
		expect(cps.length).toBeLessThanOrEqual(150);
		expect(cps.length).toBeGreaterThan(100);
		cps.slice(1).forEach((v, i) => expect(v).toBeGreaterThan(cps[i] ?? 0));
	});
});

describe('runSimulation', () => {
	it('runs all trials in chunks and reports progress', async () => {
		const progress: number[] = [];
		const handle = runSimulation({
			trials: 3000,
			chunk: 500,
			seed: 1,
			trial: (rng) => ({ a: rng() < 0.5 }),
			onProgress: (s) => progress.push(s.trials),
		});
		const state = await handle.done;
		expect(state.trials).toBe(3000);
		expect(state.running).toBe(false);
		expect(progress.length).toBeGreaterThanOrEqual(6);
		expect(state.series.a?.at(-1)?.[0]).toBe(3000);
		expect(state.series.a?.at(-1)?.[1]).toBeCloseTo((state.hits.a ?? 0) / 3000, 12);
	});

	it('stops early on cancel and resolves with the partial state', async () => {
		const handle = runSimulation({
			trials: 1_000_000,
			chunk: 1000,
			seed: 2,
			trial: (rng) => ({ a: rng() < 0.5 }),
		});
		handle.cancel();
		const state = await handle.done;
		expect(state.trials).toBeLessThan(1_000_000);
		expect(state.running).toBe(false);
	});

	it('rejects an invalid number of trials', () => {
		expect(() => runSimulation({ trials: 0, trial: () => ({}) })).toThrow(RangeError);
	});
});
