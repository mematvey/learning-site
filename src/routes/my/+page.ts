import { getChapters, getTopics } from '$lib/content/registry';
import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
	topics: getTopics().map((t) => ({ id: t.id, title: t.title })),
	chapters: getChapters().map((c) => ({ id: c.id, title: c.title })),
});
