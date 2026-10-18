import type { FolderStatus } from './folder';

export type SyncStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'skipped' | 'error';

export interface SyncState {
	status: SyncStatus;
	/** Last successful write, ISO time. */
	lastSaved?: string;
	/** Folder state that stopped the last run (status `skipped`). */
	reason?: FolderStatus['state'];
	error?: string;
}

/** Shared autosave state for the UI (save indicator, settings page). */
export const syncState: SyncState = $state({ status: 'idle' });
