import { describe, expect, it } from 'vitest';
import {
	ADAM_EPS,
	START,
	TOTAL_STEPS,
	describeOptimizers,
	divergedBy,
	grad,
	levelRadii,
	loss,
	pointAt,
	snapKappa,
	snapLr,
	snapMomentum,
	snapStep,
	trajectory,
	type OptimizerConfig,
	type OptimizerKind,
	type Point,
	type Trajectory,
} from './optimizers';

/** Point i of a trajectory; the index is always inside the computed part in these tests. */
function at(t: Trajectory, i: number): Point {
	const p = t.points[i];
	if (!p) throw new Error(`no point ${i}`);
	return p;
}

const base: OptimizerConfig = { lr: 0.1, kappa: 10, momentum: 0.9 };

function all(cfg: OptimizerConfig): Record<OptimizerKind, Trajectory> {
	return {
		sgd: trajectory('sgd', cfg),
		momentum: trajectory('momentum', cfg),
		adam: trajectory('adam', cfg),
	};
}

describe('loss and gradient', () => {
	it('f(w) = ½(w₁² + κ w₂²) and its gradient', () => {
		expect(loss([2, 1], 4)).toBeCloseTo(0.5 * (4 + 4), 12);
		expect(grad([2, 1], 4)).toEqual([2, 4]);
	});

	it('the minimum is at the origin with loss 0', () => {
		expect(loss([0, 0], 7)).toBe(0);
		expect(grad([0, 0], 7)).toEqual([0, 0]);
	});
});

describe('SGD', () => {
	it('makes one step w ← w − η ∇f', () => {
		const t = trajectory('sgd', { lr: 0.05, kappa: 4, momentum: 0 }, 1);
		const g = grad(START, 4);
		expect(at(t, 1)[0]).toBeCloseTo(START[0] - 0.05 * g[0], 12);
		expect(at(t, 1)[1]).toBeCloseTo(START[1] - 0.05 * g[1], 12);
	});

	it('with η κ = 1 the steep coordinate reaches 0 in one step', () => {
		const t = trajectory('sgd', { lr: 0.1, kappa: 10, momentum: 0 }, 1);
		expect(at(t, 1)[1]).toBeCloseTo(0, 12);
	});

	it('converges on a well-conditioned surface', () => {
		const t = trajectory('sgd', { lr: 0.05, kappa: 1, momentum: 0 }, 300);
		const end = at(t, t.points.length - 1);
		expect(Math.abs(end[0])).toBeLessThan(1e-3);
		expect(Math.abs(end[1])).toBeLessThan(1e-3);
	});

	it('is flagged as diverging when η κ > 2', () => {
		const t = trajectory('sgd', { lr: 0.5, kappa: 20, momentum: 0 });
		expect(t.diverged).toBe(true);
		expect(t.points.length).toBeLessThan(TOTAL_STEPS + 1);
		expect(divergedBy(t, TOTAL_STEPS)).toBe(true);
	});
});

describe('momentum', () => {
	it('with β = 0 is exactly SGD', () => {
		const sgd = trajectory('sgd', { ...base, momentum: 0 }, 20);
		const mom = trajectory('momentum', { ...base, momentum: 0 }, 20);
		expect(mom.points).toEqual(sgd.points);
	});

	it('the first step equals the SGD step (the buffer starts at the gradient)', () => {
		const sgd = trajectory('sgd', base, 1);
		const mom = trajectory('momentum', base, 1);
		expect(at(mom, 1)[0]).toBeCloseTo(at(sgd, 1)[0], 12);
		expect(at(mom, 1)[1]).toBeCloseTo(at(sgd, 1)[1], 12);
	});
});

describe('Adam', () => {
	it('the first step moves each coordinate by about η (bias correction, m̂/√v̂ = sign g)', () => {
		const cfg = { lr: 0.07, kappa: 5, momentum: 0 };
		const t = trajectory('adam', cfg, 1);
		const g = grad(START, cfg.kappa);
		expect(START[0] - at(t, 1)[0]).toBeCloseTo(cfg.lr * Math.sign(g[0]), 6);
		expect(START[1] - at(t, 1)[1]).toBeCloseTo(cfg.lr * Math.sign(g[1]), 6);
	});

	it('uses eps so that a zero gradient gives no step and no NaN', () => {
		const t = trajectory('adam', base, 3, [0, 0]);
		expect(t.diverged).toBe(false);
		expect(t.points.every((p) => p[0] === 0 && p[1] === 0)).toBe(true);
		expect(ADAM_EPS).toBeGreaterThan(0);
	});
});

describe('trajectories are deterministic and share the start and the step count', () => {
	it('repeated calls give the same points', () => {
		expect(trajectory('adam', base)).toEqual(trajectory('adam', base));
	});

	it('every optimizer starts at START and has TOTAL_STEPS + 1 points unless it diverges', () => {
		const trajs = all({ lr: 0.05, kappa: 3, momentum: 0.8 });
		for (const kind of ['sgd', 'momentum', 'adam'] as const) {
			expect(at(trajs[kind], 0)).toEqual(START);
			expect(trajs[kind].points.length).toBe(TOTAL_STEPS + 1);
		}
	});
});

describe('pointAt and divergence', () => {
	it('clamps the step to the computed part', () => {
		const t = trajectory('sgd', base, 5);
		expect(pointAt(t, -3)).toEqual(at(t, 0));
		expect(pointAt(t, 99)).toEqual(at(t, 5));
		expect(pointAt(t, 2.4)).toEqual(at(t, 2));
	});

	it('a diverged run reports the last finite point and stays diverged at the end', () => {
		const t = trajectory('sgd', { lr: 0.5, kappa: 20, momentum: 0 });
		expect(pointAt(t, TOTAL_STEPS)).toEqual(at(t, t.points.length - 1));
		expect(divergedBy(t, 0)).toBe(false);
	});
});

describe('level sets', () => {
	it('the level set f = c has semi-axes √(2c) and √(2c/κ)', () => {
		const [rx, ry] = levelRadii(8, 4);
		expect(rx).toBeCloseTo(4, 12);
		expect(ry).toBeCloseTo(2, 12);
		expect(loss([rx, 0], 4)).toBeCloseTo(8, 12);
		expect(loss([0, ry], 4)).toBeCloseTo(8, 12);
	});
});

describe('snapping', () => {
	it('clamps and rounds to the slider steps', () => {
		expect(snapLr(0.123)).toBe(0.12);
		expect(snapLr(9)).toBe(0.5);
		expect(snapLr(-1)).toBe(0.01);
		expect(snapKappa(7.6)).toBe(8);
		expect(snapKappa(100)).toBe(20);
		expect(snapMomentum(0.9049)).toBe(0.9);
		expect(snapMomentum(2)).toBe(0.99);
		expect(snapStep(12.4)).toBe(12);
		expect(snapStep(500)).toBe(TOTAL_STEPS);
	});

	it('non-finite input gives the default', () => {
		expect(snapLr(Number.NaN)).toBe(0.07);
		expect(snapKappa(Number.POSITIVE_INFINITY)).toBe(20);
		expect(snapStep(Number.NaN)).toBe(30);
	});
});

describe('describeOptimizers', () => {
	it('names every optimizer and marks a diverged one', () => {
		const cfg = { lr: 0.5, kappa: 20, momentum: 0.9 };
		const text = describeOptimizers(cfg, TOTAL_STEPS, all(cfg));
		expect(text).toContain('Шаг 60 из 60');
		expect(text).toContain('SGD расходится');
		expect(text).toContain('Adam');
	});
});
