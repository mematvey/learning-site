import { describe, expect, it, vi } from 'vitest';
import type { Note, NotesStore } from '$lib/contracts';
import type { MyData, MyStore } from '$lib/contracts/my';
import { describeSummary, importBackup, parseBackup } from './import';

const NOTE: Note = {
	schemaVersion: 1,
	id: '01J8ZK3V7X0000000000000000',
	chapter: 'dl/attention',
	anchor: { blockId: 'scores-def', exact: 'скалярное', prefix: 'как ', suffix: ' произведение' },
	text: 'Почему делим на корень?',
	status: 'open',
	created: '2026-10-10T10:00:00Z',
	updated: '2026-10-10T10:00:00Z',
} as Note;

const BOOKMARK = {
	schemaVersion: 1,
	id: '01J8ZK3V7X0000000000000001',
	kind: 'block',
	topic: 'dl',
	chapter: 'dl/attention',
	blockId: 'scores-def',
	comment: 'Запомнить',
	created: '2026-10-10T10:00:00Z',
	updated: '2026-10-10T10:00:00Z',
} as const;

const EMPTY_MY: MyData = { bookmarks: [], wishes: [], situations: [], clarifications: [] };

function backupText(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({
		schemaVersion: 1,
		exportedAt: '2026-10-18T12:00:00Z',
		notes: [NOTE],
		my: { ...EMPTY_MY, bookmarks: [BOOKMARK] },
		...overrides,
	});
}

describe('parseBackup', () => {
	it('returns notes and "My" data from a valid file', () => {
		const backup = parseBackup(backupText());
		expect(backup.notes).toHaveLength(1);
		expect(backup.notes[0]?.text).toBe('Почему делим на корень?');
		expect(backup.my.bookmarks).toHaveLength(1);
		expect(backup.my.wishes).toEqual([]);
	});

	it('rejects text that is not JSON with a readable message', () => {
		expect(() => parseBackup('not json')).toThrow(/не является JSON/);
	});

	it('rejects a JSON file that is not a backup', () => {
		expect(() => parseBackup('{"format":"other"}')).toThrow(/schemaVersion/);
	});

	it('rejects an unknown schema version', () => {
		expect(() => parseBackup(backupText({ schemaVersion: 7 }))).toThrow(/версия/);
	});

	it('points at the broken field when a record is invalid', () => {
		const broken = backupText({ my: { ...EMPTY_MY, bookmarks: [{ ...BOOKMARK, kind: 'video' }] } });
		expect(() => parseBackup(broken)).toThrow(/my\.bookmarks/);
	});
});

function fakeMy(initial: MyData = EMPTY_MY) {
	let data: MyData = structuredClone(initial);
	const store = {
		exportAll: vi.fn(async () => structuredClone(data)),
		importAll: vi.fn(async (incoming: MyData, mode: 'merge' | 'replace') => {
			data = mode === 'replace' ? structuredClone(incoming) : { ...data, ...incoming };
		}),
	};
	return store as unknown as MyStore & { importAll: typeof store.importAll };
}

function fakeNotes(initial: Note[] = []) {
	let rows = structuredClone(initial);
	let counter = 0;
	const store = {
		list: vi.fn(async () => structuredClone(rows)),
		create: vi.fn(async (draft: { chapter: string; anchor: unknown; text: string }) => {
			counter += 1;
			const created = { ...draft, id: `NEW${counter}`, status: 'open' } as unknown as Note;
			rows = [...rows, created];
			return created;
		}),
		delete: vi.fn(async (id: string) => {
			rows = rows.filter((n) => n.id !== id);
		}),
	};
	return { store: store as unknown as NotesStore, rows: () => rows };
}

describe('importBackup', () => {
	it('merge: counts only records that were not in the store and keeps existing notes', async () => {
		const notes = fakeNotes([NOTE]);
		const my = fakeMy({ ...EMPTY_MY, bookmarks: [BOOKMARK] });
		const summary = await importBackup(parseBackup(backupText()), 'merge', {
			notes: notes.store,
			my,
		});

		expect(summary.added.bookmarks).toBe(0);
		expect(summary.added.notes).toBe(0);
		expect(summary.total.notes).toBe(1);
		expect(my.importAll).toHaveBeenCalledWith(expect.any(Object), 'merge');
	});

	it('merge: adds a note that is new and counts it', async () => {
		const notes = fakeNotes([]);
		const my = fakeMy();
		const summary = await importBackup(parseBackup(backupText()), 'merge', {
			notes: notes.store,
			my,
		});

		expect(summary.added.notes).toBe(1);
		expect(summary.added.bookmarks).toBe(1);
		expect(notes.rows()[0]?.text).toBe('Почему делим на корень?');
	});

	it('merge: a second import of the same file does not duplicate notes', async () => {
		const notes = fakeNotes([]);
		const my = fakeMy();
		const backup = parseBackup(backupText());
		await importBackup(backup, 'merge', { notes: notes.store, my });
		const second = await importBackup(backup, 'merge', { notes: notes.store, my });

		expect(second.added.notes).toBe(0);
		expect(notes.rows()).toHaveLength(1);
	});

	it('replace: removes existing notes and counts everything from the file', async () => {
		const notes = fakeNotes([{ ...NOTE, id: 'OLD', text: 'старая' } as Note]);
		const my = fakeMy({ ...EMPTY_MY, bookmarks: [BOOKMARK] });
		const summary = await importBackup(parseBackup(backupText()), 'replace', {
			notes: notes.store,
			my,
		});

		expect(notes.rows().map((n) => n.text)).toEqual(['Почему делим на корень?']);
		expect(summary.added.notes).toBe(1);
		expect(summary.added.bookmarks).toBe(1);
		expect(my.importAll).toHaveBeenCalledWith(expect.any(Object), 'replace');
	});
});

describe('describeSummary', () => {
	it('lists what was added', () => {
		const text = describeSummary({
			mode: 'merge',
			added: { notes: 2, bookmarks: 5, wishes: 0, situations: 0, clarifications: 0 },
			total: { notes: 2, bookmarks: 5, wishes: 0, situations: 0, clarifications: 0 },
		});
		expect(text).toBe('Добавлено: заметки 2, закладки 5.');
	});

	it('says so when nothing was new', () => {
		const zero = { notes: 0, bookmarks: 0, wishes: 0, situations: 0, clarifications: 0 };
		expect(describeSummary({ mode: 'merge', added: zero, total: zero })).toMatch(
			/Новых записей нет/,
		);
	});
});
