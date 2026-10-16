import { describe, expect, it } from 'vitest';
import {
	LR_MAX,
	addPoint,
	clampUnit,
	fitOls,
	fitRidge,
	gradientDescent,
	makePoints,
	mse,
	movePoint,
	predict,
	r2,
	removePoint,
	residuals,
	snapTo,
	type Line,
	type Point,
} from './linear-regression';

const exact: Point[] = [0, 0.25, 0.5, 0.75, 1].map((x) => ({ x, y: 2 * x + 0.1 }));
const cloud = makePoints();

describe('fitOls', () => {
	it('recovers the exact line through noiseless points', () => {
		const line = fitOls(exact) as Line;
		expect(line.a).toBeCloseTo(2, 10);
		expect(line.b).toBeCloseTo(0.1, 10);
		expect(r2(exact, line)).toBeCloseTo(1, 10);
		expect(mse(exact, line)).toBeLessThan(1e-20);
	});

	it('residuals sum to zero and are orthogonal to x (normal equations)', () => {
		const line = fitOls(cloud) as Line;
		const r = residuals(cloud, line);
		const sumR = r.reduce((s, v) => s + v, 0);
		const sumRx = r.reduce((s, v, i) => s + v * (cloud[i]?.x ?? 0), 0);
		expect(sumR).toBeCloseTo(0, 9);
		expect(sumRx).toBeCloseTo(0, 9);
	});

	it('is undefined for fewer than two points or identical x', () => {
		expect(fitOls([{ x: 0.5, y: 0.2 }])).toBeNull();
		expect(
			fitOls([
				{ x: 0.5, y: 0.2 },
				{ x: 0.5, y: 0.9 },
			]),
		).toBeNull();
	});
});

describe('fitRidge', () => {
	it('with lambda = 0 equals ordinary least squares', () => {
		const ols = fitOls(cloud) as Line;
		const ridge = fitRidge(cloud, 0) as Line;
		expect(ridge.a).toBeCloseTo(ols.a, 12);
		expect(ridge.b).toBeCloseTo(ols.b, 12);
	});

	it('shrinks the slope monotonically as lambda grows', () => {
		let prev = Number.POSITIVE_INFINITY;
		for (const lambda of [0, 0.1, 0.5, 1, 2, 100]) {
			const { a } = fitRidge(cloud, lambda) as Line;
			expect(Math.abs(a)).toBeLessThanOrEqual(Math.abs(prev) + 1e-12);
			prev = a;
		}
		expect(Math.abs(prev)).toBeLessThan(0.01);
	});

	it('keeps the fitted line through the centroid (intercept is not penalised)', () => {
		const mx = cloud.reduce((s, p) => s + p.x, 0) / cloud.length;
		const my = cloud.reduce((s, p) => s + p.y, 0) / cloud.length;
		const line = fitRidge(cloud, 3) as Line;
		expect(predict(line, mx)).toBeCloseTo(my, 10);
	});
});

describe('gradientDescent', () => {
	it('loss decreases and converges close to the least squares solution', () => {
		const { line, losses } = gradientDescent(cloud, 0.3, 400);
		for (let i = 1; i < losses.length; i++) {
			expect(losses[i] as number).toBeLessThanOrEqual((losses[i - 1] as number) + 1e-12);
		}
		const ols = fitOls(cloud) as Line;
		expect(line.a).toBeCloseTo(ols.a, 3);
		expect(line.b).toBeCloseTo(ols.b, 3);
	});

	it('returns steps + 1 losses, the last one being the loss of the returned line', () => {
		const { line, losses } = gradientDescent(cloud, 0.1, 25);
		expect(losses).toHaveLength(26);
		expect(losses[25]).toBeCloseTo(mse(cloud, line), 12);
	});

	it('stops early and reports non-finite losses when the step is too large', () => {
		const { losses } = gradientDescent(cloud, 5 * LR_MAX, 2000);
		expect(losses.length).toBeLessThan(2001);
		expect(Number.isFinite(losses[losses.length - 1] as number)).toBe(false);
	});
});

describe('points editing', () => {
	it('clampUnit keeps coordinates in [0, 1]', () => {
		expect(clampUnit(-0.4)).toBe(0);
		expect(clampUnit(1.7)).toBe(1);
		expect(clampUnit(Number.NaN)).toBe(0);
	});

	it('movePoint and addPoint clamp new coordinates', () => {
		const moved = movePoint(exact, 2, 2, -1);
		expect(moved[2]).toEqual({ x: 1, y: 0 });
		expect(addPoint(exact, 0.3, 0.9)).toHaveLength(exact.length + 1);
	});

	it('removePoint never drops below two points', () => {
		const two = exact.slice(0, 2);
		expect(removePoint(two, 0)).toHaveLength(2);
		expect(removePoint(exact, 0)).toHaveLength(exact.length - 1);
	});

	it('snapTo rounds to the step grid inside the range', () => {
		expect(snapTo(0.123, 0, 2, 0.05)).toBeCloseTo(0.1, 10);
		expect(snapTo(0.13, 0, 2, 0.05)).toBeCloseTo(0.15, 10);
		expect(snapTo(9, 0, 2, 0.05)).toBe(2);
	});
});
