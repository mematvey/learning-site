import { describe, expect, it } from 'vitest';
import { countSectionsDone, sumCounts } from './sections';

describe('countSectionsDone', () => {
	it('counts marks that match existing sections', () => {
		expect(countSectionsDone(['idea', 'math', 'code'], ['idea', 'code'])).toEqual({
			done: 2,
			total: 3,
		});
	});

	it('ignores marks of removed sections and duplicate ids', () => {
		expect(countSectionsDone(['idea', 'idea', 'math'], ['gone', 'math'])).toEqual({
			done: 1,
			total: 2,
		});
	});

	it('handles a chapter without sections and missing marks', () => {
		expect(countSectionsDone([], undefined)).toEqual({ done: 0, total: 0 });
		expect(countSectionsDone(['idea'], undefined)).toEqual({ done: 0, total: 1 });
	});
});

describe('sumCounts', () => {
	it('adds up chapter counts for a topic', () => {
		expect(
			sumCounts([
				{ done: 1, total: 4 },
				{ done: 0, total: 2 },
				{ done: 3, total: 3 },
			]),
		).toEqual({ done: 4, total: 9 });
	});
});
