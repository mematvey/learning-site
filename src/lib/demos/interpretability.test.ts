import { describe, expect, it } from 'vitest';
import {
	COND_HALF_WIDTH,
	DEFAULT_RHO,
	DEFAULT_V,
	GRID,
	N_POINTS,
	conditionalCurve,
	countTrue,
	describeState,
	iceCurves,
	linePath,
	makeSample,
	mulberry32,
	nearCount,
	noiseScale,
	offCloudFlags,
	pdpCurve,
	pearson,
	permutationImportance,
	predict,
	snapRho,
	snapV,
} from './interpretability';

describe('seeded data', () => {
	it('mulberry32 gives the same sequence for the same seed, values in [0, 1)', () => {
		const a = mulberry32(42);
		const b = mulberry32(42);
		for (let i = 0; i < 100; i++) {
			const v = a();
			expect(v).toBe(b());
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('makeSample is deterministic', () => {
		expect(makeSample(0.5)).toEqual(makeSample(0.5));
		expect(makeSample(0.5).x1).toHaveLength(N_POINTS);
	});

	it('the sample correlation follows the slider', () => {
		expect(pearson(makeSample(0.9).x1, makeSample(0.9).x2)).toBeCloseTo(0.9, 1);
		expect(pearson(makeSample(0.1).x1, makeSample(0.1).x2)).toBeCloseTo(0.1, 0);
	});

	it('noiseScale grows as correlation falls', () => {
		expect(noiseScale(0.9)).toBeLessThan(noiseScale(0.3));
		expect(noiseScale(0.3)).toBeLessThan(noiseScale(0.1));
	});
});

describe('PDP and ICE', () => {
	const sample = makeSample(DEFAULT_RHO);
	const ice = iceCurves(sample);

	it('has one ICE curve per object, each over the whole grid', () => {
		expect(ice).toHaveLength(N_POINTS);
		expect(ice[0]).toHaveLength(GRID.length);
	});

	it('PDP is the mean of the ICE curves at every grid point', () => {
		const pdp = pdpCurve(ice);
		for (let j = 0; j < GRID.length; j++) {
			let s = 0;
			for (const row of ice) s += row[j] ?? 0;
			expect(pdp[j]).toBeCloseTo(s / N_POINTS, 10);
		}
	});

	it('at weak correlation the data cover every grid point in the middle range', () => {
		const cond = conditionalCurve(makeSample(0.1));
		for (const v of [-0.5, 0, 0.5, 1, 1.5]) {
			expect(cond[GRID.indexOf(v)]).not.toBeNull();
		}
	});

	it('at strong correlation there is no data near x1 = 2 and every PDP point is off the cloud', () => {
		const strong = makeSample(0.95);
		expect(conditionalCurve(strong)[GRID.indexOf(2)]).toBeNull();
		expect(nearCount(strong, 2)).toBe(0);
		expect(countTrue(offCloudFlags(strong, 2))).toBe(N_POINTS);
	});

	it('the share of off-cloud PDP points grows with correlation at the same x1', () => {
		const weak = countTrue(offCloudFlags(makeSample(0.1), 0.5));
		const mid = countTrue(offCloudFlags(makeSample(0.5), 0.5));
		const strong = countTrue(offCloudFlags(makeSample(0.95), 0.5));
		expect(strong).toBeGreaterThan(mid);
		expect(mid).toBeGreaterThanOrEqual(weak);
		expect(strong).toBeGreaterThan(weak);
	});

	it('the default state is a valid grid value', () => {
		expect(GRID).toContain(DEFAULT_V);
		expect(COND_HALF_WIDTH).toBeGreaterThan(0);
	});
});

describe('permutation importance on correlated features', () => {
	it('is finite and non-negative for single features', () => {
		const imp = permutationImportance(makeSample(0.9));
		expect(Number.isFinite(imp.base)).toBe(true);
		expect(imp.x1).toBeGreaterThanOrEqual(0);
		expect(imp.x2).toBeGreaterThanOrEqual(0);
	});

	it('permuting the correlated pair together hurts more than either feature alone', () => {
		const imp = permutationImportance(makeSample(0.9));
		expect(imp.group).toBeGreaterThan(Math.max(imp.x1, imp.x2));
	});

	it('is deterministic for the same sample', () => {
		expect(permutationImportance(makeSample(0.5))).toEqual(permutationImportance(makeSample(0.5)));
	});
});

describe('linePath', () => {
	it('breaks the line at null values', () => {
		const d = linePath(
			[0, 1, 2, 3],
			[1, null, 2, 3],
			(v) => v,
			(v) => v,
		);
		expect(d).toBe('M0.0 1.0M2.0 2.0L3.0 3.0');
	});
});

describe('controls and text', () => {
	it('snapRho clamps and rounds to the slider step, non-finite gives default', () => {
		expect(snapRho(0.01)).toBe(0.1);
		expect(snapRho(2)).toBe(0.95);
		expect(snapRho(0.333)).toBe(0.35);
		expect(snapRho(Number.NaN)).toBe(DEFAULT_RHO);
	});

	it('snapV rounds to the grid and clamps', () => {
		expect(snapV(0.44)).toBe(0.4);
		expect(snapV(9)).toBe(2.5);
		expect(snapV(-9)).toBe(-1.5);
		expect(snapV(Number.POSITIVE_INFINITY)).toBe(DEFAULT_V);
	});

	it('predict is the additive part plus the interaction term', () => {
		expect(predict(1, 1)).toBeCloseTo(1, 10);
		expect(predict(0, 0)).toBe(0);
	});

	it('describeState reports the computed numbers', () => {
		const text = describeState(makeSample(0.95), 2, 0.95);
		expect(text).toContain('нет ни одного объекта');
		expect(text).toContain(`Из ${N_POINTS} точек`);
	});
});
