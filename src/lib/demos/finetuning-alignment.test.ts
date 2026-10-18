import { describe, expect, it } from 'vitest';
import {
	D_IN,
	D_OUT,
	RANK_DEFAULT,
	RANK_MAX,
	RANK_MIN,
	describeLora,
	formatCount,
	formatPercent,
	fullParams,
	loraParams,
	paramCounts,
	snapRank,
} from './finetuning-alignment';

describe('LoRA parameter counts for one matrix', () => {
	it('rank 8 on a 4096 × 4096 matrix gives 65 536 of 16 777 216 values (0.39%)', () => {
		const c = paramCounts('matrix', 8);
		expect(c.lora).toBe(65_536);
		expect(c.full).toBe(16_777_216);
		expect(c.fraction).toBeCloseTo(0.00390625, 10);
		expect(formatPercent(c.fraction)).toBe('0,39');
	});

	it('the smallest rank gives 8 192 trainable values', () => {
		expect(paramCounts('matrix', RANK_MIN).lora).toBe(8_192);
	});

	it('the count grows linearly with rank, not quadratically', () => {
		const one = paramCounts('matrix', 1).lora;
		expect(paramCounts('matrix', 2).lora).toBe(2 * one);
		expect(paramCounts('matrix', 16).lora).toBe(16 * one);
		expect(paramCounts('matrix', RANK_MAX).lora).toBe(RANK_MAX * one);
	});

	it('full fine-tuning uses d times k', () => {
		expect(fullParams(D_OUT, D_IN)).toBe(16_777_216);
		expect(loraParams(D_OUT, D_IN, 8)).toBe(8 * 8192);
	});
});

describe('LoRA parameter counts for the model scope', () => {
	it('32 layers with query and value at rank 8 give 4 194 304 against 1 073 741 824', () => {
		const c = paramCounts('model', 8);
		expect(c.matrices).toBe(64);
		expect(c.lora).toBe(4_194_304);
		expect(c.full).toBe(1_073_741_824);
	});
});

describe('snapRank', () => {
	it('rounds and clamps to the slider range', () => {
		expect(snapRank(7.6)).toBe(8);
		expect(snapRank(-3)).toBe(RANK_MIN);
		expect(snapRank(1000)).toBe(RANK_MAX);
	});

	it('gives the default for non-finite input', () => {
		expect(snapRank(Number.NaN)).toBe(RANK_DEFAULT);
		expect(snapRank(Number.POSITIVE_INFINITY)).toBe(RANK_DEFAULT);
	});
});

describe('formatting', () => {
	it('groups thousands with a no-break space', () => {
		expect(formatCount(16_777_216)).toBe('16 777 216');
		expect(formatCount(8_192)).toBe('8 192');
		expect(formatCount(512)).toBe('512');
	});

	it('describes the state with computed numbers', () => {
		const text = describeLora('matrix', 8);
		expect(text).toContain('65 536');
		expect(text).toContain('16 777 216');
		expect(text).toContain('0,39%');
	});
});
