import {
	ANCHOR_CONTEXT_CHARS,
	type AnchorFromSelection,
	type AnchorResolution,
	type ChapterTextIndex,
	type NoteAnchor,
	type ResolveAnchor,
} from '$lib/contracts';
import { visibleOffset, visibleText } from './text';

/** Elements that carry a block id: paragraphs, headings, list items (`data-block`) and figures. */
const BLOCK_SELECTOR = '[data-block], [data-figure-id]';

/** Minimal similarity (Dice over bigrams) for a fuzzy match of a moved quote. */
export const FUZZY_THRESHOLD = 0.8;

/** A fuzzy match may be this share shorter or longer than the quote. */
const FUZZY_LENGTH_SPREAD = 0.2;

/** Fuzzy results kept for repeated resolutions of the same quote in the same text. */
const FUZZY_CACHE_LIMIT = 16;

function blockIdOf(el: Element): string {
	return el.getAttribute('data-figure-id') ?? el.id;
}

/** Plain-text view of a chapter. Hidden layers stay in the DOM, so they are included. */
export function chapterTextIndex(root: HTMLElement): ChapterTextIndex {
	const blocks: ChapterTextIndex['blocks'] = [];
	for (const el of root.querySelectorAll(BLOCK_SELECTOR)) {
		const id = blockIdOf(el);
		if (id) blocks.push({ id, text: visibleText(el) });
	}
	return { blocks };
}

export const anchorFromSelection: AnchorFromSelection = (selection, root) => {
	if (selection.rangeCount === 0 || selection.isCollapsed) return null;
	if (selection.toString().trim() === '') return null;

	const range = selection.getRangeAt(0);
	const startNode = range.startContainer;
	const startEl = startNode instanceof Element ? startNode : startNode.parentElement;
	const blockEl = startEl?.closest(BLOCK_SELECTOR);
	if (!blockEl || !root.contains(blockEl)) return null;
	// The quote must sit inside one block; cross-block selections have no single anchor.
	if (!blockEl.contains(range.endContainer)) return null;

	const blockId = blockIdOf(blockEl);
	if (!blockId) return null;

	// Offsets count reader-visible text only, the same text `chapterTextIndex` uses.
	const start = visibleOffset(blockEl, range.startContainer, range.startOffset);
	const end = visibleOffset(blockEl, range.endContainer, range.endOffset);
	const text = visibleText(blockEl);
	const exact = text.slice(start, end);
	if (exact.trim() === '' || end <= start) return null;

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

/** Dice coefficient of `s` against precomputed bigram counts of a target of length `targetLen`. */
function diceAgainst(target: Map<string, number>, targetLen: number, s: string): number {
	if (s.length < 2) return 0;
	const counts = bigrams(s);
	let common = 0;
	for (const [gram, count] of counts) common += Math.min(count, target.get(gram) ?? 0);
	return (2 * common) / (targetLen - 1 + (s.length - 1));
}

/** Dice coefficient over bigram multisets, 0..1. */
export function similarity(a: string, b: string): number {
	if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
	return diceAgainst(bigrams(a), a.length, b);
}

interface FuzzyHit {
	blockId: string;
	start: number;
	end: number;
	score: number;
}

/**
 * Every window at or above the threshold, in all blocks of the chapter. Window lengths vary by
 * `FUZZY_LENGTH_SPREAD` around the quote's length, so a quote edited by a few words still matches.
 */
function computeFuzzyHits(exact: string, blocks: ChapterTextIndex['blocks']): FuzzyHit[] {
	const len = exact.length;
	if (len < 2) return [];
	const target = bigrams(exact);
	const minLen = Math.max(2, Math.floor(len * (1 - FUZZY_LENGTH_SPREAD)));
	const maxLen = Math.ceil(len * (1 + FUZZY_LENGTH_SPREAD));
	const hits: FuzzyHit[] = [];
	for (const block of blocks) {
		const text = block.text;
		for (let width = minLen; width <= maxLen; width++) {
			for (let start = 0; start + width <= text.length; start++) {
				const end = start + width;
				const score = diceAgainst(target, len, text.slice(start, end));
				if (score >= FUZZY_THRESHOLD) hits.push({ blockId: block.id, start, end, score });
			}
		}
	}
	return hits;
}

const fuzzyCache = new Map<string, FuzzyHit[]>();

/** Fuzzy hits for a quote in a chapter text. Cached: the same chapter is resolved on every change. */
function fuzzyHits(exact: string, chapter: ChapterTextIndex): FuzzyHit[] {
	const fingerprint = chapter.blocks.map((b) => `${b.id}\u0001${b.text}`).join('\u0002');
	const key = `${exact}\u0000${fingerprint}`;
	const cached = fuzzyCache.get(key);
	if (cached) return cached;
	const hits = computeFuzzyHits(exact, chapter.blocks);
	fuzzyCache.set(key, hits);
	if (fuzzyCache.size > FUZZY_CACHE_LIMIT) {
		const oldest = fuzzyCache.keys().next();
		if (!oldest.done) fuzzyCache.delete(oldest.value);
	}
	return hits;
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

/**
 * Resolution order: the quote inside its own block (checked with prefix and suffix); then an
 * exact quote elsewhere in the chapter; then a fuzzy match; else orphaned. A `shifted` result
 * in another block than the note's is a move (`isMoved` in `reanchor.ts`).
 */
export const resolveAnchor: ResolveAnchor = (anchor, chapter): AnchorResolution => {
	const len = anchor.exact.length;
	const texts = new Map(chapter.blocks.map((b) => [b.id, b.text]));

	const own = chapter.blocks.find((b) => b.id === anchor.blockId);
	if (own) {
		const hit = occurrences(own.text, anchor.exact).find((i) =>
			contextMatches(own.text, i, i + len, anchor),
		);
		if (hit !== undefined) {
			return { status: 'found', range: { blockId: own.id, start: hit, end: hit + len } };
		}
	}

	let best: Candidate | undefined;
	for (const block of chapter.blocks) {
		for (const start of occurrences(block.text, anchor.exact)) {
			const end = start + len;
			const candidate: Candidate = {
				blockId: block.id,
				start,
				end,
				exact: true,
				score: 1,
				context: contextScore(block.text, start, end, anchor),
			};
			if (isBetter(candidate, best)) best = candidate;
		}
	}

	if (!best) {
		for (const hit of fuzzyHits(anchor.exact, chapter)) {
			const text = texts.get(hit.blockId) ?? '';
			const candidate: Candidate = {
				...hit,
				exact: false,
				context: contextScore(text, hit.start, hit.end, anchor),
			};
			if (isBetter(candidate, best)) best = candidate;
		}
	}

	if (!best) return { status: 'orphaned' };

	const text = texts.get(best.blockId) ?? '';
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
