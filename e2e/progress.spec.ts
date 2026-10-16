import { expect, test } from '@playwright/test';
import { PROGRESS_FLUSH_MS } from './helpers';

test('marking a chapter as done is saved across reload', async ({ page }) => {
	await page.goto('/dl/attention/');
	const done = page.getByRole('button', { name: 'Отметить пройденным' });
	await expect(done).toHaveAttribute('aria-pressed', 'false');

	await done.click();
	await expect(done).toHaveAttribute('aria-pressed', 'true');
	await page.waitForTimeout(PROGRESS_FLUSH_MS);

	await page.reload();
	await expect(page.getByRole('button', { name: 'Отметить пройденным' })).toHaveAttribute(
		'aria-pressed',
		'true',
	);
});

test('home shows «Продолжить» for a visited, unfinished chapter', async ({ page }) => {
	await page.goto('/dl/attention/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	// The visit is written after a debounce; wait for it before leaving the page.
	await page.waitForTimeout(PROGRESS_FLUSH_MS);

	await page.goto('/');
	await expect(page.getByRole('link', { name: /Продолжить/ })).toBeVisible();
});
