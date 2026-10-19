<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { SiteHeaderProps } from '$lib/contracts/component-props';
	import { resolveTheme, watchSystemDark } from '$lib/theme/theme';
	import ThemeToggle from './ThemeToggle.svelte';
	import SaveIndicator from './my/SaveIndicator.svelte';

	/** Site header: breadcrumbs, search, levels slot, theme toggle, reading progress. */
	let { crumbs = [], theme, onToggleTheme, levels, search }: SiteHeaderProps = $props();

	let systemDark = $state(false);
	$effect(() => watchSystemDark((dark) => (systemDark = dark)));
	const onRoadmaps = $derived(page.url.pathname.includes('/roadmaps'));
	const onMy = $derived(page.url.pathname.includes('/my'));
	const onSettings = $derived(page.url.pathname.includes('/settings'));
	const resolved = $derived(resolveTheme(theme, systemDark));

	let progress = $state(0);
	$effect(() => {
		const update = () => {
			const max = document.documentElement.scrollHeight - window.innerHeight;
			progress = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
		};
		update();
		window.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		return () => {
			window.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
		};
	});
</script>

<header class="topbar">
	<div class="topbar-inner">
		<a class="brand" href={resolve('/')} data-home>learning-site</a>
		<a
			class="nav-link"
			href={resolve('/roadmaps')}
			aria-label="Маршруты"
			aria-current={onRoadmaps ? 'page' : undefined}
		>
			<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<path
					d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linejoin="round"
				/>
			</svg>
			<span class="nav-text">Маршруты</span>
		</a>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the "My" route is linked by its path -->
		<a class="nav-link" href="/my/" aria-label="Моё" aria-current={onMy ? 'page' : undefined}>
			<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<path
					d="M6 3h12v18l-6-4-6 4z"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linejoin="round"
				/>
			</svg>
			<span class="nav-text">Моё</span>
		</a>
		<nav class="crumbs" aria-label="Путь к главе">
			{#each crumbs as crumb, i (i)}
				{#if i > 0}<span class="sep" aria-hidden="true">›</span>{/if}
				{#if crumb.href}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- crumb hrefs are built by the page, not typed routes -->
					<a href={crumb.href}>{crumb.label}</a>
				{:else}
					<span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>
				{/if}
			{/each}
		</nav>
		<!-- Only on phones: starts a new line so that search and levels sit in a second row. -->
		<div class="row-break" aria-hidden="true"></div>
		{#if search}
			<div class="search-slot">{@render search()}</div>
		{/if}
		{#if levels}
			<div class="levels-slot">{@render levels()}</div>
		{/if}
		<SaveIndicator />
		<!-- eslint-disable svelte/no-navigation-without-resolve -- the settings route is linked by its path -->
		<a
			class="nav-link settings-link"
			href="/settings/data/"
			aria-current={onSettings ? 'page' : undefined}
			aria-label="Настройки"
		>
			<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" />
				<path
					d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linejoin="round"
				/>
			</svg>
			<span class="nav-text">Настройки</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<ThemeToggle theme={resolved} onToggle={() => onToggleTheme()} />
	</div>
	<div class="progress" aria-hidden="true">
		<span style:width="{progress}%"></span>
	</div>
</header>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: 20;
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--border);
	}

	.topbar-inner {
		max-width: 1320px;
		margin: 0 auto;
		padding: 0 var(--space-8);
		height: 56px;
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	/* Never shrinks: the brand stays readable at every width. */
	.brand {
		flex: none;
		font-family: var(--font-serif);
		font-weight: 700;
		font-size: 17px;
		letter-spacing: -0.01em;
		color: var(--text);
		text-decoration: none;
		white-space: nowrap;
	}

	.nav-link {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--fs-sm);
		color: var(--text-muted);
		text-decoration: none;
		white-space: nowrap;
	}

	.nav-link:hover,
	.nav-link[aria-current] {
		color: var(--text);
	}

	/* Icons are shown only on phones (see the narrow-screen rules below). */
	.nav-icon {
		display: none;
		flex: none;
	}

	.crumbs {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-sm);
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
	}

	/* Long titles shrink and end with an ellipsis instead of being cut mid-word. */
	.crumbs > a,
	.crumbs > span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.crumbs > .sep {
		flex: none;
	}

	.crumbs a {
		color: var(--text-muted);
		text-decoration: none;
	}

	.crumbs a:hover {
		color: var(--text);
	}

	.crumbs [aria-current] {
		color: var(--text);
		font-weight: 550;
	}

	.row-break {
		display: none;
	}

	.levels-slot {
		flex: none;
		display: flex;
		align-items: center;
	}

	/* Desktop: the search field shrinks before anything else does (crumbs take the rest). */
	.search-slot {
		flex: 0 1 250px;
		min-width: 150px;
		display: flex;
		align-items: center;
	}

	.progress {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 2px;
	}

	.progress span {
		display: block;
		height: 100%;
		width: 0;
		background: var(--topic);
		transition: width var(--dur-fast) linear;
	}

	@media (prefers-reduced-motion: reduce) {
		.progress span {
			transition: none;
		}
	}

	/*
	 * Tablets and small laptops: no breadcrumbs; Маршруты, Моё and Настройки become icon links; the levels button
	 * keeps only its values; the search field takes the remaining space.
	 */
	@media (max-width: 1100px) {
		.topbar-inner {
			padding: 0 16px;
			gap: var(--space-2);
		}

		.crumbs {
			display: none;
		}

		.search-slot {
			flex: 1 1 auto;
		}

		.nav-link {
			width: 34px;
			height: 34px;
			justify-content: center;
			border-radius: var(--radius);
		}

		.nav-link .nav-text {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}

		.nav-link .nav-icon {
			display: block;
		}

		.levels-slot :global(.lvl-prefix) {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
	}

	/*
	 * Phones: two rows. Row 1 is the brand and icon links (Маршруты, Моё, status, Настройки,
	 * theme); row 2 is the search field and, on chapter pages, the levels button.
	 * Every icon link is a 34px target; the text stays in the DOM for the accessible name.
	 */
	@media (max-width: 640px) {
		.topbar-inner {
			height: auto;
			flex-wrap: wrap;
			align-content: center;
			row-gap: 0;
			column-gap: var(--space-1);
			padding: var(--space-2) 12px;
		}

		.brand {
			order: 0;
			flex: 1 1 auto;
			min-width: 0;
			font-size: 16px;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.nav-link {
			order: 0;
		}

		.nav-link[aria-current] {
			background: var(--topic-soft);
			color: var(--topic);
		}

		.row-break {
			display: block;
			order: 1;
			flex: 0 0 100%;
			height: 0;
		}

		.search-slot {
			order: 2;
			flex: 1 1 0;
			margin-top: var(--space-2);
		}

		.levels-slot {
			order: 2;
			margin-top: var(--space-2);
		}

		/* Search keeps its label and icon, and fills the row. */
		.search-slot :global(.search-field) {
			width: 100%;
			height: 34px;
			justify-content: flex-start;
			padding: 0 var(--space-3);
		}

		.search-slot :global(.search-label) {
			position: static;
			width: auto;
			height: auto;
			overflow: visible;
			clip: auto;
			white-space: nowrap;
		}

		.search-slot :global(.search-icon) {
			display: block;
		}

		/* Levels: the short value (С2·Г1, design-system §5) is shown; the full labels stay for screen readers. */
		.levels-slot :global(.levels-btn) {
			padding: 0 var(--space-2);
		}

		.levels-slot :global(.lvl-short) {
			display: inline;
			font-weight: 600;
		}

		.levels-slot :global(.lvl-prefix),
		.levels-slot :global(.lvl-label) {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}

		.levels-slot :global(.caret),
		.levels-slot :global(.lvl-key) {
			display: none;
		}
	}
</style>
