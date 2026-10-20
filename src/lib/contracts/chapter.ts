import { z } from 'zod';
import { BlockId, ChapterId, IsoDate, LabId, TermId, TopicId } from './ids';

export const ChapterStatus = z.enum(['draft', 'review', 'published']);
export type ChapterStatus = z.infer<typeof ChapterStatus>;

export const SourceKind = z.enum(['paper', 'doc', 'spec', 'repo', 'book', 'blog']);
export type SourceKind = z.infer<typeof SourceKind>;

/** Source of facts. `<Cite id>` refers to `id`. Numbers about hardware/API need `accessed`. */
export const Source = z.object({
	id: z.string().regex(/^[a-z][a-z0-9]*$/i, 'source id: letters and digits'),
	kind: SourceKind,
	title: z.string().min(1),
	url: z.url(),
	authors: z.string().optional(),
	venue: z.string().optional(),
	year: z.number().int().min(1900).max(2100).optional(),
	note: z.string().optional(),
	/** Date the source was checked (required for documentation with numbers; enforced by the linter). */
	accessed: IsoDate.optional(),
	/** Block ids that rely on this source. */
	supports: z.array(BlockId).optional(),
});
export type Source = z.infer<typeof Source>;

/** A concept introduced by a chapter (node of the concept graph). */
export const Concept = z.object({ id: TermId, title: z.string().min(1) });
export type Concept = z.infer<typeof Concept>;

/** Reading time: one number, or minutes per complexity level. */
export const Minutes = z.union([
	z.number().positive(),
	z
		.object({
			c1: z.number().positive().optional(),
			c2: z.number().positive().optional(),
			c3: z.number().positive().optional(),
			c4: z.number().positive().optional(),
		})
		.refine((m) => Object.values(m).some((v) => v !== undefined), 'at least one of c1..c4'),
]);
export type Minutes = z.infer<typeof Minutes>;

/** Frontmatter of `content/<topic>/<slug>/index.svx`. */
export const ChapterFrontmatter = z
	.object({
		id: ChapterId,
		title: z.string().min(1),
		topic: TopicId,
		summary: z.string().min(1),
		prereqs: z.array(ChapterId),
		concepts: z.array(Concept).optional(),
		/** Concept ids (from other chapters or the glossary) this chapter uses. */
		requires: z.array(TermId).optional(),
		keywords: z.array(z.string().min(1)),
		minutes: Minutes,
		labs: z.array(LabId).optional(),
		sources: z.array(Source).optional(),
		/** Previous ids of this chapter; merged into `data/aliases.yaml` at generation. */
		aliases: z.array(ChapterId).optional(),
		status: ChapterStatus.optional(),
	})
	.refine((f) => f.id.startsWith(`${f.topic}/`), {
		message: 'id must start with "<topic>/"',
		path: ['id'],
	});
export type ChapterFrontmatter = z.infer<typeof ChapterFrontmatter>;
