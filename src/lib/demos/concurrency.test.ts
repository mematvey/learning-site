import { describe, expect, it } from 'vitest';
import {
	amdahl,
	amdahlLimit,
	canStep,
	createRun,
	explain,
	formatRu,
	isWaiting,
	lossStats,
	runRandom,
	stepThread,
	clampP,
	type RunState,
} from './concurrency';

/** Runs the given thread indices in order, one step each. */
function play(run: RunState, order: number[]): RunState {
	return order.reduce((cur, t) => stepThread(cur, t), run);
}

describe('race on the counter without a lock', () => {
	it('loses one update when both threads read 0 before either writes', () => {
		// A: LOAD, B: LOAD, A: LOAD_CONST, A: BINARY_OP, A: STORE, B: ..., B: STORE
		const run = play(createRun(2, false), [0, 1, 0, 0, 0, 1, 1, 1]);
		expect(run.counter).toBe(1);
		expect(explain(run)).toContain('итог 1 вместо 2');
	});

	it('gives 2 for the sequential order A then B', () => {
		const run = play(createRun(2, false), [0, 0, 0, 0, 1, 1, 1, 1]);
		expect(run.counter).toBe(2);
	});

	it('marks the store that overwrites a newer value as stale', () => {
		const run = play(createRun(2, false), [0, 1, 0, 0, 0, 1, 1, 1]);
		const stale = run.log.filter((e) => e.stale);
		expect(stale).toHaveLength(1);
		expect(stale[0]?.thread).toBe(1);
	});

	it('finishes with a random schedule and keeps the counter within [0, N]', () => {
		let seed = 7;
		const rand = () => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};
		for (let i = 0; i < 50; i++) {
			const done = runRandom(createRun(4, false), rand);
			expect(done.counter).toBeGreaterThanOrEqual(1);
			expect(done.counter).toBeLessThanOrEqual(4);
		}
	});

	it('shows losses growing with the number of threads', () => {
		const two = lossStats(2, 2000, 42);
		const four = lossStats(4, 2000, 42);
		expect(two.meanLost).toBeGreaterThan(0);
		expect(four.meanLost).toBeGreaterThan(two.meanLost);
	});
});

describe('lock', () => {
	it('blocks a second thread at its first step while the first holds the lock', () => {
		const run = play(createRun(2, true), [0]);
		expect(run.holder).toBe(0);
		expect(isWaiting(run, 1)).toBe(true);
		expect(canStep(run, 1)).toBe(false);
		expect(explain(run)).toContain('ждёт блокировку');
	});

	it('releases the lock after STORE_GLOBAL', () => {
		const run = play(createRun(2, true), [0, 0, 0, 0]);
		expect(run.holder).toBeNull();
		expect(canStep(run, 1)).toBe(true);
	});

	it('gives the expected total for every random schedule', () => {
		let seed = 3;
		const rand = () => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};
		for (let i = 0; i < 50; i++) {
			const done = runRandom(createRun(4, true), rand);
			expect(done.counter).toBe(4);
		}
	});

	it('ignores steps that are not allowed', () => {
		const run = play(createRun(2, true), [0]);
		expect(stepThread(run, 1)).toBe(run);
	});
});

describe('Amdahl law', () => {
	it('matches the table for p = 0.9', () => {
		expect(formatRu(amdahl(0.9, 2))).toBe('1,82');
		expect(formatRu(amdahl(0.9, 4))).toBe('3,08');
		expect(formatRu(amdahl(0.9, 8))).toBe('4,71');
		expect(formatRu(amdahl(0.9, 16))).toBe('6,40');
		expect(formatRu(amdahl(0.9, 1))).toBe('1,00');
	});

	it('gives about 9.2 for 100 cores and approaches the limit 10', () => {
		expect(amdahl(0.9, 100)).toBeCloseTo(9.17, 2);
		expect(amdahlLimit(0.9)).toBeCloseTo(10, 10);
		expect(amdahl(0.9, 1e9)).toBeCloseTo(10, 3);
	});

	it('snaps the parallel share to the slider step and its bounds', () => {
		expect(clampP(0.9)).toBe(0.9);
		expect(clampP(0.123)).toBe(0.5);
		expect(clampP(2)).toBe(0.99);
	});
});
