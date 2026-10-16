import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SHIFT,
	PSI_ALERT,
	PSI_BINS,
	PSI_WARN,
	PROD_N,
	REF_N,
	SHIFT_MAX,
	binShares,
	describeDrift,
	histogram,
	ksCritical,
	ksPValue,
	ksStatistic,
	makeSamples,
	productionSample,
	psi,
	psiLevel,
	quantileEdges,
	snapShift,
} from './monitoring-drift';

describe('snapShift', () => {
	it('clamps to the slider range and snaps to the step', () => {
		expect(snapShift(-1)).toBe(0);
		expect(snapShift(SHIFT_MAX + 5)).toBe(SHIFT_MAX);
		expect(snapShift(0.3000000000000004)).toBe(0.3);
		expect(snapShift(1.27)).toBe(1.3);
	});

	it('gives the default for non-numbers', () => {
		expect(snapShift(Number.NaN)).toBe(DEFAULT_SHIFT);
		expect(snapShift('x')).toBe(DEFAULT_SHIFT);
	});
});

describe('samples', () => {
	it('are deterministic for the fixed seeds', () => {
		const a = makeSamples();
		const b = makeSamples();
		expect(a.ref).toHaveLength(REF_N);
		expect(a.z).toHaveLength(PROD_N);
		expect(a.ref[10]).toBe(b.ref[10]);
		expect(a.z[10]).toBe(b.z[10]);
	});

	it('moves the production sample by the shift', () => {
		const { z } = makeSamples();
		const moved = productionSample(z, 1.5);
		expect(moved[0]).toBeCloseTo((z[0] ?? 0) + 1.5, 12);
	});
});

describe('binning', () => {
	it('gives PSI_BINS - 1 interior edges that are non-decreasing', () => {
		const { ref } = makeSamples();
		const edges = quantileEdges(ref);
		expect(edges).toHaveLength(PSI_BINS - 1);
		for (let i = 1; i < edges.length; i++) {
			expect(edges[i] ?? 0).toBeGreaterThanOrEqual(edges[i - 1] ?? 0);
		}
	});

	it('gives reference shares close to uniform and summing to 1', () => {
		const { ref } = makeSamples();
		const shares = binShares(ref, quantileEdges(ref));
		expect(shares).toHaveLength(PSI_BINS);
		expect(shares.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
		for (const s of shares) expect(Math.abs(s - 1 / PSI_BINS)).toBeLessThan(0.02);
	});
});

describe('PSI', () => {
	it('is near zero when the production sample is the reference', () => {
		const { ref } = makeSamples();
		expect(psi(ref, ref)).toBeCloseTo(0, 10);
	});

	it('is stable for the unshifted production sample', () => {
		const { ref, z } = makeSamples();
		expect(psiLevel(psi(ref, productionSample(z, 0)))).toBe('stable');
	});

	it('grows with the shift and alarms at a large shift', () => {
		const { ref, z } = makeSamples();
		const small = psi(ref, productionSample(z, 0.5));
		const large = psi(ref, productionSample(z, 2));
		expect(large).toBeGreaterThan(small);
		expect(large).toBeGreaterThan(PSI_ALERT);
	});
});

describe('KS statistic', () => {
	it('is 0 for identical samples and 1 for disjoint ones', () => {
		expect(ksStatistic([1, 2, 3], [1, 2, 3])).toBe(0);
		expect(ksStatistic([1, 2], [10, 11])).toBe(1);
	});

	it('matches a hand-computed small example', () => {
		// ECDF gaps: 1/3 at x=1, 1/3 at x=2, 1/3 at x=3, 0 at x=4.
		expect(ksStatistic([1, 2, 3], [2, 3, 4])).toBeCloseTo(1 / 3, 12);
	});

	it('exceeds the critical value for a large shift only', () => {
		const { ref, z } = makeSamples();
		const crit = ksCritical(ref.length, PROD_N);
		expect(ksStatistic(ref, productionSample(z, 2))).toBeGreaterThan(crit);
		expect(ksStatistic(ref, productionSample(z, 0))).toBeLessThan(0.1);
	});
});

describe('KS critical value and p-value', () => {
	it('gives the alpha = 0.05 critical value for equal samples', () => {
		expect(ksCritical(1000, 1000)).toBeCloseTo(1.358 * Math.sqrt(2000 / 1e6), 12);
	});

	it('gives p close to 0.05 at the critical value', () => {
		const p = ksPValue(ksCritical(1000, 1000), 1000, 1000);
		expect(p).toBeGreaterThan(0.04);
		expect(p).toBeLessThan(0.06);
	});

	it('gives p = 1 for D = 0 and p near 0 for a large D', () => {
		expect(ksPValue(0, 100, 100)).toBe(1);
		expect(ksPValue(0.5, 1000, 1000)).toBeLessThan(1e-6);
	});
});

describe('psiLevel', () => {
	it('uses the thresholds 0.1 and 0.25', () => {
		expect(psiLevel(PSI_WARN - 0.001)).toBe('stable');
		expect(psiLevel(PSI_WARN)).toBe('warning');
		expect(psiLevel(PSI_ALERT - 0.001)).toBe('warning');
		expect(psiLevel(PSI_ALERT)).toBe('alert');
	});
});

describe('histogram', () => {
	it('integrates to about 1 for values inside the range', () => {
		const xs = [0.1, 0.2, 0.3, 1.1, 2.4];
		const dens = histogram(xs, 0, 3, 0.5);
		const area = dens.reduce((s, v) => s + v * 0.5, 0);
		expect(area).toBeCloseTo(1, 12);
	});
});

describe('describeDrift', () => {
	it('names the alarm when KS exceeds the critical value', () => {
		const text = describeDrift(2, 1.2, 0.4, 0.06, 0);
		expect(text).toContain('тревога');
		expect(text).toContain('PSI = 1.200');
	});
});
