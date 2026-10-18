import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderHandle, PermissionMode } from './folder';
import { FolderSync, type StoredFolder } from './folder';
import { startAutosync } from './autosync';
import { syncState } from './autosync.svelte';
import type { ExportBundle, ExportContext } from './markdown';

class FakeDir implements FolderHandle {
	readonly dirs = new Map<string, FakeDir>();
	readonly files = new Map<string, string>();
	permission: PermissionMode = 'granted';

	constructor(readonly name: string) {}

	async queryPermission(): Promise<PermissionMode> {
		return this.permission;
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

const ctx: ExportContext = {
	chapterTitle: (id) => id,
	topicTitle: (id) => id,
	chapterHref: (id) => `/${id}`,
};

const bundle: ExportBundle = {
	notes: [],
	my: { bookmarks: [], wishes: [], situations: [], clarifications: [] },
	exportedAt: '2026-10-18T12:00:00Z',
};

function memoryStorage(initial?: StoredFolder) {
	let value = initial;
	return {
		async load() {
			return value;
		},
		async save(next: StoredFolder) {
			value = next;
		},
		async clear() {
			value = undefined;
		},
	};
}

/** Minimal change feed: `emit` calls every listener, as the stores do after a write. */
function feed() {
	const listeners = new Set<() => void>();
	return {
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		emit() {
			for (const listener of listeners) listener();
		},
	};
}

const host = globalThis as unknown as {
	showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<FolderHandle>;
};

let root: FakeDir;
let stop: (() => void) | undefined;

beforeEach(() => {
	vi.useFakeTimers();
	root = new FakeDir('my-notes');
	host.showDirectoryPicker = async () => root;
	syncState.status = 'idle';
	syncState.reason = undefined;
	syncState.error = undefined;
});

afterEach(() => {
	stop?.();
	stop = undefined;
	vi.useRealTimers();
	delete host.showDirectoryPicker;
});

describe('startAutosync', () => {
	it('writes once after the debounce window, not on every change', async () => {
		const folder = new FolderSync({ storage: memoryStorage({ handle: root }) });
		const write = vi.spyOn(folder, 'write');
		const changes = feed();
		stop = startAutosync(async () => bundle, ctx, folder, {
			subscribe: (l) => changes.subscribe(l),
		});

		changes.emit();
		await vi.advanceTimersByTimeAsync(1000);
		changes.emit();
		await vi.advanceTimersByTimeAsync(1000);
		changes.emit();
		await vi.advanceTimersByTimeAsync(1499);
		expect(write).not.toHaveBeenCalled();
		expect(syncState.status).toBe('pending');

		await vi.advanceTimersByTimeAsync(1);
		expect(write).toHaveBeenCalledTimes(1);
		expect(root.dirs.get('user-data')?.files.get('all.md')).toContain(
			'Экспорт: 2026-10-18T12:00:00Z',
		);
		expect(syncState.status).toBe('saved');
		expect(syncState.lastSaved).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('does not write while the folder is not ready, and says why', async () => {
		root.permission = 'prompt';
		const folder = new FolderSync({ storage: memoryStorage({ handle: root }) });
		const write = vi.spyOn(folder, 'write');
		const changes = feed();
		stop = startAutosync(async () => bundle, ctx, folder, {
			subscribe: (l) => changes.subscribe(l),
		});

		changes.emit();
		await vi.advanceTimersByTimeAsync(1500);
		expect(write).not.toHaveBeenCalled();
		expect(root.dirs.size).toBe(0);
		expect(syncState.status).toBe('skipped');
		expect(syncState.reason).toBe('needs-permission');
	});

	it('does not write without a chosen folder', async () => {
		const folder = new FolderSync({ storage: memoryStorage() });
		const changes = feed();
		stop = startAutosync(async () => bundle, ctx, folder, {
			subscribe: (l) => changes.subscribe(l),
		});

		changes.emit();
		await vi.advanceTimersByTimeAsync(1500);
		expect(syncState.status).toBe('skipped');
		expect(syncState.reason).toBe('no-folder');
	});

	it('stops listening after the returned function is called', async () => {
		const folder = new FolderSync({ storage: memoryStorage({ handle: root }) });
		const write = vi.spyOn(folder, 'write');
		const changes = feed();
		const stopSync = startAutosync(async () => bundle, ctx, folder, {
			subscribe: (l) => changes.subscribe(l),
		});

		changes.emit();
		stopSync();
		await vi.advanceTimersByTimeAsync(5000);
		expect(write).not.toHaveBeenCalled();
	});

	it('uses a custom debounce', async () => {
		const folder = new FolderSync({ storage: memoryStorage({ handle: root }) });
		const write = vi.spyOn(folder, 'write');
		const changes = feed();
		stop = startAutosync(async () => bundle, ctx, folder, {
			subscribe: (l) => changes.subscribe(l),
			debounceMs: 100,
		});

		changes.emit();
		await vi.advanceTimersByTimeAsync(100);
		expect(write).toHaveBeenCalledTimes(1);
	});
});
