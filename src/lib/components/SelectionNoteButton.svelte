<script lang="ts">
	import type { SelectionNoteButtonProps } from '../contracts/component-props';

	/** Floating note button over a text selection. */
	const { rect, onClick }: SelectionNoteButtonProps = $props();
</script>

{#if rect}
	<!-- mousedown is prevented so the text selection survives the click. -->
	<button
		type="button"
		class="sel-note"
		data-note-btn
		style:top="{rect.top}px"
		style:left="{rect.left}px"
		onmousedown={(e) => e.preventDefault()}
		onclick={onClick}
	>
		💬 Заметка
	</button>
{/if}

<style>
	/* rect is in viewport coordinates. */
	.sel-note {
		position: fixed;
		transform: translateX(-50%);
		z-index: 30;
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: 550;
		cursor: pointer;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 6px 12px;
	}
	.sel-note:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
</style>
