<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { syncState } from '$lib/export/autosync.svelte';
	import { folderSync, type FolderStatus } from '$lib/export/folder';

	/** Compact autosave state for the site header. Links to the data settings page. */
	let folder = $state<FolderStatus | undefined>();

	async function refresh(): Promise<void> {
		try {
			folder = await folderSync.status();
		} catch {
			folder = undefined;
		}
	}

	onMount(() => {
		void refresh();
		window.addEventListener('focus', refresh);
		return () => window.removeEventListener('focus', refresh);
	});

	// Re-read the folder state after each autosave run and when the user comes back to the tab.
	$effect(() => {
		void syncState.status;
		void syncState.lastSaved;
		void refresh();
	});

	const label = $derived.by(() => {
		switch (folder?.state) {
			case undefined:
				return '';
			case 'unsupported':
				return 'Не поддерживается';
			case 'no-folder':
				return 'Папка не выбрана';
			case 'needs-permission':
				return 'Нужно разрешение';
			case 'ready':
				return `Автосохранение: ${folder.folderName ?? ''}`;
			case 'error':
				return 'Автосохранение: ошибка';
		}
	});

	const fullLabel = $derived(`${label}. Открыть настройки данных`);
</script>

{#if folder}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- settings route is linked by its path -->
	<a
		class="save-indicator"
		href={resolve('/settings/data/' as '/')}
		aria-label={fullLabel}
		title={fullLabel}
	>
		<span class="dot" class:ready={folder.state === 'ready'} aria-hidden="true"></span>
		<span class="text">{label}</span>
	</a>
{/if}

<style>
	.save-indicator {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		max-width: 220px;
		font-size: var(--fs-sm);
		color: var(--text-muted);
		text-decoration: none;
		white-space: nowrap;
	}

	.save-indicator:hover {
		color: var(--text);
	}

	.save-indicator:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.text {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1.5px solid var(--text-muted);
	}

	.dot.ready {
		background: var(--ok);
		border-color: var(--ok);
	}

	@media (max-width: 1100px) {
		.save-indicator {
			max-width: 160px;
		}
	}

	/*
	 * Tablets and phones: the status becomes a 34px icon link (dot only). Its aria-label and title
	 * carry the full state and point to the data settings page.
	 */
	@media (max-width: 900px) {
		.save-indicator {
			width: 34px;
			height: 34px;
			justify-content: center;
			border: 1px solid var(--border-control);
			border-radius: var(--radius);
			max-width: none;
		}

		.save-indicator:hover {
			border-color: var(--text-muted);
		}

		.text {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
	}
</style>
