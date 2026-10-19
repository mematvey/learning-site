import { isVisibleText } from '$lib/notes/text';
import { parseBlockHash } from './links';

/** CSS class that flashes a block after navigation to its link. Styled in `prose.css`. */
export const BLOCK_FLASH_CLASS = 'block-flash';
/** Name of the CSS Custom Highlight used for the quoted fragment (`::highlight(hash-quote)`). */
export const QUOTE_HIGHLIGHT_NAME = 'hash-quote';
const FLASH_MS = 1600;
/** Breathing room between the sticky site header and the target. */
const HEADER_GAP = 16;

type HighlightRegistry = { set(name: string, value: unknown): void; delete(name: string): void };
type HighlightCtor = new (...ranges: Range[]) => unknown;

function highlightApi(): { registry: HighlightRegistry; Ctor: HighlightCtor } | null {
	const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
	const Ctor = (globalThis as unknown as { Highlight?: HighlightCtor }).Highlight;
	return registry && Ctor ? { registry, Ctor } : null;
}

/** Height of the sticky site header, so the target is not hidden under it. */
function headerOffset(): number {
	return document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().height ?? 0;
}

/**
 * Finds the quote inside the block and marks it with a CSS Custom Highlight (no DOM changes).
 * Matching is exact over reader-visible text (tooltips and MathML copies are skipped); a quote
 * that no longer exists in the text is simply not highlighted.
 */
function highlightQuote(block: HTMLElement, quote: string): void {
	const api = highlightApi();
	if (!api) return;
	const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
	const parts: Array<{ node: Text; start: number }> = [];
	let text = '';
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!isVisibleText(node as Text)) continue;
		parts.push({ node: node as Text, start: text.length });
		text += node.textContent ?? '';
	}
	const index = text.indexOf(quote);
	if (index === -1) return;
	const at = (position: number) => {
		let part = parts[0];
		for (const p of parts) if (p.start <= position) part = p;
		return part ? { node: part.node, offset: position - part.start } : undefined;
	};
	const from = at(index);
	const to = at(index + quote.length);
	if (!from || !to) return;
	const range = document.createRange();
	range.setStart(from.node, from.offset);
	range.setEnd(to.node, to.offset);
	api.registry.set(QUOTE_HIGHLIGHT_NAME, new api.Ctor(range));
}

/**
 * Follows `#block-id` (and `~q=` quote) in the address bar: scrolls to the block below the
 * header, flashes it and highlights the quote. Runs on load and on every `hashchange`.
 * Returns the cleanup function (removes listeners, timers and highlights).
 */
export function scrollToHashTarget(root: HTMLElement): () => void {
	if (typeof window === 'undefined') return () => {};
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let flashed: HTMLElement | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let frame: number | undefined;

	const clearFlash = () => {
		clearTimeout(timer);
		flashed?.classList.remove(BLOCK_FLASH_CLASS);
		flashed = undefined;
	};

	const flash = (block: HTMLElement) => {
		clearFlash();
		// Restart the animation when the same block is targeted twice.
		void block.offsetWidth;
		block.classList.add(BLOCK_FLASH_CLASS);
		flashed = block;
		timer = setTimeout(clearFlash, FLASH_MS);
	};

	const apply = () => {
		const parsed = parseBlockHash(window.location.hash);
		if (!parsed) return;
		const block = document.getElementById(parsed.blockId);
		if (!block || !root.contains(block)) return;

		const top = block.getBoundingClientRect().top + window.scrollY - headerOffset() - HEADER_GAP;
		window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
		flash(block);
		highlightApi()?.registry.delete(QUOTE_HIGHLIGHT_NAME);
		// Formulas and figures are highlighted as a whole block: their quote is TeX or a caption.
		const wholeBlock = block.matches('.math-display') || block.hasAttribute('data-figure-id');
		if (parsed.quote && !wholeBlock) highlightQuote(block, parsed.quote);
	};

	frame = requestAnimationFrame(() => {
		frame = undefined;
		apply();
	});
	window.addEventListener('hashchange', apply);

	return () => {
		if (frame !== undefined) cancelAnimationFrame(frame);
		window.removeEventListener('hashchange', apply);
		clearFlash();
		highlightApi()?.registry.delete(QUOTE_HIGHLIGHT_NAME);
	};
}
