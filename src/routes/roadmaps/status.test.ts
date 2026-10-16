import { describe, expect, it } from 'vitest';
import {
	chaptersLabel,
	continuePoint,
	formatMinutes,
	roadmapProgress,
	snapshotFrom,
	type ProgressSnapshot,
} from './status';

const road = {
	steps: [
		{ title: 'a', description: 'a', chapters: ['dl/a', 'dl/b'] },
		{ title: 'b', description: 'b', chapters: ['dl/c'], optional: true },
		{ title: 'c', description: 'c', chapters: ['dl/d'] },
	],
};

const snap = (chapters: ProgressSnapshot['chapters']): ProgressSnapshot => ({ chapters, labs: {} });

describe('roadmap progress', () => {
	it('counts done chapters', () => {
		const p = roadmapProgress(road, snap({ 'dl/a': 'done', 'dl/b': 'progress' }));
		expect(p).toEqual({ done: 1, total: 4, fraction: 0.25 });
	});

	it('continues from the first chapter that is not done', () => {
		expect(continuePoint(road, snap({}))).toEqual({ step: 0, chapter: 'dl/a' });
		expect(continuePoint(road, snap({ 'dl/a': 'done', 'dl/b': 'progress' }))).toEqual({
			step: 0,
			chapter: 'dl/b',
		});
	});

	it('skips optional steps and finishes with null', () => {
		expect(continuePoint(road, snap({ 'dl/a': 'done', 'dl/b': 'done' }))).toEqual({
			step: 2,
			chapter: 'dl/d',
		});
		expect(
			continuePoint(road, snap({ 'dl/a': 'done', 'dl/b': 'done', 'dl/d': 'done' })),
		).toBeNull();
	});

	it('builds a snapshot from store records', () => {
		const s = snapshotFrom({
			chapters: [
				{ id: 'dl/a', done: true, visited: 'x' },
				{ id: 'dl/b', done: false, visited: 'x' },
				{ id: 'dl/c', done: false, visited: null },
			],
			labs: [
				{ labId: 'dl-a', passed: true },
				{ labId: 'dl-b', passed: false },
			],
		});
		expect(s.chapters).toEqual({ 'dl/a': 'done', 'dl/b': 'progress' });
		expect(s.labs).toEqual({ 'dl-a': true });
	});

	it('formats minutes and plurals', () => {
		expect(formatMinutes(40)).toBe('40 мин');
		expect(formatMinutes(120)).toBe('2 ч');
		expect(formatMinutes(95)).toBe('1 ч 35 мин');
		expect([1, 2, 5, 11, 21].map(chaptersLabel)).toEqual([
			'1 глава',
			'2 главы',
			'5 глав',
			'11 глав',
			'21 глава',
		]);
	});
});
