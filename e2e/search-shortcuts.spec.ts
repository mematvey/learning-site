import { expect, test } from '@playwright/test';
import { servePagefindFromBuild } from './helpers';

// The keyboard handler is attached on hydration, so right after `goto` a key may be lost.
// Each key press is retried until its visible effect appears.

test('help window opens with ? and closes with Escape', async ({ page }) => {
	await page.goto('/');
	const help = page.getByRole('dialog', { name: 'Шорткаты' });

	await expect(async () => {
		await page.keyboard.press('?');
		await expect(help).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });

	await page.keyboard.press('Escape');
	await expect(help).toBeHidden();
});

test('T toggles the theme on the html element', async ({ page }) => {
	await page.goto('/');
	const root = page.locator('html');
	const before = await root.getAttribute('data-theme');

	await expect(async () => {
		await page.keyboard.press('t');
		await expect(root).not.toHaveAttribute('data-theme', before ?? '', { timeout: 1000 });
	}).toPass({ timeout: 15_000 });

	const after = await root.getAttribute('data-theme');
	expect(['light', 'dark']).toContain(after);
});

test('Ctrl+K opens search and «softmax» finds a result', async ({ page }) => {
	await servePagefindFromBuild(page);
	await page.goto('/');
	const input = page.getByRole('combobox');

	await expect(async () => {
		await page.keyboard.press('Control+k');
		await expect(input).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });

	await input.fill('softmax');
	await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
});
