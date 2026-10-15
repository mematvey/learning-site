import { ChaptersRegistry, PrereqGraphData, TopicsRegistry } from '$lib/contracts/registry';
import type { PageLoad } from './$types';

/*
 * Generated registries are read as JSON modules (see GENERATED_FILES in contracts/registry.ts).
 * A missing file yields an empty list, so the home page still renders before the first
 * `gen-registry` run. Invalid data fails the build loudly.
 * TODO(orchestrator): switch to `$lib/content/registry` (V2) once it is merged.
 */
const generated = import.meta.glob('/src/generated/*.json', { eager: true, import: 'default' });

export const load: PageLoad = () => {
	const topicsRaw = generated['/src/generated/topics.json'];
	const chaptersRaw = generated['/src/generated/chapters.json'];
	const graphRaw = generated['/src/generated/prereq-graph.json'];
	return {
		topics: topicsRaw === undefined ? [] : TopicsRegistry.parse(topicsRaw),
		chapters: chaptersRaw === undefined ? [] : ChaptersRegistry.parse(chaptersRaw),
		graph: graphRaw === undefined ? { nodes: [], edges: [] } : PrereqGraphData.parse(graphRaw),
	};
};
