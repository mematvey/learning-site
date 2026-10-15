import { describe, expect, it } from 'vitest';
import type { ChapterEntry, ChaptersRegistry, TopicsRegistry } from '$lib/contracts/registry';
import { buildChapterPageData, chapterEntries, formatMinutes } from './chapter-data';

function entry(id: string, extra: Partial<ChapterEntry> = {}): ChapterEntry {
	return {
		id,
		title: `Title ${id}`,
		topic: 'dl',
		summary: 's',
		prereqs: [],
		keywords: [],
		minutes: 25,
		path: `content/${id}/index.svx`,
		href: `/${id}/`,
		index: 0,
		prev: null,
		next: null,
		blocks: [],
		sections: [],
		...extra,
	} as ChapterEntry;
}

const chapters: ChaptersRegistry = [
	entry('dl/softmax', { next: 'dl/attention' }),
	entry('dl/attention', { prev: 'dl/softmax', prereqs: ['dl/softmax', 'dl/missing'] }),
];
const topics = [{ id: 'dl', title: 'DL Theory' }] as unknown as TopicsRegistry;

describe('chapterEntries', () => {
	it('splits chapter ids into topic and slug', () => {
		expect(chapterEntries(chapters)).toEqual([
			{ topic: 'dl', slug: 'softmax' },
			{ topic: 'dl', slug: 'attention' },
		]);
	});
});

describe('buildChapterPageData', () => {
	it('resolves prev, next and prerequisite links', () => {
		const data = buildChapterPageData(chapters, topics, 'dl/attention');
		expect(data?.topic).toEqual({ id: 'dl', title: 'DL Theory' });
		expect(data?.prev).toEqual({
			id: 'dl/softmax',
			title: 'Title dl/softmax',
			href: '/dl/softmax/',
		});
		expect(data?.next).toBeNull();
		expect(data?.prereqs.at(0)?.href).toBe('/dl/softmax/');
		expect(data?.prereqs.at(1)).toEqual({ id: 'dl/missing', title: 'dl/missing', href: '#' });
	});

	it('returns null for an unknown chapter', () => {
		expect(buildChapterPageData(chapters, topics, 'dl/nope')).toBeNull();
	});
});

describe('formatMinutes', () => {
	it('formats a single number and per-level ranges', () => {
		expect(formatMinutes(25)).toBe('≈ 25 мин');
		expect(formatMinutes({ c1: 10, c3: 20 })).toBe('≈ 10–20 мин');
		expect(formatMinutes({ c2: 15 })).toBe('≈ 15 мин');
	});
});
