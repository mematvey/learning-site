import { error } from '@sveltejs/kit';
import { getChapters, getTopics } from '$lib/content/registry';
import type { EntryGenerator, PageLoad } from './$types';
import { buildChapterPageData, chapterEntries } from './chapter-data';

const contentFiles = import.meta.glob('/content/*/*/index.svx');

export const entries: EntryGenerator = () => chapterEntries(getChapters());

export const load: PageLoad = ({ params }) => {
	const id = `${params.topic}/${params.slug}`;
	const data = buildChapterPageData(getChapters(), getTopics(), id);
	if (!data || !(`/content/${id}/index.svx` in contentFiles)) {
		error(404, `Глава не найдена: ${id}`);
	}
	return data;
};
