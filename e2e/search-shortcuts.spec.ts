import { expect, test } from '@playwright/test';
import { gotoReady } from './helpers';

test('help window opens with ? and closes with Escape', async ({ page }) => {
	await gotoReady(page, '/');
	const help = page.getByRole('dialog', { name: 'Шорткаты' });

	await page.keyboard.press('?');
	await expect(help).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(help).toBeHidden();
});

test('T toggles the theme on the html element', async ({ page }) => {
	await gotoReady(page, '/');
	const root = page.locator('html');
	const before = await root.getAttribute('data-theme');

	await page.keyboard.press('t');
	await expect(root).not.toHaveAttribute('data-theme', before ?? '');

	const after = await root.getAttribute('data-theme');
	expect(['light', 'dark']).toContain(after);
});

test('Ctrl+K opens search and «softmax» finds a result', async ({ page }) => {
	await gotoReady(page, '/');
	const input = page.getByRole('combobox');

	await page.keyboard.press('Control+k');
	await expect(input).toBeVisible();

	await input.fill('softmax');
	await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
});
