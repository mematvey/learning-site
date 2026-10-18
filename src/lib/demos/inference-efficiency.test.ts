import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	KV_GROUPS,
	MAX_CONTEXT,
	acceptCurve,
	describeState,
	expectedAccepted,
	formatBytes,
	formatInt,
	kvBytesPerToken,
	kvCacheBytes,
	kvSeries,
	linePath,
	scaleLinear,
	snapAlpha,
	snapContext,
} from './inference-efficiency';

const MHA_GROUPS = 32;

describe('kvBytesPerToken', () => {
	it('gives 512 KiB per token for the reference model with 32 groups', () => {
		expect(kvBytesPerToken(MHA_GROUPS)).toBe(524288);
		expect(formatBytes(kvBytesPerToken(MHA_GROUPS))).toBe('512 КиБ');
	});

	it('is proportional to the number of key/value groups', () => {
		expect(kvBytesPerToken(8)).toBe(kvBytesPerToken(MHA_GROUPS) / 4);
		expect(kvBytesPerToken(1)).toBe(kvBytesPerToken(MHA_GROUPS) / 32);
	});
});

describe('kvCacheBytes', () => {
	it('gives 2 GiB for 4096 tokens with multi-head attention', () => {
		expect(kvCacheBytes(4096, 'mha')).toBe(2 * 1024 ** 3);
		expect(formatBytes(kvCacheBytes(4096, 'mha'))).toBe('2 ГиБ');
	});

	it('is 4 times smaller with GQA and 32 times smaller with MQA, as in the text', () => {
		const mha = kvCacheBytes(4096, 'mha');
		expect(mha / kvCacheBytes(4096, 'gqa')).toBe(4);
		expect(mha / kvCacheBytes(4096, 'mqa')).toBe(32);
		expect(formatBytes(kvCacheBytes(4096, 'gqa'))).toBe('512 МиБ');
		expect(formatBytes(kvCacheBytes(4096, 'mqa'))).toBe('64 МиБ');
	});

	it('grows linearly with the context length', () => {
		expect(kvCacheBytes(8192, 'gqa')).toBe(2 * kvCacheBytes(4096, 'gqa'));
		expect(kvCacheBytes(0, 'mha')).toBe(0);
	});

	it('uses 8 groups for GQA and one for MQA', () => {
		expect(KV_GROUPS).toEqual({ mha: 32, gqa: 8, mqa: 1 });
	});
});

describe('formatBytes', () => {
	it('picks the binary unit and uses a decimal comma', () => {
		expect(formatBytes(100)).toBe('100 Б');
		expect(formatBytes(1024)).toBe('1 КиБ');
		expect(formatBytes(1.5 * 1024 ** 3)).toBe('1,5 ГиБ');
		expect(formatBytes(16 * 1024 ** 3)).toBe('16 ГиБ');
	});

	it('keeps values just under 1 KiB in bytes', () => {
		expect(formatBytes(1023)).toBe('1023 Б');
	});

	it('handles invalid input', () => {
		expect(formatBytes(Number.NaN)).toBe('0 Б');
		expect(formatBytes(-5)).toBe('0 Б');
	});
});

describe('expectedAccepted', () => {
	it('gives about 3.36 tokens for alpha 0.8 and k = 4', () => {
		expect(expectedAccepted(0.8, 4)).toBeCloseTo(3.36, 2);
	});

	it('gives about 1.94 tokens for alpha 0.5 and k = 4', () => {
		expect(expectedAccepted(0.5, 4)).toBeCloseTo(1.94, 2);
	});

	it('is 1 when nothing is accepted and k + 1 when everything is accepted', () => {
		expect(expectedAccepted(0, 4)).toBe(1);
		expect(expectedAccepted(1, 4)).toBe(5);
	});

	it('equals the direct sum of alpha^i for i = 0..k', () => {
		const alpha = 0.65;
		let sum = 0;
		for (let i = 0; i <= 4; i++) sum += alpha ** i;
		expect(expectedAccepted(alpha, 4)).toBeCloseTo(sum, 12);
	});

	it('grows with the acceptance rate', () => {
		const ys = acceptCurve().map((p) => p.y);
		for (let i = 1; i < ys.length; i++) {
			expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] ?? 0);
		}
	});
});

describe('snapping', () => {
	it('snaps the context to the step and clamps it to the range', () => {
		expect(snapContext(4100)).toBe(4096);
		expect(snapContext(100)).toBe(256);
		expect(snapContext(999999)).toBe(MAX_CONTEXT);
		expect(snapContext(Number.NaN)).toBe(DEFAULT_STATE.context);
	});

	it('snaps alpha to 0.05 and clamps it to [0, 1]', () => {
		expect(snapAlpha(0.83)).toBe(0.85);
		expect(snapAlpha(-1)).toBe(0);
		expect(snapAlpha(3)).toBe(1);
		expect(snapAlpha(Number.NaN)).toBe(DEFAULT_STATE.alpha);
	});
});

describe('charts', () => {
	it('builds a straight line from the origin for the cache series', () => {
		const pts = kvSeries('gqa');
		expect(pts[0]).toEqual({ x: 0, y: 0 });
		expect(pts[1]).toEqual({ x: MAX_CONTEXT, y: kvCacheBytes(MAX_CONTEXT, 'gqa') });
	});

	it('maps domain ends to range ends', () => {
		const s = scaleLinear(0, 10, 0, 100);
		expect(s(0)).toBe(0);
		expect(s(10)).toBe(100);
		expect(s(5)).toBe(50);
	});

	it('writes an SVG polyline path', () => {
		expect(
			linePath([
				{ x: 1, y: 2 },
				{ x: 3.25, y: 4 },
			]),
		).toBe('M1.0 2.0 L3.3 4.0');
	});
});

describe('describeState', () => {
	it('gives numbers from the state in words', () => {
		const text = describeState({ context: 4096, attention: 'mha', alpha: 0.8 });
		expect(text).toContain('2 ГиБ');
		expect(text).toContain('512 КиБ');
		expect(text).toContain('3,36');
	});

	it('is deterministic for the same state', () => {
		const state = { context: 2048, attention: 'gqa' as const, alpha: 0.5 };
		expect(describeState(state)).toBe(describeState(state));
	});

	it('formats thousands with a non-breaking space', () => {
		expect(formatInt(4096)).toBe('4 096');
	});
});
