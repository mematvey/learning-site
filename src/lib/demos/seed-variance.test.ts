import { describe, expect, it } from 'vitest';
import {
	SEED_COUNT,
	describeSeeds,
	makeSeedRuns,
	sanitizeSeedState,
	snapSeeds,
	spread,
	summarizeSeeds,
} from './seed-variance';

describe('seed variance', () => {
	it('is deterministic and has SEED_COUNT values per configuration', () => {
		const a = makeSeedRuns();
		expect(a).toEqual(makeSeedRuns());
		expect(a.A).toHaveLength(SEED_COUNT);
		expect(a.B).toHaveLength(SEED_COUNT);
	});

	it('computes spread with the n - 1 standard deviation', () => {
		const s = spread([1, 2, 3, 4]);
		expect(s.mean).toBe(2.5);
		expect(s.sd).toBeCloseTo(Math.sqrt(5 / 3), 12);
		expect(spread([5]).sd).toBe(0);
	});

	it('shows overlapping ranges for the default seeds', () => {
		const s = summarizeSeeds(makeSeedRuns(), sanitizeSeedState(undefined));
		expect(s.overlap).toBe(true);
		expect(describeSeeds(s)).toContain('пересекаются');
	});

	it('single seed picks a winner without any spread', () => {
		const s = summarizeSeeds(makeSeedRuns(), { seeds: 1 });
		expect(s.a.sd).toBe(0);
		expect(describeSeeds(s)).toContain('разброса не видно');
	});

	it('single seed winner differs from the mean winner', () => {
		const runs = makeSeedRuns();
		const one = summarizeSeeds(runs, { seeds: 1 });
		const all = summarizeSeeds(runs, { seeds: SEED_COUNT });
		expect(one.firstSeedWinner).not.toBe(all.meanWinner);
	});

	it('snaps the seed count', () => {
		expect(snapSeeds(0)).toBe(1);
		expect(snapSeeds(99)).toBe(SEED_COUNT);
		expect(snapSeeds('x')).toBe(SEED_COUNT);
	});
});
