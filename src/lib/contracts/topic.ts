import { z } from 'zod';
import { ChapterId, TopicId } from './ids';

/** Schema version of authored content formats (frontmatter, topic.yaml, lab.yaml, glossary). */
export const CONTENT_SCHEMA_VERSION = 1;

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb');

/** Accent colors of a topic. They feed `--topic` and `--topic-soft` for both themes. */
export const TopicAccent = z.object({
	topic: z.object({ light: Hex, dark: Hex }),
	soft: z.object({ light: Hex, dark: Hex }),
});
export type TopicAccent = z.infer<typeof TopicAccent>;

/** `content/<topic>/topic.yaml`. */
export const Topic = z.object({
	id: TopicId,
	title: z.string().min(1),
	/** Short description for the topic card. */
	description: z.string().min(1),
	/** Position of the topic on the home page (ascending). */
	order: z.number().int().nonnegative(),
	/** Icon name from the site icon set (or an inline-SVG key). */
	icon: z.string().min(1).optional(),
	accent: TopicAccent,
	/** Explicit chapter slugs order. If omitted: topological by `prereqs`, then alphabetical. */
	chapters: z.array(z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)).optional(),
	/** Chapter ids shown first in the topic map / on the topic card. */
	featured: z.array(ChapterId).max(3).optional(),
});
export type Topic = z.infer<typeof Topic>;
