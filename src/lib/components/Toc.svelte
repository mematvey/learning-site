<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { TocProps } from '$lib/contracts/component-props';

	/** Table of contents of the chapter. Highlights the section in view. */
	let { items, activeId }: TocProps = $props();

	let observed = $state<string | undefined>(undefined);
	const current = $derived(activeId ?? observed);

	$effect(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		const targets = items
			.map((item) => document.getElementById(item.id))
			.filter((el): el is HTMLElement => el !== null);
		if (targets.length === 0) return;

		const visible = new SvelteSet<string>();
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) visible.add(entry.target.id);
					else visible.delete(entry.target.id);
				}
				const first = items.find((item) => visible.has(item.id));
				if (first) observed = first.id;
			},
			{ rootMargin: '-30% 0px -60% 0px' },
		);
		for (const el of targets) io.observe(el);
		return () => io.disconnect();
	});
</script>

<nav class="toc" aria-label="Оглавление">
	<p class="toc-title">В этой главе</p>
	<ol>
		{#each items as item (item.id)}
			<li class:sub={item.level === 3}>
				<a
					href="#{item.id}"
					class:current={current === item.id}
					aria-current={current === item.id ? 'location' : undefined}>{item.title}</a
				>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.toc {
		position: sticky;
		top: 88px;
		width: 160px;
		padding-top: var(--space-2);
		font-size: var(--fs-sm);
	}

	.toc-title {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin-bottom: var(--space-3);
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		border-left: 1px solid var(--border);
	}

	a {
		display: block;
		padding: 6px 0 6px var(--space-4);
		margin-left: -1px;
		color: var(--text-muted);
		text-decoration: none;
		border-left: 2px solid transparent;
		transition:
			color var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}

	a:hover {
		color: var(--text);
	}

	a.current {
		color: var(--topic);
		border-left-color: var(--topic);
		font-weight: 600;
	}

	.sub a {
		padding-left: 28px;
		font-size: 13px;
	}

	@media (max-width: 1180px) {
		.toc {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		a {
			transition: none;
		}
	}
</style>
