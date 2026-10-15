import { splitChapterId } from '$lib/contracts/ids';
import type { ChapterEntry, ChaptersRegistry, TopicsRegistry } from '$lib/contracts/registry';
import type { Minutes } from '$lib/contracts/chapter';

/** Site base path without a trailing slash: `""` locally, `/learning-site` on Pages. */
export const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Link to another chapter. `href` is site-relative (`/dl/attention/`); pass it through `resolve()`. */
export interface ChapterLink {
	id: string;
	title: string;
	href: string;
}

/** Serializable data of a chapter page (returned from `+page.ts`). */
export interface ChapterPageData {
	chapter: ChapterEntry;
	topic: { id: string; title: string } | null;
	prereqs: ChapterLink[];
	prev: ChapterLink | null;
	next: ChapterLink | null;
}

/** Params for prerendering: one entry per chapter in the registry. */
export function chapterEntries(chapters: ChaptersRegistry): Array<{ topic: string; slug: string }> {
	return chapters.map((c) => {
		const { topic, slug } = splitChapterId(c.id);
		return { topic, slug };
	});
}

function toLink(chapter: ChapterEntry | undefined, id: string): ChapterLink | null {
	if (!chapter) return null;
	return { id, title: chapter.title, href: chapter.href };
}

/** Builds the page data for chapter `id`. Returns `null` when the chapter is unknown. */
export function buildChapterPageData(
	chapters: ChaptersRegistry,
	topics: TopicsRegistry,
	id: string,
): ChapterPageData | null {
	const chapter = chapters.find((c) => c.id === id);
	if (!chapter) return null;
	const topic = topics.find((t) => t.id === chapter.topic);
	const byId = new Map(chapters.map((c) => [c.id, c]));
	return {
		chapter,
		topic: topic ? { id: topic.id, title: topic.title } : null,
		prereqs: chapter.prereqs.map((p) => toLink(byId.get(p), p) ?? { id: p, title: p, href: '#' }),
		prev: chapter.prev ? toLink(byId.get(chapter.prev), chapter.prev) : null,
		next: chapter.next ? toLink(byId.get(chapter.next), chapter.next) : null,
	};
}

/** Reading time as text: `≈ 25 мин` or `≈ 10–20 мин` for per-level minutes. */
export function formatMinutes(minutes: Minutes): string {
	if (typeof minutes === 'number') return `≈ ${minutes} мин`;
	const values = Object.values(minutes).filter((v): v is number => typeof v === 'number');
	const min = Math.min(...values);
	const max = Math.max(...values);
	return min === max ? `≈ ${min} мин` : `≈ ${min}–${max} мин`;
}
