import type { ConsoleMessage, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Collects console errors and uncaught page errors for later assertions. */
export function collectErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (msg: ConsoleMessage) => {
		// Refused connections come from the test server backlog (see LOAD_ATTEMPTS), not from the site.
		if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_REFUSED')) {
			errors.push(msg.text());
		}
	});
	page.on('pageerror', (err: Error) => {
		errors.push(err.message);
	});
	return errors;
}

/** Quiet time that lets the debounced progress write (500 ms) reach IndexedDB before a reload. */
export const PROGRESS_FLUSH_MS = 1000;

/**
 * Attempts per navigation. `python -m http.server` (the server from playwright.config.ts) has a
 * small listen backlog, so with several parallel browsers some chunk requests are refused. A
 * page that lost a chunk never hydrates, so the whole load is retried.
 */
const LOAD_ATTEMPTS = 3;
const HYDRATION_TIMEOUT_MS = 10_000;

/** Waits until `+layout.svelte` has set `html[data-hydrated="true"]`: handlers are attached. */
export async function waitHydrated(page: Page): Promise<void> {
	await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', {
		timeout: HYDRATION_TIMEOUT_MS,
	});
}

async function withLoadRetry(load: () => Promise<void>, page: Page): Promise<void> {
	for (let attempt = 1; ; attempt++) {
		try {
			await load();
			await waitHydrated(page);
			return;
		} catch (err) {
			if (attempt >= LOAD_ATTEMPTS) throw err;
		}
	}
}

/** Navigates to `url` and waits for hydration before any keyboard or click action. */
export async function gotoReady(page: Page, url: string): Promise<void> {
	await withLoadRetry(() => page.goto(url).then(() => undefined), page);
}

/** Reloads the page and waits for hydration again. */
export async function reloadReady(page: Page): Promise<void> {
	await withLoadRetry(() => page.reload().then(() => undefined), page);
}
