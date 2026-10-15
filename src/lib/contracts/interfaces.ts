import { z } from 'zod';
import { LabId, type ChapterId, type Ulid } from './ids';
import type { Lab } from './lab';
import { LabResult } from './lab-result';
import type { Note, NoteAnchor, NoteDraft, NoteStatus } from './notes';
import type { ChapterProgress, LabProgress, ProgressExport, Settings } from './progress';

/** Stops a subscription. */
export type Unsubscribe = () => void;

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

/** Change event for `ProgressStore.subscribe`. */
export type ProgressChange =
	| { kind: 'chapter'; id: ChapterId }
	| { kind: 'lab'; id: LabId }
	| { kind: 'settings' }
	| { kind: 'reset' };

/** Partial update. Only the given records change; `updated` is set by the store. */
export interface ProgressPatch {
	chapters?: Array<Partial<ChapterProgress> & Pick<ChapterProgress, 'id'>>;
	labs?: Array<Partial<LabProgress> & Pick<LabProgress, 'labId' | 'chapter'>>;
	settings?: Partial<Omit<Settings, 'schemaVersion' | 'updated'>>;
}

export type ImportMode = 'merge' | 'replace';

export interface ImportReport {
	chapters: number;
	labs: number;
	notes: number;
	/** Human-readable problems; the import skips invalid records and reports them. */
	skipped: string[];
}

/**
 * One migration step `from -> to` (`to === from + 1`). Pure function over unknown records,
 * applied in order at open/import until `schemaVersion` is current.
 * Each migration ships with a test on a fixture.
 */
export interface Migration {
	from: number;
	to: number;
	migrate(record: unknown): unknown;
}

/**
 * Local store of progress. Application code never knows where data lives.
 * Adapters: IndexedDB (default), in-memory (tests), GitHub sync mirror.
 * Saving is automatic: there is no "save" call from the UI.
 */
export interface ProgressStore {
	/** True when the stored data is newer than this build understands: writes are rejected. */
	readonly readOnly: boolean;
	getChapter(id: ChapterId): Promise<ChapterProgress | undefined>;
	getLab(id: LabId): Promise<LabProgress | undefined>;
	getSettings(): Promise<Settings | undefined>;
	/** Atomically applies the patch and sets `updated`. Throws if `readOnly`. */
	update(patch: ProgressPatch): Promise<void>;
	list(): Promise<{ chapters: ChapterProgress[]; labs: LabProgress[] }>;
	/** Exports progress, settings and notes. Never includes the sync token. */
	export(): Promise<ProgressExport>;
	/** Validates with `ProgressExport` and migrates old versions. */
	import(data: unknown, mode: ImportMode): Promise<ImportReport>;
	subscribe(listener: (change: ProgressChange) => void): Unsubscribe;
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

export interface NotesStore {
	/** Notes of one chapter, in creation order (ULID order). Alias ids are resolved. */
	listByChapter(chapter: ChapterId): Promise<Note[]>;
	list(filter?: { status?: NoteStatus }): Promise<Note[]>;
	get(id: Ulid): Promise<Note | undefined>;
	/** Creates a note: generates ULID, times, `status: 'open'`. */
	create(draft: NoteDraft): Promise<Note>;
	update(
		id: Ulid,
		patch: Partial<Pick<Note, 'text' | 'tags' | 'status' | 'anchor'>>,
	): Promise<Note>;
	delete(id: Ulid): Promise<void>;
	subscribe(listener: (chapter: ChapterId) => void): Unsubscribe;
}

/* ------------------------------------------------------------------ */
/* Sync                                                                */
/* ------------------------------------------------------------------ */

export type SyncState = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
	state: SyncState;
	/** Local changes not yet pushed. */
	pending: number;
	lastSyncAt?: string;
	message?: string;
}

export interface SyncReport {
	pulled: number;
	pushed: number;
	/** Records where both sides changed; the loser is kept in `.conflicts/`. */
	conflicts: string[];
}

/**
 * Optional sync with a private data repository through the GitHub API. Without a token the
 * state is `disabled` and everything works locally. The token is kept in a separate IndexedDB
 * store, never exported, never logged.
 */
export interface SyncAdapter {
	readonly status: SyncStatus;
	setToken(token: string, repository: string): Promise<void>;
	/** Deletes the token ("forget token"). */
	forgetToken(): Promise<void>;
	/** Pull first, then push. Offline or rate-limited: queue stays, nothing is lost. */
	sync(): Promise<SyncReport>;
	subscribe(listener: (status: SyncStatus) => void): Unsubscribe;
}

