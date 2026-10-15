import {
	ANCHOR_CONTEXT_CHARS,
	type AnchorFromSelection,
	type AnchorResolution,
	type ChapterTextIndex,
	type NoteAnchor,
	type ResolveAnchor,
} from '$lib/contracts';

/** Elements that carry a block id: paragraphs, headings, list items (`data-block`) and figures. */
const BLOCK_SELECTOR = '[data-block], [data-figure-id]';

/** Minimal similarity (Dice over bigrams) for a fuzzy match of a moved quote. */
export const FUZZY_THRESHOLD = 0.8;

function blockIdOf(el: Element): string {
	return el.getAttribute('data-figure-id') ?? el.id;
}

/** Plain-text view of a chapter. Hidden layers stay in the DOM, so they are included. */
export function chapterTextIndex(root: HTMLElement): ChapterTextIndex {
	const blocks: ChapterTextIndex['blocks'] = [];
	for (const el of root.querySelectorAll(BLOCK_SELECTOR)) {
		const id = blockIdOf(el);
		if (id) blocks.push({ id, text: el.textContent ?? '' });
	}
	return { blocks };
}

export const anchorFromSelection: AnchorFromSelection = (selection, root) => {
	if (selection.rangeCount === 0 || selection.isCollapsed) return null;
	const exact = selection.toString();
	if (exact.trim() === '') return null;

	const range = selection.getRangeAt(0);
	const startNode = range.startContainer;
	const startEl = startNode instanceof Element ? startNode : startNode.parentElement;
	const blockEl = startEl?.closest(BLOCK_SELECTOR);
	if (!blockEl || !root.contains(blockEl)) return null;
	// The quote must sit inside one block; cross-block selections have no single anchor.
	if (!blockEl.contains(range.endContainer)) return null;

	const blockId = blockIdOf(blockEl);
	if (!blockId) return null;

	const before = blockEl.ownerDocument.createRange();
	before.selectNodeContents(blockEl);
	before.setEnd(range.startContainer, range.startOffset);
	const start = before.toString().length;

	const text = blockEl.textContent ?? '';
	const end = start + exact.length;
	const anchor: NoteAnchor = {
		blockId,
		exact,
		prefix: text.slice(Math.max(0, start - ANCHOR_CONTEXT_CHARS), start),
		suffix: text.slice(end, end + ANCHOR_CONTEXT_CHARS),
	};

	if (blockEl.hasAttribute('data-figure-id')) {
		anchor.figureId = blockId;
		const element = startEl?.closest('[data-element]');
		if (element && blockEl.contains(element)) {
			const value = element.getAttribute('data-element');
			if (value) anchor.element = value;
		}
	}
	return anchor;
};

function occurrences(text: string, needle: string): number[] {
	const found: number[] = [];
	let i = text.indexOf(needle);
	while (i !== -1) {
		found.push(i);
		i = text.indexOf(needle, i + 1);
	}
	return found;
}

function commonSuffixLength(a: string, b: string): number {
	let i = 0;
	while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
	return i;
}

function commonPrefixLength(a: string, b: string): number {
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) i++;
	return i;
}

/** True when the context around `[start, end)` matches the stored prefix and suffix. */
function contextMatches(text: string, start: number, end: number, anchor: NoteAnchor): boolean {
	const before = text.slice(0, start);
	const after = text.slice(end);
	return (
		commonSuffixLength(before, anchor.prefix) === Math.min(anchor.prefix.length, before.length) &&
		commonPrefixLength(after, anchor.suffix) === Math.min(anchor.suffix.length, after.length)
	);
}

/** Share of matching context characters, 0..1. Used to rank several candidates. */
function contextScore(text: string, start: number, end: number, anchor: NoteAnchor): number {
	const total = anchor.prefix.length + anchor.suffix.length;
	if (total === 0) return 0;
	const matched =
		commonSuffixLength(text.slice(0, start), anchor.prefix) +
		commonPrefixLength(text.slice(end), anchor.suffix);
	return matched / total;
}

function bigrams(s: string): Map<string, number> {
	const counts = new Map<string, number>();
	for (let i = 0; i < s.length - 1; i++) {
		const gram = s.slice(i, i + 2);
		counts.set(gram, (counts.get(gram) ?? 0) + 1);
	}
	return counts;
}

/** Dice coefficient over bigram multisets, 0..1. */
export function similarity(a: string, b: string): number {
	if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
	const ca = bigrams(a);
	const cb = bigrams(b);
	let common = 0;
	for (const [gram, count] of ca) common += Math.min(count, cb.get(gram) ?? 0);
	return (2 * common) / (a.length - 1 + (b.length - 1));
}

interface Candidate {
	blockId: string;
	start: number;
	end: number;
	exact: boolean;
	score: number;
	context: number;
}

function isBetter(a: Candidate, b: Candidate | undefined): boolean {
	if (!b) return true;
	if (a.exact !== b.exact) return a.exact;
	if (a.score !== b.score) return a.score > b.score;
	return a.context > b.context;
}

export const resolveAnchor: ResolveAnchor = (anchor, chapter): AnchorResolution => {
	const len = anchor.exact.length;

	const own = chapter.blocks.find((b) => b.id === anchor.blockId);
	if (own) {
		const hit = occurrences(own.text, anchor.exact).find((i) =>
			contextMatches(own.text, i, i + len, anchor),
		);
		if (hit !== undefined) {
			return { status: 'found', range: { blockId: own.id, start: hit, end: hit + len } };
		}
	}

	// Exact quotes anywhere in the chapter win over fuzzy matches.
	let best: Candidate | undefined;
	for (const block of chapter.blocks) {
		for (const start of occurrences(block.text, anchor.exact)) {
			const end = start + len;
			const context = contextScore(block.text, start, end, anchor);
			const candidate: Candidate = {
				blockId: block.id,
				start,
				end,
				exact: true,
				score: 1,
				context,
			};
			if (isBetter(candidate, best)) best = candidate;
		}
	}

	if (!best) {
		for (const block of chapter.blocks) {
			for (let start = 0; start + len <= block.text.length; start++) {
				const end = start + len;
				const score = similarity(block.text.slice(start, end), anchor.exact);
				if (score < FUZZY_THRESHOLD) continue;
				const candidate: Candidate = {
					blockId: block.id,
					start,
					end,
					exact: false,
					score,
					context: contextScore(block.text, start, end, anchor),
				};
				if (isBetter(candidate, best)) best = candidate;
			}
		}
	}

	if (!best) return { status: 'orphaned' };

	const text = chapter.blocks.find((b) => b.id === best.blockId)?.text ?? '';
	const updated: NoteAnchor = {
		...anchor,
		blockId: best.blockId,
		exact: text.slice(best.start, best.end),
		prefix: text.slice(Math.max(0, best.start - ANCHOR_CONTEXT_CHARS), best.start),
		suffix: text.slice(best.end, best.end + ANCHOR_CONTEXT_CHARS),
	};
	return {
		status: 'shifted',
		range: { blockId: best.blockId, start: best.start, end: best.end },
		anchor: updated,
		score: best.score,
	};
};
