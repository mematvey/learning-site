import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { levelsToQuery, type LevelState } from '$lib/contracts/levels';

/**
 * Writes `?c=&d=` into the current URL without a history entry.
 * Other query parameters and the hash are kept. Failures are ignored (e.g. file://).
 */
export function writeLevelsToUrl(state: LevelState): void {
	if (typeof window === 'undefined') return;
	try {
		const url = new URL(window.location.href);
		for (const [key, value] of new URLSearchParams(levelsToQuery(state))) {
			url.searchParams.set(key, value);
		}
		// Shallow navigation with replace: no load functions run and no history entry is added.
		void goto(resolve(`${url.pathname}${url.search}${url.hash}` as '/'), {
			replace: true,
			shallow: true,
		}).catch(() => {});
	} catch {
		/* goto can throw before the app has started or outside the router */
	}
}
