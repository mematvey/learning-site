<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ChapterEntry } from '$lib/contracts/registry';

	type Status = 'done' | 'progress' | 'new';

	/** Chapters of one topic in reading order, with progress status and prerequisite links. */
	const {
		chapters,
		titles,
		status,
	}: {
		chapters: ChapterEntry[];
		titles: Record<string, { title: string; href: string }>;
		status: Record<string, Status>;
	} = $props();

	function minutesLabel(m: ChapterEntry['minutes']): string {
		if (typeof m === 'number') return `${m} мин`;
		const v = Object.values(m).filter((x): x is number => typeof x === 'number');
		if (v.length === 0) return '';
		const lo = Math.min(...v);
		const hi = Math.max(...v);
		return lo === hi ? `${lo} мин` : `${lo}–${hi} мин`;
	}

	const LABELS: Record<Status, string> = { done: 'Прочитана', progress: 'В процессе', new: '' };
</script>

<ol class="list">
	{#each chapters as ch, i (ch.id)}
		{@const st = status[ch.id] ?? 'new'}
		<li class="item">
			<span class="num">{String(i + 1).padStart(2, '0')}</span>
			<div class="body">
				<h3>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- registry href: not a typed route yet; resolve() adds the site base -->
					<a class="stretch" href={resolve(ch.href as '/')}>{ch.title}</a>
				</h3>
				<p class="summary">{ch.summary}</p>
				<div class="meta">
					<span class="tag">{minutesLabel(ch.minutes)}</span>
					{#if ch.labs?.length}<span class="tag">Лаб</span>{/if}
					{#if st !== 'new'}<span class="tag status">{LABELS[st]}</span>{/if}
				</div>
				{#if ch.prereqs.length}
					<p class="prereqs">
						Сначала:
						{#each ch.prereqs.filter((p) => titles[p]) as p, k (p)}
							{#if k > 0},
							{/if}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- registry href, see above -->
							<a href={resolve((titles[p]?.href ?? '/') as '/')}>{titles[p]?.title}</a>
						{/each}
					</p>
				{/if}
			</div>
			<span class="arrow" aria-hidden="true">→</span>
		</li>
	{/each}
</ol>

<style>
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-4);
	}
	.item {
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--space-4);
		align-items: start;
		padding: var(--space-6);
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 4px solid var(--topic);
		border-radius: var(--radius-lg);
	}
	.item:hover {
		border-color: var(--topic);
		box-shadow: var(--shadow);
	}
	.item:focus-within {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.num {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--topic);
		padding-top: 4px;
	}
	h3 {
		font-family: var(--font-serif);
		font-size: 20px;
		font-weight: 600;
	}
	.stretch {
		color: var(--text);
		text-decoration: none;
	}
	.stretch::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.stretch:focus-visible {
		outline: none;
	}
	.summary {
		margin-top: var(--space-2);
		color: var(--text-muted);
		line-height: 1.55;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.tag {
		font-size: 12px;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 10px;
	}
	.status {
		color: var(--topic);
		border-color: var(--topic);
	}
	.prereqs {
		margin-top: var(--space-3);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.prereqs a {
		position: relative;
		z-index: 1;
		color: var(--accent);
	}
	.arrow {
		color: var(--topic);
		font-size: 20px;
	}
	@media (max-width: 520px) {
		.item {
			grid-template-columns: auto 1fr;
			padding: var(--space-4);
		}
		.arrow {
			display: none;
		}
	}
</style>
