import { openDB, type IDBPDatabase } from 'idb';
import { z, type ZodType } from 'zod';
import {
	ChapterProgress,
	DEFAULT_LEVELS,
	EXPORT_FORMAT,
	LabProgress,
	Note,
	PROGRESS_SCHEMA_VERSION,
	ProgressExport,
	Settings,
	type ChapterId,
	type ImportMode,
	type ImportReport,
	type LabId,
	type Migration,
	type ProgressChange,
	type ProgressPatch,
	type ProgressStore,
	type Unsubscribe,
} from '$lib/contracts';
import { decodeRecord, PROGRESS_MIGRATIONS } from './migrate';

export const PROGRESS_DB_NAME = 'learning-site-progress';

const DB_VERSION = 1;
const CHAPTERS = 'chapters';
const LABS = 'labs';
const SETTINGS = 'settings';
const META = 'meta';
const SETTINGS_KEY = 'settings';
const VERSION_KEY = 'schemaVersion';

export interface ProgressStoreOptions {
	dbName?: string;
	/** Steps `vN -> vN+1` applied to records written by older builds. */
	migrations?: readonly Migration[];
	/** Supplies notes for export. The notes store lives outside this module. */
	notes?: () => Promise<Note[]>;
	/** Receives valid notes found in an import (the notes store writes them). */
	importNotes?: (notes: Note[], mode: ImportMode) => Promise<void>;
	/** ISO timestamp source; injectable for tests. */
	now?: () => string;
}

export interface OpenedProgressStore extends ProgressStore {
	close(): void;
}

