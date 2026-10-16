import { describe, expect, it } from 'vitest';
import {
	DEPTH,
	activate,
	curve,
	curveDomain,
	describeState,
	DEFAULT_STATE,
	histogram,
	initVariance,
	isActKind,
	logSecondMoment,
	perLayerFactor,
	simulate,
	slope,
	snapLayer,
	snapWidth,
} from './activations-init';

describe('activation functions', () => {
	it('gives the reference values at zero and the right sign behaviour', () => {
		expect(activate('sigmoid', 0)).toBeCloseTo(0.5, 12);
		expect(activate('tanh', 0)).toBeCloseTo(0, 12);
		expect(activate('relu', -1)).toBe(0);
		expect(activate('relu', 2)).toBe(2);
	});

	it('gives the maximal slope 1/4 for sigmoid and 1 for tanh at zero, and 0 or 1 for ReLU', () => {
		expect(slope('sigmoid', 0)).toBeCloseTo(0.25, 12);
		expect(slope('tanh', 0)).toBeCloseTo(1, 12);
		expect(slope('relu', 3)).toBe(1);
		expect(slope('relu', -3)).toBe(0);
	});

	it('matches the analytic slope with a finite difference', () => {
		const h = 1e-6;
		for (const kind of ['sigmoid', 'tanh'] as const) {
			for (const z of [-2, -0.5, 0.7, 3]) {
				const numeric = (activate(kind, z + h) - activate(kind, z - h)) / (2 * h);
				expect(slope(kind, z)).toBeCloseTo(numeric, 6);
			}
		}
	});

	it('samples the curve on the chart range and keeps the domain around 0 and 1', () => {
		const pts = curve('relu');
		expect(pts[0]?.z).toBe(-4);
		expect(pts[pts.length - 1]?.z).toBe(4);
		const [lo, hi] = curveDomain('sigmoid');
		expect(lo).toBeLessThan(0);
		expect(hi).toBeGreaterThan(1);
	});
});

describe('initVariance', () => {
	it('gives 2/(n_in+n_out) for Xavier and 2/n_in for He', () => {
		expect(initVariance('xavier', 100, 300)).toBeCloseTo(2 / 400, 12);
		expect(initVariance('he', 100, 300)).toBeCloseTo(2 / 100, 12);
	});
});

describe('simulate', () => {
	it('is deterministic for the same arguments', () => {
		const a = simulate('relu', 'he', 32);
		const b = simulate('relu', 'he', 32);
		expect(a.stats).toEqual(b.stats);
	});

	it('has depth + 1 stats entries and the input has E[x²] close to 1', () => {
		const sim = simulate('tanh', 'xavier', 32);
		expect(sim.stats).toHaveLength(DEPTH + 1);
		expect(sim.stats[0]?.secondMoment).toBeCloseTo(1, 0);
	});

	it('ReLU with Xavier halves E[a²] per layer, and ReLU with He keeps it (width 256)', () => {
		const xavier = simulate('relu', 'xavier', 256);
		const he = simulate('relu', 'he', 256);
		const fx = perLayerFactor(xavier.stats, DEPTH);
		const fh = perLayerFactor(he.stats, DEPTH);
		expect(fx).toBeGreaterThan(0.4);
		expect(fx).toBeLessThan(0.6);
		expect(fh).toBeGreaterThan(0.85);
		expect(fh).toBeLessThan(1.15);
	});
});

describe('perLayerFactor and histogram', () => {
	it('returns 1 for the first layer', () => {
		const sim = simulate('relu', 'he', 16, 3, 8);
		expect(perLayerFactor(sim.stats, 1)).toBe(1);
	});

	it('histogram fractions sum to 1 and values beyond the range go to the edge bins', () => {
		const h = histogram([0, 0.1, -0.1, 10, -10]);
		const sum = h.fractions.reduce((s, v) => s + v, 0);
		expect(sum).toBeCloseTo(1, 12);
		expect(h.outside).toBeCloseTo(2 / 5, 12);
		expect(h.fractions[h.fractions.length - 1]).toBeCloseTo(1 / 5, 12);
	});

	it('histogram of empty input is all zeros', () => {
		const h = histogram([]);
		expect(h.fractions.every((v) => v === 0)).toBe(true);
		expect(h.outside).toBe(0);
	});
});

describe('snapping and helpers', () => {
	it('snaps layer to 1..DEPTH and width to the nearest allowed value', () => {
		expect(snapLayer(0)).toBe(1);
		expect(snapLayer(99)).toBe(DEPTH);
		expect(snapLayer(Number.NaN)).toBe(1);
		expect(snapWidth(100)).toBe(128);
		expect(snapWidth(1000)).toBe(256);
	});

	it('recognises activation kinds and clamps log values', () => {
		expect(isActKind('relu')).toBe(true);
		expect(isActKind('gelu')).toBe(false);
		expect(logSecondMoment(0)).toBe(-4);
		expect(logSecondMoment(100)).toBe(1);
	});

	it('describes the chosen layer with computed numbers', () => {
		const sim = simulate(DEFAULT_STATE.act, DEFAULT_STATE.init, DEFAULT_STATE.width);
		const text = describeState(DEFAULT_STATE, sim);
		expect(text).toContain(`Слой ${DEPTH}`);
		expect(text).toContain('ReLU');
	});
});
