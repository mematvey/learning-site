import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	DOMAIN_MAX,
	DOMAIN_MIN,
	GRID_N,
	PARAM_MAX,
	PARAM_MIN,
	accuracy,
	boundarySegment,
	classify,
	confusion,
	gdSteps,
	gdStep,
	gradient,
	logLoss,
	logit,
	makeDataset,
	mergeState,
	predictProba,
	probabilityGrid,
	sigmoid,
	softplus,
} from './logistic-regression';

const points = makeDataset();

describe('makeDataset', () => {
	it('is deterministic, balanced and inside the visible square', () => {
		expect(makeDataset()).toEqual(points);
		const ones = points.filter((p) => p.label === 1).length;
		expect(ones).toBe(points.length / 2);
		for (const p of points) {
			expect(Math.abs(p.x)).toBeLessThanOrEqual(2.9);
			expect(Math.abs(p.y)).toBeLessThanOrEqual(2.9);
		}
	});
});

describe('sigmoid and softplus', () => {
	it('stay finite for large scores of both signs', () => {
		expect(sigmoid(1000)).toBe(1);
		expect(sigmoid(-1000)).toBe(0);
		expect(Number.isFinite(softplus(1000))).toBe(true);
		expect(softplus(-1000)).toBeCloseTo(0, 12);
	});

	it('sigmoid(0) = 0.5 and logit inverts sigmoid', () => {
		expect(sigmoid(0)).toBe(0.5);
		expect(sigmoid(logit(0.3))).toBeCloseTo(0.3, 12);
	});
});

describe('logLoss', () => {
	it('equals ln 2 at zero weights and stays finite for huge logits', () => {
		expect(logLoss(points, { w1: 0, w2: 0, b: 0 })).toBeCloseTo(Math.LN2, 12);
		const big = logLoss(points, { w1: 1e6, w2: -1e6, b: 0 });
		expect(Number.isFinite(big)).toBe(true);
	});
});

describe('gradient', () => {
	it('matches the numerical derivative of the loss', () => {
		const params = { w1: 0.7, w2: -0.4, b: 0.2 };
		const g = gradient(points, params);
		const h = 1e-6;
		const shifted = (key: keyof typeof params, delta: number) => ({
			...params,
			[key]: params[key] + delta,
		});
		const central = (key: keyof typeof params) =>
			(logLoss(points, shifted(key, h)) - logLoss(points, shifted(key, -h))) / (2 * h);
		expect(g.w1).toBeCloseTo(central('w1'), 5);
		expect(g.w2).toBeCloseTo(central('w2'), 5);
		expect(g.b).toBeCloseTo(central('b'), 5);
	});
});

describe('gradient descent', () => {
	it('lowers the loss on every step for a small step size', () => {
		let params = { w1: 0, w2: 0, b: 0 };
		let prev = logLoss(points, params);
		for (let i = 0; i < 30; i++) {
			params = gdStep(points, params, 0.2);
			const cur = logLoss(points, params);
			expect(cur).toBeLessThanOrEqual(prev + 1e-12);
			prev = cur;
		}
	});

	it('gdSteps(k) equals k single steps and keeps weights in range', () => {
		const start = { w1: 0, w2: 0, b: 0 };
		let manual = start;
		for (let i = 0; i < 5; i++) manual = gdStep(points, manual, 1);
		expect(gdSteps(points, start, 1, 5)).toEqual(manual);
		const far = gdSteps(points, start, 2, 300);
		for (const v of [far.w1, far.w2, far.b]) {
			expect(v).toBeGreaterThanOrEqual(PARAM_MIN);
			expect(v).toBeLessThanOrEqual(PARAM_MAX);
		}
	});
});

