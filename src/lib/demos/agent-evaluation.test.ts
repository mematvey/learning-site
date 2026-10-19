import { describe, expect, it } from 'vitest';
import {
	RUN_DRAWS,
	binom,
	checkTrajectory,
	curve,
	formatNum,
	makeRuns,
	passAtK,
	passHatK,
	passHatKEstimate,
	sampleSummary,
	snapK,
	snapP,
	trajectoryFor,
} from './agent-evaluation';

describe('pass@k and pass^k', () => {
	it('reproduces the chapter table', () => {
		const rows: [number, number, number, number][] = [
			[0.7, 3, 0.343, 0.973],
			[0.7, 10, 0.028, 1.0],
			[0.8, 3, 0.512, 0.992],
			[0.8, 10, 0.107, 1.0],
			[0.9, 3, 0.729, 0.999],
			[0.9, 10, 0.349, 1.0],
		];
		for (const [p, k, hat, at] of rows) {
			expect(passHatK(p, k).toFixed(3)).toBe(hat.toFixed(3));
			expect(passAtK(p, k).toFixed(3)).toBe(at.toFixed(3));
		}
	});

	it('gives 0.512 and 0.992 for p = 0.8, k = 3', () => {
		expect(formatNum(passHatK(0.8, 3))).toBe('0,512');
		expect(formatNum(passAtK(0.8, 3))).toBe('0,992');
	});

	it('matches the callout for p = 0.5, k = 10', () => {
		expect(passAtK(0.5, 10).toFixed(3)).toBe('0.999');
		expect(passHatK(0.5, 10).toFixed(3)).toBe('0.001');
	});

	it('makes both metrics equal p at k = 1', () => {
		expect(passAtK(0.8, 1)).toBeCloseTo(0.8, 12);
		expect(passHatK(0.8, 1)).toBeCloseTo(0.8, 12);
	});

	it('curve covers k = 1..10 and is monotone in the right directions', () => {
		const at = curve(0.8, 'pass-at-k');
		const hat = curve(0.8, 'pass-hat-k');
		expect(at.map((pt) => pt.k)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		const atVals = at.map((pt) => pt.value);
		const hatVals = hat.map((pt) => pt.value);
		expect(atVals).toEqual([...atVals].sort((a, b) => a - b));
		expect(hatVals).toEqual([...hatVals].sort((a, b) => b - a));
	});
});

describe('unbiased estimator of pass^k', () => {
	it('gives 0.4 for four successes out of five at k = 3', () => {
		expect(passHatKEstimate(4, 5, 3)).toBeCloseTo(0.4, 12);
	});

	it('gives 1.0 for five successes out of five at k = 3', () => {
		expect(passHatKEstimate(5, 5, 3)).toBeCloseTo(1.0, 12);
	});

	it('rejects k above the number of runs and bad counts', () => {
		expect(() => passHatKEstimate(2, 3, 4)).toThrow(RangeError);
		expect(() => passHatKEstimate(4, 3, 2)).toThrow(RangeError);
		expect(() => passHatKEstimate(1, 0, 1)).toThrow(RangeError);
	});

	it('binom computes small coefficients exactly', () => {
		expect(binom(5, 3)).toBe(10);
		expect(binom(4, 3)).toBe(4);
		expect(binom(3, 5)).toBe(0);
	});
});

describe('snapping of slider values', () => {
	it('keeps p in range and rounded to 0.01', () => {
		expect(snapP(0.123)).toBe(0.5);
		expect(snapP(0.8449)).toBe(0.84);
		expect(snapP(2)).toBe(0.99);
		expect(snapP(Number.NaN)).toBe(0.8);
	});

	it('keeps k an integer in 1..10', () => {
		expect(snapK(3.6)).toBe(4);
		expect(snapK(0)).toBe(1);
		expect(snapK(99)).toBe(10);
		expect(snapK(Number.POSITIVE_INFINITY)).toBe(3);
	});
});

describe('trajectories and binary criteria', () => {
	it('passes the good path on every criterion', () => {
		const v = checkTrajectory(trajectoryFor(true, 0));
		expect(v.success).toBe(true);
		expect(v.issueStep).toBeNull();
		expect(v.reason).toBeNull();
	});

	it('fails a right answer reached through wrong arguments, at the first wrong call', () => {
		const v = checkTrajectory(trajectoryFor(false, 0));
		expect(v.checks.args).toBe(false);
		expect(v.checks.grounded).toBe(true);
		expect(v.success).toBe(false);
		expect(v.issueStep).toBe(0);
	});

	it('fails an answer with a fact no tool returned, at the answer step', () => {
		const v = checkTrajectory(trajectoryFor(false, 1));
		expect(v.checks.grounded).toBe(false);
		expect(v.issueStep).toBe(2);
	});

	it('fails a wrong order of steps, at the policy call', () => {
		const v = checkTrajectory(trajectoryFor(false, 2));
		expect(v.checks.order).toBe(false);
		expect(v.issueStep).toBe(0);
	});
});

describe('series of runs', () => {
	it('makes a run succeed exactly when its draw is below p', () => {
		for (const p of [0.5, 0.8, 0.95]) {
			const runs = makeRuns(p);
			runs.forEach((r, i) => {
				expect(r.draw).toBe(RUN_DRAWS[i]);
				expect(r.success).toBe(r.draw < p);
				expect(r.verdict.success).toBe(r.success);
			});
		}
	});

	it('turns failures into successes as p grows', () => {
		const low = makeRuns(0.6).filter((r) => r.success).length;
		const high = makeRuns(0.9).filter((r) => r.success).length;
		expect(high).toBeGreaterThanOrEqual(low);
	});

	it('summarises the first k runs as a sample', () => {
		const runs = makeRuns(0.8);
		const s = sampleSummary(runs, 3);
		expect(s.k).toBe(3);
		expect(s.successes).toBe(2);
		expect(s.allSucceeded).toBe(false);
		expect(s.anySucceeded).toBe(true);
	});
});
