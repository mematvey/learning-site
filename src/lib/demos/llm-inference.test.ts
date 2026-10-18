import { describe, expect, it } from 'vitest';
import {
	BATCHES,
	CONTEXTS,
	DEFAULT_STATE,
	H100_BANDWIDTH,
	MODELS,
	describeEstimate,
	estimate,
	findModel,
	formatBinary,
	formatGB,
	kvBytesPerToken,
	kvCacheBytes,
	snapBatch,
	snapContext,
	weightBytes,
} from './llm-inference';

const llama = findModel('llama3-8b-gqa');
const mha = findModel('llama3-8b-mha');

describe('KV-cache memory', () => {
	it('gives 128 KiB per token for Llama 3 8B in FP16 (GQA, 8 KV heads)', () => {
		expect(kvBytesPerToken(llama, 2)).toBe(131072);
	});

	it('gives exactly 1 GiB for 8192 tokens at batch 1', () => {
		expect(kvCacheBytes(llama, 2, 8192, 1)).toBe(1073741824);
	});

	it('scales linearly with batch and with context', () => {
		expect(kvCacheBytes(llama, 2, 8192, 32)).toBe(32 * 2 ** 30);
		expect(kvCacheBytes(llama, 2, 4096, 1) * 2).toBe(kvCacheBytes(llama, 2, 8192, 1));
	});

	it('is 4 times larger with 32 KV heads (MHA), 512 KiB per token', () => {
		expect(kvBytesPerToken(mha, 2)).toBe(524288);
		expect(kvBytesPerToken(mha, 2) / kvBytesPerToken(llama, 2)).toBe(4);
	});

	it('changes with the element size: FP32 doubles, 8-bit halves', () => {
		expect(kvBytesPerToken(llama, 4)).toBe(2 * kvBytesPerToken(llama, 2));
		expect(kvBytesPerToken(llama, 1)).toBe(kvBytesPerToken(llama, 2) / 2);
	});

	it('gives 16e9 bytes of weights for 8 billion parameters in FP16', () => {
		expect(weightBytes(llama, 2)).toBe(16e9);
	});
});

describe('decode bound (upper estimate)', () => {
	it('gives about 210 tokens per second for one request with short context (batch 1)', () => {
		const e = estimate({ ...DEFAULT_STATE, context: 512, batch: 1 });
		expect(e.stepSeconds * 1000).toBeCloseTo(4.78, 1);
		expect(e.tokensPerSecond).toBeGreaterThan(205);
		expect(e.tokensPerSecond).toBeLessThan(212);
	});

	it('gives about 2100 tokens per second in total at batch 32 and context 8192', () => {
		const e = estimate({ model: 'llama3-8b-gqa', dtype: 'fp16', context: 8192, batch: 32 });
		expect(e.perStep / 1e9).toBeCloseTo(50.4, 1);
		expect(e.tokensPerSecond).toBeGreaterThan(2100);
		expect(e.tokensPerSecond).toBeLessThan(2150);
	});

	it('uses the H100 bandwidth by default and divides time by bandwidth', () => {
		const e = estimate(DEFAULT_STATE);
		expect(e.stepSeconds).toBeCloseTo(e.perStep / H100_BANDWIDTH, 15);
	});

	it('grows with batch but saturates, and falls with context at a fixed batch', () => {
		const tps = BATCHES.map((b) => estimate({ ...DEFAULT_STATE, batch: b }).tokensPerSecond);
		tps.reduce((prev, v) => {
			expect(v).toBeGreaterThan(prev);
			return v;
		});
		const perReq = BATCHES.map(
			(b) => estimate({ ...DEFAULT_STATE, batch: b }).tokensPerSecondPerRequest,
		);
		perReq.reduce((prev, v) => {
			expect(v).toBeLessThan(prev);
			return v;
		});
		const byCtx = CONTEXTS.map(
			(t) => estimate({ ...DEFAULT_STATE, context: t, batch: 8 }).tokensPerSecond,
		);
		byCtx.reduce((prev, v) => {
			expect(v).toBeLessThanOrEqual(prev);
			return v;
		});
	});

	it('reports memory fit against the 80 GB of an H100', () => {
		expect(estimate(DEFAULT_STATE).fits).toBe(true);
		expect(
			estimate({ model: 'llama3-8b-mha', dtype: 'fp32', context: 131072, batch: 64 }).fits,
		).toBe(false);
	});
});

describe('snapping and lookup', () => {
	it('snaps context and batch to the nearest allowed value', () => {
		expect(snapContext(7000)).toBe(8192);
		expect(snapContext(200)).toBe(512);
		expect(snapContext(1e9)).toBe(131072);
		expect(snapBatch(3)).toBe(2);
		expect(snapBatch(100)).toBe(64);
	});

	it('falls back to the default on non-finite input', () => {
		expect(snapContext(Number.NaN)).toBe(DEFAULT_STATE.context);
		expect(snapBatch(Number.POSITIVE_INFINITY)).toBe(DEFAULT_STATE.batch);
	});

	it('returns the first model for an unknown id', () => {
		expect(findModel('nope')).toBe(MODELS[0]);
	});
});

describe('formatting and description', () => {
	it('formats binary and decimal units', () => {
		expect(formatBinary(131072)).toBe('128 KiB');
		expect(formatBinary(2 ** 30)).toBe('1.00 GiB');
		expect(formatGB(16e9)).toBe('16.0 GB');
	});

	it('describes the state as an upper bound, not a measurement', () => {
		const text = describeEstimate(DEFAULT_STATE);
		expect(text).toContain('не быстрее');
		expect(text).toContain('оценка сверху');
		expect(text).toContain('1.00 GiB');
	});

	it('is deterministic for the same state', () => {
		expect(describeEstimate(DEFAULT_STATE)).toBe(describeEstimate({ ...DEFAULT_STATE }));
	});
});