describe('classify and confusion', () => {
	it('uses p >= threshold and the counts add up to the sample size', () => {
		expect(classify(0.5, 0.5)).toBe(1);
		expect(classify(0.49, 0.5)).toBe(0);
		const params = { w1: 1, w2: 1, b: 0 };
		for (const t of [0.1, 0.5, 0.9]) {
			const c = confusion(points, params, t);
			expect(c.tp + c.fp + c.tn + c.fn).toBe(points.length);
		}
	});

	it('accuracy is 1 when the separating line is the true one on separated data', () => {
		const separated = [
			{ x: -1, y: 0, label: 0 as const },
			{ x: 1, y: 0, label: 1 as const },
		];
		expect(accuracy(confusion(separated, { w1: 2, w2: 0, b: 0 }, 0.5))).toBe(1);
		expect(accuracy({ tp: 0, fp: 0, tn: 0, fn: 0 })).toBe(0);
	});
});

describe('probabilityGrid', () => {
	it('has GRID_N rows and columns, values in (0, 1), top row has the largest x2 for w2 > 0', () => {
		const params = { w1: 0, w2: 2, b: 0 };
		const g = probabilityGrid(params);
		expect(g).toHaveLength(GRID_N);
		for (const row of g) expect(row).toHaveLength(GRID_N);
		const top = g[0]?.[0] ?? 0;
		const bottom = g[GRID_N - 1]?.[0] ?? 0;
		expect(top).toBeGreaterThan(bottom);
		for (const row of g) for (const v of row) expect(v).toBeGreaterThan(0);
	});
});

describe('boundarySegment', () => {
	it('lies on the threshold line and inside the square', () => {
		const params = { w1: 1.5, w2: -0.8, b: 0.4 };
		const t = 0.7;
		const seg = boundarySegment(params, t);
		expect(seg).not.toBeNull();
		if (!seg) return;
		const [x1, y1, x2, y2] = seg;
		const target = logit(t);
		expect(params.w1 * x1 + params.w2 * y1 + params.b).toBeCloseTo(target, 9);
		expect(params.w1 * x2 + params.w2 * y2 + params.b).toBeCloseTo(target, 9);
		for (const v of [x1, y1, x2, y2]) {
			expect(v).toBeGreaterThanOrEqual(DOMAIN_MIN - 1e-9);
			expect(v).toBeLessThanOrEqual(DOMAIN_MAX + 1e-9);
		}
	});

	it('is vertical for w2 = 0 and absent for zero weights', () => {
		const seg = boundarySegment({ w1: 1, w2: 0, b: 0 }, 0.5);
		expect(seg?.[0]).toBeCloseTo(0, 9);
		expect(seg?.[2]).toBeCloseTo(0, 9);
		expect(boundarySegment({ w1: 0, w2: 0, b: 1 }, 0.5)).toBeNull();
	});

	it('is null when the line leaves the visible square', () => {
		expect(boundarySegment({ w1: 0.1, w2: 0.1, b: 100 }, 0.5)).toBeNull();
	});
});

describe('mergeState', () => {
	it('keeps current values for missing or non-finite fields', () => {
		const cur = { ...DEFAULT_STATE, w1: 1 };
		expect(mergeState(cur, { w2: Number.NaN })).toEqual(cur);
		expect(mergeState(cur, {})).toEqual(cur);
	});

	it('clamps and snaps to the slider ranges', () => {
		const next = mergeState(DEFAULT_STATE, {
			w1: 9,
			w2: -0.234,
			threshold: 0,
			lr: 1.234,
		});
		expect(next.w1).toBe(PARAM_MAX);
		expect(next.w2).toBeCloseTo(-0.2, 9);
		expect(next.threshold).toBeCloseTo(0.05, 9);
		expect(next.lr).toBeCloseTo(1.25, 9);
	});

	it('predictProba agrees with the sigmoid of the score', () => {
		const params = { w1: 0.3, w2: 0.9, b: -0.1 };
		expect(predictProba(params, 1, 2)).toBeCloseTo(sigmoid(0.3 + 1.8 - 0.1), 12);
	});
});
