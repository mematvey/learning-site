import { describe, expect, it } from 'vitest';
import { toNumber, rat } from '../rational';
import { mulberry32 } from '../rng';
import type { ProblemDef, ProblemParams, Rational } from '../types';
import { PROBLEMS, p1, p2, p3, p4, p5, p6, p7, p8, p9 } from './index';

const TRIALS = 40_000;
const SEED = 20260;

/** Exact expected answers at the default parameters (task conditions). */
const EXPECTED: Record<string, Record<string, Rational>> = {
	p1: { a: rat(1, 34), b: rat(12, 17) },
	p2: { a: rat(13, 25) },
	p3: { a: rat(19, 30) },
	p4: { a: rat(5, 204), b: rat(5, 34) },
	p5: { a: rat(57, 115), b: rat(19, 138), c: rat(19, 46) },
	p6: { a: rat(5, 11) },
	p7: { a: rat(1, 120), b: rat(1, 720) },
	p8: { a: rat(1, 60) },
	p9: { a: rat(950, 2639), b: rat(21167, 23751) },
};

function frequencies(def: ProblemDef, params: ProblemParams, seed: number): Record<string, number> {
	const rng = mulberry32(seed);
	const hits: Record<string, number> = {};
	for (let i = 0; i < TRIALS; i++) {
		const r = def.trial(params, rng);
		for (const [key, ok] of Object.entries(r)) hits[key] = (hits[key] ?? 0) + (ok ? 1 : 0);
	}
	return Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v / TRIALS]));
}

describe('exact answers at default parameters', () => {
	for (const def of PROBLEMS) {
		it(`${def.id} matches the task answers`, () => {
			const exact = def.exact(def.defaults);
			for (const [key, value] of Object.entries(EXPECTED[def.id] ?? {})) {
				expect(exact[key], `${def.id}.${key}`).toEqual(value);
			}
		});
	}

	it('p9 numbers from the task (≈)', () => {
		expect(toNumber(EXPECTED.p9?.a ?? rat(0))).toBeCloseTo(0.36, 3);
		expect(toNumber(EXPECTED.p9?.b ?? rat(0))).toBeCloseTo(0.8912, 4);
	});

	it('p7 with other parameters and the condition text', () => {
		expect(p7.exact({ cards: 6, len: 6 }).a).toEqual(rat(1, 720));
		expect(p7.exact({ cards: 4, len: 2 }).b).toEqual(rat(1, 24));
		const text = p7.condition(p7.defaults);
		expect(text).toContain('а)');
		expect(text).toContain('б)');
		expect(text).toContain('123456');
	});

	it('p8 with other parameters (task 8 alternate)', () => {
		expect(p8.exact({ ones: 3, twos: 2, threes: 1 }).a).toEqual(rat(1, 60));
	});
});

describe('Monte-Carlo agrees with exact answers within 4σ', () => {
	for (const def of PROBLEMS) {
		it(`${def.id}`, () => {
			const freq = frequencies(def, def.defaults, SEED);
			for (const [key, value] of Object.entries(EXPECTED[def.id] ?? {})) {
				const p = toNumber(value);
				const sigma = Math.sqrt((p * (1 - p)) / TRIALS);
				expect(Math.abs((freq[key] ?? 0) - p), `${def.id}.${key}`).toBeLessThanOrEqual(4 * sigma);
			}
		});
	}
});

describe('validation', () => {
	it('accepts the defaults', () => {
		for (const def of PROBLEMS) expect(def.validate(def.defaults), def.id).toEqual([]);
	});

	it('rejects invalid p1 input', () => {
		expect(p1.validate({ total: 17, medalists: 5, k: 2 }).length).toBeGreaterThan(0);
		expect(p1.validate({ total: 18, medalists: 0, k: 0 }).length).toBeGreaterThan(0);
		expect(p1.validate({ total: 18, medalists: 2, k: 3 }).length).toBeGreaterThan(0);
	});

	it('rejects extreme and inconsistent p2 probabilities', () => {
		expect(p2.validate({ pA: 0, pB: 0.3, pAB: 0.1 }).length).toBeGreaterThan(0);
		expect(p2.validate({ pA: 0.3, pB: 0.3, pAB: 0 }).length).toBeGreaterThan(0);
		expect(p2.validate({ pA: 0.3, pB: 0.3, pAB: 0.5 }).length).toBeGreaterThan(0);
		expect(p2.validate({ pA: 0.99, pB: 0.99, pAB: 0.01 }).length).toBeGreaterThan(0);
	});

	it('rejects p3 when the student knows everything or fewer than asked', () => {
		expect(p3.validate({ N: 25, K: 25, n: 2 }).length).toBeGreaterThan(0);
		expect(p3.validate({ N: 25, K: 1, n: 2 }).length).toBeGreaterThan(0);
	});

	it('rejects p4 with an empty fruit kind and p5 with n < 2', () => {
		expect(p4.validate({ mandarins: 10, oranges: 5, lemons: 0 }).length).toBeGreaterThan(0);
		expect(p5.validate({ N: 25, good: 20, n: 1 }).length).toBeGreaterThan(0);
		expect(p5.validate({ N: 25, good: 25, n: 3 }).length).toBeGreaterThan(0);
	});

	it('rejects p6, p7, p8, p9 out-of-range input', () => {
		expect(p6.validate({ faces: 6, target: 7 }).length).toBeGreaterThan(0);
		expect(p7.validate({ cards: 6, len: 7 }).length).toBeGreaterThan(0);
		expect(p8.validate({ ones: 3, twos: 0, threes: 1 }).length).toBeGreaterThan(0);
		expect(p9.validate({ N: 30, K: 10, n: 5, k: 6 }).length).toBeGreaterThan(0);
	});
});

describe('functions do not throw on boundary valid parameters', () => {
	for (const def of PROBLEMS) {
		it(def.id, () => {
			const candidates: ProblemParams[] = [];
			for (const spec of def.params) {
				for (const v of [spec.min, spec.max]) {
					candidates.push({ ...def.defaults, [spec.key]: v });
				}
			}
			for (const params of candidates) {
				if (def.validate(params).length > 0) continue;
				expect(() => {
					def.exact(params);
					def.steps(params);
					def.altSteps?.(params);
					def.condition(params);
					def.trial(params, mulberry32(1));
				}, JSON.stringify(params)).not.toThrow();
			}
		});
	}
});
