import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { gotoReady } from './helpers';

const solutionPath = fileURLToPath(
	new URL('../labs/dl-attention-numpy/solution.py', import.meta.url),
);

test('starter code fails, reference solution passes all tests', async ({ page }) => {
	// Pyodide is loaded from CDN on the first run.
	test.slow();
	test.setTimeout(180_000);

	await gotoReady(page, '/dl/attention/');
	const editor = page.getByRole('textbox', { name: 'Код лаба' });
	const run = page.getByRole('button', { name: /Запустить/ });
	const panel = page.getByRole('region', { name: 'Результат лаба' });

	await expect(editor).toBeVisible();
	await expect(run).toBeEnabled();
	await run.click();

	await expect(panel).toBeVisible({ timeout: 170_000 });
	await expect(panel).toContainText('Пройдено тестов');
	await expect(panel).not.toContainText('Все тесты зелёные');

	const solution = readFileSync(solutionPath, 'utf-8');
	await editor.click();
	await page.keyboard.press('Control+A');
	await page.keyboard.insertText(solution);

	await run.click();
	await expect(panel).toContainText('Все тесты зелёные', { timeout: 170_000 });
});
