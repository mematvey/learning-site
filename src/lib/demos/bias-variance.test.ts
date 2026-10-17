import { describe, expect, it } from 'vitest';
import {
	DEG_MAX,
	DEG_MIN,
	DEFAULT_DEGREE,
	allStats,
	describeRegime,
	evalPoly,
	fitPoly,
	fitsOnGrid,
	gridXs,
	legendreRow,
	lstsq,
	makeDatasets,
	snapDegree,
	statsForDegree,
	trueFn,
} from './bias-variance';

const datasets = makeDatasets();
const grid = gridXs();

describe('lstsq', () => {
	it('matches the normal-equation solution on a small well-conditioned system', () => {
		const rows = [
			[1, 0],
			[1, 1],
			[1, 2],
			[1, 3],
		];
		const y = [1.1, 2.9, 5.2, 6.8];
		const w = lstsq(rows, y);
		// Closed form for a line: slope and intercept of the least-squares fit.
		const n = y.length;
		const mx = 1.5;
		const my = y.reduce((a, b) => a + b, 0) / n;
		let sxy = 0;
		let sxx = 0;
		for (let i = 0; i < n; i++) {
			sxy += (i - mx) * ((y[i] ?? 0) - my);
			sxx += (i - mx) ** 2;
		}
		const slope = sxy / sxx;
		expect(w[1]).toBeCloseTo(slope, 10);
		expect(w[0]).toBeCloseTo(my - slope * mx, 10);
	});

	it('recovers an exact polynomial of degree 2', () => {
		const set = {
			xs: [0.05, 0.2, 0.35, 0.5, 0.7, 0.9, 1],
			ys: [0.05, 0.2, 0.35, 0.5, 0.7, 0.9, 1].map((x) => 1 - 2 * x + 3 * x * x),
		};
		const w = fitPoly(set, 2);
		for (const x of [0, 0.3, 0.6, 1]) {
			expect(evalPoly(w, x)).toBeCloseTo(1 - 2 * x + 3 * x * x, 9);
		}
	});

	it('stays accurate at the top degree on the demo data', () => {
		const set = datasets[0];
		if (!set) throw new Error('no datasets');
		const w = fitPoly(set, DEG_MAX);
		// Residuals of the least-squares fit must be orthogonal to every basis column.
		for (let c = 0; c <= DEG_MAX; c++) {
			let dot = 0;
			set.xs.forEach((x, i) => {
				dot += (legendreRow(x, DEG_MAX)[c] ?? 0) * ((set.ys[i] ?? 0) - evalPoly(w, x));
			});
			expect(Math.abs(dot)).toBeLessThan(1e-7);
		}
	});
});

describe('legendreRow', () => {
	it('gives P_0 = 1 and P_1 = 2x - 1 at the ends of the interval', () => {
		expect(legendreRow(0, 1)).toEqual([1, -1]);
		expect(legendreRow(1, 1)).toEqual([1, 1]);
	});
});

describe('makeDatasets', () => {
	it('is deterministic for a fixed seed', () => {
		const a = makeDatasets(7, 5, 2, 0.1);
		const b = makeDatasets(7, 5, 2, 0.1);
		expect(a).toEqual(b);
	});
});

describe('bias and variance', () => {
	it('average squared error equals bias^2 + variance exactly', () => {
		const k = 4;
		const fits = fitsOnGrid(datasets, k, grid);
		let mse = 0;
		for (const row of fits) {
			for (let g = 0; g < grid.length; g++) {
				mse += ((row[g] ?? 0) - trueFn(grid[g] ?? 0)) ** 2;
			}
		}
		mse /= fits.length * grid.length;
		const s = statsForDegree(datasets, k, grid);
		expect(s.sum).toBeCloseTo(mse, 10);
	});

	it('variance grows and bias^2 falls from the lowest to the highest degree', () => {
		const stats = allStats(datasets);
		const first = stats[0];
		const last = stats[stats.length - 1];
		if (!first || !last) throw new Error('no stats');
		expect(last.variance).toBeGreaterThan(first.variance);
		expect(last.bias2).toBeLessThan(first.bias2);
	});

	it('returns one entry per degree in order', () => {
		const stats = allStats(datasets);
		expect(stats.map((s) => s.degree)).toEqual(
			Array.from({ length: DEG_MAX - DEG_MIN + 1 }, (_, i) => DEG_MIN + i),
		);
	});
});

describe('snapDegree and describeRegime', () => {
	it('clamps and rounds the degree', () => {
		expect(snapDegree(0)).toBe(DEG_MIN);
		expect(snapDegree(99)).toBe(DEG_MAX);
		expect(snapDegree(4.6)).toBe(5);
		expect(snapDegree(Number.NaN)).toBe(DEFAULT_DEGREE);
	});

	it('names the dominating term', () => {
		expect(describeRegime({ bias2: 1, variance: 0.1 })).toMatch(/Смещение/);
		expect(describeRegime({ bias2: 0.1, variance: 1 })).toMatch(/Разброс/);
		expect(describeRegime({ bias2: 1, variance: 0.8 })).toMatch(/сопоставим/);
	});
});

describe('train and held-out error', () => {
	const stats = allStats(makeDatasets());
	it('train error falls with degree while held-out error stays above the noise floor', () => {
		const first = stats[0];
		const last = stats[stats.length - 1];
		expect(last!.train).toBeLessThan(first!.train);
		for (const s of stats) expect(s.test).toBeGreaterThan(s.noise * 0.9);
	});
	it('held-out error is close to bias2 + variance + sigma^2', () => {
		for (const s of stats.slice(0, 8)) expect(s.test).toBeCloseTo(s.sum + s.noise, 1);
	});
	it('held-out error exceeds train error at high degree', () => {
		const last = stats[stats.length - 1];
		expect(last!.test).toBeGreaterThan(last!.train);
	});
});
