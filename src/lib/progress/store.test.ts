import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { PROGRESS_SCHEMA_VERSION, type Migration, type ProgressChange } from '$lib/contracts';
import chapterFixture from '$lib/contracts/fixtures/progress-chapter.json';
import labFixture from '$lib/contracts/fixtures/progress-lab.json';
import { migrateRecord } from './migrate';
import { openProgressStore, type OpenedProgressStore } from './store';

const opened: OpenedProgressStore[] = [];
let counter = 0;

/** Fresh in-memory database per test; timestamps increase by one second per write. */
function clockFrom(start = Date.UTC(2026, 9, 16, 9, 0, 0)) {
	let t = start;
	return () => new Date((t += 1000)).toISOString();
}

async function open(options: Parameters<typeof openProgressStore>[0] = {}) {
	const store = await openProgressStore({
		dbName: `test-progress-${counter++}`,
		now: clockFrom(),
		...options,
	});
	opened.push(store);
	return store;
}

afterEach(() => {
	for (const s of opened.splice(0)) s.close();
});

describe('ProgressStore CRUD', () => {
	it('creates a chapter with defaults and merges later patches', async () => {
		const store = await open();
		expect(await store.getChapter('dl/attention')).toBeUndefined();

		await store.update({
			chapters: [
				{ id: 'dl/attention', visited: '2026-10-16T09:00:00Z', sectionsReached: ['idea'] },
			],
		});
		await store.update({
			chapters: [{ id: 'dl/attention', sectionsReached: ['idea', 'math'], done: true }],
		});

		const chapter = await store.getChapter('dl/attention');
		expect(chapter).toMatchObject({
			schemaVersion: PROGRESS_SCHEMA_VERSION,
			id: 'dl/attention',
			visited: '2026-10-16T09:00:00Z',
			sectionsReached: ['idea', 'math'],
			levels: { c: 2, d: 1 },
			done: true,
		});
		expect(chapter?.updated).not.toBe('');
	});

	it('stores labs with drafts and settings, and lists everything', async () => {
		const store = await open();
		await store.update({
			labs: [
				{
					labId: 'dl-attention-numpy',
					chapter: 'dl/attention',
					passed: false,
					draft: labFixture.draft,
				},
			],
			settings: { theme: 'dark', levels: { c: 3, d: 2 } },
		});

		expect((await store.getLab('dl-attention-numpy'))?.draft?.code).toBe(labFixture.draft.code);
		expect(await store.getSettings()).toMatchObject({ theme: 'dark', levels: { c: 3, d: 2 } });

		const list = await store.list();
		expect(list.chapters).toHaveLength(0);
		expect(list.labs.map((l) => l.labId)).toEqual(['dl-attention-numpy']);
	});

	it('notifies subscribers about each changed record', async () => {
		const store = await open();
		const seen: ProgressChange[] = [];
		const unsubscribe = store.subscribe((c) => seen.push(c));

		await store.update({
			chapters: [{ id: 'dl/attention', done: true }],
			settings: { theme: 'light' },
		});
		unsubscribe();
		await store.update({ chapters: [{ id: 'dl/attention', done: false }] });

		expect(seen).toEqual([{ kind: 'chapter', id: 'dl/attention' }, { kind: 'settings' }]);
	});

	it('rejects writes when the database is from a newer schema', async () => {
		const name = `test-progress-${counter++}`;
		const first = await openProgressStore({ dbName: name });
		first.close();
		const raw = await openDB(name);
		await raw.put('meta', PROGRESS_SCHEMA_VERSION + 1, 'schemaVersion');
		raw.close();

		const store = await openProgressStore({ dbName: name });
		opened.push(store);
		expect(store.readOnly).toBe(true);
		await expect(store.update({ chapters: [{ id: 'dl/attention', done: true }] })).rejects.toThrow(
			/read-only/,
		);
	});
});

