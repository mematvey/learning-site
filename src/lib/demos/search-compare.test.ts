import { describe, expect, it } from 'vitest';
import {
	bestScore,
	distinctX,
	gridPoints,
	meanRandomBest,
	randomPoints,
	sanitizeSearchState,
	score,
	snapSide,
	summarizeSearch,
} from './search-compare';

describe('search compare', () => {
	it('grid has side^2 points but only side distinct values of x', () => {
		const g = gridPoints(4);
		expect(g).toHaveLength(16);
		expect(distinctX(g)).toBe(4);
	});

	it('random search has the same budget and almost all x distinct', () => {
		const r = randomPoints(4, 1);
		expect(r).toHaveLength(16);
		expect(distinctX(r)).toBe(16);
	});

	it('is deterministic for a given draw', () => {
		expect(randomPoints(3, 5)).toEqual(randomPoints(3, 5));
		expect(randomPoints(3, 5)).not.toEqual(randomPoints(3, 6));
	});

	it('score peaks along x and depends weakly on y', () => {
		expect(score(0.56, 0.5)).toBeGreaterThan(score(0.2, 0.5));
		expect(Math.abs(score(0.56, 0.1) - score(0.56, 0.9))).toBeLessThan(0.1);
	});

	it('on average random search beats the grid at every budget', () => {
		for (let side = 2; side <= 5; side++) {
			expect(meanRandomBest(side)).toBeGreaterThan(bestScore(gridPoints(side)));
		}
	});

	it('summary and sanitising behave', () => {
		const s = summarizeSearch(sanitizeSearchState({ side: 3 }));
		expect(s.budget).toBe(9);
		expect(snapSide(100)).toBe(5);
		expect(snapSide(null)).toBe(3);
	});
});
