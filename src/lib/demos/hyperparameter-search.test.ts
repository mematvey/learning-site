import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	type MethodId,
	type MethodResult,
	FULL_UNITS,
	SH_CANDIDATES,
	argmax,
	compareMethods,
	gridPoints,
	gridSide,
	halvingPlan,
	heatmap,
	quality,
	qualityMax,
	randomPoints,
	snapBudget,
	snapW,
} from './hyperparameter-search';

const s = DEFAULT_STATE;

describe('surface', () => {
	it('reaches its maximum exactly at the optimum', () => {
		expect(quality({ x: s.x0, y: s.y0 }, s)).toBeCloseTo(qualityMax(s), 10);
	});

	it('does not depend on y when the second parameter has no weight', () => {
		const flat = { ...s, w: 0 };
		expect(quality({ x: 0.3, y: 0 }, flat)).toBeCloseTo(quality({ x: 0.3, y: 1 }, flat), 12);
	});

	it('changes much more along the important axis than along the second one', () => {
		const alongX = Math.abs(quality({ x: s.x0, y: s.y0 }, s) - quality({ x: 0.1, y: s.y0 }, s));
		const alongY = Math.abs(quality({ x: s.x0, y: s.y0 }, s) - quality({ x: s.x0, y: 0.95 }, s));
		expect(alongX).toBeGreaterThan(3 * alongY);
	});
});

describe('grid and random', () => {
	it('uses a 3 by 3 grid for budget 9 with three distinct values per axis', () => {
		const g = gridPoints(9);
		expect(gridSide(9)).toBe(3);
		expect(g).toHaveLength(9);
		expect(new Set(g.map((p) => p.x)).size).toBe(3);
		expect(g.map((p) => p.x)).toEqual([0, 0.5, 1, 0, 0.5, 1, 0, 0.5, 1]);
	});

	it('uses at most budget trainings on the grid', () => {
		expect(gridPoints(20)).toHaveLength(16);
		expect(gridPoints(4)).toHaveLength(4);
	});

	it('gives the same random points for the same seed, all inside the unit square', () => {
		const a = randomPoints(9, 3);
		expect(randomPoints(9, 3)).toEqual(a);
		expect(a).toHaveLength(9);
		for (const p of a) {
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.x).toBeLessThan(1);
			expect(p.y).toBeGreaterThanOrEqual(0);
			expect(p.y).toBeLessThan(1);
		}
	});

	it('gives 9 random points that take 9 different values of the important parameter', () => {
		expect(new Set(randomPoints(9, s.seed).map((p) => p.x)).size).toBe(9);
	});

	it('argmax returns a point from the list', () => {
		const pts = randomPoints(5, 2);
		expect(pts).toContainEqual(argmax(pts, s, FULL_UNITS));
	});
});

describe('successive halving', () => {
	const plan = halvingPlan(s);

	it('keeps 81, 27, 9, 3, 1 configurations and trains them with budgets 1, 3, 9, 27, 81', () => {
		expect(plan.survivors.map((a) => a.length)).toEqual([81, 27, 9, 3, 1, 1]);
		expect(plan.budgets).toEqual([1, 3, 9, 27, 81]);
		expect(SH_CANDIDATES).toBe(81);
	});

	it('spends 81 units per round and 405 in total against 6561 for the full search', () => {
		expect(plan.spent).toEqual([0, 81, 162, 243, 324, 405]);
		expect(SH_CANDIDATES * FULL_UNITS).toBe(6561);
	});

	it('keeps survivors as a subset of the previous round', () => {
		for (let r = 1; r < plan.survivors.length; r++) {
			const prev = plan.survivors[r - 1];
			for (const p of plan.survivors[r] ?? []) expect(prev).toContain(p);
		}
	});

	it('is deterministic for a seed', () => {
		expect(halvingPlan(s).survivors[5]).toEqual(plan.survivors[5]);
	});
});

describe('comparison at the default state', () => {
	const rows = compareMethods(s, halvingPlan(s));
	const row = (id: MethodId): MethodResult => {
		const found = rows.find((r) => r.id === id);
		if (!found) throw new Error(id);
		return found;
	};

	it('reports the budgets of each method', () => {
		expect(row('grid').configs).toBe(9);
		expect(row('random').configs).toBe(9);
		expect(row('halving').units).toBe(405);
		expect(row('full').units).toBe(6561);
	});

	it('random search at the same count gets closer to the optimum than the grid', () => {
		expect(row('random').gap).toBeLessThan(row('grid').gap);
	});

	it('gap is never negative', () => {
		for (const r of rows) expect(r.gap).toBeGreaterThanOrEqual(-1e-12);
	});
});

describe('state helpers and heatmap', () => {
	it('snaps budget and weight into their ranges', () => {
		expect(snapBudget(1)).toBe(4);
		expect(snapBudget(100)).toBe(49);
		expect(snapBudget(Number.NaN)).toBe(9);
		expect(snapW(1.04)).toBe(1);
		expect(snapW(-3)).toBe(0);
	});

	it('gives one cell per heatmap square with quality at most 1 relative to the optimum', () => {
		const cells = heatmap(s);
		expect(cells).toHaveLength(400);
		for (const c of cells) expect(c.q).toBeLessThanOrEqual(1);
	});
});
