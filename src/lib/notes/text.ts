/**
 * Reader-visible text of chapter DOM. Some elements carry text that is in the DOM but not read
 * as the page's text, and offsets for anchors, highlights and bookmark quotes skip it:
 * - KaTeX renders each formula twice: visible glyphs and a visually hidden MathML copy
 *   (`.katex-mathml`, with the TeX source in an annotation);
 * - glossary terms keep their tooltip (`role="tooltip"`) inside the term;
 * - `.sr-only` and `aria-hidden="true"` content is not part of the page text.
 * KaTeX marks its visible glyphs `aria-hidden` too, so `aria-hidden` inside a formula counts as visible.
 * The `hidden` attribute is not excluded: `<Level>` layers that are switched off stay in the chapter
 * text, so notes anchored there still resolve (see `chapterTextIndex`).
 */

const ALWAYS_HIDDEN_SELECTOR = '.katex-mathml, .sr-only, [role="tooltip"], .term-tip';
const ARIA_HIDDEN_SELECTOR = '[aria-hidden="true"]';

/** True when the element itself or an ancestor is hidden from the reader. */
export function isHiddenElement(el: Element | null): boolean {
	if (!el) return false;
	if (el.closest(ALWAYS_HIDDEN_SELECTOR)) return true;
	const ariaHidden = el.closest(ARIA_HIDDEN_SELECTOR);
	return ariaHidden !== null && ariaHidden.closest('.katex') === null;
}

/** True for a text node a reader sees (not a tooltip, MathML copy or other hidden content). */
export function isVisibleText(node: Text): boolean {
	return !isHiddenElement(node.parentElement);
}

/** Visible text nodes under `root`, in document order. */
export function visibleTextNodes(root: Node): Text[] {
	const doc = root.ownerDocument ?? (root as Document);
	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const out: Text[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node as Text;
		if (isVisibleText(text)) out.push(text);
	}
	return out;
}

/** Visible text of `root`. Offsets used by anchors refer to this string. */
export function visibleText(root: Node): string {
	return visibleTextNodes(root)
		.map((node) => node.data)
		.join('');
}

/**
 * Offset in `visibleText(block)` of the DOM boundary point (`node`, `offset`).
 * Works for a point in a text node (offset in characters) or in an element (child index).
 */
export function visibleOffset(block: Element, node: Node, offset: number): number {
	const doc = block.ownerDocument;
	const point = doc.createRange();
	point.setStart(node, offset);
	point.collapse(true);
	let pos = 0;
	for (const text of visibleTextNodes(block)) {
		if (text === node) return pos + offset;
		// A text node that starts at or after the point ends the count.
		if (point.comparePoint(text, 0) >= 0) return pos;
		pos += text.length;
	}
	return pos;
}
