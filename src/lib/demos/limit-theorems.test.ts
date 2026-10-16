import { describe, expect, it } from 'vitest';
import {
	N_MAX,
	N_MIN,
	REPS,
	describeState,
	histogram,
	histogramDomain,
	measurements,
	mulberry32,
	normalPdf,
	runningMeans,
	sampleMeans,
	sampleOne,
	skewness,
	snapN,
	standardError,
	summarize,
	trueMean,
	trueVariance,
} from './limit-theorems';

describe('mulberry32', () => {
	it('is deterministic for a seed and stays in [0, 1)', () => {
		const a = mulberry32(42);
		const b = mulberry32(42);
		for (let i = 0; i < 1000; i++) {
			const v = a();
			expect(v).toBe(b());
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('different seeds give different streams', () => {
		expect(mulberry32(1)()).not.toBe(mulberry32(2)());
	});
});

describe('sampleOne', () => {
	it('maps the uniform number to the right range for each distribution', () => {
		expect(sampleOne('uniform', 0.25)).toBe(0.25);
		expect(sampleOne('exponential', 0)).toBeCloseTo(0, 12);
		expect(sampleOne('exponential', 0.5)).toBeCloseTo(Math.LN2, 12);
		expect(sampleOne('die', 0)).toBe(1);
		expect(sampleOne('die', 0.999999)).toBe(6);
	});
});

describe('expected value and variance', () => {
	it('match the textbook values', () => {
		expect(trueMean('uniform')).toBe(0.5);
		expect(trueVariance('uniform')).toBeCloseTo(1 / 12, 12);
		expect(trueMean('exponential')).toBe(1);
		expect(trueVariance('exponential')).toBe(1);
		expect(trueMean('die')).toBe(3.5);
		expect(trueVariance('die')).toBeCloseTo(35 / 12, 12);
	});

	it('standard error of the uniform mean at n = 100 is about 0.029', () => {
		expect(standardError('uniform', 100)).toBeCloseTo(0.0289, 3);
	});
});

describe('running mean', () => {
	it('element k is the mean of the first k+1 values', () => {
		expect(runningMeans([2, 4, 6])).toEqual([2, 3, 4]);
	});

	it('prefixes of a longer stream match the shorter stream', () => {
		const short = runningMeans(measurements('exponential', 10));
		const long = runningMeans(measurements('exponential', 50));
		expect(long.slice(0, 10)).toEqual(short);
	});

	it('converges to the expected value (law of large numbers)', () => {
		const path = runningMeans(measurements('die', 5000));
		expect(Math.abs((path.at(-1) ?? 0) - 3.5)).toBeLessThan(0.1);
	});
});

describe('sample means (central limit theorem)', () => {
	it('is deterministic and has REPS entries', () => {
		const a = sampleMeans('uniform', 20);
		const b = sampleMeans('uniform', 20);
		expect(a).toHaveLength(REPS);
		expect(a).toEqual(b);
	});

	it('the simulated standard error is close to sigma / sqrt(n)', () => {
		for (const kind of ['uniform', 'exponential', 'die'] as const) {
			const s = summarize(kind, 100, sampleMeans(kind, 100));
			expect(Math.abs(s.se / s.seTheory - 1)).toBeLessThan(0.15);
			expect(Math.abs(s.mean - trueMean(kind))).toBeLessThan(0.05);
		}
	});

	it('averaging removes the skew of the exponential distribution', () => {
		const single = sampleMeans('exponential', 1);
		const averaged = sampleMeans('exponential', 100);
		expect(skewness(single)).toBeGreaterThan(1.2);
		expect(Math.abs(skewness(averaged))).toBeLessThan(0.5);
	});
});

describe('histogram', () => {
	it('counts values into equal bins and includes the upper edge', () => {
		expect(histogram([0, 0.5, 1], 2, 0, 1)).toEqual([1, 2]);
	});

	it('skips values outside the range', () => {
		expect(histogram([-1, 0.5, 2], 2, 0, 1)).toEqual([0, 1]);
	});

	it('the histogram domain is centred on the expected value and narrows with n', () => {
		const [lo10, hi10] = histogramDomain('uniform', 10);
		const [lo100, hi100] = histogramDomain('uniform', 100);
		expect((lo10 + hi10) / 2).toBeCloseTo(0.5, 12);
		expect(hi100 - lo100).toBeLessThan(hi10 - lo10);
	});
});

describe('normalPdf', () => {
	it('peaks at the mean with value 1 / (sigma sqrt(2 pi))', () => {
		expect(normalPdf(3, 3, 2)).toBeCloseTo(1 / (2 * Math.sqrt(2 * Math.PI)), 12);
	});

	it('is zero for a non-positive sigma', () => {
		expect(normalPdf(0, 0, 0)).toBe(0);
	});
});

describe('snapN', () => {
	it('rounds and clamps to the slider range', () => {
		expect(snapN(20.4)).toBe(20);
		expect(snapN(0)).toBe(N_MIN);
		expect(snapN(1000)).toBe(N_MAX);
	});

	it('non-finite input gives the default', () => {
		expect(snapN(Number.NaN)).toBe(20);
	});
});

describe('describeState', () => {
	it('names the sample size and both standard errors', () => {
		const text = describeState('uniform', 4, summarize('uniform', 4, sampleMeans('uniform', 4)));
		expect(text).toContain('n = 4 измерения');
		expect(text).toContain('σ/√n');
	});
});
