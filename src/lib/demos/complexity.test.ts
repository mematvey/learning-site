import { describe, expect, it } from 'vitest';
import {
	DEFAULT_K,
	DEFAULT_N,
	K_MAX,
	K_MIN,
	N_MAX,
	N_MIN,
	applyPatch,
	cheaper,
	crossover,
	curvePoints,
	describeState,
	formatCount,
	operations,
	snapK,
	snapN,
} from './complexity';

describe('operation counts', () => {
	it('matches the chapter example: 100n against n² at n = 100', () => {
		expect(operations('linear', 100, 100)).toBe(10000);
		expect(operations('quadratic', 100, 100)).toBe(10000);
	});

	it('exponential at n = 10 and n = 100', () => {
		expect(operations('exponential', 10, 1)).toBe(1024);
		expect(formatCount(operations('exponential', 100, 1))).toBe('1,27·10^30');
	});

	it('n log2 n at a power of two', () => {
		expect(operations('nlogn', 8, 1)).toBe(24);
	});

	it('doubling n multiplies the quadratic count by four', () => {
		expect(operations('quadratic', 20, 1) / operations('quadratic', 10, 1)).toBe(4);
	});
});

describe('crossover', () => {
	it('K · n meets n² at n = K', () => {
		for (const k of [K_MIN, 10, DEFAULT_K, K_MAX]) {
			expect(operations('linear', crossover(k), k)).toBe(operations('quadratic', crossover(k), k));
		}
	});

	it('quadratic is cheaper before the crossover, linear after it', () => {
		expect(cheaper(DEFAULT_N, DEFAULT_K)).toBe('quadratic');
		expect(cheaper(DEFAULT_K - 1, DEFAULT_K)).toBe('quadratic');
		expect(cheaper(DEFAULT_K, DEFAULT_K)).toBe('equal');
		expect(cheaper(DEFAULT_K + 1, DEFAULT_K)).toBe('linear');
	});
});

describe('curve points', () => {
	it('covers the whole axis with one point per step', () => {
		const pts = curvePoints('quadratic', DEFAULT_K);
		expect(pts).toHaveLength(N_MAX - N_MIN + 1);
		expect(pts[0]).toEqual([N_MIN, 1]);
		expect(pts[pts.length - 1]).toEqual([N_MAX, N_MAX * N_MAX]);
	});
});

describe('formatCount', () => {
	it('prints small integers as is and large ones in power-of-ten form', () => {
		expect(formatCount(0)).toBe('0');
		expect(formatCount(999_999)).toBe('999999');
		expect(formatCount(1_000_000)).toBe('1,00·10^6');
		expect(formatCount(9_999_999.9)).toBe('1,00·10^7');
	});
});

describe('snapping and patches', () => {
	it('clamps and rounds n and K to their ranges', () => {
		expect(snapN(0)).toBe(N_MIN);
		expect(snapN(1e6)).toBe(N_MAX);
		expect(snapN(10.4)).toBe(10);
		expect(snapK(-5)).toBe(K_MIN);
		expect(snapK(1000)).toBe(K_MAX);
		expect(snapK(Number.NaN)).toBe(DEFAULT_K);
	});

	it('applies only the fields present in the patch', () => {
		const start = { n: DEFAULT_N, k: DEFAULT_K };
		expect(applyPatch(start, { k: 7 })).toEqual({ n: DEFAULT_N, k: 7 });
		expect(applyPatch(start, {})).toEqual(start);
	});
});

describe('describeState', () => {
	it('names the cheaper algorithm and the crossover', () => {
		const text = describeState({ n: 50, k: 100 });
		expect(text).toContain('быстрее квадратичный');
		expect(text).toContain('Пересечение при n = 100');
	});
});
