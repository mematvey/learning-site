import { z } from 'zod';
import { BlockId, ChapterId, IsoDateTime, LabId } from './ids';
import { LabResultSummary } from './lab-result';
import { LevelState } from './levels';
import { Note } from './notes';

export const PROGRESS_SCHEMA_VERSION = 1;

/** `user-data/progress/<topic>/<slug>.json`. Saved automatically. */
export const ChapterProgress = z.object({
	schemaVersion: z.literal(PROGRESS_SCHEMA_VERSION),
	id: ChapterId,
	updated: IsoDateTime,
	/** First visit, or null if the record was created without a visit. */
	visited: IsoDateTime.nullable(),
	lastVisit: IsoDateTime.optional(),
	/** Reading position by block, not pixels. `offset` is 0..1 inside the block. */
	scroll: z.object({ blockId: BlockId, offset: z.number().min(0).max(1) }).optional(),
	/** Ids of sections (`#idea`, `#math`, ...) reached. */
	sectionsReached: z.array(z.string()),
	/** Last applied slider state. */
	levels: LevelState,
	/** Optional manual "done" mark. */
	done: z.boolean(),
});
export type ChapterProgress = z.infer<typeof ChapterProgress>;

/** Draft of the user's lab code. */
export const LabDraft = z.object({
	code: z.string(),
	savedAt: IsoDateTime,
	/** Hash (hex, sha-256 of starter file text) of the starter code the draft was started from. */
	starterHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type LabDraft = z.infer<typeof LabDraft>;

/** `user-data/progress/labs/<lab-id>.json`. */
export const LabProgress = z.object({
	schemaVersion: z.literal(PROGRESS_SCHEMA_VERSION),
	labId: LabId,
	chapter: ChapterId,
	updated: IsoDateTime,
	passed: z.boolean(),
	passedAt: IsoDateTime.optional(),
	lastResult: LabResultSummary.optional(),
	draft: LabDraft.optional(),
});
export type LabProgress = z.infer<typeof LabProgress>;

export const Theme = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof Theme>;

/** `user-data/settings.json`. The sync token is never stored here. */
export const Settings = z.object({
	schemaVersion: z.literal(PROGRESS_SCHEMA_VERSION),
	updated: IsoDateTime,
	levels: LevelState.optional(),
	theme: Theme,
});
export type Settings = z.infer<typeof Settings>;

/** Export format (JSON file for moving data between devices). No tokens. */
export const EXPORT_FORMAT = 'learning-site-export';

export const ProgressExport = z.object({
	format: z.literal(EXPORT_FORMAT),
	schemaVersion: z.literal(PROGRESS_SCHEMA_VERSION),
	exportedAt: IsoDateTime,
	settings: Settings.optional(),
	chapters: z.array(ChapterProgress),
	labs: z.array(LabProgress),
	notes: z.array(Note),
});
export type ProgressExport = z.infer<typeof ProgressExport>;
