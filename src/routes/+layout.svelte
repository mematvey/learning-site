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
		theme = readStoredTheme();
		const stopWatch = watchSystemDark((dark) => (systemDark = dark));
		const stopShortcuts = installShortcuts({
			onHelp: () => (helpOpen = true),
			isHelpOpen: () => helpOpen,
		});
		return () => {
			stopWatch();
			stopShortcuts();
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
