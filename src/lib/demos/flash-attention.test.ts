import { describe, expect, it } from 'vitest';
import {
	DEMO_SCORES,
	DEMO_VALUES,
	EMPTY_STATE,
	clampStep,
	describeStep,
	mergeState,
	naiveAttention,
	onlineAttention,
	outputAfter,
	outputOf,
	tileIndices,
	tileState,
	walkRow,
} from './flash-attention';

/** Small deterministic generator, so the random cases are the same on every run. */
function lcg(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

describe('online softmax over tiles', () => {
	it('matches the naive attention on the chapter example for every tile size', () => {
		const ref = naiveAttention(DEMO_SCORES, DEMO_VALUES);
		expect(ref).toBeCloseTo(24.9, 1);
		for (const size of [1, 2, 3, 4]) {
			expect(onlineAttention(DEMO_SCORES, DEMO_VALUES, size)).toBeCloseTo(ref, 10);
		}
	});

	it('matches the naive result when the maximum comes late, in the last tile', () => {
		const scores = [0.1, -0.4, 0.3, 7];
		const values = [1, 2, 3, 4];
		expect(onlineAttention(scores, values, 2)).toBeCloseTo(naiveAttention(scores, values), 10);
		expect(onlineAttention(scores, values, 1)).toBeCloseTo(naiveAttention(scores, values), 10);
	});

	it('matches the naive result on random rows with several tile sizes', () => {
		const rnd = lcg(42);
		for (let trial = 0; trial < 50; trial++) {
			const n = 1 + Math.floor(rnd() * 12);
			const scores = Array.from({ length: n }, () => (rnd() - 0.5) * 20);
			const values = Array.from({ length: n }, () => (rnd() - 0.5) * 10);
			const ref = naiveAttention(scores, values);
			for (const size of [1, 2, 3, 4, 8]) {
				expect(onlineAttention(scores, values, size)).toBeCloseTo(ref, 9);
			}
		}
	});

	it('does not overflow on large scores', () => {
		const scores = [1000, 1001, 999];
		const values = [1, 2, 3];
		const out = onlineAttention(scores, values, 1);
		expect(Number.isFinite(out)).toBe(true);
		expect(out).toBeCloseTo(naiveAttention(scores, values), 9);
	});
});

describe('tiles and merging', () => {
	it('splits the row into consecutive tiles, the last one may be shorter', () => {
		expect(tileIndices(4, 2)).toEqual([
			[0, 1],
			[2, 3],
		]);
		expect(tileIndices(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
		expect(tileIndices(4, 1)).toHaveLength(4);
	});

	it('gives the same accumulated state for any tile partition', () => {
		const a = walkRow(DEMO_SCORES, DEMO_VALUES, 1).at(-1)!.after;
		const b = walkRow(DEMO_SCORES, DEMO_VALUES, 2).at(-1)!.after;
		expect(b.m).toBe(a.m);
		expect(b.l).toBeCloseTo(a.l, 10);
		expect(b.a).toBeCloseTo(a.a, 10);
	});

	it('merge with an empty state returns the other state', () => {
		const s = tileState(DEMO_SCORES, DEMO_VALUES, [0, 1]);
		expect(mergeState(EMPTY_STATE, s)).toEqual(s);
	});

	it('the merge order of two tiles does not change the result', () => {
		const A = tileState(DEMO_SCORES, DEMO_VALUES, [0, 1]);
		const B = tileState(DEMO_SCORES, DEMO_VALUES, [2, 3]);
		const ab = mergeState(A, B);
		const ba = mergeState(B, A);
		expect(ab.m).toBe(ba.m);
		expect(ab.l).toBeCloseTo(ba.l, 12);
		expect(ab.a).toBeCloseTo(ba.a, 12);
	});

	it('reproduces the chapter table: m, l and a after each element', () => {
		const steps = walkRow(DEMO_SCORES, DEMO_VALUES, 1);
		expect(steps.map((s) => s.after.m)).toEqual([2, 5, 5, 5]);
		expect(steps[1]!.after.l).toBeCloseTo(1.0498, 4);
		expect(steps[2]!.after.l).toBeCloseTo(1.0681, 4);
		expect(steps[3]!.after.l).toBeCloseTo(1.436, 4);
		expect(steps[1]!.after.a).toBeCloseTo(20.4979, 4);
		expect(steps[2]!.after.a).toBeCloseTo(21.0474, 3);
		expect(steps[3]!.after.a).toBeCloseTo(35.7626, 3);
		expect(outputOf(steps[3]!.after)).toBeCloseTo(24.9, 1);
	});

	it('the rescale factor is e^(-3) when the maximum jumps from 2 to 5', () => {
		const steps = walkRow(DEMO_SCORES, DEMO_VALUES, 1);
		expect(steps[1]!.rescale).toBeCloseTo(Math.exp(-3), 12);
		expect(steps[2]!.rescale).toBe(1);
	});
});

describe('outputAfter and clampStep', () => {
	it('returns the empty state before the first tile', () => {
		expect(outputAfter(DEMO_SCORES, DEMO_VALUES, 2, 0)).toEqual(EMPTY_STATE);
	});

	it('clamps the step to the number of tiles', () => {
		expect(clampStep(9, 4)).toBe(4);
		expect(clampStep(-2, 4)).toBe(0);
		expect(clampStep(Number.NaN, 4)).toBe(0);
		expect(clampStep(2.7, 4)).toBe(2);
	});
});

describe('describeStep', () => {
	it('describes the state before any tile is merged', () => {
		const steps = walkRow(DEMO_SCORES, DEMO_VALUES, 2);
		expect(describeStep(steps, 0, 2, 24.9)).toContain('Ещё ничего не учтено');
	});

	it('mentions the rescaling when the maximum changes in the second tile', () => {
		const steps = walkRow(DEMO_SCORES, DEMO_VALUES, 2);
		const text = describeStep(steps, 1, 2, 24.9);
		expect(text).toContain('Тайл 1 из 2');
		expect(text).toContain('1, 2');
	});
});