describe('migrations', () => {
	const v0ToV1: Migration = {
		from: 0,
		to: 1,
		migrate(record) {
			const r = record as Record<string, unknown>;
			const { sections, ...rest } = r;
			return { ...rest, schemaVersion: 1, sectionsReached: sections ?? [], done: false };
		},
	};

	it('migrates an old stored record on read', async () => {
		const name = `test-progress-${counter++}`;
		const store = await openProgressStore({ dbName: name, migrations: [v0ToV1], now: clockFrom() });
		opened.push(store);
		store.close();

		const raw = await openDB(name);
		await raw.put('chapters', {
			schemaVersion: 0,
			id: 'dl/attention',
			updated: '2026-10-10T10:00:00Z',
			visited: null,
			sections: ['idea'],
			levels: { c: 2, d: 1 },
		});
		raw.close();

		const reopened = await openProgressStore({ dbName: name, migrations: [v0ToV1] });
		opened.push(reopened);
		expect(await reopened.getChapter('dl/attention')).toMatchObject({
			schemaVersion: 1,
			sectionsReached: ['idea'],
			done: false,
		});
	});

	it('migrateRecord reports missing steps and newer records', () => {
		expect(() => migrateRecord({ schemaVersion: 0 }, [], 1)).toThrow(
			/no migration from schemaVersion 0/,
		);
		expect(() => migrateRecord({ schemaVersion: 3 }, [], 1)).toThrow(/newer than 1/);
		expect(() =>
			migrateRecord({ schemaVersion: 0 }, [{ from: 0, to: 1, migrate: (r) => r }], 1),
		).toThrow(/produced schemaVersion 0/);
	});
});

describe('export and import', () => {
	it('round-trips progress and settings through a JSON export', async () => {
		const source = await open({ notes: async () => [] });
		await source.update({
			chapters: [
				{
					id: 'dl/attention',
					visited: '2026-10-16T09:00:00Z',
					sectionsReached: ['idea'],
					levels: { c: 3, d: 2 },
				},
			],
			labs: [
				{
					labId: 'dl-attention-numpy',
					chapter: 'dl/attention',
					passed: false,
					draft: labFixture.draft,
				},
			],
			settings: { theme: 'dark' },
		});
		const exported = JSON.parse(JSON.stringify(await source.export()));
		expect(exported).toMatchObject({ format: 'learning-site-export', schemaVersion: 1 });
		expect(exported).not.toHaveProperty('token');

		const target = await open();
		const report = await target.import(exported, 'merge');
		expect(report).toMatchObject({ chapters: 1, labs: 1, notes: 0, skipped: [] });
		expect((await target.getChapter('dl/attention'))?.sectionsReached).toEqual(['idea']);
		expect((await target.getSettings())?.theme).toBe('dark');
	});

	it('merge keeps the newer record, replace drops local data', async () => {
		const store = await open({ now: () => '2026-12-01T00:00:00Z' });
		await store.update({ chapters: [{ id: 'dl/attention', done: true }] });

		const older = { ...chapterFixture, done: false, updated: '2026-10-01T00:00:00Z' };
		const exportLike = {
			format: 'learning-site-export',
			schemaVersion: 1,
			exportedAt: '2026-10-16T00:00:00Z',
			chapters: [older],
			labs: [],
			notes: [],
		};

		await store.import(exportLike, 'merge');
		expect((await store.getChapter('dl/attention'))?.done).toBe(true);

		await store.import({ ...exportLike, chapters: [] }, 'replace');
		expect(await store.getChapter('dl/attention')).toBeUndefined();
	});

	it('skips invalid records and reports them', async () => {
		const store = await open();
		const report = await store.import(
			{
				format: 'learning-site-export',
				schemaVersion: 1,
				exportedAt: '2026-10-16T00:00:00Z',
				chapters: [chapterFixture, { id: 'bad id', schemaVersion: 1 }],
				labs: [],
				notes: [],
			},
			'merge',
		);
		expect(report.chapters).toBe(1);
		expect(report.skipped).toHaveLength(1);
		expect(report.skipped[0]).toMatch(/^chapters\[1\]/);
	});

	it('rejects files that are not learning-site exports', async () => {
		const store = await open();
		await expect(store.import({ format: 'other', schemaVersion: 1 }, 'merge')).rejects.toThrow(
			/Not a learning-site export/,
		);
	});
});
