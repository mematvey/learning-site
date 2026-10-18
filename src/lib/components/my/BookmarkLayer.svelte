<script lang="ts">
	import type { Bookmark, BookmarkDraft } from '$lib/contracts/my';
	import type { ChapterId } from '$lib/contracts/ids';
	import { getMyStore } from '$lib/my/store';
	import { my } from '$lib/my/state.svelte';
	import {
		bookmarkKey,
		commitBookmark,
		draftFromElement,
		draftFromSelection,
		findBookmarkTargets,
		targetFrom,
	} from '$lib/my/bookmark-draft';
	import { SvelteSet } from 'svelte/reactivity';
	import BookmarkEditor from './BookmarkEditor.svelte';

	/**
	 * Bookmark affordances for one chapter: a "В закладки" button on hover, focus or long press
	 * over blocks, formulas, figures and terms; a button under a text selection; saved places are
	 * marked with `data-bookmarked`. Renders only fixed-position elements, so it takes no grid space.
	 */
	interface Props {
		chapterId: ChapterId;
		topic: string;
		root: HTMLElement | undefined;
	}

	const { chapterId, topic, root }: Props = $props();

	/** Delay for a touch long press before the button appears. */
	const LONG_PRESS_MS = 500;

	type Placed = { top: number; left: number };
	type Hover = { el: Element; draft: BookmarkDraft } & Placed;
	type Editing = { draft: BookmarkDraft; existing?: Bookmark } & Placed;

	let hover = $state<Hover | null>(null);
	let selected = $state<({ draft: BookmarkDraft } & Placed) | null>(null);
	let editing = $state<Editing | null>(null);
	let editError = $state('');
	let fabEl: HTMLButtonElement | undefined = $state();

	const chapterBookmarks = $derived(my.bookmarks.filter((b) => b.chapter === chapterId));
	const savedKeys = $derived(new SvelteSet(chapterBookmarks.map((b) => bookmarkKey(b))));

	function existingFor(draft: BookmarkDraft): Bookmark | undefined {
		const key = bookmarkKey(draft);
		return chapterBookmarks.find((b) => bookmarkKey(b) === key);
	}

	function clampLeft(x: number, min: number): number {
		return Math.max(min, Math.min(x, window.innerWidth - 8));
	}

	function showFor(node: Element) {
		if (!root || editing) return;
		const el = targetFrom(node);
		if (!el || !root.contains(el)) return;
		const draft = draftFromElement(el, root, topic, chapterId);
		if (!draft) return;
		const rect = el.getBoundingClientRect();
		hover = {
			el,
			draft,
			top: rect.top >= 44 ? rect.top - 36 : rect.bottom + 4,
			left: clampLeft(rect.right, 160),
		};
	}

	function openEditor(draft: BookmarkDraft, top: number, left: number) {
		const existing = existingFor(draft);
		editError = '';
		editing = {
			draft: { ...draft, comment: existing?.comment ?? '' },
			existing,
			top: Math.min(top, window.innerHeight - 260),
			left: clampLeft(left - 140, 8),
		};
		hover = null;
	}

	function closeEditor() {
		editing = null;
		editError = '';
	}

	async function save(comment: string) {
		if (!editing) return;
		try {
			const store = await getMyStore();
			await commitBookmark(store, editing.draft, comment, editing.existing);
			closeEditor();
			selected = null;
		} catch {
			editError = 'Не удалось сохранить закладку. Попробуйте ещё раз.';
		}
	}

	async function removeExisting() {
		const existing = editing?.existing;
		if (!existing || !window.confirm('Удалить закладку?')) return;
		try {
			const store = await getMyStore();
			await store.bookmarks.remove(existing.id);
			closeEditor();
		} catch {
			editError = 'Не удалось удалить закладку.';
		}
	}

	// Hover, focus and touch long press over the chapter text.
	$effect(() => {
		const r = root;
		if (!r) return;

		let pressTimer: ReturnType<typeof setTimeout> | undefined;
		const cancelPress = () => clearTimeout(pressTimer);

		const onOver = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse' || !(e.target instanceof Element)) return;
			const el = targetFrom(e.target);
			if (el) showFor(el);
			else hover = null;
		};
		const onOut = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return;
			const next = e.relatedTarget;
			if (next instanceof Node && (fabEl?.contains(next) || r.contains(next))) return;
			hover = null;
		};
		const onFocusIn = (e: FocusEvent) => {
			if (e.target instanceof Element) showFor(e.target);
		};
		const onPointerDown = (e: PointerEvent) => {
			if (e.pointerType === 'mouse' || !(e.target instanceof Element)) return;
			const el = targetFrom(e.target);
			if (!el) return;
			cancelPress();
			pressTimer = setTimeout(() => showFor(el), LONG_PRESS_MS);
		};

		r.addEventListener('pointerover', onOver);
		r.addEventListener('pointerout', onOut);
		r.addEventListener('focusin', onFocusIn);
		r.addEventListener('pointerdown', onPointerDown);
		r.addEventListener('pointerup', cancelPress);
		r.addEventListener('pointermove', cancelPress);
		r.addEventListener('pointercancel', cancelPress);
		return () => {
			cancelPress();
			r.removeEventListener('pointerover', onOver);
			r.removeEventListener('pointerout', onOut);
			r.removeEventListener('focusin', onFocusIn);
			r.removeEventListener('pointerdown', onPointerDown);
			r.removeEventListener('pointerup', cancelPress);
			r.removeEventListener('pointermove', cancelPress);
			r.removeEventListener('pointercancel', cancelPress);
		};
	});

	// Button under a text selection inside one block.
	function updateSelection() {
		if (!root || editing) return;
		const sel = window.getSelection();
		const draft = sel ? draftFromSelection(sel, root, topic, chapterId) : null;
		if (!sel || !draft) {
			selected = null;
			return;
		}
		const rect = sel.getRangeAt(0).getBoundingClientRect();
		selected = { draft, top: rect.bottom + 8, left: clampLeft(rect.left + rect.width / 2, 80) };
		hover = null;
	}

	$effect(() => {
		document.addEventListener('selectionchange', updateSelection);
		const onScroll = () => {
			hover = null;
			updateSelection();
		};
		window.addEventListener('scroll', onScroll, true);
		return () => {
			document.removeEventListener('selectionchange', updateSelection);
			window.removeEventListener('scroll', onScroll, true);
		};
	});

	// Marks saved places in the text; the marks are removed again on cleanup.
	$effect(() => {
		const r = root;
		if (!r) return;
		const marked = new SvelteSet<Element>();
		for (const b of chapterBookmarks) {
			for (const el of findBookmarkTargets(r, b)) marked.add(el);
		}
		for (const el of marked) el.setAttribute('data-bookmarked', 'true');
		return () => {
			for (const el of marked) el.removeAttribute('data-bookmarked');
		};
	});
