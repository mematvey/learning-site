import type { FolderSync } from './folder';
import { buildFiles, type ExportBundle, type ExportContext } from './markdown';
import { syncState } from './autosync.svelte';

export const DEFAULT_DEBOUNCE_MS = 1500;

/** Subscribes to changes of all stores that feed the export; returns unsubscribe. */
export type Subscribe = (listener: () => void) => () => void;

export interface AutosyncOptions {
	/** Change feed: `MyStore.subscribe` and `NotesStore.subscribe` combined by the caller. */
	subscribe: Subscribe;
	debounceMs?: number;
}

/**
 * Rewrites the export folder after changes, debounced. Writes happen only while the folder
 * state is `ready`; otherwise the run is skipped and `syncState` says why.
 * Returns a function that stops the autosync.
 */
export function startAutosync(
	getBundle: () => Promise<ExportBundle>,
	ctx: ExportContext,
	folder: FolderSync,
	opts: AutosyncOptions,
): () => void {
	const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	// Runs never overlap: each one waits for the previous.
	let chain: Promise<void> = Promise.resolve();

	const run = async (): Promise<void> => {
		const before = await folder.status();
		if (before.state !== 'ready') {
			syncState.status = 'skipped';
			syncState.reason = before.state;
			return;
		}
		syncState.status = 'saving';
		try {
			const files = buildFiles(await getBundle(), ctx);
			await folder.write(files);
			const after = await folder.status();
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
		} catch (e) {
			syncState.status = 'error';
			syncState.error = e instanceof Error ? e.message : String(e);
		}
	};

	const schedule = (): void => {
		if (stopped) return;
		syncState.status = 'pending';
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			chain = chain.then(run).catch(() => undefined);
		}, debounceMs);
	};

	const unsubscribe = opts.subscribe(schedule);

	return () => {
		stopped = true;
		unsubscribe();
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
	};
}
