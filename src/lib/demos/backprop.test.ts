import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	STEP_MAX,
	backward,
	backwardDone,
	describeStep,
	forward,
	forwardDone,
	nodeAtStep,
	normalizeState,
	sigmoid,
	snapParam,
	snapStep,
	snapTarget,
	type Params,
} from './backprop';

const base: Params = { x: 2, w: 0.5, b: -0.3, y: 1 };

/** Loss L(p) computed through the forward pass only, for finite differences. */
function loss(p: Params): number {
	return forward(p).L;
}

describe('forward pass', () => {
	it('gives the hand-computed values at the default state', () => {
		const f = forward(base);
		expect(f.m).toBeCloseTo(1, 12);
		expect(f.s).toBeCloseTo(0.7, 12);
		expect(f.a).toBeCloseTo(0.668188, 5);
		expect(f.d).toBeCloseTo(-0.331812, 5);
		expect(f.L).toBeCloseTo(0.110099, 5);
	});

	it('gives zero loss when the output equals the target', () => {
		const p = { x: 0, w: 0, b: 0, y: 0.5 };
		expect(forward(p).a).toBeCloseTo(0.5, 12);
		expect(forward(p).L).toBeCloseTo(0, 12);
	});
});

describe('backward pass', () => {
	it('matches hand-computed gradients at the default state', () => {
		const g = backward(base, forward(base));
		expect(g.L).toBe(1);
		expect(g.d).toBeCloseTo(-0.663624, 5);
		expect(g.s).toBeCloseTo(-0.147134, 5);
		expect(g.b).toBeCloseTo(-0.147134, 5);
		expect(g.m).toBeCloseTo(-0.147134, 5);
		expect(g.w).toBeCloseTo(-0.294268, 5);
		expect(g.x).toBeCloseTo(-0.073567, 5);
	});

	it('gives y the opposite sign of d (d = a − y)', () => {
		const g = backward(base, forward(base));
		expect(g.y).toBeCloseTo(-g.d, 12);
	});

	it.each([
		{ x: 2, w: 0.5, b: -0.3, y: 1 },
		{ x: -1.5, w: 1.2, b: 0.4, y: 0 },
		{ x: 0.3, w: -2, b: 1.7, y: 0.6 },
		{ x: 1, w: 0, b: 0, y: 0.2 },
	])('agrees with finite differences for %o', (p) => {
		const g = backward(p, forward(p));
		const eps = 1e-6;
		const keys = ['x', 'w', 'b', 'y'] as const;
		for (const k of keys) {
			const plus = loss({ ...p, [k]: p[k] + eps });
			const minus = loss({ ...p, [k]: p[k] - eps });
			const numeric = (plus - minus) / (2 * eps);
			expect(g[k]).toBeCloseTo(numeric, 5);
		}
	});

	it('the sigmoid factor a(1 − a) never exceeds 0.25', () => {
		for (let s = -10; s <= 10; s += 0.25) {
			const a = sigmoid(s);
			expect(a * (1 - a)).toBeLessThanOrEqual(0.25 + 1e-12);
		}
	});
});

describe('sigmoid', () => {
	it('is 0.5 at zero and stays finite at extreme inputs', () => {
		expect(sigmoid(0)).toBe(0.5);
		expect(sigmoid(-1000)).toBeCloseTo(0, 12);
		expect(sigmoid(1000)).toBeCloseTo(1, 12);
		expect(Number.isFinite(sigmoid(-1000))).toBe(true);
	});
});

describe('state normalisation', () => {
	it('snaps parameters to the 0.1 grid and clamps them into range', () => {
		expect(snapParam(0.34)).toBe(0.3);
		expect(snapParam(0.36)).toBe(0.4);
		expect(snapParam(9)).toBe(2);
		expect(snapParam(-9)).toBe(-2);
		expect(snapParam(Number.NaN)).toBe(0);
	});

	it('clamps the target into [0, 1]', () => {
		expect(snapTarget(1.7)).toBe(1);
		expect(snapTarget(-0.4)).toBe(0);
	});

	it('clamps the step into 0..STEP_MAX as an integer', () => {
		expect(snapStep(-3)).toBe(0);
		expect(snapStep(99)).toBe(STEP_MAX);
		expect(snapStep(2.6)).toBe(3);
		expect(snapStep(Number.POSITIVE_INFINITY)).toBe(0);
	});

	it('fills missing fields with defaults', () => {
		expect(normalizeState({ w: 1 })).toEqual({ ...DEFAULT_STATE, w: 1 });
		expect(normalizeState()).toEqual(DEFAULT_STATE);
	});
});

describe('step schedule', () => {
	it('runs forward steps 1..5 and backward steps 6..10 over the nodes in order', () => {
		expect(nodeAtStep(0)).toBeNull();
		expect(nodeAtStep(1)).toEqual({ dir: 'forward', node: 'm' });
		expect(nodeAtStep(5)).toEqual({ dir: 'forward', node: 'L' });
		expect(nodeAtStep(6)).toEqual({ dir: 'backward', node: 'L' });
		expect(nodeAtStep(10)).toEqual({ dir: 'backward', node: 'm' });
	});

	it('reveals a gradient only after its consumer has been processed backward', () => {
		expect(backwardDone('d', 6)).toBe(false);
		expect(backwardDone('d', 7)).toBe(true);
		expect(backwardDone('m', 9)).toBe(false);
		expect(backwardDone('m', 10)).toBe(true);
	});

	it('shows forward values only after their node has been computed; inputs are always known', () => {
		expect(forwardDone('w', 0)).toBe(true);
		expect(forwardDone('s', 1)).toBe(false);
		expect(forwardDone('s', 2)).toBe(true);
	});

	it('describes every step with a non-empty text', () => {
		for (let k = 0; k <= STEP_MAX; k++) {
			expect(describeStep({ ...DEFAULT_STATE, step: k }).length).toBeGreaterThan(0);
		}
	});

	it('is deterministic for the same state', () => {
		const a = describeStep({ ...DEFAULT_STATE, step: 9 });
		const b = describeStep({ ...DEFAULT_STATE, step: 9 });
		expect(a).toBe(b);
	});
});
