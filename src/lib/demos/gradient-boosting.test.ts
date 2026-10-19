import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	DEPTH_MAX,
	MAX_ROUNDS,
	NU_MAX,
	NU_MIN,
	STEP_MAX,
	boostPredict,
	contribution,
	describeBoost,
	earlyStop,
	fitBoost,
	fitRegTree,
	linearScale,
	makeData,
	mse,
	polylinePath,
	predictRegTree,
	snapDepth,
	snapNu,
	snapStep,
	validationCurves,
} from './gradient-boosting';

const data = makeData();

describe('makeData', () => {
	it('is deterministic and has the requested sizes', () => {
		const again = makeData();
		expect(again).toEqual(data);
		expect(data.train).toHaveLength(40);
		expect(data.val).toHaveLength(40);
	});

	it('keeps x inside the unit interval', () => {
		for (const p of [...data.train, ...data.val]) {
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.x).toBeLessThan(1);
		}
	});
});

describe('fitRegTree', () => {
	it('depth 0 gives the mean of the targets', () => {
		const tree = fitRegTree([0, 0.5, 1], [1, 2, 6], 0);
		expect(tree.leaf).toBe(true);
		expect(predictRegTree(tree, 0.2)).toBeCloseTo(3, 12);
	});

	it('depth 1 splits a step function into the two means', () => {
		const xs = [0.1, 0.2, 0.3, 0.6, 0.7, 0.8];
		const rs = [0, 0, 0, 1, 1, 1];
		const tree = fitRegTree(xs, rs, 1);
		expect(tree.leaf).toBe(false);
		expect(predictRegTree(tree, 0.25)).toBeCloseTo(0, 12);
		expect(predictRegTree(tree, 0.75)).toBeCloseTo(1, 12);
	});
});

describe('fitBoost', () => {
	it('fits MAX_ROUNDS trees', () => {
		const fit = fitBoost(data.train, MAX_ROUNDS, 0.3, 2);
		expect(fit.trees).toHaveLength(MAX_ROUNDS);
		expect(fit.base).toBeCloseTo(data.train.reduce((a, p) => a + p.y, 0) / 40, 12);
	});

	it('training error never grows when nu is in (0, 2]', () => {
		for (const nu of [0.1, 0.5, 1]) {
			const c = validationCurves(fitBoost(data.train, MAX_ROUNDS, nu, 2), data);
			for (let k = 1; k < c.train.length; k++) {
				expect(c.train[k]).toBeLessThanOrEqual((c.train[k - 1] ?? 0) + 1e-12);
			}
		}
	});

	it('contribution of tree k is the step from F_(k-1) to F_k', () => {
		const fit = fitBoost(data.train, 10, 0.3, 2);
		for (const x of [0.05, 0.4, 0.93]) {
			for (let k = 1; k <= 10; k++) {
				const step = boostPredict(fit, k, x) - boostPredict(fit, k - 1, x);
				expect(step).toBeCloseTo(contribution(fit, k, x), 12);
			}
		}
		expect(contribution(fit, 0, 0.5)).toBe(0);
		expect(contribution(fit, 11, 0.5)).toBe(0);
	});

	it('validation curve agrees with a direct evaluation of F_k', () => {
		const fit = fitBoost(data.train, MAX_ROUNDS, 0.3, 2);
		const c = validationCurves(fit, data);
		for (const k of [0, 7, MAX_ROUNDS]) {
			const direct = mse(data.val, (x) => boostPredict(fit, k, x));
			expect(c.val[k]).toBeCloseTo(direct, 12);
		}
	});
});

describe('earlyStop', () => {
	it('stops after patience rounds without improvement', () => {
		const curve = [5, 4, 3, 3.5, 3.6, 3.7, 3.8, 3.9];
		expect(earlyStop(curve, 3)).toEqual({ best: 2, stopAt: 5 });
	});

	it('never stops on a curve that keeps improving', () => {
		expect(earlyStop([3, 2, 1, 0.5], 2)).toEqual({ best: 3, stopAt: null });
	});

	it('keeps the earlier round on ties', () => {
		expect(earlyStop([3, 1, 1, 1, 1, 1, 1], 5)).toEqual({ best: 1, stopAt: 6 });
	});

	it('shows the chapter claim: big shrinkage stops earlier than small', () => {
		const big = earlyStop(validationCurves(fitBoost(data.train, MAX_ROUNDS, 1, 2), data).val);
		const small = earlyStop(validationCurves(fitBoost(data.train, MAX_ROUNDS, 0.1, 2), data).val);
		expect(big.stopAt).not.toBeNull();
		expect(big.best).toBeLessThan(small.best);
	});
});

describe('snapping', () => {
	it('snaps nu to the 0.05 grid inside the range', () => {
		expect(snapNu(0.33)).toBe(0.35);
		expect(snapNu(0)).toBe(NU_MIN);
		expect(snapNu(7)).toBe(NU_MAX);
		expect(snapNu(Number.NaN)).toBe(DEFAULT_STATE.nu);
	});

	it('clamps depth and step to their ranges', () => {
		expect(snapDepth(9)).toBe(DEPTH_MAX);
		expect(snapDepth('x')).toBe(DEFAULT_STATE.depth);
		expect(snapStep(-4)).toBe(0);
		expect(snapStep(1000)).toBe(STEP_MAX);
	});
});

describe('drawing helpers', () => {
	it('maps a degenerate domain to the middle of the range', () => {
		expect(linearScale(2, 2, 0, 10)(5)).toBe(5);
		expect(linearScale(0, 10, 0, 100)(2.5)).toBe(25);
	});

	it('builds an SVG path', () => {
		const pts = [
			{ x: 0, y: 1 },
			{ x: 2.25, y: 3 },
		];
		expect(polylinePath(pts)).toBe('M0.0 1.0 L2.3 3.0');
	});
});

describe('describeBoost', () => {
	it('names the step, the errors and the best round', () => {
		const fit = fitBoost(data.train, MAX_ROUNDS, DEFAULT_STATE.nu, DEFAULT_STATE.depth);
		const curves = validationCurves(fit, data);
		const stop = earlyStop(curves.val);
		const text = describeBoost({ ...DEFAULT_STATE, step: 10 }, curves, stop);
		expect(text).toContain('Деревьев: 10 из 60');
		expect(text).toContain('Лучший шаг по контролю');
	});

	it('mentions the early stop only when it fires', () => {
		const curves = { train: [1, 0.5], val: [1, 0.5] };
		const text = describeBoost({ ...DEFAULT_STATE, step: 1 }, curves, {
			best: 1,
			stopAt: null,
		});
		expect(text).not.toContain('остановка');
	});
});
