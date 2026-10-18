import type { Bookmark, Clarification, Situation, Wish } from '$lib/contracts/my';
import { getMyStore } from './store';

/** Reactive view of the "My" data. Components read `my.*` and write through `getMyStore()`. */
export const my = $state({
	bookmarks: [] as Bookmark[],
	wishes: [] as Wish[],
	situations: [] as Situation[],
	clarifications: [] as Clarification[],
	ready: false,
});

let started: Promise<void> | undefined;

async function reload(): Promise<void> {
	const store = await getMyStore();
	const [bookmarks, wishes, situations, clarifications] = await Promise.all([
		store.bookmarks.list(),
		store.wishes.list(),
		store.situations.list(),
		store.clarifications.list(),
	]);
	my.bookmarks = bookmarks;
	my.wishes = wishes;
	my.situations = situations;
	my.clarifications = clarifications;
}

/**
 * Loads everything from the store, then keeps `my` in sync with every later write.
 * Safe to call more than once: only the first call does the work.
 */
export function initMy(): Promise<void> {
	started ??= (async () => {
		const store = await getMyStore();
		store.subscribe(() => {
			reload().catch((error: unknown) => {
				console.error('Failed to reload "My" data', error);
			});
		});
		await reload();
		my.ready = true;
	})();
	return started;
}
