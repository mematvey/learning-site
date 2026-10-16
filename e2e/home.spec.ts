import { expect, test } from '@playwright/test';
import { collectErrors, gotoReady } from './helpers';

test('home page opens, shows six topic cards and switches the map with key 2', async ({ page }) => {
	const errors = collectErrors(page);
	await gotoReady(page, '/');

	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByRole('article')).toHaveCount(6);

	const tabs = page.getByRole('group', { name: 'Топик карты' }).getByRole('button');
	await expect(tabs).toHaveCount(6);
	const second = tabs.nth(1);
	await expect(second).toHaveAttribute('aria-pressed', 'false');

	await page.keyboard.press('2');
	await expect(second).toHaveAttribute('aria-pressed', 'true');

	expect(errors).toEqual([]);
});
