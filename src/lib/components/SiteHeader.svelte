<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { SiteHeaderProps } from '$lib/contracts/component-props';
	import { resolveTheme, watchSystemDark } from '$lib/theme/theme';
	import ThemeToggle from './ThemeToggle.svelte';

	/** Site header: breadcrumbs, search, levels slot, theme toggle, reading progress. */
	let { crumbs = [], theme, onToggleTheme, levels, search }: SiteHeaderProps = $props();

	let systemDark = $state(false);
	$effect(() => watchSystemDark((dark) => (systemDark = dark)));
	const onRoadmaps = $derived(page.url.pathname.includes('/roadmaps'));
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
		<a class="nav-link" href={resolve('/roadmaps')} aria-current={onRoadmaps ? 'page' : undefined}
			>Маршруты</a
		>
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
		{#if search}
			<div class="search-slot">{@render search()}</div>
		{/if}
		{#if levels}
			<div class="levels-slot">{@render levels()}</div>
		{/if}
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

	.brand {
		font-family: var(--font-serif);
		font-weight: 700;
		font-size: 17px;
		letter-spacing: -0.01em;
		color: var(--text);
		text-decoration: none;
		white-space: nowrap;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nav-link {
		flex: none;
		font-size: var(--fs-sm);
		color: var(--text-muted);
		text-decoration: none;
		white-space: nowrap;
	}

	.nav-link:hover,
	.nav-link[aria-current] {
		color: var(--text);
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

	.search-slot,
	.levels-slot {
		flex: none;
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

	@media (max-width: 900px) {
		.topbar-inner {
			padding: 0 16px;
			gap: var(--space-2);
		}

		.crumbs {
			display: none;
		}

		.search-slot {
			flex: 1;
			min-width: 0;
		}
	}

	@media (max-width: 640px) {
		.topbar-inner {
			padding: 0 12px;
			gap: var(--space-2);
		}

		/* Search collapses to an icon button (see SearchDialog); slot keeps it on the right. */
		.search-slot {
			justify-content: flex-end;
		}
	}
</style>
