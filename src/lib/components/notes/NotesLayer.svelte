<script lang="ts">
	import type {
		AnchorFromSelection,
		AnchorResolution,
		ChapterId,
		LevelState,
		Note,
		NoteAnchor,
		NotesStore,
		Ulid,
	} from '../../contracts';
	import MarginNote from '../MarginNote.svelte';
	import SelectionNoteButton from '../SelectionNoteButton.svelte';
	import NoteEditor from './NoteEditor.svelte';
	import { stackTops, type NotePatch } from './notes-format';

	type Status = AnchorResolution['status'];
	type Editing = { mode: 'new'; anchor: NoteAnchor } | { mode: 'edit'; id: Ulid } | null;

	interface Props {
		store: NotesStore;
		chapter: ChapterId;
		/** Chapter container. Blocks are looked up as `[data-block="<id>"]` inside it. */
		root: HTMLElement | undefined;
		/** Builds the anchor from the selection (the anchor logic lives in `$lib/notes`). */
		anchorFromSelection: AnchorFromSelection;
		/** Applied levels; stored with new notes as the `layer` hint. */
		layer?: LevelState;
		/** Resolution per note id, from `resolveAnchor`. Without it a plain text check is used. */
		resolutions?: Record<string, AnchorResolution>;
		/** Host switches levels so that a hidden layer becomes visible. */
		onShowLayer?: (id: Ulid) => void;
	}

	const { store, chapter, root, anchorFromSelection, layer, resolutions, onShowLayer }: Props =
		$props();

	const GAP = 12;
	const DEFAULT_HEIGHT = 120;
	/** Button height plus margin, so the floating button clears the selection. */
	const BUTTON_OFFSET = 44;

	let notes = $state<Note[]>([]);
	let editing = $state<Editing>(null);
	let selection = $state<{ top: number; left: number } | null>(null);
	let heights = $state<Record<string, number>>({});
	let placement = $state<Record<string, { top: number; status: Status; layerHidden: boolean }>>({});
	let draftTop = $state(0);
	let layerHeight = $state(0);
	let canvas: HTMLElement | undefined = $state();
	let loadSeq = 0;

	const placedNotes = $derived(
		notes.flatMap((n) => {
			const p = placement[n.id];
			return p ? [{ n, p }] : [];
		}),
	);
	const detachedNotes = $derived(notes.filter((n) => !placement[n.id]));

	async function load(s: NotesStore, c: ChapterId) {
		const seq = ++loadSeq;
		const list = await s.listByChapter(c);
		if (seq === loadSeq) notes = list;
	}

	$effect(() => {
		const s = store;
		const c = chapter;
		void load(s, c);
		return s.subscribe((changed) => {
			if (changed === c) void load(s, c);
		});
	});

	function blockEl(id: string): HTMLElement | null {
		if (!root) return null;
		return root.querySelector<HTMLElement>(`[data-block="${CSS.escape(id)}"]`);
	}

	function statusOf(n: Note, el: HTMLElement | null): Status {
		const known = resolutions?.[n.id];
		if (known) return known.status;
		return el?.textContent?.includes(n.anchor.exact) ? 'found' : 'orphaned';
	}

	/**
	 * Positions note cards next to their blocks. Notes whose block is missing, orphaned or
	 * inside a hidden layer go to the list below the canvas.
	 */
	function layout() {
		if (!root || !canvas) return;
		const base = canvas.getBoundingClientRect().top;
		const topOf = (el: HTMLElement) => Math.max(0, el.getBoundingClientRect().top - base);

		const raw: Record<string, { top: number; status: Status; layerHidden: boolean }> = {};
		const items: { key: string; top: number; height: number }[] = [];

		for (const n of notes) {
			const el = blockEl(n.anchor.blockId);
			const status = statusOf(n, el);
			const layerHidden = !!el?.closest('[hidden]');
			if (!el || layerHidden || status === 'orphaned') continue;
			const top = topOf(el);
			raw[n.id] = { top, status, layerHidden };
			items.push({ key: n.id, top, height: heights[n.id] ?? DEFAULT_HEIGHT });
		}

		let draft = 0;
		if (editing?.mode === 'new') {
			const el = blockEl(editing.anchor.blockId);
			draft = el ? topOf(el) : 0;
			items.push({ key: 'new', top: draft, height: heights['new'] ?? DEFAULT_HEIGHT });
		}

		const stacked = stackTops(items, GAP);
		const next: typeof placement = {};
		let bottom = 0;
		for (const item of items) {
			const top = stacked[item.key] ?? 0;
			bottom = Math.max(bottom, top + item.height);
			if (item.key === 'new') continue;
			const info = raw[item.key];
			if (info) next[item.key] = { ...info, top };
		}
		placement = next;
		draftTop = stacked['new'] ?? draft;
		layerHeight = bottom;
	}

	// Re-layout when notes, resolutions, levels, editor state or measured heights change.
	$effect(() => {
		void notes;
		void resolutions;
		void layer;
		void editing;
		void heights;
		void root;
		void canvas;
		layout();
	});

	$effect(() => {
		const onResize = () => layout();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	function updateSelection() {
		const sel = window.getSelection();
		if (
			!sel ||
			sel.isCollapsed ||
			sel.rangeCount === 0 ||
			!root ||
			!sel.anchorNode ||
			!root.contains(sel.anchorNode)
		) {
			selection = null;
			return;
		}
		const r = sel.getRangeAt(0).getBoundingClientRect();
		selection = { top: r.top - BUTTON_OFFSET, left: r.left + r.width / 2 };
	}

	$effect(() => {
		document.addEventListener('selectionchange', updateSelection);
		document.addEventListener('scroll', updateSelection, true);
		return () => {
			document.removeEventListener('selectionchange', updateSelection);
			document.removeEventListener('scroll', updateSelection, true);
		};
	});

	function startNote() {
		const sel = window.getSelection();
		if (!sel || !root) return;
		const anchor = anchorFromSelection(sel, root);
		if (!anchor) return;
		editing = { mode: 'new', anchor };
		selection = null;
	}

	async function save(patch: NotePatch) {
		const ed = editing;
		if (!ed) return;
		if (ed.mode === 'new') {
			await store.create({ chapter, anchor: ed.anchor, text: patch.text, tags: patch.tags, layer });
		} else {
			await store.update(ed.id, { text: patch.text, tags: patch.tags, status: patch.status });
		}
		editing = null;
	}

	async function remove(id: Ulid) {
		await store.delete(id);
		if (editing?.mode === 'edit' && editing.id === id) editing = null;
	}
</script>

<SelectionNoteButton rect={selection} onClick={startNote} />

<div class="notes-layer">
	<div class="notes-canvas" bind:this={canvas} style:height="{layerHeight}px">
		{#each placedNotes as { n, p } (n.id)}
			<div class="note-slot" style:top="{p.top}px" bind:offsetHeight={heights[n.id]}>
				{#if editing?.mode === 'edit' && editing.id === n.id}
					<NoteEditor
						note={n}
						onSave={save}
						onCancel={() => (editing = null)}
						onDelete={() => remove(n.id)}
					/>
				{:else}
					<MarginNote
						note={n}
						resolution={p.status}
						layerHidden={p.layerHidden}
						onSelect={(id) => (editing = { mode: 'edit', id })}
						{onShowLayer}
						onDelete={remove}
					/>
				{/if}
			</div>
		{/each}

		{#if editing?.mode === 'new'}
			<div class="note-slot" style:top="{draftTop}px" bind:offsetHeight={heights['new']}>
				<NoteEditor anchor={editing.anchor} onSave={save} onCancel={() => (editing = null)} />
			</div>
		{/if}
	</div>

	{#if detachedNotes.length > 0}
		<section class="notes-orphans" aria-label="Заметки без привязки к тексту">
			<h3>Без привязки</h3>
			{#each detachedNotes as n (n.id)}
				{#if editing?.mode === 'edit' && editing.id === n.id}
					<NoteEditor
						note={n}
						onSave={save}
						onCancel={() => (editing = null)}
						onDelete={() => remove(n.id)}
					/>
				{:else}
					<MarginNote
						note={n}
						resolution={statusOf(n, blockEl(n.anchor.blockId))}
						layerHidden={!!blockEl(n.anchor.blockId)?.closest('[hidden]')}
						onSelect={(id) => (editing = { mode: 'edit', id })}
						{onShowLayer}
						onDelete={remove}
					/>
				{/if}
			{/each}
		</section>
	{/if}
</div>

<style>
	.notes-canvas {
		position: relative;
	}
	.note-slot {
		position: absolute;
		left: 0;
		right: 0;
		width: 240px;
		max-width: 100%;
		margin-bottom: var(--space-4);
	}
	.notes-orphans {
		margin-top: var(--space-6);
		display: grid;
		gap: var(--space-3);
	}
	.notes-orphans h3 {
		font-size: var(--fs-sm);
		color: var(--text-muted);
		margin: 0;
		font-weight: 600;
	}
	/* Narrow screens: the notes flow into the page after the paragraphs. */
	@media (max-width: 1180px) {
		.notes-canvas {
			height: auto !important;
			display: grid;
			gap: var(--space-4);
		}
		.note-slot {
			position: static;
			width: auto;
			margin-bottom: 0;
		}
	}
</style>
