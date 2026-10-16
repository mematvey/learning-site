<script lang="ts">
	import { resolve } from '$app/paths';
	import type { TopicCardProps } from '$lib/contracts/component-props';

	/** Home page topic card. */
	const {
		topic,
		title,
		description,
		chapterCount,
		chapters,
		progress,
		active = false,
		mapHref,
		onSelect,
	}: TopicCardProps = $props();

	const percent = $derived(Math.round(Math.min(1, Math.max(0, progress)) * 100));

	function plural(n: number): string {
		const m10 = n % 10;
		const m100 = n % 100;
		if (m10 === 1 && m100 !== 11) return `${n} глава`;
		if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} главы`;
		return `${n} глав`;
	}
</script>

<article class="topic-card" class:is-active={active} data-topic={topic}>
	<div class="topic-top">
		<span class="topic-icon" aria-hidden="true">
			<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /></svg>
		</span>
		<span class="badge">{plural(chapterCount)}</span>
	</div>
	<h3><a class="title-link" href={resolve('/[topic]', { topic })}>{title}</a></h3>
	<p class="topic-desc">{description}</p>
	<ol class="chapter-list">
		{#each chapters as ch, i (ch.id)}
			<li>
				<span class="num">{String(i + 1).padStart(2, '0')}</span>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- registry href: not a typed route yet; resolve() adds the site base -->
				<a href={resolve(ch.href as '/')}>{ch.title}</a>
			</li>
		{/each}
	</ol>
	<div class="card-foot">
		<div class="progress">
			<span class="bar"><i style="width: {percent}%"></i></span>
			<span class="progress-label">{percent}%</span>
		</div>
		<a class="card-all" href={resolve('/[topic]', { topic })}
			>Все главы <span aria-hidden="true">→</span></a
		>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- in-page anchor (#map), not an app route -->
		<a class="card-map" href={mapHref} onclick={() => onSelect?.(topic)}>
			Карта <span aria-hidden="true">→</span>
		</a>
	</div>
</article>

<style>
	.topic-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-8) var(--space-6) var(--space-6);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.topic-card::before {
		content: '';
		position: absolute;
		inset: 0 0 auto 0;
		height: 4px;
		background: var(--topic);
	}
	.topic-card.is-active {
		border-color: var(--topic);
		box-shadow: 0 0 0 2px var(--topic);
	}
	@media (prefers-reduced-motion: no-preference) {
		.topic-card {
			transition:
				box-shadow var(--dur) var(--ease),
				transform var(--dur) var(--ease),
				border-color var(--dur) var(--ease);
		}
		.topic-card:hover {
			border-color: var(--topic);
			box-shadow: var(--shadow);
			transform: translateY(-2px);
		}
	}
	.topic-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.topic-icon {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border-radius: var(--radius-sm);
		background: var(--topic-soft);
	}
	.topic-icon svg {
		width: 16px;
		height: 16px;
		fill: var(--topic);
	}
	.badge {
		font-size: 12px;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 10px;
		white-space: nowrap;
	}
	h3 {
		font-family: var(--font-serif);
		font-size: 22px;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin-top: calc(var(--space-2) * -1);
	}
	.topic-desc {
		color: var(--text-muted);
		font-size: var(--fs-base);
		line-height: 1.55;
		margin-top: calc(var(--space-3) * -1);
	}
	.chapter-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 2px;
	}
	.chapter-list li {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-top: 1px solid var(--border);
		font-size: var(--fs-sm);
	}
	.num {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--topic);
		flex: none;
	}
	.chapter-list a {
		color: var(--text);
	}
	.chapter-list a:hover {
		color: var(--topic);
	}
	.card-foot {
		margin-top: auto;
		display: grid;
		gap: var(--space-3);
	}
	.progress {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.bar {
		flex: 1;
		height: 4px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--topic);
	}
	.progress-label {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.title-link {
		color: var(--text);
	}
	.title-link:hover {
		color: var(--topic);
		text-decoration: underline;
	}
	.card-all {
		justify-self: start;
		color: var(--topic);
		font-size: var(--fs-sm);
		font-weight: 600;
	}
	.card-all:hover {
		text-decoration: underline;
	}
	.card-map {
		justify-self: start;
		color: var(--topic);
		font-size: var(--fs-sm);
		font-weight: 600;
	}
	.card-map:hover {
		text-decoration: underline;
	}
</style>
