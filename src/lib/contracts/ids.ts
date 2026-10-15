import { z } from 'zod';

/**
 * Identifier schemas. All ids are lowercase ASCII, stable forever.
 * Renaming a chapter goes through `data/aliases.yaml`, never through an id change.
 */

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Topic id, e.g. `dl`, `classic-ml`. Topics are discovered from `content/<topic>/topic.yaml`. */
export const TopicId = z.string().regex(KEBAB, 'topic id must be kebab-case');
export type TopicId = z.infer<typeof TopicId>;

/** Chapter id `<topic>/<slug>`, e.g. `dl/attention`. Must match the folder path. */
export const ChapterId = z
	.string()
	.regex(
		/^[a-z][a-z0-9]*(-[a-z0-9]+)*\/[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
		'chapter id is <topic>/<slug>',
	);
export type ChapterId = z.infer<typeof ChapterId>;

/** Lab id `<topic>-<slug>`, e.g. `dl-attention-numpy`. Must match the folder name in `labs/`. */
export const LabId = z
	.string()
	.regex(
		/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/,
		'lab id is <topic>-<slug> (kebab-case, at least two parts)',
	);
export type LabId = z.infer<typeof LabId>;

/** Block id used in `{#block-id}` and `Figure id`. Unique inside one chapter. */
export const BlockId = z.string().regex(KEBAB, 'block id must be kebab-case');
export type BlockId = z.infer<typeof BlockId>;

/** Glossary term id and concept id, e.g. `attention-head`. */
export const TermId = z.string().regex(KEBAB, 'term id must be kebab-case');
export type TermId = z.infer<typeof TermId>;

/** ULID (Crockford base32, 26 chars). Used for notes. */
export const Ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'invalid ULID');
export type Ulid = z.infer<typeof Ulid>;

/** ISO 8601 date-time in UTC, e.g. `2026-10-16T10:12:00Z`. */
export const IsoDateTime = z.iso.datetime();
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** ISO 8601 calendar date, e.g. `2026-10-16`. */
export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

/** Splits a chapter id into topic and slug. Throws on a malformed id. */
export function splitChapterId(id: ChapterId): { topic: TopicId; slug: string } {
	const parsed = ChapterId.parse(id);
	const [topic, slug] = parsed.split('/') as [string, string];
	return { topic, slug };
}
