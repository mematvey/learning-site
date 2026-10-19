import { expect, test, type Browser, type Download, type Page } from '@playwright/test';
import { PROGRESS_FLUSH_MS, gotoReady, reloadReady } from './helpers';

const CHAPTER = '/dl/attention/';
const TOPIC_MY = '/dl/my/';
const BLOCK = '[data-block][id="idea-weights"]';

/** Adds a bookmark on the `idea-weights` block of the attention chapter. */
async function addBookmark(page: Page, comment: string): Promise<void> {
	await gotoReady(page, CHAPTER);
	const block = page.locator(BLOCK);
	await block.hover();
	await page.getByRole('button', { name: 'В закладки' }).click();
	await page.getByRole('textbox', { name: 'Комментарий' }).fill(comment);
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await expect(block).toHaveAttribute('data-bookmarked', 'true');
}

test('section mark survives reload; «Сбросить прогресс главы» clears it after confirmation', async ({
	page,
}) => {
	await gotoReady(page, CHAPTER);
	const firstSection = page.getByRole('checkbox', { name: /пройден/ }).first();
	await firstSection.check();
	await expect(page.locator('[data-section-progress]')).toHaveText(/Разделов пройдено: 1 из \d+/);
	await page.waitForTimeout(PROGRESS_FLUSH_MS);

	await reloadReady(page);
	await expect(page.getByRole('checkbox', { name: /пройден/ }).first()).toBeChecked();

	page.once('dialog', (dialog) => dialog.accept());
	await page.locator('[data-reset-chapter]').click();
	await expect(page.getByRole('checkbox', { name: /пройден/ }).first()).not.toBeChecked();
	await expect(page.locator('[data-section-progress]')).toHaveText(/Разделов пройдено: 0 из \d+/);
});

test('bookmark with comment shows on the topic «Моё» page and «Открыть» flashes the block', async ({
	page,
}) => {
	const comment = 'Повторить, как веса считаются по строкам';
	await addBookmark(page, comment);
	await page.waitForTimeout(PROGRESS_FLUSH_MS);

	await gotoReady(page, TOPIC_MY);
	await page.locator('[data-tab="bookmarks"]').click();
	const card = page.getByRole('listitem').filter({ hasText: comment });
	await expect(card).toBeVisible();
	await card.getByRole('link', { name: 'Открыть' }).click();

	await expect(page).toHaveURL(/\/dl\/attention\/#idea-weights/);
	await expect(page.locator(BLOCK)).toHaveClass(/block-flash/);
});

test('idea «Хочу разобрать» survives reload and copies a non-empty task for an agent', async ({
	page,
}) => {
	const title = 'Оптимизаторы второго порядка';
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (text: string) => {
					(window as unknown as { __copied?: string }).__copied = text;
				},
			},
		});
	});

	await gotoReady(page, TOPIC_MY);
	await page.locator('[data-tab="wishes"]').click();
	await page.getByRole('button', { name: '+ Хочу разобрать' }).click();
	await page.getByLabel('Название будущей главы').fill(title);
	await page.getByLabel('Что непонятно или что хочу понять').fill('Зачем нужен гессиан?');
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await expect(page.getByText(title, { exact: true })).toBeVisible();
	await page.waitForTimeout(PROGRESS_FLUSH_MS);

	await reloadReady(page);
	await page.locator('[data-tab="wishes"]').click();
	await expect(page.getByText(title, { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Скопировать как задание агенту' }).click();
	await expect(page.getByText(`Задание «${title}» скопировано.`)).toBeVisible();
	const copied = await page.evaluate(
		() => (window as unknown as { __copied?: string }).__copied ?? '',
	);
	expect(copied.trim().length).toBeGreaterThan(0);
	expect(copied).toContain(title);
});

test('«+ Моя ситуация» at the chapter end is saved and listed on the topic «Моё» page', async ({
	page,
}) => {
	const title = 'Не понимаю, почему веса softmax не сходятся';
	await gotoReady(page, CHAPTER);
	await page.getByRole('button', { name: '+ Моя ситуация' }).click();
	// First press in this browser shows the target picker; «this chapter» is preselected.
	const picker = page.locator('form.panel');
	await picker.getByRole('button', { name: 'Далее' }).click();
	await page.getByLabel('Короткое название').fill(title);
	await page.getByLabel('Моя ситуация').fill('Обучение стоит на одном шаге, не понимаю почему.');
	await page.getByLabel('Что нужно понять или решить').fill('Понять, нормален ли такой шаг.');
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await expect(page.getByText('Ситуация добавлена.')).toBeVisible();
	await page.waitForTimeout(PROGRESS_FLUSH_MS);

	await gotoReady(page, TOPIC_MY);
	await page.locator('[data-tab="situations"]').click();
	await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test('data settings explain browser support and restore a backup after a fresh start', async ({
	page,
	browser,
}) => {
	await gotoReady(page, '/settings/data/');
	await expect(
		page.getByText('Автосохранение в папку работает в Chrome и Edge', { exact: false }),
	).toBeVisible();

	// Without File System Access the page says so instead of offering a folder.
	const unsupported = await browser.newContext();
	const unsupportedPage = await unsupported.newPage();
	await unsupportedPage.addInitScript(() => {
		Object.defineProperty(window, 'showDirectoryPicker', { value: undefined, configurable: true });
	});
	await gotoReady(unsupportedPage, '/settings/data/');
	await expect(
		unsupportedPage.getByText('Браузер не поддерживает сохранение в папку.'),
	).toBeVisible();
	await unsupported.close();

	// Export from a profile that has a bookmark.
	const comment = 'Перенести в другой браузер';
	await addBookmark(page, comment);
	await page.waitForTimeout(PROGRESS_FLUSH_MS);
	await gotoReady(page, '/settings/data/');
	const [backup] = await Promise.all<Download>([
		page.waitForEvent('download', (d) => d.suggestedFilename() === 'backup.json'),
		page.getByRole('button', { name: 'Скачать all.md и backup.json' }).click(),
	]);
	const backupPath = await backup.path();
	if (!backupPath) throw new Error('backup.json was not saved');

	// A fresh context has an empty IndexedDB: the import must bring the bookmark back.
	const fresh = await (browser as Browser).newContext();
	const freshPage = await fresh.newPage();
	await gotoReady(freshPage, '/settings/data/');
	await freshPage.locator('input[type="file"]').setInputFiles(backupPath);
	await freshPage.getByRole('button', { name: /Импортировать/ }).click();
	await expect(freshPage.getByRole('status')).toContainText('закладок 1');

	await gotoReady(freshPage, TOPIC_MY);
	await freshPage.locator('[data-tab="bookmarks"]').click();
	await expect(freshPage.getByRole('listitem').filter({ hasText: comment })).toBeVisible();
	await fresh.close();
});
