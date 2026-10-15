/** Class of the `<mark>` elements that wrap a note's quote. */
export const NOTE_HL_CLASS = 'note-hl';

/**
 * Wraps the text of `range` in `<mark class="note-hl">` elements, one per text node, so the
 * surrounding DOM (formulas, inline markup) keeps its structure. Returns the created marks.
 */
export function highlightRange(range: Range): HTMLElement[] {
	// A range inside one text node has the text node as ancestor; a walker needs an element root.
	const ancestor = range.commonAncestorContainer;
	const root = ancestor.nodeType === Node.TEXT_NODE ? (ancestor.parentNode ?? ancestor) : ancestor;
	const doc = root.ownerDocument ?? (root as Document);
	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);

	const pieces: Array<{ node: Text; start: number; end: number }> = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node as Text;
		if (!range.intersectsNode(text) || text.length === 0) continue;
		const start = text === range.startContainer ? range.startOffset : 0;
		const end = text === range.endContainer ? range.endOffset : text.length;
		if (start < end) pieces.push({ node: text, start, end });
	}

	const marks: HTMLElement[] = [];
	for (const { node, start, end } of pieces) {
		// Split from the right so the offsets of the left part stay valid.
		if (end < node.length) node.splitText(end);
		const target = start > 0 ? node.splitText(start) : node;
		const parent = target.parentNode;
		if (!parent) continue;
		const mark = doc.createElement('mark');
		mark.className = NOTE_HL_CLASS;
		parent.insertBefore(mark, target);
		mark.appendChild(target);
		marks.push(mark);
	}
	return marks;
}

/** Removes every note highlight under `root`, restoring the original text nodes. */
export function clearHighlights(root: ParentNode): void {
	const marks = Array.from(root.querySelectorAll(`mark.${NOTE_HL_CLASS}`));
	for (const mark of marks) {
		const parent = mark.parentNode;
		if (!parent) continue;
		while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
		parent.removeChild(mark);
		parent.normalize();
	}
}

/** DOM range over characters `start..end` of the text of `block` (offsets into `textContent`). */
export function rangeInBlock(block: HTMLElement, start: number, end: number): Range | null {
	const doc = block.ownerDocument;
	const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
	const range = doc.createRange();
	let pos = 0;
	let started = false;
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const len = (node as Text).length;
		if (!started && start < pos + len) {
			range.setStart(node, start - pos);
			started = true;
		}
		if (started && end <= pos + len) {
			range.setEnd(node, end - pos);
			return range;
		}
		pos += len;
	}
	return null;
}
