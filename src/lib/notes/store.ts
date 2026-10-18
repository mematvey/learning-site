import { openDB, type IDBPDatabase } from 'idb';
import { monotonicFactory } from 'ulid';
import {
	Note,
	type ChapterId,
	type ImportMode,
	type NoteDraft,
	type NoteStatus,
	type NotesStore,
	type Ulid,
	type Unsubscribe,
} from '$lib/contracts';

// Monotonic: ids created within the same millisecond still sort in creation order.
const ulid = monotonicFactory();

const STORE = 'notes';
const CHAPTER_INDEX = 'chapter';

export interface NotesStoreOptions {
	/** IndexedDB database name. Tests pass a unique name per store. */
	dbName?: string;
	/** Maps a stored chapter id to its current id (`data/aliases.yaml`). Identity by default. */
	resolveChapter?: (id: ChapterId) => ChapterId;
}

export interface OpenNotesStore extends NotesStore {
	/**
	 * Writes notes from an export file, keeping their ids and timestamps. `merge` keeps a stored
	 * note that is newer than the incoming one; `replace` clears the store first.
	 * Returns the number of notes written.
	 */
	importNotes(notes: Note[], mode: ImportMode): Promise<number>;
	close(): void;
}

/**
 * Notes in IndexedDB. Each write validates the record with the `Note` schema, so a store never
 * holds data that the export format would reject.
 */
export async function createNotesStore(options: NotesStoreOptions = {}): Promise<OpenNotesStore> {
	const resolve = options.resolveChapter ?? ((id: ChapterId) => id);
	const listeners = new Set<(chapter: ChapterId) => void>();

	const db: IDBPDatabase = await openDB(options.dbName ?? 'learning-site-notes', 1, {
		upgrade(database) {
			const store = database.createObjectStore(STORE, { keyPath: 'id' });
			store.createIndex(CHAPTER_INDEX, 'chapter');
		},
	});

	const emit = (chapter: ChapterId) => {
		for (const listener of listeners) listener(chapter);
	};

	const readAll = async (): Promise<Note[]> => {
		const rows: unknown[] = await db.getAll(STORE);
		return rows.map((row) => Note.parse(row));
	};

	// ULIDs sort by creation time, so sorting by id gives creation order.
	const sortById = (rows: Note[]) => rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

	const get = async (id: Ulid): Promise<Note | undefined> => {
		const row: unknown = await db.get(STORE, id);
		return row === undefined ? undefined : Note.parse(row);
	};

	return {
		async listByChapter(chapter) {
			const target = resolve(chapter);
			const rows = await readAll();
			return sortById(rows.filter((note) => resolve(note.chapter) === target));
		},

		async list(filter) {
			const rows = await readAll();
			const status: NoteStatus | undefined = filter?.status;
			return sortById(rows.filter((note) => status === undefined || note.status === status));
		},

		get,

		async create(draft: NoteDraft) {
			const now = new Date().toISOString();
			const note = Note.parse({
				schemaVersion: 1,
				id: ulid(),
				chapter: draft.chapter,
				anchor: draft.anchor,
				text: draft.text,
				tags: draft.tags,
				status: 'open',
				created: now,
				updated: now,
				layer: draft.layer,
			});
			await db.add(STORE, note);
			emit(note.chapter);
			return note;
		},

		async update(id, patch) {
			const current = await get(id);
			if (!current) throw new Error(`note not found: ${id}`);
			const next = Note.parse({
				...current,
				...patch,
				updated: new Date().toISOString(),
			});
			await db.put(STORE, next);
			emit(next.chapter);
			return next;
		},

		async delete(id) {
			const current = await get(id);
			await db.delete(STORE, id);
			if (current) emit(current.chapter);
		},

		async importNotes(incoming, mode) {
			const valid = incoming.map((note) => Note.parse(note));
			const tx = db.transaction(STORE, 'readwrite');
			const os = tx.objectStore(STORE);
			const touched = new Set<ChapterId>();
			if (mode === 'replace') {
				for (const row of await os.getAll()) touched.add(Note.parse(row).chapter);
				await os.clear();
			}
			let written = 0;
			for (const note of valid) {
				const existing: unknown = mode === 'replace' ? undefined : await os.get(note.id);
				if (existing !== undefined) {
					const stored = Note.parse(existing);
					if (Date.parse(stored.updated) > Date.parse(note.updated)) continue;
				}
				await os.put(note);
				touched.add(note.chapter);
				written++;
			}
			await tx.done;
			for (const chapter of touched) emit(chapter);
			return written;
		},

		subscribe(listener): Unsubscribe {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		close() {
			db.close();
			listeners.clear();
		},
	};
}