/* ------------------------------------------------------------------ */
/* Anchors                                                             */
/* ------------------------------------------------------------------ */

/** Plain-text view of a chapter: block id -> visible text. Hidden layers are included. */
export interface ChapterTextIndex {
	blocks: Array<{ id: string; text: string }>;
}

/** Position of a resolved anchor inside the text of its block. */
export interface TextRange {
	blockId: string;
	start: number;
	end: number;
}

/**
 * Result of `resolveAnchor`:
 * - `found`: `exact` is in the anchor's block at the expected place (prefix/suffix agree).
 * - `shifted`: block missing or text changed, `exact` found elsewhere (maybe fuzzy);
 *   `anchor` holds the updated anchor to store (re-anchoring).
 * - `orphaned`: nothing found above the similarity threshold; the note stays in the chapter list
 *   with the original quote.
 */
export type AnchorResolution =
	| { status: 'found'; range: TextRange }
	| { status: 'shifted'; range: TextRange; anchor: NoteAnchor; score: number }
	| { status: 'orphaned' };

/**
 * Builds an anchor from the user's selection inside the chapter container.
 * Finds the closest ancestor with a block id (`[data-block-id]`), takes the selected text as
 * `exact` and up to `ANCHOR_CONTEXT_CHARS` characters of context on each side.
 * For figures sets `figureId` and `element` (from `data-element`).
 * Returns null if the selection is empty, collapsed, or has no block ancestor.
 */
export type AnchorFromSelection = (selection: Selection, root: HTMLElement) => NoteAnchor | null;

/**
 * Pure function. Resolution order:
 * 1. Block with `anchor.blockId` exists and contains `exact` (prefix/suffix used to pick between
 *    several matches) -> `found`.
 * 2. Otherwise search `exact` in the whole chapter (exact, then fuzzy above a threshold)
 *    -> `shifted` with an updated anchor.
 * 3. Otherwise -> `orphaned`.
 */
export type ResolveAnchor = (anchor: NoteAnchor, chapter: ChapterTextIndex) => AnchorResolution;

/* ------------------------------------------------------------------ */
/* Lab runner                                                          */
/* ------------------------------------------------------------------ */

/** Everything the runner needs to run a lab (assembled by `CodeLab` from the registry). */
export interface LabBundle {
	lab: Lab;
	starter: string;
	testsVisible: string;
	/** Executed, but reported by name and status only. */
	testsHidden?: string;
}

export interface RunOptions {
	/** Milliseconds; default is `lab.timeout * 1000`. */
	timeoutMs?: number;
}

/**
 * Runs lab code in an isolated Web Worker (Pyodide or JS). Never rejects for user-code
 * problems: syntax errors, exceptions, timeouts and out-of-memory become a `LabResult`
 * with status `error` / `timeout`. It rejects only for infrastructure failures.
 */
export interface LabRunner {
	run(bundle: LabBundle, code: string, opts?: RunOptions): Promise<LabResult>;
	/** Terminates the Worker. A new Worker is created on the next run. */
	terminate(): void;
}

/** Messages page -> Worker. */
export const WorkerRequest = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('init'),
		runtime: z.enum(['pyodide', 'js']),
		packages: z.array(z.string()),
	}),
	z.object({
		type: z.literal('run'),
		requestId: z.string(),
		labId: LabId,
		code: z.string(),
		testsVisible: z.string(),
		testsHidden: z.string().optional(),
		timeoutMs: z.number().positive(),
	}),
]);
export type WorkerRequest = z.infer<typeof WorkerRequest>;

/** Messages Worker -> page. */
export const WorkerResponse = z.discriminatedUnion('type', [
	z.object({ type: z.literal('ready') }),
	z.object({
		type: z.literal('stage'),
		requestId: z.string(),
		stage: z.enum(['loading-runtime', 'loading-packages', 'running-code', 'running-tests']),
	}),
	z.object({ type: z.literal('stdout'), requestId: z.string(), chunk: z.string() }),
	z.object({ type: z.literal('result'), requestId: z.string(), result: LabResult }),
	z.object({ type: z.literal('fatal'), requestId: z.string().optional(), message: z.string() }),
]);
export type WorkerResponse = z.infer<typeof WorkerResponse>;
