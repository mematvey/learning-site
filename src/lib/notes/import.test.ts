import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChapterId, NoteDraft } from '$lib/contracts';
import { createNotesStore, type OpenNotesStore } from './store';

let counter = 0;
const opened: OpenNotesStore[] = [];

async function open(): Promise<OpenNotesStore> {
	const store = await createNotesStore({ dbName: `notes-import-test-${++counter}` });
	opened.push(store);
	return store;
}

const draft = (text: string): NoteDraft => ({
	chapter: 'dl/attention' as ChapterId,
	anchor: { blockId: 'scores-def', exact: 'скалярное', prefix: 'как ', suffix: ' произведение' },
	text,
});

afterEach(() => {
	for (const s of opened.splice(0)) s.close();
});

describe('NotesStore.importNotes', () => {
	it('writes notes with their ids and timestamps, so a second import does not duplicate them', async () => {
		const source = await open();
		const target = await open();
		const note = await source.create(draft('из файла'));

		expect(await target.importNotes([note], 'merge')).toBe(1);
		expect(await target.get(note.id)).toEqual(note);
		await target.importNotes([note], 'merge');
		expect(await target.list()).toHaveLength(1);
	});

	it('merge keeps a stored note that is newer than the incoming one', async () => {
		const store = await open();
		const note = await store.create(draft('старый'));
		const newer = await store.update(note.id, { text: 'новый' });
		const older = { ...note, text: 'из старого файла' };

		expect(await store.importNotes([older], 'merge')).toBe(0);
		expect((await store.get(note.id))?.text).toBe('новый');
		expect((await store.get(note.id))?.updated).toBe(newer.updated);
	});

	it('replace clears the store before writing the file', async () => {
		const source = await open();
		const store = await open();
		const incoming = await source.create(draft('из файла'));
		await store.create(draft('лишняя'));

		await store.importNotes([incoming], 'replace');
		const all = await store.list();
		expect(all.map((n) => n.text)).toEqual(['из файла']);
	});

	it('notifies subscribers about the chapters it wrote', async () => {
		const store = await open();
		const note = await store.create(draft('из файла'));
		const seen: string[] = [];
		const other = await open();
		other.subscribe((chapter) => seen.push(chapter));
		await other.importNotes([note], 'merge');
		expect(seen).toEqual(['dl/attention']);
	});
});
