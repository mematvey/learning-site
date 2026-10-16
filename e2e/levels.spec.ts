import { expect, test } from '@playwright/test';
import { gotoReady, reloadReady } from './helpers';

test('level change applies only after «Применить» and survives reload', async ({ page }) => {
	await gotoReady(page, '/dl/attention/');

	const c1 = page.locator('[data-variant-c="1"]');
	const c24 = page.locator('[data-variant-c="2-4"]');
	await expect(c24).toBeVisible();
	await expect(c1).toBeHidden();

	await page.getByRole('button', { name: /Уровень:/ }).click();
	const slider = page.getByRole('slider', { name: 'Сложность' });
	await slider.focus();
	await page.keyboard.press('Home');
	await expect(page.getByRole('button', { name: 'Применить' })).toBeVisible();

	// Unapplied: the text on the page does not change yet.
	await expect(c24).toBeVisible();
	await expect(c1).toBeHidden();

	await page.getByRole('button', { name: 'Применить' }).click();
	await expect(c1).toBeVisible();
	await expect(c24).toBeHidden();
	await expect(page).toHaveURL(/[?&]c=1(&|$)/);

	await reloadReady(page);
	await expect(c1).toBeVisible();
	await expect(c24).toBeHidden();
});
