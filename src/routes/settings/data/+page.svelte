<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { bundleMarkdown, copyText, downloadText, downloadZipLike } from '$lib/export/download';
	import { folderSync, type FolderStatus } from '$lib/export/folder';
	import {
		describeSummary,
		importBackup,
		parseBackup,
		type Backup,
		type ImportMode,
	} from '$lib/export/import';
	import { currentFiles, saveNow, services } from '$lib/my/autosync-boot';
	import { ensureProgress } from '$lib/shell.svelte';

	/** Where the user's data lives, how it is saved, exported, imported and reset. */

	let folder = $state<FolderStatus | undefined>();
	let busy = $state('');
	let message = $state('');
	let error = $state('');

	let pending = $state<{ name: string; backup: Backup } | null>(null);
	let importMode = $state<ImportMode>('merge');
	let importResult = $state('');

	async function refreshFolder(): Promise<void> {
		folder = await folderSync.status();
	}

	/** Runs one action with a busy flag; errors go to the page instead of the console only. */
	async function run(label: string, action: () => Promise<void>): Promise<void> {
		busy = label;
		message = '';
		error = '';
		try {
			await action();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = '';
		}
	}

	onMount(() => {
		void refreshFolder();
	});

	function pickFolder() {
		return run('folder', async () => {
			await folderSync.pickFolder();
			await refreshFolder();
			if (folder?.state === 'ready') {
				await saveNow(await services());
				await refreshFolder();
				message = 'Папка выбрана, данные записаны.';
			}
		});
	}

	function requestPermission() {
		return run('folder', async () => {
			const granted = await folderSync.requestPermission();
			await refreshFolder();
			if (granted) {
				await saveNow(await services());
				await refreshFolder();
				message = 'Разрешение получено, данные записаны.';
			} else {
				error = 'Разрешение не выдано. Нажмите кнопку ещё раз и подтвердите доступ к папке.';
			}
		});
	}

	function saveAll() {
		return run('save', async () => {
			const state = await saveNow(await services());
			await refreshFolder();
			message =
				state.state === 'ready'
					? 'Данные записаны в папку.'
					: 'Папка не готова к записи: см. статус выше.';
		});
	}

	function forgetFolder() {
		return run('folder', async () => {
			if (!window.confirm('Забыть папку? Файлы в ней останутся, но автосохранение выключится.')) {
				return;
			}
			await folderSync.forget();
			await refreshFolder();
			message = 'Папка забыта. Автосохранение выключено.';
		});
	}

	async function loadFiles() {
		return currentFiles(await services());
	}

	function downloadAll() {
		return run('download', async () => {
			const files = await loadFiles();
			downloadZipLike(files);
			const backup = files.find((f) => f.path.endsWith('backup.json'));
			if (backup) downloadText('backup.json', backup.content, 'application/json;charset=utf-8');
			message = 'Файлы скачаны: all.md и backup.json.';
		});
	}

	function copyAll() {
		return run('copy', async () => {
			const ok = await copyText(bundleMarkdown(await loadFiles()));
			if (ok) message = 'all.md скопирован в буфер обмена.';
			else error = 'Не удалось скопировать. Скачайте all.md кнопкой выше.';
		});
	}

	async function onFileChosen(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		pending = null;
		importResult = '';
		error = '';
		if (!file) return;
		try {
			pending = { name: file.name, backup: parseBackup(await file.text()) };
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	function runImport() {
		if (!pending) return;
		const chosen = pending;
		if (
			importMode === 'replace' &&
			!window.confirm(
				'Заменить все заметки и данные «Моё» содержимым файла? Текущие записи будут удалены.',
			)
		) {
			return;
		}
		return run('import', async () => {
			const stores = await services();
			const summary = await importBackup(chosen.backup, importMode, stores);
			importResult = `${describeSummary(summary)} В файле: заметок ${summary.total.notes}, закладок ${summary.total.bookmarks}, желаемых глав ${summary.total.wishes}, ситуаций ${summary.total.situations}, уточнений ${summary.total.clarifications}.`;
			pending = null;
		});
	}

	function resetProgress() {
		return run('reset', async () => {
			if (
				!window.confirm(
					'Сбросить весь прогресс? Отметки пройденных глав и разделов будут удалены. Результаты лабов, черновики кода и заметки не трогаются.',
				)
			) {
				return;
			}
			await (await ensureProgress()).resetAll();
			message = 'Прогресс сброшен.';
		});
	}

	function clearMy() {
		return run('reset', async () => {
			if (
				!window.confirm(
					'Удалить все закладки, желаемые главы, ситуации и уточнения? Это нельзя отменить. Заметки не затрагиваются.',
				)
			) {
				return;
			}
			await (await services()).my.clearAll();
			message = 'Закладки, идеи и ситуации удалены.';
		});
	}

	function clearNotes() {
		return run('reset', async () => {
			if (!window.confirm('Удалить все заметки? Это нельзя отменить.')) return;
			const { notes } = await services();
			for (const note of await notes.list()) await notes.delete(note.id);
			message = 'Заметки удалены.';
		});
	}

	const folderText = $derived.by(() => {
		if (!folder) return 'Проверяем…';
		switch (folder.state) {
			case 'unsupported':
				return 'Браузер не поддерживает сохранение в папку. Откройте сайт в Chrome или Edge.';
			case 'no-folder':
				return 'Папка не выбрана.';
			case 'needs-permission':
				return `Папка «${folder.folderName ?? ''}» выбрана, но браузер просит разрешение на запись.`;
			case 'ready':
				return `Автосохранение в папку «${folder.folderName ?? ''}» включено.`;
			case 'error':
				return 'Ошибка при работе с папкой.';
		}
	});

	const lastWrite = $derived(
		folder?.lastWrite ? new Date(folder.lastWrite).toLocaleString('ru-RU') : '',
	);
</script>

<svelte:head>
	<title>Настройки данных · learning-site</title>
</svelte:head>

<main class="wrap">
	<nav class="crumbs" aria-label="Навигация">
		<a href={resolve('/')}>Главная</a> <span aria-hidden="true">/</span>
		<span>Настройки данных</span>
	</nav>

	<header class="head">
		<h1>Настройки данных</h1>
		<p>
			Заметки, закладки и ситуации хранятся в этом браузере. Здесь их можно сохранить в папку,
			скачать, перенести в другой браузер или удалить.
		</p>
	</header>

	<p class="notice" role="note">
		<strong>Автосохранение в папку работает в Chrome и Edge.</strong> Данные хранятся в этом
		браузере и не попадают в репозиторий сайта. Папку подключите вне репозитория или добавьте
		<code>user-data/</code> в <code>.gitignore</code>.
	</p>

	<section class="card" aria-labelledby="folder-title">
		<h2 id="folder-title">Сохранение в папку</h2>
		<p class="status" aria-live="polite">{folderText}</p>
		{#if lastWrite}
			<p class="muted">Последняя запись: {lastWrite}</p>
		{/if}
		{#if folder?.error}
			<p class="error">Ошибка: {folder.error}</p>
		{/if}
		<div class="actions">
			{#if folder?.supported}
				{#if folder?.state === 'needs-permission'}
					<button type="button" class="btn-primary" onclick={requestPermission} disabled={!!busy}>
						Дать разрешение
					</button>
				{/if}
				<button type="button" class="btn-outline" onclick={pickFolder} disabled={!!busy}>
					{folder?.state === 'no-folder' || !folder ? 'Выбрать папку' : 'Выбрать другую папку'}
				</button>
				{#if folder?.state && folder.state !== 'no-folder' && folder.state !== 'unsupported'}
					<button type="button" class="btn-outline" onclick={saveAll} disabled={!!busy}>
						Сохранить сейчас
					</button>
					<button type="button" class="btn-link danger" onclick={forgetFolder} disabled={!!busy}>
						Забыть папку
					</button>
				{/if}
			{/if}
		</div>
	</section>

	<section class="card" aria-labelledby="download-title">
		<h2 id="download-title">Скачать и скопировать</h2>
		<p class="muted">
			all.md — сводка и все записи в одном файле для чтения. backup.json — полная копия для импорта
			на сайт.
		</p>
		<div class="actions">
			<button type="button" class="btn-primary" onclick={downloadAll} disabled={!!busy}>
				Скачать all.md и backup.json
			</button>
			<button type="button" class="btn-outline" onclick={copyAll} disabled={!!busy}>
				Скопировать all.md
			</button>
		</div>
	</section>

	<section class="card" aria-labelledby="import-title">
		<h2 id="import-title">Импорт</h2>
		<p class="muted">
			Загрузите backup.json, скачанный с сайта. «Слить» добавит новые записи и оставит текущие;
			«Заменить» удалит текущие записи и заметки.
		</p>
		<label class="field">
			<span>Файл backup.json</span>
			<input type="file" accept=".json,application/json" onchange={onFileChosen} />
		</label>

		{#if pending}
			<fieldset class="modes">
				<legend>Режим</legend>
				<label><input type="radio" name="mode" value="merge" bind:group={importMode} /> Слить</label
				>
				<label
					><input type="radio" name="mode" value="replace" bind:group={importMode} /> Заменить</label
				>
			</fieldset>
			<p class="muted">
				В файле: заметок {pending.backup.notes.length}, закладок {pending.backup.my.bookmarks
					.length}, желаемых глав {pending.backup.my.wishes.length}, ситуаций {pending.backup.my
					.situations.length}, уточнений {pending.backup.my.clarifications.length}.
			</p>
			<div class="actions">
				<button type="button" class="btn-primary" onclick={runImport} disabled={!!busy}>
					Импортировать «{pending.name}»
				</button>
			</div>
		{/if}
		{#if importResult}
			<p class="ok" role="status">{importResult}</p>
		{/if}
	</section>

	<section class="card" aria-labelledby="reset-title">
		<h2 id="reset-title">Сброс</h2>
		<p class="muted">
			Каждое действие спрашивает подтверждение. Перед удалением скачайте backup.json.
		</p>
		<div class="actions">
			<button type="button" class="btn-outline" onclick={resetProgress} disabled={!!busy}>
				Сбросить весь прогресс
			</button>
			<button type="button" class="btn-outline danger" onclick={clearMy} disabled={!!busy}>
				Удалить закладки, идеи и ситуации
			</button>
			<button type="button" class="btn-outline danger" onclick={clearNotes} disabled={!!busy}>
				Удалить заметки
			</button>
		</div>
		<p class="muted">
			Сброс прогресса не трогает результаты лабов и черновики кода. Заметки, закладки и ситуации при
			сбросе прогресса остаются.
		</p>
	</section>

	<div class="feedback" aria-live="polite">
		{#if busy}<p class="muted">Идёт действие…</p>{/if}
		{#if message}<p class="ok">{message}</p>{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</div>
</main>

<style>
	.wrap {
		max-width: 760px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4) var(--space-16);
	}
	@media (min-width: 720px) {
		.wrap {
			padding-inline: var(--space-8);
		}
	}
	.crumbs {
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.crumbs a {
		color: var(--accent);
	}
	.head {
		margin: var(--space-8) 0 var(--space-6);
	}
	h1 {
		font-family: var(--font-serif);
		font-size: var(--fs-h1);
		letter-spacing: -0.02em;
		margin: 0 0 var(--space-3);
	}
	h2 {
		font-family: var(--font-serif);
		font-size: var(--fs-h3);
		margin: 0 0 var(--space-2);
	}
	p {
		margin: 0 0 var(--space-3);
		line-height: 1.5;
	}
	.notice {
		background: var(--warn-bg);
		color: var(--text);
		border-left: 3px solid var(--warn);
		border-radius: var(--radius);
		padding: var(--space-3) var(--space-4);
		font-size: var(--fs-sm);
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-4) var(--space-6);
		margin: var(--space-6) 0;
	}
	.status {
		font-weight: 500;
	}
	.muted {
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
	.ok {
		color: var(--ok);
		font-size: var(--fs-sm);
	}
	.error {
		color: var(--fail);
		font-size: var(--fs-sm);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.field {
		display: grid;
		gap: var(--space-1);
		font-size: var(--fs-sm);
		margin: var(--space-3) 0;
	}
	.modes {
		border: 0;
		padding: 0;
		display: flex;
		gap: var(--space-4);
		font-size: var(--fs-sm);
		margin: var(--space-3) 0;
	}
	button {
		font: inherit;
		font-size: var(--fs-sm);
		border-radius: var(--radius-sm);
		padding: 6px 12px;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.btn-primary {
		background: var(--topic);
		color: var(--surface);
		border: 1px solid var(--topic);
	}
	.btn-outline {
		background: none;
		color: var(--text);
		border: 1px solid var(--border);
	}
	.btn-outline:hover:not(:disabled) {
		border-color: var(--topic);
	}
	.btn-outline.danger,
	.btn-link.danger {
		color: var(--fail);
	}
	.btn-link {
		background: none;
		border: 0;
		color: var(--topic);
		padding: 6px 4px;
	}
	.feedback {
		min-height: 1.5em;
	}
</style>
