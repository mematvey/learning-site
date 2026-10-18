import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	FREQS,
	PAYBACK_EXAMPLES,
	computeLoad,
	describeLifecycle,
	formatFreq,
	formatRu,
	freqIndex,
	maxManualModels,
	paybackMonths,
	snapFreq,
	snapModels,
	snapTeam,
	statusOf,
} from './lifecycle';

describe('paybackMonths', () => {
	it('reproduces the chapter numbers 5.7, 1.4 and 22.9 months', () => {
		expect(paybackMonths(1)).toBeCloseTo(5.714, 3);
		expect(paybackMonths(4)).toBeCloseTo(1.429, 3);
		expect(paybackMonths(0.25)).toBeCloseTo(22.857, 3);
	});

	it('is inversely proportional to the release frequency', () => {
		expect(paybackMonths(2) * 2).toBeCloseTo(paybackMonths(1), 10);
	});

	it('gives the chapter examples in order', () => {
		expect(PAYBACK_EXAMPLES.map((e) => formatRu(e.months, 1))).toEqual(['5,7', '1,4', '22,9']);
	});
});

describe('computeLoad', () => {
	it('computes the default state by hand', () => {
		// 3 models x 1 release = 3 releases; 3 x 16 h = 48 h; incidents 3 x 2 h = 6 h; capacity 2 x 160 h.
		const load = computeLoad(DEFAULT_STATE);
		expect(load.releases).toBe(3);
		expect(load.manualH).toBeCloseTo(54, 10);
		expect(load.capacityH).toBe(320);
		expect(load.manualShare).toBeCloseTo(54 / 320, 10);
		expect(load.status).toBe('ok');
	});

	it('keeps incident hours the same with and without automation', () => {
		const load = computeLoad({ models: 5, freq: 2, team: 3 });
		expect(load.incidentH).toBeCloseTo(10, 10);
		expect(load.autoH - load.incidentH).toBeCloseTo(5 * 2 * 2, 10);
	});

	it('automation never increases the load', () => {
		for (const freq of FREQS) {
			const load = computeLoad({ models: 4, freq, team: 2 });
			expect(load.autoH).toBeLessThanOrEqual(load.manualH);
		}
	});

	it('grows with models and frequency', () => {
		const a = computeLoad({ models: 2, freq: 1, team: 2 }).manualH;
		expect(computeLoad({ models: 3, freq: 1, team: 2 }).manualH).toBeGreaterThan(a);
		expect(computeLoad({ models: 2, freq: 2, team: 2 }).manualH).toBeGreaterThan(a);
	});
});

describe('maxManualModels', () => {
	it('is the boundary where the manual share reaches 100%', () => {
		const team = 2;
		const freq = 1;
		const n = maxManualModels(freq, team);
		expect(computeLoad({ models: n, freq, team }).manualShare).toBeLessThanOrEqual(1);
		expect(computeLoad({ models: n + 1, freq, team }).manualShare).toBeGreaterThan(1);
	});

	it('falls when the frequency rises', () => {
		expect(maxManualModels(8, 2)).toBeLessThan(maxManualModels(0.25, 2));
	});
});

describe('statusOf', () => {
	it('marks the thresholds', () => {
		expect(statusOf(0.59)).toBe('ok');
		expect(statusOf(0.6)).toBe('limit');
		expect(statusOf(0.99)).toBe('limit');
		expect(statusOf(1)).toBe('overload');
	});
});

describe('snapping', () => {
	it('clamps and rounds models and team', () => {
		expect(snapModels(0)).toBe(1);
		expect(snapModels(99)).toBe(20);
		expect(snapModels(3.6)).toBe(4);
		expect(snapTeam(-2)).toBe(1);
		expect(snapTeam(50)).toBe(10);
	});

	it('moves frequency to the nearest allowed value', () => {
		expect(snapFreq(0.3)).toBe(0.25);
		expect(snapFreq(3)).toBe(2);
		expect(snapFreq(100)).toBe(8);
		expect(freqIndex(8)).toBe(FREQS.length - 1);
	});

	it('falls back to defaults for non-finite input', () => {
		expect(snapModels(Number.NaN)).toBe(DEFAULT_STATE.models);
		expect(snapTeam(Number.POSITIVE_INFINITY)).toBe(DEFAULT_STATE.team);
		expect(snapFreq(Number.NaN)).toBe(DEFAULT_STATE.freq);
	});
});

describe('text', () => {
	it('formats with a decimal comma', () => {
		expect(formatRu(5.714, 1)).toBe('5,7');
		expect(formatFreq(0.25)).toBe('0,25');
		expect(formatFreq(8)).toBe('8');
	});

	it('describes the state with computed numbers', () => {
		const text = describeLifecycle(DEFAULT_STATE, computeLoad(DEFAULT_STATE));
		expect(text).toContain('54 ч из 320 ч');
		expect(text).toContain('(17%)');
	});
});
