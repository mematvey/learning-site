import { error } from '@sveltejs/kit';
import { getChapters, getTopic, getTopics } from '$lib/content/registry';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => getTopics().map((t) => ({ topic: t.id }));

export const load: PageLoad = ({ params }) => {
	const topic = getTopic(params.topic);
	if (!topic) error(404, `Раздел не найден: ${params.topic}`);
	return {
		topic: { id: topic.id, title: topic.title },
		topics: getTopics().map((t) => ({ id: t.id, title: t.title })),
		chapters: topic.chapterIds.flatMap((id) =>
			getChapters()
				.filter((c) => c.id === id)
				.map((c) => ({ id: c.id, title: c.title })),
		),
	};
};
