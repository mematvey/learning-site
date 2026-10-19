import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	N_MAX,
	allowedN,
	bestOfNAccuracy,
	curves,
	describeState,
	fmt3,
	majorityAccuracy,
	readouts,
	sanitize,
	snapN,
} from './test-time-compute';

describe('majorityAccuracy (chapter table)', () => {
	it('matches the table for p = 0,6', () => {
		expect(fmt3(majorityAccuracy(1, 0.6))).toBe('0,600');
		expect(fmt3(majorityAccuracy(3, 0.6))).toBe('0,648');
		expect(fmt3(majorityAccuracy(9, 0.6))).toBe('0,733');
		expect(fmt3(majorityAccuracy(31, 0.6))).toBe('0,872');
	});

	it('matches the table for p = 0,4 (below one half the vote gets worse)', () => {
		expect(fmt3(majorityAccuracy(1, 0.4))).toBe('0,400');
		expect(fmt3(majorityAccuracy(3, 0.4))).toBe('0,352');
		expect(fmt3(majorityAccuracy(9, 0.4))).toBe('0,267');
		expect(fmt3(majorityAccuracy(31, 0.4))).toBe('0,128');
	});

	it('gives the chapter gain from 31 to 63 samples (about 0,07)', () => {
		const gain = majorityAccuracy(63, 0.6) - majorityAccuracy(31, 0.6);
		expect(gain).toBeGreaterThan(0.065);
		expect(gain).toBeLessThan(0.08);
	});

	it('stays flat at one half', () => {
		expect(majorityAccuracy(15, 0.5)).toBeCloseTo(0.5, 10);
	});
});

describe('bestOfNAccuracy (chapter table and gains)', () => {
	it('matches the table for p = 0,1 with an ideal verifier', () => {
		expect(fmt3(bestOfNAccuracy(9, 0.1))).toBe('0,613');
		expect(fmt3(bestOfNAccuracy(16, 0.1))).toBe('0,815');
		expect(fmt3(bestOfNAccuracy(31, 0.1))).toBe('0,962');
		expect(fmt3(bestOfNAccuracy(64, 0.1))).toBe('0,999');
	});

	it('gives the chapter gains from 16 to 32 (about 0,15) and from 32 to 64 (about 0,03)', () => {
		const g1 = bestOfNAccuracy(32, 0.1) - bestOfNAccuracy(16, 0.1);
		const g2 = bestOfNAccuracy(64, 0.1) - bestOfNAccuracy(32, 0.1);
		expect(fmt3(g1)).toBe('0,151');
		expect(fmt3(g2)).toBe('0,033');
	});

	it('gives 1 - 0,7^4 for four samples at p = 0,3 (quiz)', () => {
		expect(fmt3(bestOfNAccuracy(4, 0.3))).toBe('0,760');
	});

	it('is zero at p = 0 for any N', () => {
		expect(bestOfNAccuracy(64, 0)).toBe(0);
	});

	it('scales with verifier quality', () => {
		expect(bestOfNAccuracy(16, 0.1, 0.5)).toBeCloseTo(0.5 * 0.8147, 3);
	});
});

describe('allowedN and snapN', () => {
	it('lists every N in the one-step mode', () => {
		expect(allowedN('one')).toHaveLength(N_MAX);
	});

	it('lists powers of two in the doubling mode', () => {
		expect(allowedN('double')).toEqual([1, 2, 4, 8, 16, 32, 64]);
	});

	it('snaps N to the nearest allowed value', () => {
		expect(snapN(31, 'double')).toBe(32);
		expect(snapN(23, 'double')).toBe(16);
		expect(snapN(31, 'one')).toBe(31);
	});
});

describe('sanitize', () => {
	it('returns defaults for an empty patch', () => {
		expect(sanitize(undefined)).toEqual(DEFAULT_STATE);
	});

	it('clamps out-of-range values and ignores non-finite ones', () => {
		const s = sanitize({ n: 500, pVote: 0, pBest: 200, verifier: 10 });
		expect(s.n).toBe(N_MAX);
		expect(s.pVote).toBe(5);
		expect(s.pBest).toBe(95);
		expect(s.verifier).toBe(50);
		expect(sanitize({ n: Number.NaN }).n).toBe(DEFAULT_STATE.n);
	});

	it('snaps N when the step mode is doubling', () => {
		expect(sanitize({ step: 'double', n: 31 }).n).toBe(32);
	});
});

describe('curves and readouts', () => {
	it('returns 64 points per curve with the chapter values at N = 31 by default', () => {
		const c = curves(DEFAULT_STATE);
		expect(c.xs).toHaveLength(N_MAX);
		expect(c.vote).toHaveLength(N_MAX);
		expect(c.best).toHaveLength(N_MAX);
		const r = readouts(DEFAULT_STATE);
		expect(fmt3(r.vote)).toBe('0,872');
		expect(fmt3(r.best)).toBe('0,962');
	});

	it('has no doubling gain above N_MAX', () => {
		const r = readouts({ ...DEFAULT_STATE, n: 64 });
		expect(r.voteGainDouble).toBeNull();
		expect(r.bestGainDouble).toBeNull();
	});
});

describe('describeState', () => {
	it('says that voting with p below one half gets worse with N', () => {
		const d = describeState({ ...DEFAULT_STATE, pVote: 40 });
		expect(d.notice).toContain('падает');
		expect(d.vote).toContain('0,128');
	});

	it('mentions the verifier when it is not ideal', () => {
		const d = describeState({ ...DEFAULT_STATE, verifier: 80 });
		expect(d.notice).toContain('80%');
	});

	it('warns about even N for the tie rule', () => {
		const d = describeState({ ...DEFAULT_STATE, n: 16 });
		expect(d.vote).toContain('чётном');
	});
});
