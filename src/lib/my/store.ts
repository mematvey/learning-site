import { openDB, type IDBPDatabase } from 'idb';
import { monotonicFactory } from 'ulid';
import { z } from 'zod';
import {
	Bookmark,
	Clarification,
	MY_SCHEMA_VERSION,
	Situation,
	Wish,
	type BookmarkDraft,
	type ClarificationDraft,
	type MyCollection,
	type MyData,
	type MyFilter,
	type MyStore,
	type SituationDraft,
	type WishDraft,
} from '$lib/contracts/my';

// Monotonic: ids created within the same millisecond still sort in creation order.
const ulid = monotonicFactory();

const DB_NAME = 'learning-site-my';
const DB_VERSION = 1;

const STORES = ['bookmarks', 'wishes', 'situations', 'clarifications'] as const;
type StoreName = (typeof STORES)[number];

/** Whole-file shape accepted by `importAll`. Validated before anything is written. */
export const MyDataSchema = z.object({
	bookmarks: z.array(Bookmark),
	wishes: z.array(Wish),
	situations: z.array(Situation),
	clarifications: z.array(Clarification),
});

interface Row {
	id: string;
	topic: string;
	created: string;
	updated: string;
}

interface CollectionDef<T extends Row, D> {
	name: StoreName;
	schema: z.ZodType<T>;
	/** Record fields given by the caller plus defaults; id and times are added by the store. */
	fill(draft: D): Record<string, unknown>;
	/** Extra filter matching beyond `topic`; `chapter` is handled here. */
	chapterOf(item: T): string | undefined;
}

export interface MyStoreOptions {
	/** IndexedDB database name. Tests pass a unique name per store. */
	dbName?: string;
}

function defined<T extends object>(patch: T): Partial<T> {
	return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * The "My" data in IndexedDB: bookmarks, wishes, situations and clarifications.
 * Every read and write goes through the zod schemas, so the store never holds data that
 * the export format would reject.
 */
export interface OpenMyStore extends MyStore {
	close(): void;
}

export async function createMyStore(options: MyStoreOptions = {}): Promise<OpenMyStore> {
	const db: IDBPDatabase = await openDB(options.dbName ?? DB_NAME, DB_VERSION, {
		upgrade(database) {
			for (const name of STORES) {
				const store = database.createObjectStore(name, { keyPath: 'id' });
				store.createIndex('topic', 'topic');
			}
		},
	});

	const listeners = new Set<() => void>();
	const emit = () => {
		for (const listener of listeners) listener();
	};

	const now = () => new Date().toISOString();

	const readAll = async <T extends Row>(name: StoreName, schema: z.ZodType<T>): Promise<T[]> => {
		const rows: unknown[] = await db.getAll(name);
		return rows.map((row) => schema.parse(row));
	};

	const sortById = <T extends Row>(rows: T[]): T[] =>
		rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

	function collection<T extends Row, D>(def: CollectionDef<T, D>): MyCollection<T, D> {
		const get = async (id: string): Promise<T | undefined> => {
			const row: unknown = await db.get(def.name, id);
			return row === undefined ? undefined : def.schema.parse(row);
		};

		return {
			async list(filter?: MyFilter) {
				const rows = await readAll(def.name, def.schema);
				return sortById(
					rows.filter((item) => {
						if (filter?.topic !== undefined && item.topic !== filter.topic) return false;
						if (filter?.chapter !== undefined && def.chapterOf(item) !== filter.chapter) {
							return false;
						}
						return true;
					}),
				);
			},

			async add(draft: D) {
				const stamp = now();
				const item = def.schema.parse({
					...def.fill(draft),
					schemaVersion: MY_SCHEMA_VERSION,
					id: ulid(),
					created: stamp,
					updated: stamp,
				});
				await db.add(def.name, item);
				emit();
				return item;
			},

			async update(id: string, patch: Partial<D>) {
				const current = await get(id);
				if (!current) throw new Error(`${def.name} item not found: ${id}`);
				const next = def.schema.parse({
					...current,
					...defined(patch as Record<string, unknown>),
					schemaVersion: MY_SCHEMA_VERSION,
					id: current.id,
					created: current.created,
					updated: now(),
				});
				await db.put(def.name, next);
				emit();
				return next;
			},

			async remove(id: string) {
				await db.delete(def.name, id);
				emit();
			},
		};
	}

	const bookmarks = collection<Bookmark, BookmarkDraft>({
		name: 'bookmarks',
		schema: Bookmark,
		fill: (draft) => ({ ...draft }),
		chapterOf: (item) => item.chapter,
	});

	const wishes = collection<Wish, WishDraft>({
		name: 'wishes',
		schema: Wish,
		fill: (draft) => ({ ...draft, status: draft.status ?? 'idea' }),
		chapterOf: () => undefined,
	});

	const situations = collection<Situation, SituationDraft>({
		name: 'situations',
		schema: Situation,
		fill: (draft) => ({ ...draft, status: draft.status ?? 'open' }),
		chapterOf: (item) => (item.target.kind === 'chapter' ? item.target.chapter : undefined),
	});

	const clarifications = collection<Clarification, ClarificationDraft>({
		name: 'clarifications',
		schema: Clarification,
		fill: (draft) => ({ ...draft }),
		chapterOf: (item) => (item.target.kind === 'chapter' ? item.target.chapter : undefined),
	});

	const readEverything = async (): Promise<MyData> => ({
		bookmarks: await readAll('bookmarks', Bookmark),
		wishes: await readAll('wishes', Wish),
		situations: await readAll('situations', Situation),
		clarifications: await readAll('clarifications', Clarification),
	});

	return {
		bookmarks,
		wishes,
		situations,
		clarifications,

		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		exportAll: readEverything,

		async importAll(data, mode) {
			// Validate the whole file first: an invalid file must not change the database.
			const parsed = MyDataSchema.parse(data);
			const tx = db.transaction([...STORES], 'readwrite');

			if (mode === 'replace') {
				await Promise.all(STORES.map((name) => tx.objectStore(name).clear()));
			}

			const incoming: Record<StoreName, Row[]> = {
				bookmarks: parsed.bookmarks,
				wishes: parsed.wishes,
				situations: parsed.situations,
				clarifications: parsed.clarifications,
			};

			for (const name of STORES) {
				const store = tx.objectStore(name);
				for (const row of incoming[name]) {
					if (mode === 'merge') {
						// Merge keeps whichever copy was changed last.
						const existing = (await store.get(row.id)) as Row | undefined;
						if (existing && existing.updated > row.updated) continue;
					}
					await store.put(row);
				}
			}

			await tx.done;
			emit();
		},

		async clearAll() {
			const tx = db.transaction([...STORES], 'readwrite');
			await Promise.all(STORES.map((name) => tx.objectStore(name).clear()));
			await tx.done;
			emit();
		},

		close() {
			db.close();
			listeners.clear();
		},
	};
}

let instance: Promise<MyStore> | undefined;

/** Opens the single "My" store (IndexedDB `learning-site-my`). Repeated calls share one instance. */
export function openMyStore(): Promise<MyStore> {
	instance ??= createMyStore();
	return instance;
}

/** Alias of `openMyStore`. */
export function getMyStore(): Promise<MyStore> {
	return openMyStore();
}
