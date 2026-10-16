import { describe, expect, it } from 'vitest';
import {
	BLOCK_SIZES,
	DEFAULT_STATE,
	LAYOUT,
	N_MAX,
	WARP,
	applyPatch,
	clampSel,
	describeGrid,
	gridDim,
	globalIndex,
	idleThreads,
	launchedThreads,
	layoutGrid,
	missedElements,
	snapBlockDim,
	snapN,
	summarize,
	threadOf,
} from './cuda-basics';

describe('gridDim', () => {
	it('rounds up for the chapter example: 1000 elements, 256 threads -> 4 blocks', () => {
		expect(gridDim(1000, 256, 'up')).toBe(4);
		expect(launchedThreads(4, 256)).toBe(1024);
		expect(idleThreads(1000, 4, 256)).toBe(24);
	});

	it('rounds down to 3 blocks and misses the tail when rounding is floor', () => {
		expect(gridDim(1000, 256, 'down')).toBe(3);
		expect(missedElements(1000, 3, 256)).toBe(232);
		expect(idleThreads(1000, 3, 256)).toBe(0);
	});

	it('gives no extra block when N is a multiple of B', () => {
		expect(gridDim(1024, 256, 'up')).toBe(4);
		expect(idleThreads(1024, 4, 256)).toBe(0);
	});

	it('handles N smaller than B', () => {
		expect(gridDim(1, 256, 'up')).toBe(1);
		expect(idleThreads(1, 1, 256)).toBe(255);
		expect(gridDim(100, 256, 'down')).toBe(0);
	});

	it('rejects non-positive or fractional sizes', () => {
		expect(() => gridDim(0, 256, 'up')).toThrow(RangeError);
		expect(() => gridDim(10, 0, 'up')).toThrow(RangeError);
		expect(() => gridDim(10.5, 4, 'up')).toThrow(RangeError);
	});

	it('keeps idle threads below one block for every N and B', () => {
		for (const b of BLOCK_SIZES) {
			for (let n = 1; n <= 300; n++) {
				const g = gridDim(n, b, 'up');
				expect(g * b).toBeGreaterThanOrEqual(n);
				expect(idleThreads(n, g, b)).toBeLessThan(b);
				expect(missedElements(n, g, b)).toBe(0);
			}
		}
	});
});

describe('global index', () => {
	it('is blockIdx * blockDim + threadIdx', () => {
		expect(globalIndex(0, 256, 0)).toBe(0);
		expect(globalIndex(0, 256, 255)).toBe(255);
		expect(globalIndex(1, 256, 0)).toBe(256);
		expect(globalIndex(3, 256, 231)).toBe(999);
		expect(globalIndex(3, 256, 255)).toBe(1023);
	});

	it('is a bijection with threadOf', () => {
		for (let i = 0; i < 1024; i++) {
			const { block, thread } = threadOf(i, 256);
			expect(globalIndex(block, 256, thread)).toBe(i);
		}
	});

	it('gives distinct indices to all launched threads', () => {
		const seen = new Set<number>();
		for (let b = 0; b < 4; b++) {
			for (let t = 0; t < 256; t++) seen.add(globalIndex(b, 256, t));
		}
		expect(seen.size).toBe(1024);
	});
});

describe('snapping and state', () => {
	it('clamps N to the allowed range and rounds it', () => {
		expect(snapN(0)).toBe(1);
		expect(snapN(5000)).toBe(N_MAX);
		expect(snapN(999.6)).toBe(1000);
		expect(snapN(Number.NaN)).toBe(DEFAULT_STATE.n);
	});

	it('snaps the block size to the nearest supported value', () => {
		expect(snapBlockDim(100)).toBe(128);
		expect(snapBlockDim(2000)).toBe(1024);
		expect(snapBlockDim(1)).toBe(32);
	});

	it('keeps sel inside the launched threads', () => {
		expect(clampSel(5000, 1024)).toBe(1023);
		expect(clampSel(-3, 1024)).toBe(0);
		expect(clampSel(7, 0)).toBe(0);
	});

	it('applyPatch updates the state and clamps sel after a size change', () => {
		const s = applyPatch(DEFAULT_STATE, { sel: 1023 });
		expect(s.sel).toBe(1023);
		const small = applyPatch(s, { n: 10 });
		expect(small.sel).toBe(255);
		const floored = applyPatch(DEFAULT_STATE, { rounding: 'down', blockDim: 1024 });
		expect(floored.rounding).toBe('down');
		expect(floored.blockDim).toBe(1024);
		expect(floored.sel).toBe(0);
	});
});

describe('describeGrid', () => {
	it('names the numbers of the chapter example', () => {
		const text = describeGrid(summarize(DEFAULT_STATE));
		expect(text).toContain('блоков 4');
		expect(text).toContain('1024');
		expect(text).toContain('24');
	});

	it('names the missed elements when rounding down', () => {
		const text = describeGrid(summarize({ ...DEFAULT_STATE, rounding: 'down' }));
		expect(text).toContain('232');
	});
});

describe('layoutGrid', () => {
	it('places one cell per launched thread and one per missed element', () => {
		for (const rounding of ['up', 'down'] as const) {
			for (const b of BLOCK_SIZES) {
				const s = summarize({ n: 1000, blockDim: b, rounding, sel: 0 });
				const layout = layoutGrid(s);
				const threads = layout.tiles.reduce((acc, t) => acc + t.cells.length, 0);
				expect(threads).toBe(s.launched);
				expect(layout.missed.length).toBe(s.missed);
			}
		}
	});

	it('marks exactly N threads as working in the up mode', () => {
		const layout = layoutGrid(summarize(DEFAULT_STATE));
		const working = layout.tiles.flatMap((t) => t.cells).filter((c) => c.work);
		expect(working.length).toBe(1000);
		expect(Math.max(...working.map((c) => c.index))).toBe(999);
	});

	it('keeps every cell inside the viewBox width and uses warp-sized rows', () => {
		const layout = layoutGrid(summarize({ ...DEFAULT_STATE, blockDim: 1024 }));
		for (const tile of layout.tiles) {
			for (const c of tile.cells) {
				expect(c.x + LAYOUT.cell).toBeLessThanOrEqual(layout.width);
				expect(c.y + LAYOUT.cell).toBeLessThanOrEqual(layout.height);
			}
		}
		const first = layoutGrid(summarize(DEFAULT_STATE)).tiles[0];
		expect(first?.cells[WARP]?.y).toBeGreaterThan(first?.cells[0]?.y ?? 0);
	});
});
