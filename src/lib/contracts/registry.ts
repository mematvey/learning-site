import { z } from 'zod';
import { AliasesFile } from './aliases';
import { ChapterFrontmatter } from './chapter';
import { GlossaryEntry } from './glossary';
import { BlockId, ChapterId, TermId, TopicId } from './ids';
import { Lab } from './lab';
import { Topic } from './topic';

/**
 * Generated registries (`src/generated/*.json`, written by `scripts/gen-registry`,
 * never edited by hand). Runtime code reads them as JSON modules.
 */
export const GENERATED_FILES = {
	topics: 'topics.json',
	chapters: 'chapters.json',
	labs: 'labs.json',
	glossary: 'glossary.json',
	prereqGraph: 'prereq-graph.json',
	aliases: 'aliases.json',
	roadmaps: 'roadmaps.json',
} as const;

/** `topics.json`: topics sorted by `order`; `chapterIds` are in reading order. */
/**
 * `chapterIds`: main sequence in reading order (no experimental chapters).
 * `experimentalIds`: experimental chapters of the topic, outside the main sequence.
 */
export const TopicEntry = Topic.extend({
	chapterIds: z.array(ChapterId),
	experimentalIds: z.array(ChapterId),
});
export type TopicEntry = z.infer<typeof TopicEntry>;
export const TopicsRegistry = z.array(TopicEntry);
export type TopicsRegistry = z.infer<typeof TopicsRegistry>;

/** Section of a chapter for the table of contents. */
export const SectionEntry = z.object({
	id: z.string(),
	title: z.string(),
	level: z.union([z.literal(2), z.literal(3)]),
});
export type SectionEntry = z.infer<typeof SectionEntry>;

/** One chapter in `chapters.json`: the frontmatter fields plus derived fields. */
export const ChapterEntry = z.object({
	...ChapterFrontmatter.shape,
	/** Repo-relative path of `index.svx`. */
	path: z.string(),
	/** URL path relative to the site base, e.g. `/dl/attention/`. */
	href: z.string().startsWith('/'),
	/** Experimental chapters are outside the main sequence (see `experimentalIds`). */
	experimental: z.boolean(),
	/** Zero-based position inside the topic (inside the experimental list for experimental chapters). */
	index: z.number().int().nonnegative(),
	/** Neighbours in the main sequence; always null for experimental chapters. */
	prev: ChapterId.nullable(),
	next: ChapterId.nullable(),
	/** All block ids of the chapter, in document order. */
	blocks: z.array(BlockId),
	/** Sections in order. */
	sections: z.array(SectionEntry),
});
export type ChapterEntry = z.infer<typeof ChapterEntry>;
export const ChaptersRegistry = z.array(ChapterEntry);
export type ChaptersRegistry = z.infer<typeof ChaptersRegistry>;

/** One lab in `labs.json`. */
export const LabEntry = z.object({
	...Lab.shape,
	/** Repo-relative folder, e.g. `labs/dl-attention-numpy`. */
	dir: z.string(),
	topic: TopicId,
	/** SHA-256 hex of the starter file text (draft invalidation). */
	starterHash: z
		.string()
		.regex(/^[0-9a-f]{64}$/)
		.optional(),
});
export type LabEntry = z.infer<typeof LabEntry>;
export const LabsRegistry = z.array(LabEntry);
export type LabsRegistry = z.infer<typeof LabsRegistry>;

/** `glossary.json`: all terms keyed by id. */
export const GlossaryRegistry = z.record(TermId, GlossaryEntry);
export type GlossaryRegistry = z.infer<typeof GlossaryRegistry>;

export const PrereqNode = z.object({
	id: z.string(),
	kind: z.enum(['chapter', 'concept']),
	title: z.string(),
	topic: TopicId,
	/** Chapter nodes only: experimental chapters (draw as dashed). */
	experimental: z.boolean().optional(),
});
export type PrereqNode = z.infer<typeof PrereqNode>;

/**
 * Edge direction: `from` must be known before `to`.
 * - `prereq`: chapter -> chapter (from = prerequisite chapter)
 * - `introduces`: chapter -> concept
 * - `requires`: concept -> chapter
 */
export const PrereqEdge = z.object({
	from: z.string(),
	to: z.string(),
	kind: z.enum(['prereq', 'introduces', 'requires']),
});
export type PrereqEdge = z.infer<typeof PrereqEdge>;

/** `prereq-graph.json`. Acyclic (checked by `check-content`). */
export const PrereqGraphData = z.object({
	nodes: z.array(PrereqNode),
	edges: z.array(PrereqEdge),
});
export type PrereqGraphData = z.infer<typeof PrereqGraphData>;

/** `aliases.json`: merged `data/aliases.yaml` and frontmatter `aliases`. */
export const AliasesRegistry = AliasesFile;
export type AliasesRegistry = z.infer<typeof AliasesRegistry>;
