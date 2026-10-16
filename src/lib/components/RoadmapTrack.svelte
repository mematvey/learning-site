<script lang="ts">
	import { resolve } from '$app/paths';
	import type { RoadmapEntry } from '$lib/contracts/roadmap';
	import {
		statusOf,
		type ChapterStatus,
		type ProgressSnapshot,
	} from '../../routes/roadmaps/status';

	/** Vertical route: stages as nodes on a line, chapters with status, labs and links. */
	const {
		roadmap,
		chapters,
		labs,
		snapshot,
		current = null,
	}: {
		roadmap: RoadmapEntry;
		chapters: Record<string, { title: string; href: string }>;
		labs: Record<string, { title: string; chapter: string }>;
		snapshot: ProgressSnapshot;
		/** Stage and chapter to continue from; highlighted on the track. */
		current?: { step: number; chapter: string } | null;
	} = $props();

	const LABELS: Record<ChapterStatus, string> = {
		new: 'Не начата',
		progress: 'В процессе',
		done: 'Пройдена',
	};

	function stepState(ids: string[]): ChapterStatus {
		const states = ids.map((id) => statusOf(snapshot, id));
		if (states.every((s) => s === 'done')) return 'done';
		if (states.some((s) => s !== 'new')) return 'progress';
		return 'new';
	}
</script>

<ol class="track">
	{#each roadmap.steps as step, i (i)}
		{@const state = stepState(step.chapters)}
		<li class="step" class:is-done={state === 'done'} class:is-current={current?.step === i}>
			<span class="node" aria-hidden="true">
				{#if state === 'done'}
					<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
				{:else}
					{i + 1}
				{/if}
			</span>
			<div class="body">
				<h3>
					<span class="sr-only">Этап {i + 1}: </span>{step.title}
					{#if step.optional}<span class="tag">Необязательный</span>{/if}
				</h3>
				<p class="desc">{step.description}</p>
				<ul class="chapters">
					{#each step.chapters as id (id)}
						{@const st = statusOf(snapshot, id)}
						{@const info = chapters[id]}
						<li class:is-here={current?.chapter === id}>
							{#if info}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- registry href: not a typed route; resolve() adds the site base -->
								<a class="chapter-link" href={resolve(info.href as '/')}>{info.title}</a>
							{:else}
								<span>{id}</span>
							{/if}
							<span class="status" data-status={st}>{LABELS[st]}</span>
						</li>
					{/each}
				</ul>
				{#if step.labs && step.labs.length > 0}
					<ul class="labs" aria-label="Лабы этапа {i + 1}">
						{#each step.labs as labId (labId)}
							{@const lab = labs[labId]}
							{@const chapter = lab ? chapters[lab.chapter] : undefined}
							<li>
								<span class="lab-mark" aria-hidden="true">&lt;/&gt;</span>
								{#if lab && chapter}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- registry href: not a typed route; resolve() adds the site base -->
									<a href={resolve(chapter.href as '/')}>Лаб: {lab.title}</a>
								{:else}
									<span>Лаб: {labId}</span>
								{/if}
								{#if snapshot.labs[labId]}<span class="status" data-status="done">Пройден</span
									>{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</li>
	{/each}
</ol>

<style>
	.track {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.step {
		position: relative;
		display: grid;
		grid-template-columns: 40px 1fr;
		gap: var(--space-4);
		padding-bottom: var(--space-8);
	}
	/* The line between nodes. */
	.step::before {
		content: '';
		position: absolute;
		left: 19px;
		top: 40px;
		bottom: 0;
		width: 2px;
		background: var(--border);
	}
	.step:last-child {
		padding-bottom: 0;
	}
	.step:last-child::before {
		display: none;
	}
	.step.is-done::before {
		background: var(--ok);
	}
	.node {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--surface);
		border: 2px solid var(--border);
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		font-weight: 600;
		color: var(--text-muted);
		position: relative;
		z-index: 1;
	}
	.node svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.is-done .node {
		background: var(--ok);
		border-color: var(--ok);
		color: var(--bg);
	}
	.is-current .node {
		border-color: var(--accent);
		color: var(--accent);
		box-shadow: 0 0 0 4px var(--surface-2);
	}
	.body {
		min-width: 0;
		padding: var(--space-4) var(--space-6);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}
	.is-current .body {
		border-color: var(--accent);
	}
	h3 {
		font-family: var(--font-serif);
		font-size: var(--fs-h3);
		font-weight: 600;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.tag {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 400;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 10px;
	}
	.desc {
		margin-top: var(--space-2);
		color: var(--text-muted);
		line-height: 1.55;
	}
	.chapters,
	.labs {
		list-style: none;
		margin: var(--space-4) 0 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	.chapters li,
	.labs li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2) var(--space-3);
		padding-top: var(--space-2);
		border-top: 1px solid var(--border);
		min-width: 0;
	}
	.chapter-link {
		font-weight: 550;
		overflow-wrap: anywhere;
	}
	a {
		color: var(--accent);
	}
	a:hover {
		text-decoration: underline;
	}
	.labs {
		margin-top: var(--space-2);
		font-size: var(--fs-sm);
	}
	.labs li {
		flex-wrap: nowrap;
	}
	.lab-mark {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}
	.status {
		margin-left: auto;
		font-size: 12px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.status[data-status='done'] {
		color: var(--ok);
		font-weight: 600;
	}
	.status[data-status='progress'] {
		color: var(--accent);
		font-weight: 600;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	@media (max-width: 520px) {
		.step {
			grid-template-columns: 32px 1fr;
			gap: var(--space-3);
		}
		.step::before {
			left: 15px;
			top: 32px;
		}
		.node {
			width: 32px;
			height: 32px;
		}
		.body {
			padding: var(--space-3) var(--space-4);
		}
	}
</style>
