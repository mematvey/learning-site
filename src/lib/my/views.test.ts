import { describe, expect, it } from 'vitest';
import type { Note } from '$lib/contracts/notes';
import type { Bookmark, MyTarget, Situation, Wish } from '$lib/contracts/my';
import {
	buildExportContext,
	countTabs,
	filterScope,
	groupByChapter,
	newestFirst,
	tabMarkdown,
	targetTitle,
	topicOfChapter,
	type MyScopeData,
} from './views';

const note = (id: string, chapter: string, created = '2026-01-01T00:00:00.000Z') =>
	({ id, chapter, created, text: '', status: 'open' }) as unknown as Note;

const bookmark = (id: string, topic: string, chapter: string) =>
	({ id, topic, chapter, created: '2026-01-01T00:00:00.000Z' }) as unknown as Bookmark;

const wish = (id: string, topic: string, title: string) =>
	({ id, topic, title, created: '2026-01-01T00:00:00.000Z' }) as unknown as Wish;

const situation = (id: string, topic: string) =>
	({ id, topic, created: '2026-01-01T00:00:00.000Z' }) as unknown as Situation;

const data: MyScopeData = {
	notes: [note('n1', 'dl/attention'), note('n2', 'cs/sorting'), note('n3', 'dl/mlp')],
	my: {
		bookmarks: [bookmark('b1', 'dl', 'dl/attention'), bookmark('b2', 'cs', 'cs/sorting')],
		wishes: [wish('w1', 'dl', 'Диффузия')],
		situations: [situation('s1', 'cs')],
		clarifications: [],
	},
};

describe('topicOfChapter', () => {
	it('takes the topic part of a chapter id', () => {
		expect(topicOfChapter('dl/attention')).toBe('dl');
	});
});

describe('filterScope', () => {
	it('keeps everything for an empty selection', () => {
		expect(filterScope(data, [])).toBe(data);
	});

	it('keeps only the selected topics in every collection', () => {
		const dl = filterScope(data, ['dl']);
		expect(dl.notes.map((n) => n.id)).toEqual(['n1', 'n3']);
		expect(dl.my.bookmarks.map((b) => b.id)).toEqual(['b1']);
		expect(dl.my.wishes.map((w) => w.id)).toEqual(['w1']);
		expect(dl.my.situations).toHaveLength(0);
	});

	it('accepts several topics', () => {
		const both = filterScope(data, ['dl', 'cs']);
		expect(both.notes).toHaveLength(3);
		expect(both.my.bookmarks).toHaveLength(2);
	});
});

describe('countTabs', () => {
	it('counts items of every tab', () => {
		expect(countTabs(data)).toEqual({ notes: 3, bookmarks: 2, wishes: 1, situations: 1 });
	});
});

describe('groupByChapter', () => {
	it('orders groups by the given chapter order and puts unknown chapters last', () => {
		const groups = groupByChapter(
			[
				note('a', 'dl/zeta'),
				note('b', 'dl/mlp'),
				note('c', 'dl/unknown'),
				note('d', 'dl/attention'),
			],
			(n) => n.chapter,
			['dl/attention', 'dl/mlp'],
		);
		expect(groups.map((g) => g.chapter)).toEqual([
			'dl/attention',
			'dl/mlp',
			'dl/unknown',
			'dl/zeta',
		]);
	});

	it('keeps item order inside a group', () => {
		const groups = groupByChapter([note('b', 'dl/mlp'), note('a', 'dl/mlp')], (n) => n.chapter, [
			'dl/mlp',
		]);
		expect(groups[0]?.items.map((n) => n.id)).toEqual(['b', 'a']);
	});
});

describe('newestFirst', () => {
	it('sorts by creation time, newest first', () => {
		const sorted = newestFirst([
			note('old', 'dl/a', '2026-01-01T00:00:00.000Z'),
			note('new', 'dl/a', '2026-03-01T00:00:00.000Z'),
		]);
		expect(sorted.map((n) => n.id)).toEqual(['new', 'old']);
	});
});

describe('buildExportContext', () => {
	const ctx = buildExportContext(
		[{ id: 'dl/attention', title: 'Внимание' }],
		[{ id: 'dl', title: 'Deep Learning' }],
	);

	it('returns titles and falls back to the id', () => {
		expect(ctx.chapterTitle('dl/attention')).toBe('Внимание');
		expect(ctx.chapterTitle('dl/x')).toBe('dl/x');
		expect(ctx.topicTitle('dl')).toBe('Deep Learning');
	});

	it('builds links to blocks through chapterBlockHref', () => {
		expect(ctx.chapterHref('dl/attention', 'qk-scores')).toBe('/dl/attention#qk-scores');
		expect(ctx.chapterHref('dl/attention')).toBe('/dl/attention');
	});
});

describe('tabMarkdown', () => {
	it('joins only the file of the requested tab from every topic', () => {
		const files = [
			{ path: 'user-data/README.md', content: 'readme' },
			{ path: 'user-data/all.md', content: 'all' },
			{ path: 'user-data/dl/notes.md', content: 'dl notes' },
			{ path: 'user-data/dl/bookmarks.md', content: 'dl bookmarks' },
			{ path: 'user-data/cs/notes.md', content: 'cs notes' },
		];
		const text = tabMarkdown(files, 'notes');
		expect(text).toContain('dl notes');
		expect(text).toContain('cs notes');
		expect(text).not.toContain('dl bookmarks');
		expect(text).not.toContain('readme');
		expect(tabMarkdown(files, 'wishes')).toBe('');
	});
});

describe('targetTitle', () => {
	const chapterTitle = (id: string) => `title:${id}`;
	const wishes = [wish('01HW0000000000000000000000', 'dl', 'Диффузия')];

	it('uses the chapter title for a chapter target', () => {
		const target: MyTarget = { kind: 'chapter', chapter: 'dl/attention' };
		expect(targetTitle(target, chapterTitle, wishes)).toBe('title:dl/attention');
	});

	it('uses the wish title for a wished chapter', () => {
		const target: MyTarget = { kind: 'wish', wishId: '01HW0000000000000000000000' };
		expect(targetTitle(target, chapterTitle, wishes)).toBe('Диффузия');
	});
});
