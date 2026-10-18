import { z } from 'zod';
import { Note, type NotesStore } from '$lib/contracts';
import type { MyData, MyStore } from '$lib/contracts/my';
import { MyDataSchema } from '$lib/my/store';
import { EXPORT_SCHEMA_VERSION } from './markdown';

export type ImportMode = 'merge' | 'replace';

/** Content of `backup.json`, as written by `buildFiles`. */
export interface Backup {
	notes: Note[];
	my: MyData;
}

export interface ImportCounts {
	notes: number;
	bookmarks: number;
	wishes: number;
	situations: number;
	clarifications: number;
}

export interface ImportSummary {
	mode: ImportMode;
	/** Records that were not in the store before the import. */
	added: ImportCounts;
	/** Records found in the file. */
	total: ImportCounts;
}

const BackupSchema = z.object({
	schemaVersion: z.literal(EXPORT_SCHEMA_VERSION, {
		error: `Неподдерживаемая версия файла (ожидается ${EXPORT_SCHEMA_VERSION}).`,
	}),
	exportedAt: z.string().optional(),
	notes: z.array(Note),
	my: MyDataSchema,
});

/** Turns a zod issue into one readable line: where the problem is and what is wrong. */
function describeIssue(issue: { path: PropertyKey[]; message: string }): string {
	const where = issue.path.length > 0 ? issue.path.map(String).join('.') : 'файл';
	return `${where}: ${issue.message}`;
}

/**
 * Parses and validates the text of `backup.json`. Throws an `Error` with a message that can be
 * shown to the user; nothing is written by this function.
 */
export function parseBackup(text: string): Backup {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error('Файл не является JSON. Выберите backup.json, который скачан с этого сайта.');
	}
	if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw)) {
		throw new Error('В файле нет поля schemaVersion: это не резервная копия «Моё».');
	}
	const parsed = BackupSchema.safeParse(raw);
	if (!parsed.success) {
		const first = parsed.error.issues.slice(0, 3).map(describeIssue).join('; ');
		throw new Error(`Файл не прошёл проверку: ${first}`);
	}
	return { notes: parsed.data.notes, my: parsed.data.my };
}

const EMPTY_COUNTS: ImportCounts = {
	notes: 0,
	bookmarks: 0,
	wishes: 0,
	situations: 0,
	clarifications: 0,
};

function countsOf(backup: Backup): ImportCounts {
	return {
		notes: backup.notes.length,
		bookmarks: backup.my.bookmarks.length,
		wishes: backup.my.wishes.length,
		situations: backup.my.situations.length,
		clarifications: backup.my.clarifications.length,
	};
}

/** Notes are matched by id first, then by chapter, quote and text (ids are re-created on import). */
async function importNotes(store: NotesStore, notes: Note[], mode: ImportMode): Promise<number> {
	if (mode === 'replace') {
		for (const existing of await store.list()) await store.delete(existing.id);
	}
	const current = await store.list();
	const sameContent = (a: Note, b: Note) =>
		a.chapter === b.chapter && a.anchor.exact === b.anchor.exact && a.text === b.text;
	let added = 0;
	for (const note of notes) {
		if (mode === 'merge') {
			if (current.some((c) => c.id === note.id || sameContent(c, note))) continue;
		}
		await store.create({
			chapter: note.chapter,
			anchor: note.anchor,
			text: note.text,
			...(note.tags ? { tags: note.tags } : {}),
			...(note.layer ? { layer: note.layer } : {}),
		});
		added += 1;
	}
	return added;
}

/** Records of a collection whose id is not in the store yet. */
function newIds<T extends { id: string }>(incoming: T[], existing: T[]): number {
	const known = new Set(existing.map((item) => item.id));
	return incoming.filter((item) => !known.has(item.id)).length;
}

/**
 * Imports a parsed backup. `merge` keeps the stored copy when it was changed later; `replace`
 * empties the stores first. Returns how many records were new for the user.
 */
export async function importBackup(
	backup: Backup,
	mode: ImportMode,
	stores: { notes: NotesStore; my: MyStore },
): Promise<ImportSummary> {
	const before = await stores.my.exportAll();
	const total = countsOf(backup);

	const added: ImportCounts = mode === 'replace' ? { ...total } : { ...EMPTY_COUNTS };
	if (mode === 'merge') {
		added.bookmarks = newIds(backup.my.bookmarks, before.bookmarks);
		added.wishes = newIds(backup.my.wishes, before.wishes);
		added.situations = newIds(backup.my.situations, before.situations);
		added.clarifications = newIds(backup.my.clarifications, before.clarifications);
	}

	await stores.my.importAll(backup.my, mode);
	// Notes get new ids on import, so their count is what was actually created.
	added.notes = await importNotes(stores.notes, backup.notes, mode);

	return { mode, added, total };
}

/** One line for the user, e.g. «Добавлено: заметки 2, закладки 5». Empty when nothing was added. */
export function describeSummary(summary: ImportSummary): string {
	const labels: [keyof ImportCounts, string][] = [
		['notes', 'заметки'],
		['bookmarks', 'закладки'],
		['wishes', 'желаемые главы'],
		['situations', 'ситуации'],
		['clarifications', 'уточнения'],
	];
	const parts = labels
		.filter(([key]) => summary.added[key] > 0)
		.map(([key, label]) => `${label} ${summary.added[key]}`);
	return parts.length === 0
		? 'Новых записей нет: всё уже было на сайте.'
		: `Добавлено: ${parts.join(', ')}.`;
}
