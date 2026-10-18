import type { Note } from '$lib/contracts/notes';
import type { ExportFile, MyData, MyTarget, Wish } from '$lib/contracts/my';
import { buildFiles, type ExportContext } from '$lib/export/markdown';
import { bundleMarkdown } from '$lib/export/download';
import { chapterBlockHref } from '$lib/nav/links';

export const MY_TABS = ['notes', 'bookmarks', 'wishes', 'situations'] as const;
export type MyTab = (typeof MY_TABS)[number];

export const TAB_LABELS: Record<MyTab, string> = {
	notes: 'Заметки',
	bookmarks: 'Закладки',
	wishes: 'Хочу разобрать',
	situations: 'Ситуации',
};

/** What goes where: shown as the empty state of each tab. */
export const TAB_HINTS: Record<MyTab, string> = {
	notes: 'Заметки — для себя и для вопросов агенту. Выделите фрагмент в главе и добавьте заметку.',
	bookmarks:
		'Закладки — абзацы, формулы, термины и рисунки для повторения. Кнопка «В закладки» появляется у блока при наведении.',
	wishes:
		'Идеи — темы, которых не хватает: будущие главы. Опишите, что непонятно, и тема попадёт в план.',
	situations:
		'Ситуации — конкретные случаи, которые нужно разобрать: к существующей главе или к желаемой теме.',
};

/** Name of the export file that holds each tab, inside `user-data/<topic>/`. */
export const TAB_FILE: Record<MyTab, string> = {
	notes: 'notes.md',
	bookmarks: 'bookmarks.md',
	wishes: 'wishes.md',
	situations: 'situations.md',
};

export interface TopicOption {
	id: string;
	title: string;
}

export interface ChapterOption {
	id: string;
	title: string;
}

export interface ChapterGroup<T> {
	chapter: string;
	items: T[];
}

/** Everything a "My" screen shows: notes plus the four "My" collections. */
export interface MyScopeData {
	notes: Note[];
	my: MyData;
}

export interface MyCounts {
	notes: number;
	bookmarks: number;
	wishes: number;
	situations: number;
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Topic of a chapter id (`dl/attention` -> `dl`). */
export function topicOfChapter(chapter: string): string {
	return chapter.split('/')[0] ?? chapter;
}

/** Empty selection means "all topics". */
export function inScope(topic: string, selected: readonly string[]): boolean {
	return selected.length === 0 || selected.includes(topic);
}

/** Keeps only the records of the selected topics; an empty selection keeps everything. */
export function filterScope(data: MyScopeData, selected: readonly string[]): MyScopeData {
	if (selected.length === 0) return data;
	const keep = <T extends { topic: string }>(items: T[]) =>
		items.filter((item) => inScope(item.topic, selected));
	return {
		notes: data.notes.filter((note) => inScope(topicOfChapter(note.chapter), selected)),
		my: {
			bookmarks: keep(data.my.bookmarks),
			wishes: keep(data.my.wishes),
			situations: keep(data.my.situations),
			clarifications: keep(data.my.clarifications),
		},
	};
}

export function countTabs(data: MyScopeData): MyCounts {
	return {
		notes: data.notes.length,
		bookmarks: data.my.bookmarks.length,
		wishes: data.my.wishes.length,
		situations: data.my.situations.length,
	};
}

/**
 * Groups items by chapter. Groups follow `order` (reading order of the chapters); chapters that
 * are not in `order` go last, sorted by id. Items keep their input order.
 */
export function groupByChapter<T>(
	items: readonly T[],
	chapterOf: (item: T) => string,
	order: readonly string[],
): ChapterGroup<T>[] {
	const rank = new Map(order.map((id, i) => [id, i]));
	const rankOf = (chapter: string) => rank.get(chapter) ?? Number.MAX_SAFE_INTEGER;
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const chapter = chapterOf(item);
		const list = groups.get(chapter);
		if (list) list.push(item);
		else groups.set(chapter, [item]);
	}
	return [...groups]
		.sort(([a], [b]) => rankOf(a) - rankOf(b) || cmp(a, b))
		.map(([chapter, list]) => ({ chapter, items: list }));
}

/** Newest first by creation time; ties broken by id so the order is stable. */
export function newestFirst<T extends { created: string; id: string }>(items: readonly T[]): T[] {
	return [...items].sort((a, b) => cmp(b.created, a.created) || cmp(b.id, a.id));
}

/** Export context from the registry: titles and links for the Markdown files. */
export function buildExportContext(
	chapters: readonly ChapterOption[],
	topics: readonly TopicOption[],
): ExportContext {
	const chapterTitles = new Map(chapters.map((c) => [c.id, c.title]));
	const topicTitles = new Map(topics.map((t) => [t.id, t.title]));
	return {
		chapterTitle: (id) => chapterTitles.get(id) ?? id,
		topicTitle: (id) => topicTitles.get(id) ?? id,
		chapterHref: (id, blockId) => chapterBlockHref(id, blockId),
	};
}

/** Export files (README, all.md, per-topic Markdown, backup.json) for the given data. */
export function buildScopeFiles(data: MyScopeData, ctx: ExportContext): ExportFile[] {
	return buildFiles({ notes: data.notes, my: data.my }, ctx);
}

/** Markdown of one tab, from all topics of the scope, joined into one text. */
export function tabMarkdown(files: readonly ExportFile[], tab: MyTab): string {
	const suffix = `/${TAB_FILE[tab]}`;
	const picked = files.filter(
		(file) => file.path.startsWith('user-data/') && file.path.endsWith(suffix),
	);
	return bundleMarkdown(picked);
}

/** Full summary of the scope (`user-data/all.md`); empty text when there is nothing to export. */
export function allMarkdown(files: readonly ExportFile[]): string {
	return files.find((file) => file.path === 'user-data/all.md')?.content ?? '';
}

/** Human-readable title of a situation target: a chapter or a wished (future) chapter. */
export function targetTitle(
	target: MyTarget,
	chapterTitle: (id: string) => string,
	wishes: readonly Wish[],
): string {
	if (target.kind === 'chapter') return chapterTitle(target.chapter);
	return wishes.find((w) => w.id === target.wishId)?.title ?? 'Желаемая глава';
}
