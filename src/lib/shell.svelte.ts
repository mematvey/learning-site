import type { Crumb } from '$lib/contracts/component-props';
import type { LevelState } from '$lib/contracts/levels';
import type { ProgressStore } from '$lib/contracts/interfaces';
import { openProgressStore } from '$lib/progress';
import { progressNotesOptions } from '$lib/notes';

/**
 * State shared between the root layout (header) and the pages: breadcrumbs and the level
 * popover are set by a chapter page, the layout renders them in the single site header.
 */
export const shell = $state<{
	crumbs: Crumb[];
	levels: { applied: LevelState; onApply: (state: LevelState) => void } | null;
}>({ crumbs: [], levels: null });

/** The opened progress store; `null` until the first `ensureProgress()` resolves (client only). */
export const progressState = $state<{ store: ProgressStore | null }>({ store: null });

let opening: Promise<ProgressStore> | undefined;

/** Opens the IndexedDB progress store once for the whole page. Client only. */
export function ensureProgress(): Promise<ProgressStore> {
	opening ??= openProgressStore(progressNotesOptions()).then((store) => {
		progressState.store = store;
		return store;
	});
	return opening;
}
