import type { Bookmark, BookmarkDraft, BookmarkKind, MyStore } from '$lib/contracts/my';
import { visibleOffset, visibleText } from '$lib/notes/text';

/** Limits from the bookmark contract. */
export const COMMENT_MAX = 280;
export const QUOTE_MAX = 600;
export const CONTEXT_MAX = 32;
/** Leading text kept as the quote of a bookmark on a whole block (paragraph, heading, item). */
export const BLOCK_QUOTE_MAX = 200;

/** Elements that can be bookmarked by hover, focus or long press. */
export const BOOKMARK_TARGET_SELECTOR =
	'.math-display[data-block][id], [data-term], .katex, [data-figure-id], [data-block][id]';

/** Elements that carry a block id: paragraphs, headings, list items, display formulas and figures. */
const BLOCK_SELECTOR = '[data-block][id], [data-figure-id]';

/** CSS.escape with a fallback for environments without the CSSOM API (jsdom). */
function cssEscape(value: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
	return value.replace(/["\\]/g, (ch) => `\\${ch}`);
}

function blockIdOf(el: Element): string | null {
	return el.getAttribute('data-figure-id') ?? el.getAttribute('id');
}

/** Nearest block (with a block id) that contains the node, or null. */
export function nearestBlock(node: Element, root: HTMLElement): Element | null {
	const el = node.closest(BLOCK_SELECTOR);
	return el && root.contains(el) ? el : null;
}

/** Maps any node under the pointer to the bookmarkable element it belongs to, or null. */
export function targetFrom(node: Element): Element | null {
	const formula = node.closest('.math-display[data-block][id]');
	if (formula) return formula;
	const term = node.closest('[data-term]');
	if (term) return term;
	const katex = node.closest('.katex');
	if (katex) return katex;
	return node.closest(BLOCK_SELECTOR);
}

/** TeX source of a KaTeX element (MathML annotation), falling back to its text. */
export function texOf(el: Element): string {
	const tex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
	return (tex ?? el.textContent ?? '').trim();
}

/**
 * Reader-visible text of a block, collapsed to one line and cut to `BLOCK_QUOTE_MAX` characters.
 * Tooltips, MathML copies and other hidden content are skipped (see `notes/text.ts`).
 */
export function blockLeadQuote(block: Element): string | undefined {
	const text = visibleText(block).replace(/\s+/g, ' ').trim();
	const cut = Array.from(text).slice(0, BLOCK_QUOTE_MAX).join('').trim();
	return cut || undefined;
}

/** Draft for a block, formula, figure or term element. Returns null when there is no block to anchor to. */
export function draftFromElement(
	el: Element,
	root: HTMLElement,
	topic: string,
	chapter: string,
): BookmarkDraft | null {
	const block = nearestBlock(el, root);
	if (!block) return null;
	const blockId = blockIdOf(block);
	if (!blockId) return null;

	let kind: BookmarkKind = 'block';
	let quote: string | undefined;
	let termId: string | undefined;

	if (el.matches('[data-term]')) {
		kind = 'term';
		termId = el.getAttribute('data-term') ?? undefined;
	} else if (el.matches('.math-display, .katex')) {
		kind = 'formula';
		quote = texOf(el).slice(0, QUOTE_MAX) || undefined;
	} else if (el.matches('[data-figure-id]')) {
		kind = 'figure';
	} else {
		quote = blockLeadQuote(block);
	}

	const draft: BookmarkDraft = {
		kind,
		topic,
		chapter: chapter as BookmarkDraft['chapter'],
		blockId: blockId as BookmarkDraft['blockId'],
		comment: '',
	};
	if (quote !== undefined) draft.quote = quote;
	if (termId !== undefined) draft.termId = termId;
	return draft;
}

/**
 * Draft for a text selection inside one block. Returns null for empty or cross-block selections.
 * The quote is the selected text, with up to 32 characters of context on each side.
 */
export function draftFromSelection(
	sel: Selection,
	root: HTMLElement,
	topic: string,
	chapter: string,
): BookmarkDraft | null {
	if (sel.isCollapsed || sel.rangeCount === 0) return null;
	if (sel.toString().trim() === '') return null;

	const range = sel.getRangeAt(0);
	const startNode = range.startContainer;
	const startEl = startNode instanceof Element ? startNode : startNode.parentElement;
	if (!startEl) return null;
	const block = nearestBlock(startEl, root);
	if (!block || !block.contains(range.endContainer)) return null;
	const blockId = blockIdOf(block);
	if (!blockId) return null;

	// Offsets count reader-visible text only, so tooltips and MathML copies do not leak into the quote.
	const start = visibleOffset(block, range.startContainer, range.startOffset);
	const end = visibleOffset(block, range.endContainer, range.endOffset);
	const text = visibleText(block);
	const quoted = text.slice(start, end);
	if (quoted.trim() === '' || end <= start) return null;

	const draft: BookmarkDraft = {
		kind: block.hasAttribute('data-figure-id') ? 'figure' : 'block',
		topic,
		chapter: chapter as BookmarkDraft['chapter'],
		blockId: blockId as BookmarkDraft['blockId'],
		quote: quoted.slice(0, QUOTE_MAX),
		comment: '',
	};
	const prefix = text.slice(Math.max(0, start - CONTEXT_MAX), start);
	const suffix = text.slice(end, end + CONTEXT_MAX);
	if (prefix) draft.prefix = prefix;
	if (suffix) draft.suffix = suffix;
	return draft;
}

/** Identity of a bookmarked place: two bookmarks with the same key point at the same place. */
export function bookmarkKey(b: Pick<Bookmark, 'kind' | 'blockId' | 'termId' | 'quote'>): string {
	return [b.kind, b.blockId, b.termId ?? '', b.quote ?? ''].join('|');
}

/** Elements inside the chapter root that visually mark a saved bookmark. */
export function findBookmarkTargets(
	root: HTMLElement,
	b: Pick<Bookmark, 'blockId' | 'termId'>,
): Element[] {
	const esc = cssEscape(b.blockId);
	if (b.termId !== undefined) {
		return Array.from(root.querySelectorAll(`[data-term="${cssEscape(b.termId)}"]`)).filter(
			(el) => {
				const block = nearestBlock(el, root);
				return block !== null && blockIdOf(block) === b.blockId;
			},
		);
	}
	const el = root.querySelector(`[id="${esc}"], [data-figure-id="${esc}"]`);
	return el && root.contains(el) ? [el] : [];
}

/** Saves a bookmark: updates `existing` when given, otherwise adds a new one. */
export async function commitBookmark(
	store: MyStore,
	draft: BookmarkDraft,
	comment: string,
	existing?: Bookmark,
): Promise<Bookmark> {
	const text = comment.slice(0, COMMENT_MAX);
	if (existing) return store.bookmarks.update(existing.id, { comment: text });
	return store.bookmarks.add({ ...draft, comment: text });
}

/** Russian label per bookmark kind, for the UI. */
export const KIND_LABEL: Record<BookmarkKind, string> = {
	block: 'Абзац',
	formula: 'Формула',
	term: 'Термин',
	figure: 'Рисунок',
};
