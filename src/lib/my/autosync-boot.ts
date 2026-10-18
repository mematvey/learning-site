import type { ChapterId, NotesStore } from '$lib/contracts';
import type { ExportFile, MyStore } from '$lib/contracts/my';
import { getRegistry, resolveChapterId } from '$lib/content/registry';
import { startAutosync, type Subscribe } from '$lib/export/autosync';
import { syncState } from '$lib/export/autosync.svelte';
import { folderSync, type FolderStatus, type FolderSync } from '$lib/export/folder';
import { buildFiles, type ExportBundle, type ExportContext } from '$lib/export/markdown';
import { chapterBlockHref } from '$lib/nav/links';
import { createNotesStore } from '$lib/notes/store';
import { initMy } from './state.svelte';
import { getMyStore } from './store';

/** Everything the export reads and writes. Injected in tests; the app uses `services()`. */
export interface ExportServices {
	my: MyStore;
	notes: NotesStore;
	ctx: ExportContext;
	folder: FolderSync;
}

/** Export context from the generated registry: chapter and topic titles, links to blocks. */
export function registryContext(): ExportContext {
	const registry = getRegistry();
	return {
		chapterTitle: (id) => registry.getChapter(id)?.title ?? id,
		topicTitle: (id) => registry.getTopic(id)?.title ?? id,
		chapterHref: (id, blockId) => chapterBlockHref(id, blockId),
	};
}

let opened: Promise<ExportServices> | undefined;

/** Opens the "My" store and a notes store once per page. Browser only. */
export function services(): Promise<ExportServices> {
	opened ??= (async () => {
		const [my, notes] = await Promise.all([
			getMyStore(),
			createNotesStore({ resolveChapter: (id) => resolveChapterId(id) as ChapterId }),
		]);
		return { my, notes, ctx: registryContext(), folder: folderSync };
	})();
	return opened;
}

/** Full bundle: every note and every "My" record, read from the stores now. */
export async function collectBundle(
	deps: Pick<ExportServices, 'my' | 'notes'>,
): Promise<ExportBundle> {
	const [notes, my] = await Promise.all([deps.notes.list(), deps.my.exportAll()]);
	return { notes, my };
}

/** Files of the current state, for the download, copy and save actions. */
export async function currentFiles(deps: ExportServices): Promise<ExportFile[]> {
	return buildFiles(await collectBundle(deps), deps.ctx);
}

/**
 * Writes the export to the chosen folder right now. Does nothing (and reports the folder state)
 * unless the folder is ready. Updates `syncState` the same way the autosync does.
 */
export async function saveNow(deps: ExportServices): Promise<FolderStatus> {
	const before = await deps.folder.status();
	if (before.state !== 'ready') {
		syncState.status = 'skipped';
		syncState.reason = before.state;
		return before;
	}
	syncState.status = 'saving';
	await deps.folder.write(await currentFiles(deps));
	const after = await deps.folder.status();
	if (after.state === 'ready') {
		syncState.status = 'saved';
		syncState.reason = undefined;
		syncState.error = undefined;
		syncState.lastSaved = after.lastWrite;
	} else if (after.state === 'error') {
		syncState.status = 'error';
		syncState.error = after.error;
	} else {
		syncState.status = 'skipped';
		syncState.reason = after.state;
	}
	return after;
}

/** One change feed for several stores: a write in any of them calls the listener once. */
export function combinedSubscribe(...sources: Subscribe[]): Subscribe {
	return (listener) => {
		const unsubs = sources.map((subscribe) => subscribe(() => listener()));
		return () => {
			for (const unsub of unsubs) unsub();
		};
	};
}

export type BootDeps = Partial<ExportServices> & {
	/** Resolves when the "My" data is loaded. Defaults to `initMy()`. */
	ready?: () => Promise<void>;
};

function complete(deps: BootDeps): deps is ExportServices {
	return Boolean(deps.my && deps.notes && deps.ctx && deps.folder);
}

let started: Promise<() => void> | undefined;

/**
 * Starts autosave to the chosen folder. Call once from the root layout, in the browser. Waits
 * for `initMy()`, then keeps the folder in step with notes and "My" data. Returns the stop
 * function; repeated calls return the same promise, so the autosync starts only once.
 */
export function bootAutosync(deps: BootDeps = {}): Promise<() => void> {
	started ??= (async () => {
		await (deps.ready ?? initMy)();
		const all: ExportServices = complete(deps) ? deps : await services();
		const subscribe = combinedSubscribe(
			(listener) => all.my.subscribe(listener),
			(listener) => all.notes.subscribe(listener),
		);
		return startAutosync(() => collectBundle(all), all.ctx, all.folder, { subscribe });
	})();
	return started;
}
