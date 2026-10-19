import { describe, expect, it } from 'vitest';
import {
	BURN_IN,
	N_STEPS,
	chainStats,
	histogram,
	logTarget,
	nextSeed,
	rhat,
	rhatAt,
	runChain,
	runChains,
	snapStep,
	targetDensity,
} from './mcmc';

describe('target', () => {
	it('is symmetric and has two modes at ±2', () => {
		expect(logTarget(2)).toBeCloseTo(logTarget(-2), 12);
		expect(logTarget(2)).toBeGreaterThan(logTarget(0));
	});

	it('integrates to about 1 as a normalised density', () => {
		let s = 0;
		const h = 0.01;
		for (let x = -12; x < 12; x += h) s += targetDensity(x) * h;
		expect(s).toBeCloseTo(1, 3);
	});
});

describe('runChain', () => {
	it('is deterministic for the same step, start and seed', () => {
		const a = runChain(500, 2, 0, 1);
		const b = runChain(500, 2, 0, 1);
		expect(Array.from(a.samples)).toEqual(Array.from(b.samples));
	});

	it('gives a high acceptance for a tiny step and a mid-range one for step 2', () => {
		const tiny = runChain(N_STEPS, 0.1, 0, 1);
		const mid = runChain(N_STEPS, 2, 0, 1);
		const rate = (r: { accepted: Uint8Array }) => r.accepted.reduce((a, b) => a + b, 0) / N_STEPS;
		expect(rate(tiny)).toBeGreaterThan(0.9);
		expect(rate(mid)).toBeGreaterThan(0.5);
		expect(rate(mid)).toBeLessThan(0.75);
	});

	it('after burn-in the step-2 chain is close to the target: mean near 0, std near sqrt(5)', () => {
		const run = runChain(N_STEPS, 2, 0, 1);
		const s = chainStats(run, N_STEPS, BURN_IN);
		expect(Math.abs(s.mean ?? 1)).toBeLessThan(0.5);
		expect(s.std ?? 0).toBeGreaterThan(1.9);
		expect(s.std ?? 0).toBeLessThan(2.6);
		expect(Math.abs((s.shareRight ?? 0) - 0.5)).toBeLessThan(0.1);
	});
});

describe('chainStats', () => {
	it('returns nulls before burn-in finishes', () => {
		const run = runChain(100, 1, 0, 1);
		const s = chainStats(run, 50, BURN_IN);
		expect(s.mean).toBeNull();
		expect(s.n).toBe(0);
		expect(s.rate).not.toBeNull();
	});
});

describe('rhat', () => {
	it('matches the worked example: two chains of 1000 with means 0 and 3 and unit spread', () => {
		const a = Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? 1 : -1));
		const b = a.map((v) => v + 3);
		expect(rhat([a, b])).toBeCloseTo(2.34, 1);
	});

	it('is about 1 when the chains share the same mean', () => {
		const a = Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? 1 : -1));
		expect(rhat([a, a.slice().reverse()])).toBeCloseTo(0.9995, 3);
	});

	it('is null with too few values', () => {
		expect(rhat([[1], [2]])).toBeNull();
	});

	it('is large when chains start in different modes and the step is tiny', () => {
		const runs = runChains(0.01, 1, [-4, 4], 5_000);
		expect(rhatAt(runs, 5_000)).toBeGreaterThan(1.5);
	});
});

describe('histogram', () => {
	it('integrates to 1 over the range', () => {
		const values = Array.from({ length: 1000 }, (_, i) => -5 + (10 * i) / 1000);
		const h = histogram(values, -6, 6, 24);
		const width = 12 / 24;
		expect(h.reduce((a, d) => a + d * width, 0)).toBeCloseTo(1, 10);
	});
});

describe('snapping', () => {
	it('clamps the step to the slider range and rounds to one decimal', () => {
		expect(snapStep(0)).toBe(0.1);
		expect(snapStep(50)).toBe(10);
		expect(snapStep(2.04)).toBe(2);
		expect(snapStep(Number.NaN)).toBe(2);
	});

	it('cycles seeds 1..5', () => {
		expect(nextSeed(1)).toBe(2);
		expect(nextSeed(5)).toBe(1);
	});
});
