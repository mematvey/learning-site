<script lang="ts">
	import '../app.css';
	import '@fontsource/literata/cyrillic-500.css';
	import '@fontsource/literata/cyrillic-600.css';
	import '@fontsource/literata/cyrillic-700.css';
	import '@fontsource/literata/latin-500.css';
	import '@fontsource/literata/latin-600.css';
	import '@fontsource/literata/latin-700.css';
	import '@fontsource-variable/inter';
	import '@fontsource/jetbrains-mono/400.css';
	import '@fontsource/jetbrains-mono/500.css';

	import { onMount } from 'svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import SearchDialog from '$lib/components/SearchDialog.svelte';
	import LevelPopover from '$lib/components/LevelPopover.svelte';
	import ShortcutsHelp from '$lib/components/ShortcutsHelp.svelte';
	import type { Theme } from '$lib/contracts/progress';
	import { installShortcuts } from '$lib/shortcuts';
	import {
		applyTheme,
		readStoredTheme,
		resolveTheme,
		toggleTheme,
		watchSystemDark,
		writeStoredTheme,
	} from '$lib/theme/theme';
	import { ensureProgress, shell } from '$lib/shell.svelte';
	import { initMy } from '$lib/my/state.svelte';
	import { bootAutosync } from '$lib/my/autosync-boot';

	let { children } = $props();

	// Theme: the saved choice (`light | dark | system`); the inline script in app.html applies it
	// before first paint, this state keeps the toggle and the saved value in sync.
	let theme = $state<Theme>('system');
	let systemDark = $state(false);
	const resolved = $derived(resolveTheme(theme, systemDark));

	function onToggleTheme() {
		theme = toggleTheme(resolved);
		writeStoredTheme(theme);
		applyTheme(resolveTheme(theme, systemDark));
		ensureProgress()
			.then((store) => store.update({ settings: { theme } }))
			.catch(() => {
				/* read-only or unavailable store: the choice stays in localStorage */
			});
	}

	let helpOpen = $state(false);

	onMount(() => {
		// Marker for e2e tests: the app is hydrated and handlers are attached.
		document.documentElement.dataset.hydrated = 'true';
		theme = readStoredTheme();
		const stopWatch = watchSystemDark((dark) => (systemDark = dark));
		let stopAutosync: (() => void) | undefined;
		try {
			void initMy();
			void bootAutosync()
				.then((stop) => (stopAutosync = stop))
				.catch((error: unknown) => console.error('Failed to start autosave', error));
		} catch (error) {
			console.error('Failed to start "My" data', error);
		}
		const stopShortcuts = installShortcuts({
			// Deferred: the help window itself closes on `?`, and it would see the same keydown.
			onHelp: () => setTimeout(() => (helpOpen = true), 0),
			isHelpOpen: () => helpOpen,
		});
		return () => {
			stopWatch();
			stopShortcuts();
			stopAutosync?.();
		};
	});

	$effect(() => {
		applyTheme(resolved);
	});
</script>

{#snippet levelsSlot()}
	{#if shell.levels}
		<LevelPopover applied={shell.levels.applied} onApply={shell.levels.onApply} />
	{/if}
{/snippet}

<SiteHeader
	crumbs={shell.crumbs}
	{theme}
	{onToggleTheme}
	levels={shell.levels ? levelsSlot : undefined}
>
	{#snippet search()}
		<SearchDialog />
	{/snippet}
</SiteHeader>

{@render children()}

<ShortcutsHelp open={helpOpen} onClose={() => (helpOpen = false)} />
