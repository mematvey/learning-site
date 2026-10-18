import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { MyData } from '$lib/contracts/my';
import { createMyStore, getMyStore, openMyStore, type OpenMyStore } from './store';

type Store = OpenMyStore;

let counter = 0;
const opened: Store[] = [];

async function open(): Promise<Store> {
	const store = await createMyStore({ dbName: `my-test-${++counter}` });
	opened.push(store);
	return store;
}

const bookmarkDraft = (chapter: string, comment = 'Запомнить') => ({
	kind: 'block' as const,
	topic: 'dl',
	chapter,
	blockId: 'scores-def',
	quote: 'скалярное произведение',
	comment,
});

const wishDraft = (title = 'Оптимизаторы') => ({
	topic: 'dl',
	title,
	question: 'Почему Adam работает лучше SGD?',
	wantedSections: ['Момент'],
	wantedTerms: ['adam'],
	notes: '',
});

const situationDraft = (chapter: string, title = 'Не сходится обучение') => ({
	topic: 'dl',
	target: { kind: 'chapter' as const, chapter },
	title,
	situation: 'Loss растёт после третьей эпохи',
	goal: 'Понять, какой параметр крутить',
});

const clarificationDraft = (chapter: string, text = 'Уточнение') => ({
	topic: 'dl',
	target: { kind: 'chapter' as const, chapter },
	text,
});

afterEach(() => {
	for (const s of opened.splice(0)) s.close();
});

describe('bookmarks', () => {
	it('creates, updates and removes a bookmark', async () => {
		const store = await open();
		const item = await store.bookmarks.add(bookmarkDraft('dl/attention'));
		expect(item.schemaVersion).toBe(1);
		expect(item.id).toHaveLength(26);
		expect(item.created).toBe(item.updated);

		const updated = await store.bookmarks.update(item.id, { comment: 'Новый комментарий' });
		expect(updated.comment).toBe('Новый комментарий');
		expect(updated.created).toBe(item.created);
		expect(updated.id).toBe(item.id);
		expect(updated.kind).toBe('block');

		await store.bookmarks.remove(item.id);
		expect(await store.bookmarks.list()).toEqual([]);
	});

	it('filters by topic and chapter', async () => {
		const store = await open();
		await store.bookmarks.add(bookmarkDraft('dl/attention', 'a'));
		await store.bookmarks.add(bookmarkDraft('dl/other', 'b'));
		await store.bookmarks.add({ ...bookmarkDraft('cs/x', 'c'), topic: 'cs' });

		expect((await store.bookmarks.list()).map((b) => b.comment)).toEqual(['a', 'b', 'c']);
		expect((await store.bookmarks.list({ topic: 'dl' })).map((b) => b.comment)).toEqual(['a', 'b']);
		expect(
			(await store.bookmarks.list({ topic: 'dl', chapter: 'dl/attention' })).map((b) => b.comment),
		).toEqual(['a']);
	});

	it('rejects a comment longer than 280 characters', async () => {
		const store = await open();
		await expect(
			store.bookmarks.add(bookmarkDraft('dl/attention', 'x'.repeat(281))),
		).rejects.toThrow();
		const ok = await store.bookmarks.add(bookmarkDraft('dl/attention', 'x'.repeat(280)));
		expect(ok.comment).toHaveLength(280);
	});
});

describe('wishes', () => {
	it('creates with status idea and updates the status', async () => {
		const store = await open();
		const wish = await store.wishes.add(wishDraft());
		expect(wish.status).toBe('idea');

		const drafting = await store.wishes.update(wish.id, { status: 'drafting' });
		expect(drafting.status).toBe('drafting');
		expect(drafting.title).toBe('Оптимизаторы');

		await store.wishes.remove(wish.id);
		expect(await store.wishes.list()).toEqual([]);
	});

	it('filters by topic; chapter filter excludes wishes', async () => {
		const store = await open();
		await store.wishes.add(wishDraft('A'));
		await store.wishes.add({ ...wishDraft('B'), topic: 'cs' });
		expect((await store.wishes.list({ topic: 'dl' })).map((w) => w.title)).toEqual(['A']);
		expect(await store.wishes.list({ chapter: 'dl/attention' })).toEqual([]);
	});
});

describe('situations', () => {
	it('creates attached to a chapter and filters by chapter', async () => {
		const store = await open();
		const situation = await store.situations.add(situationDraft('dl/attention'));
		expect(situation.status).toBe('open');

		await store.situations.add(situationDraft('dl/other', 'Другая'));
		await store.situations.add({
			...situationDraft('dl/attention'),
			target: { kind: 'wish', wishId: situation.id },
			title: 'К желаемой главе',
		});

		const byChapter = await store.situations.list({ chapter: 'dl/attention' });
		expect(byChapter.map((s) => s.title)).toEqual(['Не сходится обучение']);

		const answered = await store.situations.update(situation.id, { status: 'answered' });
		expect(answered.status).toBe('answered');

		await store.situations.remove(situation.id);
		expect((await store.situations.list({ topic: 'dl' })).length).toBe(2);
	});
});

