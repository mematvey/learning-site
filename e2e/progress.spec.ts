import { expect, test } from '@playwright/test';
import { PROGRESS_FLUSH_MS, gotoReady, reloadReady } from './helpers';

test('marking a chapter as done is saved across reload', async ({ page }) => {
	await gotoReady(page, '/dl/attention/');
	const done = page.locator('[data-mark-done]');
	await expect(done).toHaveAttribute('aria-pressed', 'false');

	await done.click();
	await expect(done).toHaveAttribute('aria-pressed', 'true');
	await page.waitForTimeout(PROGRESS_FLUSH_MS);

	await reloadReady(page);
	await expect(page.locator('[data-mark-done]')).toHaveAttribute('aria-pressed', 'true');
});

test('home shows «Продолжить» for a visited, unfinished chapter', async ({ page }) => {
	await gotoReady(page, '/dl/attention/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	// The visit is written after a debounce; wait for it before leaving the page.
	await page.waitForTimeout(PROGRESS_FLUSH_MS);

	await gotoReady(page, '/');
	await expect(page.getByRole('link', { name: /Продолжить/ })).toBeVisible();
});
