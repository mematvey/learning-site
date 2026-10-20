import { expect, test } from '@playwright/test';
import { collectErrors, gotoReady } from './helpers';

// Regression: a demo that wrote state inside $derived made /cs/floating-point fail with a 500 in dev.
// Each CS chapter with a demo must load, hydrate and render its demo without page errors.
const CS_DEMO_PAGES: Array<{ path: string; demo: string }> = [
	{ path: '/cs/floating-point/', demo: 'floating-point' },
	{ path: '/cs/concurrency/', demo: 'concurrency' },
	{ path: '/cs/os-memory/', demo: 'os-memory' },
	{ path: '/cs/serialization-formats/', demo: 'serialization-formats' },
];

for (const { path, demo } of CS_DEMO_PAGES) {
	test(`${path} loads and renders its demo without errors`, async ({ page }) => {
		const errors = collectErrors(page);
		await gotoReady(page, path);

		await expect(page.locator(`[data-demo="${demo}"]`)).toBeVisible();
		expect(errors).toEqual([]);
	});
}
