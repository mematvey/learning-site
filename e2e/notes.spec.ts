import { expect, test } from '@playwright/test';
import { gotoReady, reloadReady } from './helpers';

const NOTE_TEXT = 'Проверить масштаб по строке';

test('note on selected text is created, shown in the margin and survives reload', async ({
	page,
}) => {
	await gotoReady(page, '/dl/attention/');

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

	await reloadReady(page);
	await expect(page.getByRole('complementary', { name: 'Заметки' })).toContainText(NOTE_TEXT);
});

test('Escape with unsaved text asks first; delete asks before removing the note', async ({
	page,
}) => {
	await gotoReady(page, '/dl/attention/');
	const margin = page.getByRole('complementary', { name: 'Заметки' });

	const block = page.locator('[data-block][id="idea-weights"]');
	await block.evaluate((el) => {
		const range = document.createRange();
		range.selectNodeContents(el);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
		document.dispatchEvent(new Event('selectionchange'));
	});
	await page.getByRole('button', { name: /Заметка/ }).click();
	await page.getByRole('textbox', { name: 'Текст заметки' }).fill('Черновик');
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await expect(margin).toContainText('Черновик');

	// Editing: an Escape with changed text asks before discarding.
	await margin.getByRole('button', { name: /Черновик/ }).click();
	const field = page.getByRole('textbox', { name: 'Текст заметки' });
	await field.fill('Черновик, правка');
	await field.press('Escape');
	await expect(page.getByText('Отменить несохранённые изменения?')).toBeVisible();
	await page.getByRole('button', { name: 'Продолжить редактирование' }).click();
	await expect(field).toHaveValue('Черновик, правка');

	// Deleting: the question comes first; «Оставить» keeps the note.
	await page.getByRole('button', { name: 'Отмена' }).click();
	await page.getByRole('button', { name: 'Отменить изменения' }).click();
	await expect(margin).toContainText('Черновик');
	await margin.getByRole('button', { name: 'Удалить заметку' }).click();
	await expect(page.getByText('Удалить заметку? Это действие нельзя отменить.')).toBeVisible();
	await page.getByRole('button', { name: 'Оставить' }).click();
	await expect(margin).toContainText('Черновик');

	await margin.getByRole('button', { name: 'Удалить заметку' }).click();
	await page.getByRole('button', { name: 'Удалить', exact: true }).click();
	await expect(margin).not.toContainText('Черновик');
});
