import { expect, test } from '@playwright/test';
import { collectErrors, gotoReady } from './helpers';

test('topic page lists chapters and a click opens one', async ({ page }) => {
	const errors = collectErrors(page);
	await gotoReady(page, '/classic-ml/');

	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	const links = page.locator('ol a.stretch');
	await expect(links.first()).toBeVisible();
	expect(await links.count()).toBeGreaterThan(0);

	const first = links.first();
	const href = await first.getAttribute('href');
	await first.click();
	await expect(page).toHaveURL(new RegExp(`${href}$`));
	expect(errors).toEqual([]);
});
