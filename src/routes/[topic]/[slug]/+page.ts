import { error } from '@sveltejs/kit';
import type { ChaptersRegistry, TopicsRegistry } from '$lib/contracts/registry';
import type { EntryGenerator, PageLoad } from './$types';
import { buildChapterPageData, chapterEntries } from './chapter-data';

// Registries are read through `import.meta.glob`: a missing generated file yields an empty
// list instead of a build error. Once the registry module (V2) is merged, switch to it.
const chapterModules = import.meta.glob('/src/generated/chapters.json', {
	eager: true,
	import: 'default',
}) as Record<string, ChaptersRegistry>;
const topicModules = import.meta.glob('/src/generated/topics.json', {
	eager: true,
	import: 'default',
}) as Record<string, TopicsRegistry>;
const contentFiles = import.meta.glob('/content/*/*/index.svx');

function chapters(): ChaptersRegistry {
	return Object.values(chapterModules)[0] ?? [];
}

function topics(): TopicsRegistry {
	return Object.values(topicModules)[0] ?? [];
}

export const entries: EntryGenerator = () => chapterEntries(chapters());

export const load: PageLoad = ({ params }) => {
	const id = `${params.topic}/${params.slug}`;
	const data = buildChapterPageData(chapters(), topics(), id);
	if (!data || !(`/content/${id}/index.svx` in contentFiles)) {
		error(404, `Глава не найдена: ${id}`);
	}
	return data;
};
