import { resolveAlias } from '$lib/contracts/aliases';
import type { ChapterId } from '$lib/contracts/ids';
import {
	AliasesRegistry,
	ChaptersRegistry,
	type ChapterEntry,
	GENERATED_FILES,
	GlossaryRegistry,
	LabsRegistry,
	type LabEntry,
	PrereqGraphData,
	TopicsRegistry,
	type TopicEntry,
} from '$lib/contracts/registry';

/** The six generated registries as one value. */
export interface RegistryData {
	topics: TopicsRegistry;
	chapters: ChaptersRegistry;
	labs: LabsRegistry;
	glossary: GlossaryRegistry;
	prereqGraph: PrereqGraphData;
	aliases: AliasesRegistry;
}

/** Typed read access to the generated registries. */
export interface Registry {
	/** Topics sorted by `order`. */
	getTopics(): TopicEntry[];
	getTopic(id: string): TopicEntry | undefined;
	/** All chapters in registry order. */
	getChapters(): ChapterEntry[];
	/** Chapter by canonical id (`dl/attention`). Does not follow aliases; see `resolveChapterId`. */
	getChapter(id: string): ChapterEntry | undefined;
	/** Chapters of a topic in reading order. */
	getChaptersByTopic(topicId: string): ChapterEntry[];
	getLab(id: string): LabEntry | undefined;
	getGlossary(): GlossaryRegistry;
	getPrereqGraph(): PrereqGraphData;
	/** Follows `data/aliases.yaml` (and frontmatter aliases) to the current chapter id. */
	resolveChapterId(id: string): string;
}

/** Builds the accessors over already-parsed registry data. */
export function makeRegistry(data: RegistryData): Registry {
	const chapters = new Map(data.chapters.map((ch) => [ch.id, ch]));
	const labs = new Map(data.labs.map((lab) => [lab.id, lab]));
	const topics = new Map(data.topics.map((t) => [t.id, t]));
	const sortedTopics = [...data.topics].sort((a, b) => a.order - b.order);

	return {
		getTopics: () => [...sortedTopics],
		getTopic: (id) => topics.get(id),
		getChapters: () => [...data.chapters],
		getChapter: (id) => chapters.get(id as ChapterId),
		getChaptersByTopic: (topicId) => {
			const topic = topics.get(topicId);
			if (!topic) return [];
			return topic.chapterIds.flatMap((id) => {
				const chapter = chapters.get(id);
				return chapter ? [chapter] : [];
			});
		},
		getLab: (id) => labs.get(id),
		getGlossary: () => data.glossary,
		getPrereqGraph: () => data.prereqGraph,
		resolveChapterId: (id) => resolveAlias(id as ChapterId, data.aliases),
	};
}

/** Generated JSON modules, eagerly bundled. Missing files make `getRegistry` throw. */
const generated = import.meta.glob('/src/generated/*.json', {
	eager: true,
	import: 'default',
}) as Record<string, unknown>;

/** Parsed value type of each generated file. */
interface GeneratedTypes {
	topics: TopicsRegistry;
	chapters: ChaptersRegistry;
	labs: LabsRegistry;
	glossary: GlossaryRegistry;
	prereqGraph: PrereqGraphData;
	aliases: AliasesRegistry;
}

const SCHEMAS = {
	topics: TopicsRegistry,
	chapters: ChaptersRegistry,
	labs: LabsRegistry,
	glossary: GlossaryRegistry,
	prereqGraph: PrereqGraphData,
	aliases: AliasesRegistry,
} as const;

function readGenerated<K extends keyof GeneratedTypes>(key: K): GeneratedTypes[K] {
	const file = GENERATED_FILES[key];
	const value = generated[`/src/generated/${file}`];
	if (value === undefined) {
		throw new Error(`src/generated/${file} отсутствует: запустите node scripts/gen-registry.ts`);
	}
	return SCHEMAS[key].parse(value) as GeneratedTypes[K];
}

let cached: Registry | undefined;

/** The registry built from `src/generated/*.json`, created on first use. */
export function getRegistry(): Registry {
	if (!cached) {
		cached = makeRegistry({
			topics: readGenerated('topics'),
			chapters: readGenerated('chapters'),
			labs: readGenerated('labs'),
			glossary: readGenerated('glossary'),
			prereqGraph: readGenerated('prereqGraph'),
			aliases: readGenerated('aliases'),
		});
	}
	return cached;
}

export const getTopics = () => getRegistry().getTopics();
export const getTopic = (id: string) => getRegistry().getTopic(id);
export const getChapters = () => getRegistry().getChapters();
export const getChapter = (id: string) => getRegistry().getChapter(id);
export const getChaptersByTopic = (topicId: string) => getRegistry().getChaptersByTopic(topicId);
export const getLab = (id: string) => getRegistry().getLab(id);
export const getGlossary = () => getRegistry().getGlossary();
export const getPrereqGraph = () => getRegistry().getPrereqGraph();
export const resolveChapterId = (id: string) => getRegistry().resolveChapterId(id);
