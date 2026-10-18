/**
 * Reader-visible text of chapter DOM. KaTeX renders each formula twice: the visible glyphs and
 * a visually hidden MathML copy (`.katex-mathml`, with the TeX source in an annotation). The
 * MathML copy is not text the reader sees, so offsets for anchors and highlights skip it.
 */

const HIDDEN_TEXT_SELECTOR = '.katex-mathml';

/** True for a text node a reader sees (not part of a formula's MathML copy). */
export function isVisibleText(node: Text): boolean {
	return !node.parentElement?.closest(HIDDEN_TEXT_SELECTOR);
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
