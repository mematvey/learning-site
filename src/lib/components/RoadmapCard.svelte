<script lang="ts">
	import { resolve } from '$app/paths';
	import type { RoadmapEntry } from '$lib/contracts/roadmap';
	import {
		chaptersLabel,
		formatMinutes,
		roadmapProgress,
		type ProgressSnapshot,
	} from '../../routes/roadmaps/status';

	/** Card of one roadmap in the list: title, size, time estimate and progress. */
	const { roadmap, snapshot }: { roadmap: RoadmapEntry; snapshot: ProgressSnapshot } = $props();

	const progress = $derived(roadmapProgress(roadmap, snapshot));
	const percent = $derived(Math.round(progress.fraction * 100));
</script>

<article class="card">
	<div class="meta">
		<span class="badge">{chaptersLabel(roadmap.chapterCount)}</span>
		<span class="badge">~{formatMinutes(roadmap.estimatedMinutes)}</span>
	</div>
	<h2><a href={resolve('/roadmaps/[id]', { id: roadmap.id })}>{roadmap.title}</a></h2>
	<p class="summary">{roadmap.summary}</p>
	<p class="audience">{roadmap.audience}</p>
	<div class="progress">
		<span
			class="bar"
			role="progressbar"
			aria-label="Прогресс по маршруту «{roadmap.title}»"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={percent}
		>
			<i style="width: {percent}%"></i>
		</span>
		<span class="label">{progress.done} из {progress.total}</span>
	</div>
</article>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-6);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}
	@media (prefers-reduced-motion: no-preference) {
		.card {
			transition:
				box-shadow var(--dur) var(--ease),
				transform var(--dur) var(--ease),
				border-color var(--dur) var(--ease);
		}
		.card:hover {
			border-color: var(--accent);
			box-shadow: var(--shadow);
			transform: translateY(-2px);
		}
	}
	.card:focus-within {
		border-color: var(--accent);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.badge {
		font-size: 12px;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 10px;
		white-space: nowrap;
	}
	h2 {
		font-family: var(--font-serif);
		font-size: 22px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	h2 a {
		color: var(--text);
		text-decoration: none;
	}
	/* Whole card is clickable through the title link. */
	h2 a::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--radius-lg);
	}
	h2 a:hover {
		color: var(--accent);
	}
	h2 a:focus-visible {
		outline: none;
	}
	h2 a:focus-visible::after {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.summary {
		color: var(--text);
		line-height: 1.55;
	}
	.audience {
		color: var(--text-muted);
		font-size: var(--fs-sm);
		line-height: 1.5;
	}
	.progress {
		margin-top: auto;
		padding-top: var(--space-2);
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.bar {
		flex: 1;
		height: 6px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
	}
	.label {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
</style>
