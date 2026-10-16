import { error } from '@sveltejs/kit';
import { getChapters, getRegistry } from '$lib/content/registry';
import { getRoadmap, getRoadmaps } from '../data';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => getRoadmaps().map((r) => ({ id: r.id }));

export const load: PageLoad = ({ params }) => {
	const roadmap = getRoadmap(params.id);
	if (!roadmap) error(404, `Маршрут не найден: ${params.id}`);
	const chapters = Object.fromEntries(
		getChapters().map((c) => [c.id, { title: c.title, href: c.href }]),
	);
	const registry = getRegistry();
	const labs = Object.fromEntries(
		roadmap.steps
			.flatMap((s) => s.labs ?? [])
			.flatMap((id) => {
				const lab = registry.getLab(id);
				return lab ? [[id, { title: lab.title, chapter: lab.chapter }]] : [];
			}),
	);
	return { roadmap, chapters, labs };
};
