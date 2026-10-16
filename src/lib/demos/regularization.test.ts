import { describe, expect, it } from 'vitest';
import { legendreRow } from './bias-variance';
import {
	DEG_MAX,
	DEG_MIN,
	DEFAULT_LOG_LAMBDA,
	LOG_LAMBDA_MAX,
	LOG_LAMBDA_MIN,
	ZERO_TOL,
	formatLambda,
	fitModel,
	lassoFit,
	makeDataset,
	mse,
	nonZeroCount,
	penalisedNorm,
	ridgeFit,
	snapDegree,
	snapLogLambda,
	softThreshold,
	testSet,
	trainSet,
} from './regularization';

/** Solves A x = b by Gaussian elimination with partial pivoting (independent of the demo code). */
function solve(A: number[][], b: number[]): number[] {
	const n = b.length;
	const M = A.map((row, i) => [...row, b[i] ?? 0]);
	for (let c = 0; c < n; c++) {
		let piv = c;
		for (let r = c + 1; r < n; r++) {
			if (Math.abs(M[r]?.[c] ?? 0) > Math.abs(M[piv]?.[c] ?? 0)) piv = r;
		}
		[M[c], M[piv]] = [M[piv] ?? [], M[c] ?? []];
		for (let r = c + 1; r < n; r++) {
			const f = (M[r]?.[c] ?? 0) / (M[c]?.[c] ?? 1);
			const rowR = M[r] ?? [];
			for (let k = c; k <= n; k++) rowR[k] = (rowR[k] ?? 0) - f * (M[c]?.[k] ?? 0);
		}
	}
	const x = new Array<number>(n).fill(0);
	for (let i = n - 1; i >= 0; i--) {
		let s = M[i]?.[n] ?? 0;
		for (let k = i + 1; k < n; k++) s -= (M[i]?.[k] ?? 0) * (x[k] ?? 0);
		x[i] = s / (M[i]?.[i] ?? 1);
	}
	return x;
}

/** Normal-equation ridge: (X^T X + lambda D) w = X^T y, with D = diag(0, 1, ..., 1). */
function ridgeNormal(xs: number[], ys: number[], k: number, lambda: number): number[] {
	const p = k + 1;
	const X = xs.map((x) => legendreRow(x, k));
	const A = Array.from({ length: p }, (_, i) =>
		Array.from({ length: p }, (_, j) => {
			let s = 0;
			for (let r = 0; r < X.length; r++) s += (X[r]?.[i] ?? 0) * (X[r]?.[j] ?? 0);
			return s + (i === j && i > 0 ? lambda : 0);
		}),
	);
	const b = Array.from({ length: p }, (_, i) => {
		let s = 0;
		for (let r = 0; r < X.length; r++) s += (X[r]?.[i] ?? 0) * (ys[r] ?? 0);
		return s;
	});
	return solve(A, b);
}

const tr = trainSet();

describe('makeDataset', () => {
	it('is deterministic for a fixed seed and has the requested size', () => {
		const a = makeDataset(42, 15);
		const b = makeDataset(42, 15);
		expect(a).toEqual(b);
		expect(a.xs).toHaveLength(15);
		expect(a.ys).toHaveLength(15);
		expect(a.xs.every((x) => x >= 0 && x <= 1)).toBe(true);
	});
});

describe('ridgeFit', () => {
	it('matches the closed-form normal-equation solution', () => {
		for (const [k, lambda] of [
			[3, 0.1],
			[9, 0.01],
			[9, 1],
		] as const) {
			const expected = ridgeNormal(tr.xs, tr.ys, k, lambda);
			const got = ridgeFit(tr, k, lambda);
			got.forEach((w, j) => expect(w).toBeCloseTo(expected[j] ?? NaN, 6));
		}
	});

	it('with lambda 0 gives the unpenalised least-squares fit', () => {
		const w0 = ridgeFit(tr, 5, 0);
		const expected = ridgeNormal(tr.xs, tr.ys, 5, 0);
		w0.forEach((w, j) => expect(w).toBeCloseTo(expected[j] ?? NaN, 6));
	});

	it('shrinks the penalised weights as lambda grows', () => {
		const norms = [0.0001, 0.01, 0.1, 1, 10].map((l) => penalisedNorm(ridgeFit(tr, 9, l)));
		for (let i = 1; i < norms.length; i++) {
			expect(norms[i]).toBeLessThan(norms[i - 1] ?? Infinity);
		}
	});
});

