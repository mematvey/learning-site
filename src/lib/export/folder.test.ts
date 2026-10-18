import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExportFile } from '$lib/contracts/my';
import {
	FolderSync,
	type FileHandleLike,
	type FolderHandle,
	type FolderStorage,
	type PermissionMode,
	type StoredFolder,
} from './folder';

/** In-memory directory tree with the parts of the File System Access API that FolderSync uses. */
class FakeDir implements FolderHandle {
	readonly dirs = new Map<string, FakeDir>();
	readonly files = new Map<string, string>();
	permission: PermissionMode = 'granted';
	failWrites = false;

	constructor(readonly name: string) {}

	async queryPermission(): Promise<PermissionMode> {
		return this.permission;
	}

	async requestPermission(): Promise<PermissionMode> {
		this.permission = 'granted';
		return this.permission;
	}

	async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FakeDir> {
		let dir = this.dirs.get(name);
		if (!dir) {
			if (!options?.create) throw new Error(`no directory ${name}`);
			dir = new FakeDir(name);
			dir.failWrites = this.failWrites;
			this.dirs.set(name, dir);
		}
		return dir;
	}

	async getFileHandle(name: string): Promise<FileHandleLike> {
		if (this.failWrites) throw new Error('disk full');
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
					abort: async () => undefined,
				};
			},
		};
	}
}

function memoryStorage(
	initial?: StoredFolder,
): FolderStorage & { value: StoredFolder | undefined } {
	const storage = {
		value: initial,
		async load() {
			return storage.value;
		},
		async save(value: StoredFolder) {
			storage.value = value;
		},
		async clear() {
			storage.value = undefined;
		},
	};
	return storage;
}

const host = globalThis as unknown as {
	showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<FolderHandle>;
};

let root: FakeDir;

beforeEach(() => {
	root = new FakeDir('my-notes');
	host.showDirectoryPicker = async () => root;
});

afterEach(() => {
	delete host.showDirectoryPicker;
});

const file = (path: string, content: string): ExportFile => ({ path, content });

describe('FolderSync status', () => {
	it('reports unsupported when the picker is missing', async () => {
		delete host.showDirectoryPicker;
		const sync = new FolderSync({ storage: memoryStorage() });
		expect(FolderSync.isSupported()).toBe(false);
		expect(await sync.status()).toEqual({ supported: false, state: 'unsupported' });
		await expect(sync.write([file('user-data/all.md', 'x')])).resolves.toBeUndefined();
	});

	it('reports no-folder before a folder is picked', async () => {
		const sync = new FolderSync({ storage: memoryStorage() });
		expect((await sync.status()).state).toBe('no-folder');
	});

	it('becomes ready after picking, and needs-permission when access is lost', async () => {
		const sync = new FolderSync({ storage: memoryStorage() });
		await sync.pickFolder();
		expect(await sync.status()).toMatchObject({
			supported: true,
			state: 'ready',
			folderName: 'my-notes',
		});

		root.permission = 'prompt';
		expect((await sync.status()).state).toBe('needs-permission');
	});

	it('treats a cancelled picker as no change', async () => {
		host.showDirectoryPicker = async () => {
			throw new DOMException('cancelled', 'AbortError');
		};
		const sync = new FolderSync({ storage: memoryStorage() });
		await sync.pickFolder();
		expect((await sync.status()).state).toBe('no-folder');
	});

	it('reports error when a write fails', async () => {
		const sync = new FolderSync({ storage: memoryStorage({ handle: root }) });
		root.failWrites = true;
		await sync.write([file('user-data/all.md', 'x')]);
		expect(await sync.status()).toMatchObject({ state: 'error', error: 'disk full' });
	});

	it('forget clears the folder without touching files', async () => {
		const storage = memoryStorage({ handle: root });
		const sync = new FolderSync({ storage });
		await sync.write([file('user-data/all.md', 'kept')]);
		await sync.forget();
		expect((await sync.status()).state).toBe('no-folder');
		expect(root.dirs.get('user-data')?.files.get('all.md')).toBe('kept');
	});
});

describe('FolderSync write', () => {
	it('writes nested paths, creating subfolders', async () => {
		const sync = new FolderSync({ storage: memoryStorage({ handle: root }) });
		await sync.write([
			file('user-data/README.md', '# readme'),
			file('user-data/dl/notes.md', 'notes'),
		]);
		expect(root.dirs.get('user-data')?.files.get('README.md')).toBe('# readme');
		expect(root.dirs.get('user-data')?.dirs.get('dl')?.files.get('notes.md')).toBe('notes');
	});

	it('overwrites an existing file', async () => {
		const sync = new FolderSync({ storage: memoryStorage({ handle: root }) });
		await sync.write([file('user-data/all.md', 'first')]);
		await sync.write([file('user-data/all.md', 'second')]);
		expect(root.dirs.get('user-data')?.files.get('all.md')).toBe('second');
	});

	it('records lastWrite after a successful write', async () => {
		const storage = memoryStorage({ handle: root });
		const sync = new FolderSync({ storage });
		await sync.write([file('user-data/all.md', 'x')]);
		expect((await sync.status()).lastWrite).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('writes nothing while permission is missing', async () => {
		root.permission = 'prompt';
		const sync = new FolderSync({ storage: memoryStorage({ handle: root }) });
		await sync.write([file('user-data/all.md', 'x')]);
		expect(root.dirs.size).toBe(0);
		expect((await sync.status()).state).toBe('needs-permission');
	});

	it('rejects unsafe paths without writing', async () => {
		const sync = new FolderSync({ storage: memoryStorage({ handle: root }) });
		await sync.write([file('user-data/../secret.md', 'x')]);
		expect(root.dirs.size).toBe(0);
		expect((await sync.status()).state).toBe('error');
	});

	it('requestPermission asks again and reports the result', async () => {
		root.permission = 'prompt';
		const sync = new FolderSync({ storage: memoryStorage({ handle: root }) });
		expect(await sync.requestPermission()).toBe(true);
		expect((await sync.status()).state).toBe('ready');
	});

	it('requestPermission is false without a folder', async () => {
		const sync = new FolderSync({ storage: memoryStorage() });
		expect(await sync.requestPermission()).toBe(false);
	});
});
