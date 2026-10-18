<script lang="ts">
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
	<a class="save-indicator" href="/settings/data/" aria-label={fullLabel} title={fullLabel}>
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

	/* Too narrow for a status line: the settings page stays reachable through the header link. */
	@media (max-width: 640px) {
		.save-indicator {
			display: none;
		}
	}
</style>
