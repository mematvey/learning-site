import { z } from 'zod';
import { BlockId, ChapterId, IsoDateTime, Ulid } from './ids';

export const MY_SCHEMA_VERSION = 1;

export const BookmarkKind = z.enum(['block', 'formula', 'term', 'figure']);
export type BookmarkKind = z.infer<typeof BookmarkKind>;

/** Bookmark for revision: a block, a formula, a glossary term or a figure inside a chapter. */
export const Bookmark = z.object({
	schemaVersion: z.literal(MY_SCHEMA_VERSION),
	id: Ulid,
	kind: BookmarkKind,
	topic: z.string().min(1),
	chapter: ChapterId,
	/** Nearest block with `{#block-id}` (or the `Figure id`). */
	blockId: BlockId,
	/** Saved fragment: plain text, or TeX for a formula. */
	quote: z.string().max(600).optional(),
	prefix: z.string().max(32).optional(),
	suffix: z.string().max(32).optional(),
	/** Glossary term id for `kind: 'term'`. */
	termId: z.string().optional(),
	/** Short comment, up to 280 characters. */
	comment: z.string().max(280),
	created: IsoDateTime,
	updated: IsoDateTime,
});
export type Bookmark = z.infer<typeof Bookmark>;

export const WishStatus = z.enum(['idea', 'drafting', 'covered']);
export type WishStatus = z.infer<typeof WishStatus>;

/** A wanted topic / future chapter in a topic's idea bank. */
export const Wish = z.object({
	schemaVersion: z.literal(MY_SCHEMA_VERSION),
	id: Ulid,
	topic: z.string().min(1),
	title: z.string().min(1).max(160),
	/** What exactly is unclear / what I want to understand. */
	question: z.string(),
	wantedSections: z.array(z.string().min(1)),
	wantedTerms: z.array(z.string().min(1)),
	notes: z.string(),
	status: WishStatus,
	created: IsoDateTime,
	updated: IsoDateTime,
});
export type Wish = z.infer<typeof Wish>;

/** What a situation or a clarification is attached to. */
export const MyTarget = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('chapter'), chapter: ChapterId }),
	z.object({ kind: z.literal('wish'), wishId: Ulid }),
]);
export type MyTarget = z.infer<typeof MyTarget>;

export const SituationStatus = z.enum(['open', 'answered']);
export type SituationStatus = z.infer<typeof SituationStatus>;

/** "I have this situation, what should I do": attached to an existing chapter or a wished one. */
export const Situation = z.object({
	schemaVersion: z.literal(MY_SCHEMA_VERSION),
	id: Ulid,
	topic: z.string().min(1),
	target: MyTarget,
	title: z.string().min(1).max(160),
	/** My situation, in my words. */
	situation: z.string(),
	/** What decision / what understanding I need. */
	goal: z.string(),
	status: SituationStatus,
	created: IsoDateTime,
	updated: IsoDateTime,
});
export type Situation = z.infer<typeof Situation>;

/** A short clarification to a chapter, a wished chapter or a situation. */
export const Clarification = z.object({
	schemaVersion: z.literal(MY_SCHEMA_VERSION),
	id: Ulid,
	topic: z.string().min(1),
	target: z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('chapter'), chapter: ChapterId }),
		z.object({ kind: z.literal('wish'), wishId: Ulid }),
		z.object({ kind: z.literal('situation'), situationId: Ulid }),
	]),
	text: z.string().min(1),
	created: IsoDateTime,
	updated: IsoDateTime,
});
export type Clarification = z.infer<typeof Clarification>;

/** Drafts: what the caller provides; the store adds id, schemaVersion, times. */
export type BookmarkDraft = Omit<Bookmark, 'schemaVersion' | 'id' | 'created' | 'updated'>;
export type WishDraft = Omit<Wish, 'schemaVersion' | 'id' | 'created' | 'updated' | 'status'> &
	Partial<Pick<Wish, 'status'>>;
export type SituationDraft = Omit<
	Situation,
	'schemaVersion' | 'id' | 'created' | 'updated' | 'status'
> &
	Partial<Pick<Situation, 'status'>>;
export type ClarificationDraft = Omit<
	Clarification,
	'schemaVersion' | 'id' | 'created' | 'updated'
>;

export interface MyFilter {
	topic?: string;
	chapter?: string;
}

export interface MyCollection<T, D> {
	list(filter?: MyFilter): Promise<T[]>;
	add(draft: D): Promise<T>;
	update(id: string, patch: Partial<D>): Promise<T>;
	remove(id: string): Promise<void>;
}

export interface MyData {
	bookmarks: Bookmark[];
	wishes: Wish[];
	situations: Situation[];
	clarifications: Clarification[];
}

/** One store for everything in "Моё". IndexedDB `learning-site-my`. */
export interface MyStore {
	bookmarks: MyCollection<Bookmark, BookmarkDraft>;
	wishes: MyCollection<Wish, WishDraft>;
	situations: MyCollection<Situation, SituationDraft>;
	clarifications: MyCollection<Clarification, ClarificationDraft>;
	/** Called after any write; returns unsubscribe. */
	subscribe(listener: () => void): () => void;
	exportAll(): Promise<MyData>;
	importAll(data: MyData, mode: 'merge' | 'replace'): Promise<void>;
	/** Delete everything in "Моё" (after the UI confirmation). */
	clearAll(): Promise<void>;
}

/** Export file: a path inside the chosen folder and its content. */
export interface ExportFile {
	path: string;
	content: string;
}
