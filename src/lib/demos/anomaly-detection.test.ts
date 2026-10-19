import { describe, expect, it } from 'vitest';
import {
	DOMAIN,
	GAMMA_MAX,
	GAMMA_MIN,
	N_ANOMALY,
	N_NORMAL,
	averagePrecision,
	chapterExample,
	clampPoint,
	confusion,
	describeState,
	flagCount,
	flagTop,
	fmt,
	makeCloud,
	precisionAt,
	prCurve,
	quality,
	scores,
	snapGamma,
} from './anomaly-detection';

const cloud = makeCloud();

describe('makeCloud', () => {
	it('has 990 normal points and 10 anomalies, the same on every call', () => {
		expect(cloud.filter((p) => !p.anomaly)).toHaveLength(N_NORMAL);
		expect(cloud.filter((p) => p.anomaly)).toHaveLength(N_ANOMALY);
		expect(makeCloud()).toEqual(cloud);
	});

	it('keeps every coordinate inside the plotted square', () => {
		for (const p of cloud) {
			expect(Math.abs(p.x)).toBeLessThanOrEqual(DOMAIN);
			expect(Math.abs(p.y)).toBeLessThanOrEqual(DOMAIN);
		}
	});
});

describe('scores and threshold', () => {
	it('gives anomalies a higher mean score than normal points', () => {
		const sc = scores(cloud);
		const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
		const a = cloud.flatMap((p, i) => (p.anomaly ? [sc[i] ?? 0] : []));
		const normal = cloud.flatMap((p, i) => (p.anomaly ? [] : [sc[i] ?? 0]));
		expect(mean(a)).toBeGreaterThan(mean(normal));
	});

	it('flags a share of the points, at least one', () => {
		expect(flagCount(1000, 0.01)).toBe(10);
		expect(flagCount(1000, 0.2)).toBe(200);
		expect(flagCount(1000, 0.0001)).toBe(1);
	});

	it('flags exactly the k most unusual points and reports the k-th score as the threshold', () => {
		const sc = scores(cloud);
		const k = 25;
		const { flags, tau } = flagTop(sc, k);
		expect(flags.filter(Boolean)).toHaveLength(k);
		const flaggedMin = Math.min(...sc.filter((_, i) => flags[i]));
		const unflaggedMax = Math.max(...sc.filter((_, i) => !flags[i]));
		expect(flaggedMin).toBeGreaterThanOrEqual(unflaggedMax);
		expect(tau).toBe(flaggedMin);
	});
});

describe('quality of the flags', () => {
	it('computes precision, recall and accuracy from the counts', () => {
		const c = { tp: 8, fp: 2, fn: 2, tn: 988 };
		const q = quality(c);
		expect(q.precision).toBeCloseTo(0.8, 10);
		expect(q.recall).toBeCloseTo(0.8, 10);
		expect(q.accuracy).toBeCloseTo(0.996, 10);
		expect(q.baseline).toBeCloseTo(0.99, 10);
	});

	it('returns null precision when nothing is flagged', () => {
		const q = quality({ tp: 0, fp: 0, fn: 10, tn: 990 });
		expect(q.precision).toBeNull();
		expect(q.recall).toBe(0);
	});

	it('gives recall that never falls as the share grows, and a lower precision at 20% than at 1%', () => {
		const sc = scores(cloud);
		const recalls: number[] = [];
		let precisionAt1 = 0;
		let precisionAt20 = 0;
		for (let g = GAMMA_MIN; g <= GAMMA_MAX + 1e-9; g += 0.01) {
			const k = flagCount(cloud.length, g);
			const c = confusion(cloud, flagTop(sc, k).flags);
			const q = quality(c);
			recalls.push(q.recall ?? 0);
			if (Math.abs(g - 0.01) < 1e-9) precisionAt1 = q.precision ?? 0;
			if (Math.abs(g - 0.2) < 1e-9) precisionAt20 = q.precision ?? 0;
		}
		for (let i = 1; i < recalls.length; i++)
			expect(recalls[i] ?? 0).toBeGreaterThanOrEqual(recalls[i - 1] ?? 0);
		expect(precisionAt20).toBeLessThan(precisionAt1);
	});
});

describe('precision-recall curve', () => {
	it('gives average precision 1 for a perfect ranking', () => {
		const pts = [
			{ x: 0, y: 0, anomaly: true },
			{ x: 0, y: 0, anomaly: true },
			{ x: 0, y: 0, anomaly: false },
			{ x: 0, y: 0, anomaly: false },
		];
		const curve = prCurve(pts, [0.9, 0.8, 0.2, 0.1]);
		expect(averagePrecision(curve)).toBeCloseTo(1, 10);
		expect(curve[curve.length - 1]?.recall).toBe(1);
	});
});

describe('chapter numbers', () => {
	it('reproduces 80 / (80 + 495) ≈ 0,139 and 0,64 at 10% anomalies', () => {
		expect(80 / (80 + 495)).toBeCloseTo(0.1391, 4);
		expect(precisionAt(0.01, 0.8, 0.05)).toBeCloseTo(80 / 575, 10);
		expect(precisionAt(0.1, 0.8, 0.05)).toBeCloseTo(0.64, 10);
		const ex = chapterExample();
		expect(ex.precision).toBeCloseTo(80 / 575, 10);
		expect(ex.recall).toBeCloseTo(0.8, 10);
		expect(ex.accuracy).toBeCloseTo(0.9485, 10);
		expect(ex.precisionCommon).toBeCloseTo(0.64, 10);
	});
});

describe('helpers', () => {
	it('clamps points to the square and snaps the share to 0.01', () => {
		expect(clampPoint(10)).toBe(DOMAIN);
		expect(clampPoint(-10)).toBe(-DOMAIN);
		expect(snapGamma(0.123)).toBe(0.12);
		expect(snapGamma(0)).toBe(GAMMA_MIN);
		expect(snapGamma(1)).toBe(GAMMA_MAX);
		expect(snapGamma(Number.NaN)).toBe(0.01);
	});

	it('formats numbers with a decimal comma and an em dash for null', () => {
		expect(fmt(0.1391, 3)).toBe('0,139');
		expect(fmt(null)).toBe('—');
	});

	it('describes the default state with the counts', () => {
		const sc = scores(cloud);
		const k = flagCount(cloud.length, 0.01);
		const c = confusion(cloud, flagTop(sc, k).flags);
		const text = describeState(c, quality(c), k, cloud.length);
		expect(text).toContain(`Помечено 10 из ${cloud.length} точек`);
		expect(text).toContain(`Найдено ${c.tp} из 10 аномалий`);
	});
});