</script>

{#if hover && !selected && !editing}
	<button
		bind:this={fabEl}
		type="button"
		class="bm-fab"
		class:is-on={savedKeys.has(bookmarkKey(hover.draft))}
		data-bookmark-btn
		style:top="{hover.top}px"
		style:left="{hover.left}px"
		onmousedown={(e) => e.preventDefault()}
		onclick={() => hover && openEditor(hover.draft, hover.top, hover.left)}
		onpointerleave={(e) => {
			if (!(e.relatedTarget instanceof Node && root?.contains(e.relatedTarget))) hover = null;
		}}
		onfocusout={(e) => {
			if (!(e.relatedTarget instanceof Node && root?.contains(e.relatedTarget))) hover = null;
		}}
	>
		{savedKeys.has(bookmarkKey(hover.draft)) ? 'В закладках ✓' : 'В закладки'}
	</button>
{/if}

{#if selected && !editing}
	<button
		type="button"
		class="bm-sel"
		data-bookmark-sel-btn
		style:top="{selected.top}px"
		style:left="{selected.left}px"
		onmousedown={(e) => e.preventDefault()}
		onclick={() => selected && openEditor(selected.draft, selected.top, selected.left)}
	>
		В закладки
	</button>
{/if}

{#if editing}
	{#key editing}
		<div class="bm-pop" style:top="{editing.top}px" style:left="{editing.left}px">
			<BookmarkEditor
				draft={editing.draft}
				onSave={save}
				onCancel={closeEditor}
				onDelete={editing.existing ? removeExisting : undefined}
			/>
			{#if editError}
				<p class="bm-error" role="alert">{editError}</p>
			{/if}
		</div>
	{/key}
{/if}

<style>
	.bm-fab,
	.bm-sel {
		position: fixed;
		z-index: 30;
		font: inherit;
		font-size: 12px;
		font-weight: 550;
		cursor: pointer;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		box-shadow: var(--shadow);
		padding: 4px 10px;
		white-space: nowrap;
	}
	.bm-fab {
		transform: translateX(-100%);
	}
	.bm-sel {
		transform: translateX(-50%);
		font-size: var(--fs-sm);
		padding: 6px 12px;
		border-radius: var(--radius);
	}
	.bm-fab.is-on {
		color: var(--bookmark, var(--topic));
		border-color: var(--bookmark, var(--topic));
	}
	.bm-fab:focus-visible,
	.bm-sel:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.bm-pop {
		position: fixed;
		z-index: 40;
	}
	.bm-error {
		margin: var(--space-2) 0 0;
		color: var(--fail);
		font-size: var(--fs-sm);
	}
	/* Narrow screens: the editor becomes a bottom sheet. */
	@media (max-width: 640px) {
		.bm-pop {
			top: auto !important;
			left: 0 !important;
			right: 0;
			bottom: 0;
			padding: var(--space-3);
			background: var(--surface);
		}
	}
	/* Saved places: a thin accent bar at the start of the block or term. */
	:global([data-bookmarked='true']) {
		box-shadow: inset 3px 0 0 var(--bookmark, var(--topic));
	}
</style>