function defined<T extends object>(obj: T): Partial<T> {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function updatedAt(raw: unknown): number {
	return Date.parse((raw as { updated: string }).updated);
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/**
 * Opens the IndexedDB progress store. Writes are rejected (`readOnly`) when the database
 * was written by a newer schema version than this build understands.
 */
export async function openProgressStore(
	options: ProgressStoreOptions = {},
): Promise<OpenedProgressStore> {
	const migrations = options.migrations ?? PROGRESS_MIGRATIONS;
	const now = options.now ?? (() => new Date().toISOString());

	const db: IDBPDatabase = await openDB(options.dbName ?? PROGRESS_DB_NAME, DB_VERSION, {
		upgrade(database) {
			if (!database.objectStoreNames.contains(CHAPTERS)) {
				database.createObjectStore(CHAPTERS, { keyPath: 'id' });
			}
			if (!database.objectStoreNames.contains(LABS)) {
				database.createObjectStore(LABS, { keyPath: 'labId' });
			}
			if (!database.objectStoreNames.contains(SETTINGS)) database.createObjectStore(SETTINGS);
			if (!database.objectStoreNames.contains(META)) database.createObjectStore(META);
		},
	});

	const stored = await db.get(META, VERSION_KEY);
	const readOnly = typeof stored === 'number' && stored > PROGRESS_SCHEMA_VERSION;
	if (stored === undefined) await db.put(META, PROGRESS_SCHEMA_VERSION, VERSION_KEY);

	const listeners = new Set<(change: ProgressChange) => void>();
	const emit = (changes: ProgressChange[]) => {
		for (const change of changes) for (const listener of listeners) listener(change);
	};
	const assertWritable = () => {
		if (readOnly) {
			throw new Error('Progress store is read-only: data was written by a newer site version.');
		}
	};
	const decode = <T>(raw: unknown, schema: ZodType<T>) => decodeRecord(raw, schema, migrations);

	const getSettings = async () => {
		const raw = await db.get(SETTINGS, SETTINGS_KEY);
		return raw === undefined ? undefined : decode(raw, Settings);
	};

	const list = async () => {
		const [chapters, labs] = await Promise.all([db.getAll(CHAPTERS), db.getAll(LABS)]);
		return {
			chapters: chapters.map((raw) => decode(raw, ChapterProgress)),
			labs: labs.map((raw) => decode(raw, LabProgress)),
		};
	};

	/** Decodes one record of an export file, or records a skip reason and returns undefined. */
	const decodeOrSkip = <T>(
		raw: unknown,
		label: string,
		schema: ZodType<T>,
		skipped: string[],
		decoder: (raw: unknown, schema: ZodType<T>) => T = decode,
	): T | undefined => {
		try {
			return decoder(raw, schema);
		} catch (e) {
			skipped.push(`${label}: ${errorMessage(e)}`);
			return undefined;
		}
	};

	const store: OpenedProgressStore = {
		readOnly,

		async getChapter(id: ChapterId) {
			const raw = await db.get(CHAPTERS, id);
			return raw === undefined ? undefined : decode(raw, ChapterProgress);
		},

		async getLab(id: LabId) {
			const raw = await db.get(LABS, id);
			return raw === undefined ? undefined : decode(raw, LabProgress);
		},

		getSettings,

		async update(patch: ProgressPatch) {
			assertWritable();
			const ts = now();
			const changes: ProgressChange[] = [];
			const tx = db.transaction([CHAPTERS, LABS, SETTINGS, META], 'readwrite');

			for (const c of patch.chapters ?? []) {
				const raw = await tx.objectStore(CHAPTERS).get(c.id);
				const base =
					raw === undefined
						? {
								schemaVersion: PROGRESS_SCHEMA_VERSION,
								id: c.id,
								updated: ts,
								visited: null,
								sectionsReached: [],
								sectionsDone: [],
								levels: { ...DEFAULT_LEVELS },
								done: false,
							}
						: decode(raw, ChapterProgress);
				const next = ChapterProgress.parse({
					...base,
					...defined(c),
					id: c.id,
					schemaVersion: PROGRESS_SCHEMA_VERSION,
					updated: ts,
				});
				await tx.objectStore(CHAPTERS).put(next);
				changes.push({ kind: 'chapter', id: c.id });
			}

			for (const l of patch.labs ?? []) {
				const raw = await tx.objectStore(LABS).get(l.labId);
				const base =
					raw === undefined
						? {
								schemaVersion: PROGRESS_SCHEMA_VERSION,
								labId: l.labId,
								chapter: l.chapter,
								updated: ts,
								passed: false,
							}
						: decode(raw, LabProgress);
				const next = LabProgress.parse({
					...base,
					...defined(l),
					labId: l.labId,
					schemaVersion: PROGRESS_SCHEMA_VERSION,
					updated: ts,
				});
				await tx.objectStore(LABS).put(next);
				changes.push({ kind: 'lab', id: l.labId });
			}

			if (patch.settings !== undefined) {
				const raw = await tx.objectStore(SETTINGS).get(SETTINGS_KEY);
				const base =
					raw === undefined
						? { schemaVersion: PROGRESS_SCHEMA_VERSION, updated: ts, theme: 'system' as const }
						: decode(raw, Settings);
				const next = Settings.parse({
					...base,
					...defined(patch.settings),
					schemaVersion: PROGRESS_SCHEMA_VERSION,
					updated: ts,
				});
				await tx.objectStore(SETTINGS).put(next, SETTINGS_KEY);
				changes.push({ kind: 'settings' });
			}

			if (changes.length > 0) await tx.objectStore(META).put(PROGRESS_SCHEMA_VERSION, VERSION_KEY);
			await tx.done;
			emit(changes);
		},

		list,

		async setSectionDone(chapter: ChapterId, sectionId: string, done: boolean) {
			assertWritable();
			const ts = now();
			const tx = db.transaction([CHAPTERS, META], 'readwrite');
			const raw = await tx.objectStore(CHAPTERS).get(chapter);
			const base =
				raw === undefined
					? {
							schemaVersion: PROGRESS_SCHEMA_VERSION,
							id: chapter,
							updated: ts,
							visited: null,
							sectionsReached: [],
							sectionsDone: [],
							levels: { ...DEFAULT_LEVELS },
							done: false,
						}
					: decode(raw, ChapterProgress);
			const marks = new Set(base.sectionsDone);
			if (done) marks.add(sectionId);
			else marks.delete(sectionId);
			const next = ChapterProgress.parse({
				...base,
				sectionsDone: [...marks],
				schemaVersion: PROGRESS_SCHEMA_VERSION,
				updated: ts,
			});
			await tx.objectStore(CHAPTERS).put(next);
			await tx.objectStore(META).put(PROGRESS_SCHEMA_VERSION, VERSION_KEY);
			await tx.done;
			emit([{ kind: 'chapter', id: chapter }]);
		},

		async resetChapter(chapter: ChapterId) {
			assertWritable();
			await db.delete(CHAPTERS, chapter);
			emit([{ kind: 'chapter', id: chapter }]);
		},

		async resetTopic(topic: string) {
			assertWritable();
			const prefix = `${topic}/`;
			const tx = db.transaction(CHAPTERS, 'readwrite');
			const keys = (await tx.store.getAllKeys()).map(String).filter((k) => k.startsWith(prefix));
			for (const key of keys) await tx.store.delete(key);
			await tx.done;
			emit(keys.map((id) => ({ kind: 'chapter' as const, id: id as ChapterId })));
		},

		async resetAll() {
			assertWritable();
			await db.clear(CHAPTERS);
			emit([{ kind: 'reset' }]);
		},

		async export() {
			const [settings, progress, notes] = await Promise.all([
				getSettings(),
				list(),
				options.notes ? options.notes() : Promise.resolve([] as Note[]),
			]);
			return ProgressExport.parse({
				format: EXPORT_FORMAT,
				schemaVersion: PROGRESS_SCHEMA_VERSION,
				exportedAt: now(),
				settings,
				chapters: progress.chapters,
				labs: progress.labs,
				notes,
			});
		},

		async import(data: unknown, mode: ImportMode): Promise<ImportReport> {
			assertWritable();
			const header = z
				.object({ format: z.string(), schemaVersion: z.number().int() })
				.safeParse(data);
			if (!header.success || header.data.format !== EXPORT_FORMAT) {
				throw new Error('Not a learning-site export file.');
			}
			if (header.data.schemaVersion > PROGRESS_SCHEMA_VERSION) {
				throw new Error(
					`Export schemaVersion ${header.data.schemaVersion} is newer than ${PROGRESS_SCHEMA_VERSION}.`,
				);
			}

			const raw = data as Record<string, unknown>;
			const skipped: string[] = [];
			const collect = <T>(
				items: unknown,
				label: string,
				schema: ZodType<T>,
				decoder?: (raw: unknown, schema: ZodType<T>) => T,
			): T[] => {
				if (items === undefined) return [];
				if (!Array.isArray(items)) {
					skipped.push(`${label}: expected an array`);
					return [];
				}
				const out: T[] = [];
				items.forEach((item, i) => {
					const value = decodeOrSkip(item, `${label}[${i}]`, schema, skipped, decoder);
					if (value !== undefined) out.push(value);
				});
				return out;
			};

			const chapters = collect(raw.chapters, 'chapters', ChapterProgress);
			const labs = collect(raw.labs, 'labs', LabProgress);
			// Notes have their own schema version (no migrations yet): progress migrations must not touch them.
			const notes = collect(raw.notes, 'notes', Note, (item, schema) => schema.parse(item));
			const settings =
				raw.settings === undefined
					? undefined
					: decodeOrSkip(raw.settings, 'settings', Settings, skipped);

			const replace = mode === 'replace';
			const changes: ProgressChange[] = [];
			const counts = { chapters: 0, labs: 0 };
			const tx = db.transaction([CHAPTERS, LABS, SETTINGS], 'readwrite');

			if (replace) {
				await Promise.all([
					tx.objectStore(CHAPTERS).clear(),
					tx.objectStore(LABS).clear(),
					tx.objectStore(SETTINGS).clear(),
				]);
			}

			for (const ch of chapters) {
				const existing = replace ? undefined : await tx.objectStore(CHAPTERS).get(ch.id);
				if (existing !== undefined && updatedAt(existing) > Date.parse(ch.updated)) continue;
				await tx.objectStore(CHAPTERS).put(ch);
				counts.chapters++;
				changes.push({ kind: 'chapter', id: ch.id });
			}

			for (const lab of labs) {
				const existing = replace ? undefined : await tx.objectStore(LABS).get(lab.labId);
				if (existing !== undefined && updatedAt(existing) > Date.parse(lab.updated)) continue;
				await tx.objectStore(LABS).put(lab);
				counts.labs++;
				changes.push({ kind: 'lab', id: lab.labId });
			}

			if (settings) {
				const existing = replace ? undefined : await tx.objectStore(SETTINGS).get(SETTINGS_KEY);
				if (existing === undefined || updatedAt(existing) <= Date.parse(settings.updated)) {
					await tx.objectStore(SETTINGS).put(settings, SETTINGS_KEY);
					changes.push({ kind: 'settings' });
				}
			}

			await tx.done;

			let noteCount = 0;
			if (notes.length > 0) {
				if (options.importNotes) {
					await options.importNotes(notes, mode);
					noteCount = notes.length;
				} else {
					skipped.push(`notes: ${notes.length} not imported, no notes store attached`);
				}
			}

			if (replace) emit([{ kind: 'reset' }]);
			else emit(changes);

			return { chapters: counts.chapters, labs: counts.labs, notes: noteCount, skipped };
		},

		subscribe(listener: (change: ProgressChange) => void): Unsubscribe {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		close() {
			db.close();
		},
	};

	return store;
}
