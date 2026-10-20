import { error } from '@sveltejs/kit';
import { getChapters, getPrereqGraph, getTopics } from '$lib/content/registry';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => getTopics().map((t) => ({ topic: t.id }));

export const load: PageLoad = ({ params }) => {
	const topic = getTopics().find((t) => t.id === params.topic);
	if (!topic) error(404, `Раздел не найден: ${params.topic}`);
	const all = getChapters();
	const byId = new Map(all.map((c) => [c.id, c]));
	const chapters = topic.chapterIds.flatMap((id) => all.filter((c) => c.id === id));
	const experimental = topic.experimentalIds.flatMap((id) => {
		const c = byId.get(id);
		return c ? [c] : [];
	});
	const titles = Object.fromEntries(all.map((c) => [c.id, { title: c.title, href: c.href }]));
	return { topic, chapters, experimental, titles, graph: getPrereqGraph() };
};
