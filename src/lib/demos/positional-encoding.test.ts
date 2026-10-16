import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	DIM_MAX,
	DIM_MIN,
	K_BASE,
	N_POS,
	Q_BASE,
	clampPair,
	describeState,
	encodingTable,
	frequencies,
	rotate,
	ropeDot,
	ropeReadout,
	shadePercent,
	sinusoidalEncoding,
	snapDelta,
	snapDim,
	snapPos,
} from './positional-encoding';

describe('snapping of the sliders', () => {
	it('dimension is even and clamped', () => {
		expect(snapDim(5)).toBe(6);
		expect(snapDim(1)).toBe(DIM_MIN);
		expect(snapDim(100)).toBe(DIM_MAX);
		expect(snapDim(Number.NaN)).toBe(DEFAULT_STATE.dim);
	});

	it('position and offset are integers in range', () => {
		expect(snapPos(2.6)).toBe(3);
		expect(snapPos(-4)).toBe(0);
		expect(snapPos(99)).toBe(N_POS - 1);
		expect(snapDelta(-3)).toBe(0);
		expect(snapDelta(50)).toBe(20);
	});

	it('pair index never exceeds the pairs of the dimension', () => {
		expect(clampPair(10, 16)).toBe(7);
		expect(clampPair(-1, 16)).toBe(0);
	});
});

describe('frequencies', () => {
	it('start at 1 and decrease, so the first pair is the fastest', () => {
		const w = frequencies(16);
		expect(w).toHaveLength(8);
		expect(w[0]).toBe(1);
		for (let i = 1; i < w.length; i++) expect(w[i] ?? NaN).toBeLessThan(w[i - 1] ?? NaN);
		expect(w[7] ?? NaN).toBeCloseTo(Math.pow(10000, -14 / 16), 12);
	});
});

describe('sinusoidal encoding', () => {
	it('position 0 gives sin 0 = 0 and cos 0 = 1 in every pair', () => {
		const pe = sinusoidalEncoding(0, 6);
		expect(pe).toEqual([0, 1, 0, 1, 0, 1]);
	});

	it('the first pair with d = 2 is (sin pos, cos pos)', () => {
		const pe = sinusoidalEncoding(1, 2);
		expect(pe[0]).toBeCloseTo(Math.sin(1), 12);
		expect(pe[1]).toBeCloseTo(Math.cos(1), 12);
	});

	it('table has one row per position and values in [-1, 1]', () => {
		const table = encodingTable(16);
		expect(table).toHaveLength(N_POS);
		for (const row of table) {
			expect(row).toHaveLength(16);
			expect(row.every((v) => v >= -1 && v <= 1)).toBe(true);
		}
	});

	it('is deterministic', () => {
		expect(encodingTable(16)).toEqual(encodingTable(16));
	});
});

describe('RoPE rotation', () => {
	it('rotation by 0 is identity and by π/2 maps (1, 0) to (0, 1)', () => {
		expect(rotate([0.3, -0.7], 0)).toEqual([0.3, -0.7]);
		const [x, y] = rotate([1, 0], Math.PI / 2);
		expect(x).toBeCloseTo(0, 12);
		expect(y).toBeCloseTo(1, 12);
	});

	it('the score depends only on the offset n − m, not on absolute positions', () => {
		const omega = frequencies(16)[2] ?? 0;
		const delta = 5;
		const ref = ropeDot(Q_BASE, K_BASE, 0, delta, omega);
		for (const m of [1, 3, 17, 40]) {
			expect(ropeDot(Q_BASE, K_BASE, m, m + delta, omega)).toBeCloseTo(ref, 9);
		}
	});

	it('score equals q · R((n − m)ω) k', () => {
		const omega = 0.37;
		const direct = ropeDot(Q_BASE, K_BASE, 4, 9, omega);
		const [rx, ry] = rotate(K_BASE, 5 * omega);
		expect(direct).toBeCloseTo(Q_BASE[0] * rx + Q_BASE[1] * ry, 12);
	});

	it('readout uses the clamped pair and the key position n = m + Δ', () => {
		const r = ropeReadout({ dim: 4, pos: 3, pair: 9, delta: 2 });
		expect(r.n).toBe(5);
		expect(r.omega).toBeCloseTo(frequencies(4)[1] ?? NaN, 12);
		expect(r.score).toBeCloseTo(r.scoreAtZero, 9);
	});
});

describe('heatmap shading and text', () => {
	it('maps −1, 0, 1 to 0%, 50%, 100%', () => {
		expect(shadePercent(-1)).toBe(0);
		expect(shadePercent(0)).toBe(50);
		expect(shadePercent(1)).toBe(100);
	});

	it('describeState names the pair, the angles and the offset', () => {
		const text = describeState(DEFAULT_STATE);
		expect(text).toContain('Пара 1 из 8');
		expect(text).toContain('Δ = 6');
	});
});
