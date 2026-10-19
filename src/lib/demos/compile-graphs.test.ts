import { describe, expect, it } from 'vitest';
import {
	allTotals,
	explain,
	fmt,
	formulaText,
	modeOf,
	snapB,
	snapN,
	timeline,
	timeCompile,
	timeEager,
	timeGraph,
	timeCompileGraph,
	wIndexOf,
	wAt,
	type Mode,
	type Params,
	type Span,
} from './compile-graphs';

/** Idle time on the GPU between kernel i-1 and kernel i. */
function gap(spans: readonly Span[], i: number): number {
	const prev = spans[i - 1];
	const cur = spans[i];
	if (!prev || !cur) throw new Error(`no kernel at index ${i}`);
	return cur.start - prev.end;
}

const SMALL: Params = { n: 8, w: 0.25, b: 0 };
const BIG: Params = { n: 8, w: 20, b: 0 };

describe('chapter table (N=8, K=2, o=1)', () => {
	it('eager, compile, graph and compile+graph at w = 0.25 and w = 20', () => {
		expect(allTotals(SMALL)).toEqual({
			eager: 8.25,
			compile: 2.25,
			graph: 3,
			'compile-graph': 1.5,
		});
		expect(allTotals(BIG)).toEqual({
			eager: 161,
			compile: 41,
			graph: 161,
			'compile-graph': 41,
		});
	});

	it('compile with two graph breaks gives 4.25 at w = 0.25 and 81 at w = 20', () => {
		expect(timeCompile({ n: 8, w: 0.25, b: 2 })).toBeCloseTo(4.25, 10);
		expect(timeCompileGraph(SMALL)).toBeCloseTo(1.5, 10);
		expect(timeCompile({ n: 8, w: 20, b: 2 })).toBe(81);
	});

	it('CUDA graph saves (N-1)(o-w) when launch is longer than work, and nothing at w = 20', () => {
		expect(timeEager(SMALL) - timeGraph(SMALL)).toBeCloseTo((8 - 1) * (1 - 0.25), 10);
		expect(timeEager(BIG) - timeGraph(BIG)).toBe(0);
	});
});

describe('timeline matches the closed forms', () => {
	const cases: Params[] = [
		SMALL,
		BIG,
		{ n: 8, w: 0.5, b: 2 },
		{ n: 1, w: 1, b: 0 },
		{ n: 32, w: 5, b: 4 },
	];
	const modes: Mode[] = ['eager', 'compile', 'graph', 'compile-graph'];

	for (const p of cases) {
		for (const mode of modes) {
			it(`${mode} with n=${p.n}, w=${p.w}, b=${p.b} ends at the formula value`, () => {
				expect(timeline(mode, p).total).toBeCloseTo(allTotals(p)[mode], 10);
			});
		}
	}

	it('eager at w = 0.25 has idle gaps between kernels on the GPU', () => {
		const gpu = timeline('eager', SMALL).gpu;
		expect(gpu).toHaveLength(8);
		for (let i = 1; i < gpu.length; i++) {
			expect(gap(gpu, i)).toBeGreaterThan(0);
		}
	});

	it('CUDA graph kernels run back to back without gaps', () => {
		const gpu = timeline('graph', SMALL).gpu;
		for (let i = 1; i < gpu.length; i++) {
			expect(gap(gpu, i)).toBeCloseTo(0, 10);
		}
	});

	it('compiled mode launches K + B kernels', () => {
		expect(timeline('compile', { n: 8, w: 1, b: 2 }).gpu).toHaveLength(4);
		expect(timeline('compile-graph', { n: 8, w: 1, b: 2 }).gpu).toHaveLength(2);
	});
});

describe('modes and snapping', () => {
	it('maps the two switches to four modes', () => {
		expect(modeOf(false, false)).toBe('eager');
		expect(modeOf(true, false)).toBe('compile');
		expect(modeOf(false, true)).toBe('graph');
		expect(modeOf(true, true)).toBe('compile-graph');
	});

	it('clamps and rounds N and B', () => {
		expect(snapN(0)).toBe(1);
		expect(snapN(100)).toBe(32);
		expect(snapN(7.6)).toBe(8);
		expect(snapN(Number.NaN)).toBe(8);
		expect(snapB(-1)).toBe(0);
		expect(snapB(9)).toBe(4);
		expect(snapB(2.4)).toBe(2);
	});

	it('maps w to the nearest step', () => {
		expect(wAt(wIndexOf(0.25))).toBe(0.25);
		expect(wAt(wIndexOf(19))).toBe(20);
		expect(wAt(wIndexOf(Number.NaN))).toBe(0.25);
	});
});

describe('text helpers', () => {
	it('formats integers without decimals and others with a comma', () => {
		expect(fmt(161)).toBe('161');
		expect(fmt(8.25)).toBe('8,25');
		expect(fmt(1.5)).toBe('1,50');
	});

	it('writes the formula with the substituted numbers', () => {
		expect(formulaText('eager', SMALL)).toContain('= 8,25');
		expect(formulaText('compile-graph', SMALL)).toContain('= 1,5');
	});

	it('explains the bottleneck and the cost of a graph break', () => {
		expect(explain('eager', SMALL)).toContain('GPU ждёт CPU');
		expect(explain('eager', BIG)).toContain('почти ничего не меняет');
		expect(explain('compile', { n: 8, w: 0.25, b: 2 })).toContain('+2');
	});
});
