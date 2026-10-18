/** Longest quote kept in a link. Longer fragments are cut; the target block still matches. */
export const QUOTE_MAX_CHARS = 80;

/** Separates the block id from the quote inside the hash: `#block-id~q=<encoded quote>`. */
const QUOTE_SEPARATOR = '~q=';

/**
 * Site-relative link to a block of a chapter: `/<topic>/<slug>#<blockId>`, optionally with a
 * quote (the first 80 characters, percent-encoded) to highlight inside the block.
 * Pass the result through `resolve()` in components, like the other hrefs.
 */
export function chapterBlockHref(chapterId: string, blockId?: string, quote?: string): string {
	const base = `/${chapterId}`;
	if (!blockId) return base;
	const fragment = `#${blockId}`;
	if (!quote) return `${base}${fragment}`;
	const cut = Array.from(quote).slice(0, QUOTE_MAX_CHARS).join('');
	return `${base}${fragment}${QUOTE_SEPARATOR}${encodeURIComponent(cut)}`;
}

/**
 * Parses `location.hash` (with or without the leading `#`). Returns `null` when the hash does
 * not point to a block: empty, a malformed percent-encoding or an empty block id.
 */
export function parseBlockHash(hash: string): { blockId: string; quote?: string } | null {
	const raw = hash.startsWith('#') ? hash.slice(1) : hash;
	const at = raw.indexOf(QUOTE_SEPARATOR);
	const idPart = at === -1 ? raw : raw.slice(0, at);
	const quotePart = at === -1 ? undefined : raw.slice(at + QUOTE_SEPARATOR.length);
	try {
		const blockId = decodeURIComponent(idPart);
		if (blockId === '') return null;
		if (quotePart === undefined) return { blockId };
		const quote = decodeURIComponent(quotePart);
		return quote === '' ? { blockId } : { blockId, quote };
	} catch {
		return null;
	}
}
