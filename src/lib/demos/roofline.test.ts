import { describe, expect, it } from 'vitest';
import {
	EXP_MAX,
	EXP_MIN,
	GEMM_N,
	HBM_BANDWIDTH_TBS,
	I_MAX,
	I_MIN,
	KERNELS,
	attainable,
	bound,
	clampIntensity,
	describeRoofline,
	expFromIntensity,
	formatNumber,
	gemmIntensity,
	intensityFromExp,
	isUnit,
	kernelById,
	ridgePoint,
	roofPoints,
	utilization,
	xToPx,
	yToPx,
	type PlotBox,
} from './roofline';

const BOX: PlotBox = { width: 400, height: 260, left: 40, right: 10, top: 10, bottom: 30 };

describe('ridge point and roofs', () => {
	it('matches the chapter values', () => {
		expect(ridgePoint('fp32')).toBeCloseTo(20.0, 1);
		expect(ridgePoint('fp16Tensor')).toBeCloseTo(295.2, 1);
	});

	it('takes the bandwidth roof below the ridge and the peak above it', () => {
		expect(attainable(1, 'fp16Tensor')).toBeCloseTo(HBM_BANDWIDTH_TBS, 10);
		expect(attainable(10000, 'fp16Tensor')).toBe(989);
		expect(attainable(10000, 'fp32')).toBe(67);
	});

	it('gives the reference value of the lab: intensity 1 at 3.35 TB/s is 3.35 TFLOPS', () => {
		expect(attainable(1, 'fp16Tensor')).toBeCloseTo(3.35, 10);
	});

	it('is continuous at the ridge point', () => {
		for (const unit of ['fp32', 'fp16Tensor'] as const) {
			const r = ridgePoint(unit);
			expect(attainable(r, unit)).toBeCloseTo(attainable(r * 1.0000001, unit), 6);
		}
	});

	it('returns three corner points of the roof, with the knee at the ridge point', () => {
		const [start, knee, end] = roofPoints('fp32');
		expect(start?.x).toBe(I_MIN);
		expect(knee?.x).toBeCloseTo(ridgePoint('fp32'), 10);
		expect(knee?.y).toBe(67);
		expect(end?.y).toBe(67);
	});
});

describe('bound and utilization', () => {
	it('classifies by the ridge point', () => {
		expect(bound(0.083, 'fp32')).toBe('memory');
		expect(bound(19.9, 'fp32')).toBe('memory');
		expect(bound(20.1, 'fp32')).toBe('compute');
		expect(bound(1, 'fp16Tensor')).toBe('memory');
		expect(bound(1365, 'fp16Tensor')).toBe('compute');
	});

	it('gives the fraction of the peak', () => {
		expect(utilization(1, 'fp16Tensor')).toBeCloseTo(3.35 / 989, 10);
		expect(utilization(1e6, 'fp32')).toBe(1);
	});
});

describe('kernel presets', () => {
	it('computes GEMM intensity as N / 3', () => {
		expect(gemmIntensity(GEMM_N)).toBeCloseTo(1365.33, 2);
		expect(gemmIntensity(3)).toBe(1);
	});

	it('gives the addition kernel about 0.28 TFLOPS on FP32', () => {
		const add = kernelById('add');
		expect(add.unit).toBe('fp32');
		expect(attainable(add.intensity, add.unit)).toBeCloseTo(0.2791, 3);
	});

	it('puts the GEMM and decode kernels on the tensor roof', () => {
		expect(kernelById('gemm').unit).toBe('fp16Tensor');
		expect(bound(kernelById('gemm').intensity, 'fp16Tensor')).toBe('compute');
		expect(bound(kernelById('decode').intensity, 'fp16Tensor')).toBe('memory');
	});

	it('lists three kernels with letters A, B, C', () => {
		expect(KERNELS.map((k) => k.letter)).toEqual(['A', 'B', 'C']);
	});
});

describe('clamping and slider mapping', () => {
	it('clamps the intensity to the plot domain and maps non-finite to 1', () => {
		expect(clampIntensity(0)).toBe(I_MIN);
		expect(clampIntensity(1e9)).toBe(I_MAX);
		expect(clampIntensity(Number.NaN)).toBe(1);
		expect(clampIntensity(5)).toBe(5);
	});

	it('round-trips slider position and intensity', () => {
		expect(intensityFromExp(0)).toBe(1);
		expect(expFromIntensity(1)).toBe(0);
		expect(intensityFromExp(EXP_MIN - 5)).toBe(I_MIN);
		expect(intensityFromExp(EXP_MAX + 5)).toBe(I_MAX);
		expect(expFromIntensity(intensityFromExp(-0.5))).toBeCloseTo(-0.5, 10);
	});

	it('checks unit names', () => {
		expect(isUnit('fp32')).toBe(true);
		expect(isUnit('fp16Tensor')).toBe(true);
		expect(isUnit('fp8')).toBe(false);
	});
});

describe('pixel mapping', () => {
	it('puts the domain ends on the plot edges', () => {
		expect(xToPx(I_MIN, BOX)).toBeCloseTo(BOX.left, 10);
		expect(xToPx(I_MAX, BOX)).toBeCloseTo(BOX.width - BOX.right, 10);
		expect(yToPx(1000, BOX)).toBeCloseTo(BOX.top, 10);
		expect(yToPx(0.01, BOX)).toBeCloseTo(BOX.height - BOX.bottom, 10);
	});

	it('is monotonic: larger intensity is further right, larger performance is higher', () => {
		expect(xToPx(10, BOX)).toBeGreaterThan(xToPx(1, BOX));
		expect(yToPx(100, BOX)).toBeLessThan(yToPx(10, BOX));
	});
});

describe('formatting and description', () => {
	it('uses a decimal comma', () => {
		expect(formatNumber(1365.33)).toBe('1365');
		expect(formatNumber(20)).toBe('20,0');
		expect(formatNumber(0.2791)).toBe('0,28');
	});

	it('names the limit and the reachable value', () => {
		const text = describeRoofline(1, 'fp16Tensor');
		expect(text).toContain('Предел: память');
		expect(text).toContain('3,4 TFLOPS из 989 TFLOPS');
		expect(describeRoofline(1365.33, 'fp16Tensor')).toContain('Предел: вычисления');
	});
});
