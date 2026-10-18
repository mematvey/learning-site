import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note, NotesStore } from '$lib/contracts';
import type { MyData, MyStore } from '$lib/contracts/my';
import { DEFAULT_DEBOUNCE_MS } from '$lib/export/autosync';
import { FolderSync, type FolderHandle, type FolderStorage } from '$lib/export/folder';
import type { ExportContext } from '$lib/export/markdown';

class FakeDir implements FolderHandle {
	readonly dirs = new Map<string, FakeDir>();
	readonly files = new Map<string, string>();

	constructor(readonly name: string) {}

	async queryPermission() {
		return 'granted' as const;
	}

	async getDirectoryHandle(name: string): Promise<FakeDir> {
		let dir = this.dirs.get(name);
		if (!dir) {
			dir = new FakeDir(name);
			this.dirs.set(name, dir);
		}
		return dir;
	}

	async getFileHandle(name: string) {
		return {
			createWritable: async () => {
				let buffer = '';
				return {
					write: async (data: string) => {
						buffer = data;
					},
					close: async () => {
						this.files.set(name, buffer);
					},
				};
			},
		};
	}
}

function memoryStorage(handle: FolderHandle): FolderStorage {
	let value: { handle: FolderHandle; lastWrite?: string } | undefined = { handle };
	return {
		async load() {
			return value;
		},
		async save(next) {
			value = next;
		},
		async clear() {
			value = undefined;
		},
	};
}

/** Fake of a store change feed: `emit` calls every listener, as the real stores do after a write. */
function feed() {
	const listeners = new Set<() => void>();
	return {
		subscribe: vi.fn((listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}),
		emit: () => {
			for (const listener of listeners) listener();
		},
	};
}

const EMPTY_MY: MyData = { bookmarks: [], wishes: [], situations: [], clarifications: [] };

function fakeMy(initial: MyData = EMPTY_MY) {
	const changes = feed();
	const store = {
		subscribe: changes.subscribe,
		exportAll: vi.fn(async () => structuredClone(initial)),
		importAll: vi.fn(async () => undefined),
		clearAll: vi.fn(async () => undefined),
	};
	return { store: store as unknown as MyStore, changes };
}

function fakeNotes(notes: Note[] = []) {
	const changes = feed();
	const store = {
		subscribe: changes.subscribe,
		list: vi.fn(async () => structuredClone(notes)),
	};
	return { store: store as unknown as NotesStore, changes };
}

const ctx: ExportContext = {
	chapterTitle: (id) => `Глава ${id}`,
	topicTitle: (id) => `Тема ${id}`,
	chapterHref: (id) => `/${id}`,
};

const note: Note = {
	schemaVersion: 1,
	id: '01J8ZK3V7X0000000000000000',
	chapter: 'dl/attention',
	anchor: { blockId: 'scores-def', exact: 'скалярное', prefix: 'как ', suffix: ' произведение' },
	text: 'Почему делим на корень?',
	status: 'open',
	created: '2026-10-10T10:00:00Z',
	updated: '2026-10-10T10:00:00Z',
} as Note;

/** Lets pending promises (folder reads and writes) settle after a timer fires. */
async function settle() {
	for (let i = 0; i < 50; i += 1) await vi.advanceTimersByTimeAsync(1);
}

describe('bootAutosync', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetModules();
		// The File System Access API is absent in Node: the folder sync sees a browser that has it.
		vi.stubGlobal('showDirectoryPicker', () => undefined);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('waits for the "My" data before the first autosave', async () => {
		const { bootAutosync } = await import('./autosync-boot');
		const root = new FakeDir('root');
		const folder = new FolderSync({ storage: memoryStorage(root) });
		const my = fakeMy();
		const notes = fakeNotes([note]);
		let release!: () => void;
		const ready = new Promise<void>((resolve) => (release = resolve));

		const booted = bootAutosync({
			ready: () => ready,
			my: my.store,
			notes: notes.store,
			ctx,
			folder,
		});
		await settle();
		expect(my.changes.subscribe).not.toHaveBeenCalled();

		release();
		await booted;
		expect(my.changes.subscribe).toHaveBeenCalledTimes(1);
		expect(notes.changes.subscribe).toHaveBeenCalledTimes(1);
	});

	it('writes the export after a change in notes or in "My" data', async () => {
		const { bootAutosync } = await import('./autosync-boot');
		const { syncState } = await import('$lib/export/autosync.svelte');
		const root = new FakeDir('root');
		const folder = new FolderSync({ storage: memoryStorage(root) });
		const my = fakeMy();
		const notes = fakeNotes([note]);

		await bootAutosync({
			ready: async () => undefined,
			my: my.store,
			notes: notes.store,
			ctx,
			folder,
		});

		notes.changes.emit();
		await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
		await settle();
		const userData = root.dirs.get('user-data');
		expect(userData?.files.get('backup.json')).toContain('Почему делим на корень?');
		expect(syncState.status).toBe('saved');

		my.changes.emit();
		expect(syncState.status).toBe('pending');
		await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
		await settle();
		expect(my.store.exportAll).toHaveBeenCalled();
	});

	it('starts only once and returns the same stop function on repeated calls', async () => {
		const { bootAutosync } = await import('./autosync-boot');
		const root = new FakeDir('root');
		const folder = new FolderSync({ storage: memoryStorage(root) });
		const my = fakeMy();
		const notes = fakeNotes();
		const deps = { ready: async () => undefined, my: my.store, notes: notes.store, ctx, folder };

		const first = await bootAutosync(deps);
		const second = await bootAutosync(deps);
		expect(second).toBe(first);
		expect(my.changes.subscribe).toHaveBeenCalledTimes(1);
	});
});
