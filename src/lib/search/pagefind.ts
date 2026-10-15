import type { PagefindRawData } from './search';

/** Subset of the Pagefind browser API used by the dialog. */
export interface PagefindApi {
	search: (term: string) => Promise<{
		results: { id: string; data: () => Promise<PagefindRawData> }[];
	}>;
}

/**
 * Loads `pagefind.js` on first use. Returns null when the index does not exist
 * (dev server, or a build without `pagefind --site build`), so the caller can
 * show a message instead of failing.
 */
export async function loadPagefind(base: string): Promise<PagefindApi | null> {
	try {
		const url = `${base}/pagefind/pagefind.js`;
		const mod: PagefindApi = await import(/* @vite-ignore */ url);
		return mod;
	} catch {
		return null;
	}
}
