import { readFile } from 'node:fs/promises';
import { extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConsoleMessage, Page } from '@playwright/test';

/** Collects console errors and uncaught page errors for later assertions. */
export function collectErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (msg: ConsoleMessage) => {
		if (msg.type() === 'error') errors.push(msg.text());
	});
	page.on('pageerror', (err: Error) => {
		errors.push(err.message);
	});
	return errors;
}

/** Quiet time that lets the debounced progress write (500 ms) reach IndexedDB before a reload. */
export const PROGRESS_FLUSH_MS = 1000;

const PAGEFIND_DIR = fileURLToPath(new URL('../build/pagefind/', import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
	'.js': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.wasm': 'application/wasm',
};

/**
 * `vite preview` serves SvelteKit's output, not `build/`, so the Pagefind index written by
 * `pagefind --site build` is missing there. Serves `build/pagefind/*` from disk for `/pagefind/`
 * requests so the search dialog runs against the real index.
 */
export async function servePagefindFromBuild(page: Page): Promise<void> {
	await page.route(/\/pagefind\//, async (route) => {
		const path = new URL(route.request().url()).pathname;
		const rel = normalize(path.slice(path.indexOf('/pagefind/') + '/pagefind/'.length));
		try {
			const body = await readFile(PAGEFIND_DIR + rel);
			await route.fulfill({
				status: 200,
				contentType: CONTENT_TYPES[extname(rel)] ?? 'application/octet-stream',
				body,
			});
		} catch {
			await route.fulfill({ status: 404, body: 'not found' });
		}
	});
}
