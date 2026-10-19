import { describe, expect, it } from 'vitest';
import {
	BETAS,
	DATA_CENTERS,
	T,
	alphaBar,
	clampStep,
	formatNumber,
	makeData,
	makeNoise,
	noiseShare,
	predictNoise,
	qSample,
	runReverse,
	signalShare,
} from './diffusion';

describe('noise schedule', () => {
	it('has T steps with beta from 1e-4 to 0.02', () => {
		expect(BETAS).toHaveLength(T);
		expect(BETAS[0]).toBeCloseTo(1e-4, 12);
		expect(BETAS[T - 1]).toBeCloseTo(0.02, 12);
	});

	it('gives the signal shares from the chapter', () => {
		expect(signalShare(1).toFixed(4)).toBe('0.9999');
		expect(signalShare(250).toFixed(4)).toBe('0.7239');
		expect(signalShare(500).toFixed(4)).toBe('0.2803');
		expect(signalShare(1000).toFixed(4)).toBe('0.0064');
		expect(formatNumber(signalShare(100), 2)).toBe('0,95');
	});

	it('crosses alpha_bar = 0.5 around step 260', () => {
		expect(alphaBar(259)).toBeGreaterThan(0.5);
		expect(alphaBar(261)).toBeLessThan(0.5);
	});

	it('keeps signal and noise shares normalised and has no signal at t = 0', () => {
		for (const t of [0, 1, 250, 500, 1000]) {
			expect(signalShare(t) ** 2 + noiseShare(t) ** 2).toBeCloseTo(1, 10);
		}
		expect(signalShare(0)).toBe(1);
		expect(noiseShare(0)).toBe(0);
	});

	it('clamps step indices', () => {
		expect(clampStep(-5)).toBe(0);
		expect(clampStep(2000)).toBe(T);
		expect(clampStep(Number.NaN)).toBe(0);
		expect(clampStep(12.6)).toBe(13);
	});
});

describe('forward process', () => {
	it('returns the clean point at t = 0', () => {
		const x0 = [0.3, -0.7] as const;
		const eps = [1.5, 2] as const;
		const xt = qSample(x0, 0, eps);
		expect(xt[0]).toBeCloseTo(0.3, 12);
		expect(xt[1]).toBeCloseTo(-0.7, 12);
	});

	it('predicts the noise almost equal to x_T at the last step, where x_T is pure noise', () => {
		const xT: [number, number] = [0.8, -1.3];
		const pred = predictNoise(xT, T);
		expect(Math.abs(pred[0] - xT[0])).toBeLessThan(0.02);
		expect(Math.abs(pred[1] - xT[1])).toBeLessThan(0.02);
	});

	it('is deterministic for a fixed seed', () => {
		expect(makeData()).toEqual(makeData());
		expect(makeNoise()).toEqual(makeNoise());
	});
});

describe('reverse sampler', () => {
	it('is deterministic for a fixed seed', () => {
		expect(runReverse()).toEqual(runReverse());
	});

	it('ends near the two clusters, not at the origin or in the noise', () => {
		const samples = runReverse();
		const meanNearest =
			samples.reduce((s, p) => {
				const d = Math.min(...DATA_CENTERS.map((c) => Math.hypot(p[0] - c[0], p[1] - c[1])));
				return s + d;
			}, 0) / samples.length;
		expect(samples.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))).toBe(true);
		expect(meanNearest).toBeLessThan(0.6);
	});
});
