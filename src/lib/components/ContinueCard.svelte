<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ContinueCardProps } from '$lib/contracts/component-props';

	/** Continue-reading card on the home page. */
	const { topic, topicTitle, title, description, progress, lab, href }: ContinueCardProps =
		$props();

	const percent = $derived(Math.round(Math.min(1, Math.max(0, progress)) * 100));
	const labLabel = $derived(
		lab === undefined
			? ''
			: lab.state === 'passed'
				? 'Лаб пройден'
				: lab.state === 'failed'
					? 'Лаб с ошибкой'
					: 'Лаб не пройден',
	);
</script>

<section class="continue" data-topic={topic} aria-labelledby="continue-title">
	<div class="continue-art" aria-hidden="true">
		<svg viewBox="0 0 160 120">
			<path class="art-arc" d="M18 84 C 40 20, 120 20, 142 84" />
			<circle cx="18" cy="84" r="7" class="art-node" />
			<circle cx="46" cy="84" r="7" class="art-node" opacity=".35" />
			<circle cx="74" cy="84" r="7" class="art-node is-hot" />
			<circle cx="102" cy="84" r="7" class="art-node" opacity=".35" />
			<circle cx="130" cy="84" r="7" class="art-node" opacity=".2" />
		</svg>
	</div>
	<div class="continue-body">
		<p class="eyebrow">Продолжить · {topicTitle}</p>
		<h2 id="continue-title">{title}</h2>
		<p class="continue-desc">{description}</p>
		<div class="progress progress-lg">
			<span class="bar"><i style="width: {percent}%"></i></span>
			<span class="progress-label">{percent}%{labLabel ? ` · ${labLabel}` : ''}</span>
		</div>
	</div>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- registry href: not a typed route yet; resolve() adds the site base -->
	<a class="btn-primary" href={resolve(href as '/')}>Продолжить <span aria-hidden="true">→</span></a
	>
</section>

<style>
	.continue {
		display: grid;
		gap: var(--space-6);
		align-items: center;
		padding: var(--space-6);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
	}
	.continue-art {
		display: none;
		width: 160px;
		height: 120px;
		border-radius: var(--radius);
		background: var(--topic-soft);
	}
	.continue-art svg {
		width: 100%;
		height: 100%;
	}
	.art-arc {
		fill: none;
		stroke: var(--topic);
		stroke-width: 2;
		stroke-dasharray: 3 5;
		opacity: 0.6;
	}
	.art-node {
		fill: var(--topic);
	}
	.art-node.is-hot {
		stroke: var(--surface);
		stroke-width: 3;
	}
	.continue-body {
		display: grid;
		gap: var(--space-2);
	}
	.eyebrow {
		font-size: var(--fs-sm);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
		font-weight: 600;
	}
	h2 {
		font-family: var(--font-serif);
		font-size: 26px;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin-top: var(--space-1);
	}
	.continue-desc {
		color: var(--text-muted);
		max-width: 560px;
	}
	.progress {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: var(--fs-sm);
		color: var(--text-muted);
		margin-top: var(--space-3);
		max-width: 420px;
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
	.btn-primary {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-6);
		border-radius: var(--radius);
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
		white-space: nowrap;
	}
	.btn-primary:hover {
		opacity: 0.9;
		text-decoration: none;
	}
	@media (min-width: 720px) {
		.continue {
			grid-template-columns: auto 1fr auto;
			gap: var(--space-8);
		}
		.continue-art {
			display: block;
		}
	}
</style>
