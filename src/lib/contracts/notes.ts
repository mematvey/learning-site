import { z } from 'zod';
import { BlockId, ChapterId, IsoDateTime, Ulid } from './ids';
import { LevelState } from './levels';

export const NOTE_SCHEMA_VERSION = 1;

/** Context length (characters) before/after the selection. */
export const ANCHOR_CONTEXT_CHARS = 32;

/**
 * Note anchor, in the spirit of the W3C Web Annotation TextQuoteSelector.
 * Resolution order: `blockId` -> `exact` inside it (checked with prefix/suffix) -> fuzzy search
 * in the whole chapter -> orphaned.
 */
export const NoteAnchor = z.object({
	/** Nearest block with `{#block-id}` (or the `Figure id`). */
	blockId: BlockId,
	/** Selected quote. */
	exact: z.string().min(1),
	prefix: z.string().max(ANCHOR_CONTEXT_CHARS),
	suffix: z.string().max(ANCHOR_CONTEXT_CHARS),
	/** `Figure id`, when the note is attached to a figure. */
	figureId: BlockId.optional(),
	/** Element inside a figure, e.g. `row=2,col=3` or an entity id. */
	element: z.string().optional(),
	/** Last known position; recomputed on the client at load. */
	position: z.enum(['anchored', 'orphaned']).optional(),
});
export type NoteAnchor = z.infer<typeof NoteAnchor>;

export const NoteStatus = z.enum(['open', 'answered']);
export type NoteStatus = z.infer<typeof NoteStatus>;

/** File: `user-data/notes/<topic>/<slug>/<ulid>.json`. Agent answer: `<ulid>.answer.md`. */
export const Note = z.object({
	schemaVersion: z.literal(NOTE_SCHEMA_VERSION),
	id: Ulid,
	/** Chapter id at creation time (resolve through aliases). */
	chapter: ChapterId,
	anchor: NoteAnchor,
	/** Author's comment (markdown). */
	text: z.string(),
	tags: z.array(z.string().min(1)).optional(),
	status: NoteStatus,
	created: IsoDateTime,
	updated: IsoDateTime,
	/** Slider state at creation: hint when the anchor sits in a hidden layer. */
	layer: LevelState.optional(),
});
export type Note = z.infer<typeof Note>;

/** Fields the caller provides when creating a note; the store adds id, times, status. */
export type NoteDraft = Pick<Note, 'chapter' | 'anchor' | 'text'> &
	Partial<Pick<Note, 'tags' | 'layer'>>;