describe('lassoFit', () => {
	it('satisfies the KKT conditions of the lasso objective', () => {
		const lambda = 0.1;
		const k = 9;
		const w = lassoFit(tr, k, lambda);
		const X = tr.xs.map((x) => legendreRow(x, k));
		const r = tr.ys.map((y, i) => y - (X[i] ?? []).reduce((s, v, j) => s + v * (w[j] ?? 0), 0));
		for (let j = 1; j <= k; j++) {
			let g = 0;
			for (let i = 0; i < X.length; i++) g += (X[i]?.[j] ?? 0) * (r[i] ?? 0);
			const wj = w[j] ?? 0;
			if (Math.abs(wj) > ZERO_TOL) {
				expect(2 * g).toBeCloseTo(lambda * Math.sign(wj), 4);
			} else {
				expect(Math.abs(2 * g)).toBeLessThanOrEqual(lambda + 1e-4);
			}
		}
	});

	it('gives all-zero penalised weights for a huge lambda, and the mean as intercept', () => {
		const w = lassoFit(tr, 9, 1e6);
		expect(nonZeroCount(w)).toBe(0);
		const mean = tr.ys.reduce((s, v) => s + v, 0) / tr.ys.length;
		expect(w[0]).toBeCloseTo(mean, 8);
	});

	it('with lambda near 0 is close to the ridge fit with the same tiny lambda', () => {
		const w = lassoFit(tr, 4, 1e-7);
		const v = ridgeFit(tr, 4, 1e-7);
		w.forEach((c, j) => expect(c).toBeCloseTo(v[j] ?? NaN, 4));
	});

	it('produces exact zeros, which ridge does not', () => {
		expect(nonZeroCount(fitModel(tr, 9, -1, 'l1'))).toBeLessThan(9);
		expect(nonZeroCount(fitModel(tr, 9, -1, 'l2'))).toBe(9);
	});
});

describe('softThreshold', () => {
	it('shrinks towards zero by t and clips to zero inside [-t, t]', () => {
		expect(softThreshold(2, 0.5)).toBeCloseTo(1.5, 12);
		expect(softThreshold(-2, 0.5)).toBeCloseTo(-1.5, 12);
		expect(softThreshold(0.3, 0.5)).toBeCloseTo(0, 12);
		expect(softThreshold(-0.5, 0.5)).toBeCloseTo(0, 12);
	});
});

describe('error on new data', () => {
	it('overfitting without penalty: the test error is far above the training error', () => {
		const w = fitModel(tr, 12, -4, 'l2');
		expect(mse(testSet(), w)).toBeGreaterThan(5 * mse(tr, w));
	});

	it('a moderate penalty lowers the test error of a high-degree model', () => {
		const te = testSet();
		expect(mse(te, fitModel(tr, 9, -1, 'l2'))).toBeLessThan(mse(te, fitModel(tr, 9, -4, 'l2')));
	});
});

describe('snapping and formatting', () => {
	it('clamps the degree to the range and rounds it', () => {
		expect(snapDegree(0)).toBe(DEG_MIN);
		expect(snapDegree(99)).toBe(DEG_MAX);
		expect(snapDegree(4.6)).toBe(5);
		expect(snapDegree(Number.NaN)).toBe(9);
		expect(snapDegree('3')).toBe(9);
	});

	it('snaps log10 lambda to the slider step inside its range', () => {
		expect(snapLogLambda(-2.1)).toBe(-2);
		expect(snapLogLambda(-2.2)).toBe(-2.25);
		expect(snapLogLambda(-2.13)).toBe(-2.25);
		expect(snapLogLambda(-9)).toBe(LOG_LAMBDA_MIN);
		expect(snapLogLambda(9)).toBe(LOG_LAMBDA_MAX);
		expect(snapLogLambda(Number.POSITIVE_INFINITY)).toBe(DEFAULT_LOG_LAMBDA);
	});

	it('formats lambda with two significant digits', () => {
		expect(formatLambda(0.01)).toBe('0.010');
		expect(formatLambda(10 ** -4)).toBe('0.00010');
	});
});
