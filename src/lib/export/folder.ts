import { openDB, type IDBPDatabase } from 'idb';
import type { ExportFile } from '$lib/contracts/my';

/** IndexedDB database that keeps the chosen folder handle. */
export const SETTINGS_DB_NAME = 'learning-site-settings';
const SETTINGS_VERSION = 1;
const HANDLES_STORE = 'handles';
const FOLDER_KEY = 'export-folder';

export interface FolderStatus {
	supported: boolean;
	state: 'unsupported' | 'no-folder' | 'needs-permission' | 'ready' | 'error';
	folderName?: string;
	lastWrite?: string;
	error?: string;
}

export type PermissionMode = 'granted' | 'denied' | 'prompt';

/** The subset of `FileSystemDirectoryHandle` used here; real handles satisfy it. */
export interface FolderHandle {
	readonly name: string;
	queryPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionMode>;
	requestPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionMode>;
	getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FolderHandle>;
	getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
}

export interface FileHandleLike {
	createWritable(): Promise<{
		write(data: string): Promise<void>;
		close(): Promise<void>;
		abort?(): Promise<void>;
	}>;
}

export interface StoredFolder {
	handle: FolderHandle;
	lastWrite?: string;
}

/** Where the folder handle is kept. IndexedDB in the browser; injectable for tests. */
export interface FolderStorage {
	load(): Promise<StoredFolder | undefined>;
	save(value: StoredFolder): Promise<void>;
	clear(): Promise<void>;
}

export interface FolderSyncOptions {
	storage?: FolderStorage;
}

type PickerHost = {
	showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<FolderHandle>;
};

function host(): PickerHost {
	return globalThis as unknown as PickerHost;
}

function message(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

function isAbort(e: unknown): boolean {
	return (e as { name?: unknown } | null)?.name === 'AbortError';
}

/** Reads the permission; asks for it only when `request` is set and the browser supports it. */
async function permissionOf(handle: FolderHandle, request: boolean): Promise<PermissionMode> {
	const descriptor = { mode: 'readwrite' as const };
	if (request && handle.requestPermission) return handle.requestPermission(descriptor);
	if (handle.queryPermission) return handle.queryPermission(descriptor);
	return 'granted';
}

function idbStorage(dbName: string = SETTINGS_DB_NAME): FolderStorage {
	let db: Promise<IDBPDatabase> | undefined;
	const open = () =>
		(db ??= openDB(dbName, SETTINGS_VERSION, {
			upgrade(database) {
				if (!database.objectStoreNames.contains(HANDLES_STORE)) {
					database.createObjectStore(HANDLES_STORE);
				}
			},
		}));
	return {
		async load() {
			return (await (await open()).get(HANDLES_STORE, FOLDER_KEY)) as StoredFolder | undefined;
		},
		async save(value) {
			await (await open()).put(HANDLES_STORE, value, FOLDER_KEY);
		},
		async clear() {
			await (await open()).delete(HANDLES_STORE, FOLDER_KEY);
		},
	};
}

/** A path segment must be a plain name: no empty, dot, or separator-like parts. */
function isUnsafeSegment(part: string): boolean {
	return part === '' || part === '.' || part === '..' || /[\\:]/.test(part);
}

async function writeFile(root: FolderHandle, file: ExportFile): Promise<void> {
	const parts = file.path.split('/');
	const name = parts.pop();
	if (name === undefined || name === '' || parts.some(isUnsafeSegment)) {
		throw new Error(`Недопустимый путь: ${file.path}`);
	}
	let dir = root;
	for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
	const handle = await dir.getFileHandle(name, { create: true });
	const writable = await handle.createWritable();
	try {
		await writable.write(file.content);
		await writable.close();
	} catch (e) {
		// Aborting keeps the previous file content: nothing is committed.
		await writable.abort?.();
		throw e;
	}
}

/**
 * Autosave target: one folder chosen by the user (File System Access API, Chrome and Edge).
 * Never throws to the UI: problems are reported through `status()`.
 */
export class FolderSync {
	private readonly storage: FolderStorage;
	private lastError: string | undefined;

	constructor(options: FolderSyncOptions = {}) {
		this.storage = options.storage ?? idbStorage();
	}

	static isSupported(): boolean {
		return typeof host().showDirectoryPicker === 'function';
	}

	async status(): Promise<FolderStatus> {
		if (!FolderSync.isSupported()) return { supported: false, state: 'unsupported' };
		try {
			const stored = await this.storage.load();
			if (!stored) {
				return this.lastError
					? { supported: true, state: 'error', error: this.lastError }
					: { supported: true, state: 'no-folder' };
			}
			const base: FolderStatus = {
				supported: true,
				state: 'ready',
				folderName: stored.handle.name,
			};
			if (stored.lastWrite) base.lastWrite = stored.lastWrite;
			if (this.lastError) return { ...base, state: 'error', error: this.lastError };
			const permission = await permissionOf(stored.handle, false);
			return { ...base, state: permission === 'granted' ? 'ready' : 'needs-permission' };
		} catch (e) {
			return { supported: true, state: 'error', error: message(e) };
		}
	}

	/** Opens the folder picker. Cancelling is not an error. */
	async pickFolder(): Promise<void> {
		const picker = host().showDirectoryPicker;
		if (typeof picker !== 'function') return;
		try {
			const handle = await picker.call(globalThis, { mode: 'readwrite' });
			await this.storage.save({ handle });
			this.lastError = undefined;
		} catch (e) {
			if (!isAbort(e)) this.lastError = message(e);
		}
	}

	/** Asks for write permission again. Needs a user gesture in the browser. */
	async requestPermission(): Promise<boolean> {
		try {
			const stored = await this.storage.load();
			if (!stored) return false;
			const granted = (await permissionOf(stored.handle, true)) === 'granted';
			if (granted) this.lastError = undefined;
			return granted;
		} catch (e) {
			this.lastError = message(e);
			return false;
		}
	}

	/** Writes files under the chosen folder. Does nothing unless the state is `ready`. */
	async write(files: ExportFile[]): Promise<void> {
		if (!FolderSync.isSupported()) return;
		try {
			const stored = await this.storage.load();
			if (!stored || (await permissionOf(stored.handle, false)) !== 'granted') return;
			for (const file of files) await writeFile(stored.handle, file);
			await this.storage.save({ ...stored, lastWrite: new Date().toISOString() });
			this.lastError = undefined;
		} catch (e) {
			this.lastError = message(e);
		}
	}

	/** Forgets the folder. Files already written stay where they are. */
	async forget(): Promise<void> {
		this.lastError = undefined;
		try {
			await this.storage.clear();
		} catch (e) {
			this.lastError = message(e);
		}
	}
}

/** Shared instance for the UI. The IndexedDB connection opens lazily on first use. */
export const folderSync = new FolderSync();
