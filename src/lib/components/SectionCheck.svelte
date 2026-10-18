<script lang="ts">
	/**
	 * Manual "section done" mark, rendered at the end of a chapter `##` heading.
	 * Mounted by ChapterPage into the heading; `checked` and `onToggle` are read at event time,
	 * so the parent can pass getters and keep the mark in its own reactive state.
	 */
	interface Props {
		sectionId: string;
		title: string;
		checked: boolean;
		onToggle: (sectionId: string, done: boolean) => void;
		disabled?: boolean;
	}

	let { sectionId, title, checked, onToggle, disabled = false }: Props = $props();
</script>

<label class="section-check" class:is-checked={checked}>
	<input
		type="checkbox"
		aria-label="Раздел «{title}» пройден"
		{checked}
		{disabled}
		onchange={(event) => onToggle(sectionId, event.currentTarget.checked)}
	/>
	<span class="box" aria-hidden="true">
		{#if checked}
			<svg viewBox="0 0 16 16" width="12" height="12" focusable="false">
				<path
					d="M3 8.5l3 3 7-7"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		{/if}
	</span>
</label>

<style>
	.section-check {
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
		margin-left: var(--space-3);
		cursor: pointer;
		position: relative;
	}
	.section-check input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
		margin: 0;
	}
	.box {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-sm);
		border: 1.5px solid var(--border);
		background: var(--surface);
		color: var(--topic);
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}
	.section-check:hover .box {
		border-color: var(--topic);
	}
	.section-check.is-checked .box {
		background: var(--topic-soft);
		border-color: var(--topic);
	}
	.section-check input:focus-visible + .box {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.section-check input:disabled + .box {
		opacity: 0.5;
	}
	@media (prefers-reduced-motion: reduce) {
		.box {
			transition: none;
		}
	}
</style>
