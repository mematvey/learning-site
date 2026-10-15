import { getChapters, getPrereqGraph, getTopics } from '$lib/content/registry';
import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
	topics: getTopics(),
	chapters: getChapters(),
	graph: getPrereqGraph(),
});
