<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { ShortcutsHelpProps } from '../contracts/component-props';
	import { detectPlatform, formatKbd, type Platform } from '../shortcuts/keys';
	import { SHORTCUT_GROUPS } from '../shortcuts/table';

	/** Modal with the list of shortcuts, opened by `?`. */
	let { open, onClose }: ShortcutsHelpProps = $props();

	let platform = $state<Platform>('win');
	onMount(() => {
		platform = detectPlatform();
	});

	let dialogEl = $state<HTMLDivElement | undefined>();
	let closeBtn = $state<HTMLButtonElement | undefined>();
	let lastFocus: HTMLElement | null = null;

	// Focus management: move focus into the window on open, restore it on close.
	$effect(() => {
		if (open) {
			lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			void tick().then(() => closeBtn?.focus());
		} else if (lastFocus) {
			lastFocus.focus();
			lastFocus = null;
		}
	});

	function onWindowKeyDown(e: KeyboardEvent): void {
		if (!open) return;
		if (e.key === 'Escape' || e.key === '?') {
			e.preventDefault();
			onClose();
			return;
		}
		if (e.key === 'Tab' && dialogEl) {
			// Keep focus inside the window: Tab and Shift+Tab cycle through its buttons.
			const buttons = Array.from(
				dialogEl.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
			);
			if (!buttons.length) return;
			const first = buttons[0];
			const last = buttons[buttons.length - 1];
			const active = document.activeElement;
			const inside = !!active && dialogEl.contains(active);
			if (!first || !last) return;
			if (e.shiftKey && (active === first || !inside)) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && (active === last || !inside)) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	function onBackdropClick(e: MouseEvent): void {
		if (e.target === e.currentTarget) onClose();
	}
</script>

<svelte:window onkeydown={onWindowKeyDown} />

{#if open}
	<div class="kbd-backdrop" role="presentation" onclick={onBackdropClick}>
		<div
			class="kbd-dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="kbd-title"
			bind:this={dialogEl}
		>
			<header class="kbd-head">
				<h2 class="kbd-title" id="kbd-title">Шорткаты</h2>
				<div class="kbd-seg" role="group" aria-label="Показать клавиши для">
					<button type="button" aria-pressed={platform === 'mac'} onclick={() => (platform = 'mac')}
						>macOS</button
					>
					<button type="button" aria-pressed={platform === 'win'} onclick={() => (platform = 'win')}
						>Windows</button
					>
				</div>
				<button
					type="button"
					class="kbd-close"
					aria-label="Закрыть"
					bind:this={closeBtn}
					onclick={onClose}>×</button
				>
			</header>

			<div class="kbd-groups">
				{#each SHORTCUT_GROUPS as group (group.title)}
					<div class="kbd-group">
						<h3>{group.title}</h3>
						<ul>
							{#each group.items as [spec, description] (spec + description)}
								<li>
									<span class="kbd-desc">{description}</span>
									<kbd>{formatKbd(spec, platform)}</kbd>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>

			<p class="kbd-foot">Однобуквенные клавиши не работают, когда курсор в поле ввода.</p>
		</div>
	</div>
{/if}

<style>
	.kbd-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: grid;
		place-items: center;
		padding: var(--space-4);
		background: color-mix(in srgb, var(--text) 35%, transparent);
	}

	.kbd-dialog {
		width: min(720px, 100%);
		max-height: calc(100vh - 32px);
		overflow: auto;
		padding: var(--space-6) var(--space-8);
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow:
			var(--shadow),
			0 24px 60px color-mix(in srgb, var(--text) 25%, transparent);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
		text-align: left;
	}

	.kbd-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4);
		margin: 0 0 var(--space-6);
	}

	.kbd-title {
		flex: 1 1 auto;
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--fs-h3);
		font-weight: 600;
		line-height: 1.2;
		color: var(--text);
	}

	.kbd-seg {
		display: inline-flex;
		padding: 2px;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}

	.kbd-seg button {
		margin: 0;
		padding: 4px 10px;
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--text-muted);
		background: none;
		border: 0;
		border-radius: 4px;
		cursor: pointer;
	}

	.kbd-seg button[aria-pressed='true'] {
		color: var(--text);
		background: var(--surface);
		box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 15%, transparent);
	}

	.kbd-close {
		width: 32px;
		height: 32px;
		margin: 0;
		padding: 0;
		font: inherit;
		font-size: 22px;
		line-height: 1;
		color: var(--text-muted);
		background: none;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.kbd-close:hover {
		color: var(--text);
		background: var(--surface-2);
	}

	.kbd-dialog button:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	.kbd-groups {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-6) var(--space-8);
	}

	.kbd-group h3 {
		margin: 0 0 var(--space-2);
		padding: 0;
		font-family: var(--font-serif);
		font-size: var(--fs-base);
		font-weight: 600;
		line-height: 1.3;
		color: var(--text-muted);
	}

	.kbd-group ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.kbd-group li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 6px 0;
		border-bottom: 1px solid var(--border);
	}

	.kbd-group li:last-child {
		border-bottom: 0;
	}

	.kbd-desc {
		color: var(--text);
	}

	.kbd-group kbd {
		flex: none;
		display: inline-block;
		min-width: 1.5em;
		padding: 0 0.4em;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.6;
		font-weight: 500;
		white-space: nowrap;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-bottom-width: 2px;
		border-radius: var(--radius-sm);
	}

	.kbd-foot {
		margin: var(--space-6) 0 0;
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}

	/* The toast is created by shortcuts/toast.ts outside this component tree. */
	:global(.kbd-toast) {
		position: fixed;
		left: 50%;
		bottom: var(--space-6);
		z-index: 1001;
		padding: var(--space-2) var(--space-4);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		opacity: 0;
		transform: translate(-50%, 8px);
		pointer-events: none;
		transition:
			opacity var(--dur-fast) var(--ease),
			transform var(--dur-fast) var(--ease);
	}

	:global(.kbd-toast.is-on) {
		opacity: 1;
		transform: translate(-50%, 0);
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.kbd-toast) {
			transition: none;
		}
	}

	@media (max-width: 640px) {
		.kbd-dialog {
			padding: var(--space-4);
		}

		.kbd-groups {
			grid-template-columns: 1fr;
		}
	}
</style>