describe('clarifications', () => {
	it('creates, updates, filters and removes', async () => {
		const store = await open();
		const item = await store.clarifications.add(clarificationDraft('dl/attention', 'Первое'));
		await store.clarifications.add(clarificationDraft('dl/other', 'Второе'));

		expect(
			(await store.clarifications.list({ chapter: 'dl/attention' })).map((c) => c.text),
		).toEqual(['Первое']);

		const updated = await store.clarifications.update(item.id, { text: 'Исправлено' });
		expect(updated.text).toBe('Исправлено');

		await store.clarifications.remove(item.id);
		expect((await store.clarifications.list()).map((c) => c.text)).toEqual(['Второе']);
	});

	it('rejects an empty text', async () => {
		const store = await open();
		await expect(
			store.clarifications.add(clarificationDraft('dl/attention', '')),
		).rejects.toThrow();
	});
});

describe('subscribe', () => {
	it('notifies after writes and stops after unsubscribe', async () => {
		const store = await open();
		let calls = 0;
		const off = store.subscribe(() => calls++);

		const item = await store.bookmarks.add(bookmarkDraft('dl/attention'));
		await store.wishes.add(wishDraft());
		await store.bookmarks.update(item.id, { comment: 'x' });
		await store.bookmarks.remove(item.id);
		expect(calls).toBe(4);

		off();
		await store.wishes.add(wishDraft('after'));
		expect(calls).toBe(4);
	});
});

describe('export and import', () => {
	const seed = async (store: Store) => {
		await store.bookmarks.add(bookmarkDraft('dl/attention'));
		await store.wishes.add(wishDraft());
		await store.situations.add(situationDraft('dl/attention'));
		await store.clarifications.add(clarificationDraft('dl/attention'));
	};

	it('exports all four collections', async () => {
		const store = await open();
		await seed(store);
		const data = await store.exportAll();
		expect(data.bookmarks).toHaveLength(1);
		expect(data.wishes).toHaveLength(1);
		expect(data.situations).toHaveLength(1);
		expect(data.clarifications).toHaveLength(1);
	});

	it('imports with merge: adds new records and keeps the newer copy of an existing one', async () => {
		const source = await open();
		await seed(source);
		const data = await source.exportAll();

		const target = await open();
		const kept = await target.bookmarks.add(bookmarkDraft('dl/attention', 'Новее'));
		// A stale copy of an existing record (older `updated`) must not overwrite the newer one.
		const incoming: MyData = {
			...data,
			bookmarks: [
				{ ...kept, comment: 'Старее', updated: '2000-01-01T00:00:00.000Z' },
				...data.bookmarks,
			],
		};
		await target.importAll(incoming, 'merge');

		const bookmarks = await target.bookmarks.list();
		expect(bookmarks).toHaveLength(2);
		expect(bookmarks.find((b) => b.id === kept.id)?.comment).toBe('Новее');
		expect(await target.wishes.list()).toHaveLength(1);
		expect(await target.situations.list()).toHaveLength(1);
		expect(await target.clarifications.list()).toHaveLength(1);
	});

	it('imports with replace: removes existing records first', async () => {
		const source = await open();
		await seed(source);
		const data = await source.exportAll();

		const target = await open();
		await target.wishes.add(wishDraft('Лишняя'));
		await target.importAll(data, 'replace');

		const wishes = await target.wishes.list();
		expect(wishes.map((w) => w.title)).toEqual(['Оптимизаторы']);
		expect(await target.bookmarks.list()).toHaveLength(1);
	});

	it('rejects invalid data and leaves the store unchanged', async () => {
		const store = await open();
		await seed(store);
		const before = await store.exportAll();

		const broken = {
			...before,
			bookmarks: [{ ...before.bookmarks[0], comment: 'x'.repeat(281) }],
		} as unknown as MyData;

		await expect(store.importAll(broken, 'replace')).rejects.toThrow();
		await expect(
			store.importAll({ bookmarks: [] } as unknown as MyData, 'merge'),
		).rejects.toThrow();
		expect(await store.exportAll()).toEqual(before);
	});
});

describe('clearAll', () => {
	it('removes everything from all collections', async () => {
		const store = await open();
		await store.bookmarks.add(bookmarkDraft('dl/attention'));
		await store.wishes.add(wishDraft());
		await store.situations.add(situationDraft('dl/attention'));
		await store.clarifications.add(clarificationDraft('dl/attention'));

		await store.clearAll();

		const data = await store.exportAll();
		expect(data).toEqual({ bookmarks: [], wishes: [], situations: [], clarifications: [] });
	});
});

describe('shared instance', () => {
	it('getMyStore returns the instance opened by openMyStore', async () => {
		const first = await openMyStore();
		expect(await getMyStore()).toBe(first);
	});
});
