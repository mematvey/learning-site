import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RoadmapEntry } from '../../src/lib/contracts/roadmap';
import type { AliasesRegistry } from '../../src/lib/contracts/registry';
import type {
	ChapterEntry,
	GlossaryRegistry,
	LabEntry,
	PrereqGraphData,
	SectionEntry,
	TopicEntry,
} from '../../src/lib/contracts/registry';
import { collectAliases, prereqLookup } from './check';
import type { LoadedContent } from './load';
import { topoOrder } from './graph';

/** The generated registries, in the shapes of `src/lib/contracts/registry.ts`. */
export interface Registries {
	topics: TopicEntry[];
	chapters: ChapterEntry[];
	labs: LabEntry[];
	glossary: GlossaryRegistry;
	prereqGraph: PrereqGraphData;
	aliases: AliasesRegistry;
	roadmaps: RoadmapEntry[];
}

/**
 * Builds registries from loaded content. Call only when `checkContent` reports no errors:
 * this function assumes references resolve and the graph has no cycles.
 */
export function buildRegistries(loaded: LoadedContent): Registries {
	const prereqsOf = prereqLookup(loaded);
	const byId = new Map(loaded.chapters.map((ch) => [ch.data.id, ch]));

	const topics: TopicEntry[] = [];
	const chapters: ChapterEntry[] = [];
	const orderByTopic = new Map<string, string[]>();
	const experimentalByTopic = new Map<string, string[]>();
	const isExperimental = (id: string) => byId.get(id)?.data.experimental === true;

	for (const topic of loaded.topics) {
		const members = loaded.chapters
			.filter((ch) => ch.topicDir === topic.data.id)
			.map((ch) => ch.data.id);
		// Experimental chapters stay out of the main sequence: no numbering, prev/next, progress totals.
		const mainMembers = members.filter((id) => !isExperimental(id));
		const explicit = topic.data.chapters
			?.map((slug) => `${topic.data.id}/${slug}`)
			.filter((id) => !isExperimental(id));
		// Chapters missing from an explicit `chapters:` list still belong to the topic: append them.
		const listed = new Set(explicit ?? []);
		const rest = topoOrder(
			mainMembers.filter((id) => !listed.has(id)),
			prereqsOf,
		);
		const ordered = [...(explicit ?? []), ...rest];
		orderByTopic.set(topic.data.id, ordered);
		const experimental = topoOrder(members.filter(isExperimental), prereqsOf);
		experimentalByTopic.set(topic.data.id, experimental);
		topics.push({ ...topic.data, chapterIds: ordered, experimentalIds: experimental });
	}
	topics.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));

	for (const ch of loaded.chapters) {
		const order = orderByTopic.get(ch.topicDir) ?? [];
		const experimental = ch.data.experimental === true;
		const index = experimental
			? (experimentalByTopic.get(ch.topicDir) ?? []).indexOf(ch.data.id)
			: order.indexOf(ch.data.id);
		const prevId = !experimental && index > 0 ? (order[index - 1] ?? null) : null;
		const nextId =
			!experimental && index >= 0 && index < order.length - 1 ? (order[index + 1] ?? null) : null;
		const blocks = [...ch.scan.blocks, ...ch.scan.figures]
			.sort((a, b) => a.line - b.line)
			.map((b) => b.id);
		const sections: SectionEntry[] = ch.scan.sections.map((s) => ({
			id: s.id,
			title: s.title,
			level: s.level,
		}));
		chapters.push({
			...ch.data,
			experimental,
			path: ch.file,
			href: `/${ch.topicDir}/${ch.dir.split('/')[1] ?? ''}/`,
			index: Math.max(index, 0),
			prev: prevId,
			next: nextId,
			blocks,
			sections,
		});
	}
	chapters.sort((a, b) => {
		const ta = topics.findIndex((t) => t.id === a.topic);
		const tb = topics.findIndex((t) => t.id === b.topic);
		return ta - tb || Number(a.experimental) - Number(b.experimental) || a.index - b.index;
	});

	const labs: LabEntry[] = loaded.labs.map((lab) => {
		const chapter = byId.get(lab.data.chapter);
		const entry: LabEntry = {
			...lab.data,
			dir: `labs/${lab.dir}`,
			topic: chapter?.topicDir ?? '',
		};
		if (lab.data.starter) {
			const text = readFileSync(join(loaded.root, 'labs', lab.dir, lab.data.starter));
			entry.starterHash = createHash('sha256').update(text).digest('hex');
		}
		return entry;
	});

	const glossary: GlossaryRegistry = {};
	for (const g of loaded.glossary) glossary[g.data.id] = g.data;

	return {
		topics,
		chapters,
		labs,
		glossary,
		prereqGraph: buildGraph(loaded),
		aliases: collectAliases(loaded).aliases,
		roadmaps: buildRoadmaps(loaded),
	};
}

/** Chapter and concept nodes; edges point from the prerequisite to the dependent node. */
function buildGraph(loaded: LoadedContent): PrereqGraphData {
	const nodes: PrereqGraphData['nodes'] = [];
	const edges: PrereqGraphData['edges'] = [];
	const concepts = new Set<string>();

	for (const ch of loaded.chapters) {
		nodes.push({
			id: ch.data.id,
			kind: 'chapter',
			title: ch.data.title,
			topic: ch.data.topic,
			experimental: ch.data.experimental === true,
		});
		for (const concept of ch.data.concepts ?? []) {
			if (concepts.has(concept.id)) continue;
			concepts.add(concept.id);
			nodes.push({ id: concept.id, kind: 'concept', title: concept.title, topic: ch.data.topic });
		}
	}
	for (const ch of loaded.chapters) {
		for (const p of ch.data.prereqs) edges.push({ from: p, to: ch.data.id, kind: 'prereq' });
		for (const concept of ch.data.concepts ?? []) {
			edges.push({ from: ch.data.id, to: concept.id, kind: 'introduces' });
		}
		for (const term of ch.data.requires ?? []) {
			if (concepts.has(term)) edges.push({ from: term, to: ch.data.id, kind: 'requires' });
		}
	}
	return { nodes, edges };
}

/** Minutes of a chapter at the base level (c2), falling back to any known value. */
function baseMinutes(minutes: LoadedContent['chapters'][number]['data']['minutes']): number {
	if (typeof minutes === 'number') return minutes;
	return minutes.c2 ?? minutes.c1 ?? minutes.c3 ?? minutes.c4 ?? 0;
}

/** Roadmaps sorted by id with the derived chapter count and time estimate. */
function buildRoadmaps(loaded: LoadedContent): RoadmapEntry[] {
	const byId = new Map(loaded.chapters.map((ch) => [ch.data.id, ch]));
	return loaded.roadmaps
		.map(({ data }) => {
			const ids = data.steps.flatMap((s) => s.chapters);
			const computed = ids.reduce((sum, id) => {
				const ch = byId.get(id);
				return sum + (ch ? baseMinutes(ch.data.minutes) : 0);
			}, 0);
			return {
				...data,
				estimatedMinutes: data.estimatedMinutes ?? Math.round(computed),
				chapterCount: ids.length,
			};
		})
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
