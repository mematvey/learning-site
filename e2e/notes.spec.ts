import { expect, test } from '@playwright/test';

const NOTE_TEXT = 'Проверить масштаб по строке';

test('note on selected text is created, shown in the margin and survives reload', async ({
	page,
}) => {
	await page.goto('/dl/attention/');

	const block = page.locator('[data-block][id="idea-weights"]');
	await expect(block).toBeVisible();
	await block.evaluate((el) => {
		const range = document.createRange();
		range.selectNodeContents(el);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
		document.dispatchEvent(new Event('selectionchange'));
	});

	await page.getByRole('button', { name: /Заметка/ }).click();
	await page.getByRole('textbox', { name: 'Текст заметки' }).fill(NOTE_TEXT);
	await page.getByRole('button', { name: 'Сохранить' }).click();

	const margin = page.getByRole('complementary', { name: 'Заметки' });
	await expect(margin).toContainText(NOTE_TEXT);

	await page.reload();
	await expect(page.getByRole('complementary', { name: 'Заметки' })).toContainText(NOTE_TEXT);
});
