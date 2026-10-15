import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChapterId, NoteDraft } from '$lib/contracts';
import { noteFilePath, notesToFiles } from './export';
import { createNotesStore, type OpenNotesStore } from './store';

let counter = 0;
const opened: OpenNotesStore[] = [];

async function open(resolveChapter?: (id: ChapterId) => ChapterId): Promise<OpenNotesStore> {
	const store = await createNotesStore({ dbName: `notes-test-${++counter}`, resolveChapter });
	opened.push(store);
	return store;
}

const draft = (chapter: string, text = 'Вопрос'): NoteDraft => ({
	chapter: chapter as ChapterId,
	anchor: { blockId: 'scores-def', exact: 'скалярное', prefix: 'как ', suffix: ' произведение' },
	text,
});

afterEach(() => {
	for (const s of opened.splice(0)) s.close();
});

describe('NotesStore', () => {
	it('creates, reads, updates and deletes notes', async () => {
		const store = await open();
		const note = await store.create(draft('dl/attention'));
		expect(note.status).toBe('open');
		expect(note.id).toHaveLength(26);
		expect(await store.get(note.id)).toEqual(note);

		const updated = await store.update(note.id, { text: 'Новый текст', status: 'answered' });
		expect(updated.text).toBe('Новый текст');
		expect(updated.status).toBe('answered');
		expect(updated.created).toBe(note.created);

		await store.delete(note.id);
		expect(await store.get(note.id)).toBeUndefined();
	});

	it('lists by chapter in creation order and filters by status', async () => {
		const store = await open();
		const a = await store.create(draft('dl/attention', 'a'));
		await store.create(draft('dl/other', 'other'));
		const b = await store.create(draft('dl/attention', 'b'));
		await store.update(a.id, { status: 'answered' });

		const chapter = await store.listByChapter('dl/attention' as ChapterId);
		expect(chapter.map((n) => n.text)).toEqual(['a', 'b']);

		const open1 = await store.list({ status: 'open' });
		// list() is not chapter-scoped: the open note of dl/other is included too.
		expect(open1.map((n) => n.text)).toEqual(['other', 'b']);
		expect(b.status).toBe('open');
	});

	it('resolves chapter aliases when listing', async () => {
		const store = await open((id) =>
			id === ('dl/old-attn' as ChapterId) ? ('dl/attention' as ChapterId) : id,
		);
		await store.create(draft('dl/old-attn', 'old'));
		await store.create(draft('dl/attention', 'new'));
		const list = await store.listByChapter('dl/attention' as ChapterId);
		expect(list).toHaveLength(2);
	});

	it('notifies subscribers about the changed chapter', async () => {
		const store = await open();
		const seen: string[] = [];
		const off = store.subscribe((chapter) => seen.push(chapter));
		await store.create(draft('dl/attention'));
		off();
		await store.create(draft('dl/attention'));
		expect(seen).toEqual(['dl/attention']);
	});

	it('rejects notes that fail the schema', async () => {
		const store = await open();
		await expect(store.create(draft('Bad Chapter'))).rejects.toThrow();
	});

	it('exports notes as user-data files', async () => {
		const store = await open();
		const note = await store.create(draft('dl/attention'));
		const files = notesToFiles([note]);
		expect(files[0]!.path).toBe(`user-data/notes/dl/attention/${note.id}.json`);
		expect(noteFilePath(note)).toBe(files[0]!.path);
		expect(JSON.parse(files[0]!.content).anchor.blockId).toBe('scores-def');
	});
});
