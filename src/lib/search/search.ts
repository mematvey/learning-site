/**
 * Pure search helpers: no DOM, no Pagefind import, so they are unit-testable.
 */

/** Minimal shape of a Pagefind result data record that the UI uses. */
export interface PagefindRawData {
	url: string;
	excerpt: string;
	meta?: { title?: string };
	filters?: Record<string, string[]>;
}

/** A search hit ready for rendering. */
export interface SearchHit {
	url: string;
	title: string;
	/** Escaped HTML; the only tag allowed is `<mark>`. */
	excerptHtml: string;
	/** Level label taken from the `level` filter, e.g. «Формально». Empty when the page has none. */
	levelLabel: string;
}

/** Name of the Pagefind filter that carries the level label on pages. */
export const LEVEL_FILTER = 'level';

const MARK_OPEN = '\u0000mark-open\u0000';
const MARK_CLOSE = '\u0000mark-close\u0000';

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Pagefind returns an excerpt with `<mark>` around matches. Everything else is
 * escaped, so the result is safe for `{@html}`. Only `<mark>` survives.
 */
export function sanitizeExcerpt(raw: string): string {
	const marked = raw.replace(/<mark>/g, MARK_OPEN).replace(/<\/mark>/g, MARK_CLOSE);
	return escapeHtml(marked).replaceAll(MARK_OPEN, '<mark>').replaceAll(MARK_CLOSE, '</mark>');
}

/** Turns a raw Pagefind record into a render-ready hit. */
export function toSearchHit(raw: PagefindRawData, base = ''): SearchHit {
	return {
		url: withBase(raw.url, base),
		title: raw.meta?.title?.trim() || raw.url,
		excerptHtml: sanitizeExcerpt(raw.excerpt),
		levelLabel: raw.filters?.[LEVEL_FILTER]?.[0] ?? '',
	};
}

/**
 * Pagefind stores URLs relative to the built site root (`/dl/attention.html`).
 * Prepends the deployment base path (`/learning-site`) unless it is already there.
 */
export function withBase(url: string, base: string): string {
	const trimmed = base.replace(/\/+$/, '');
	if (!trimmed || url === trimmed || url.startsWith(trimmed + '/')) return url;
	return trimmed + (url.startsWith('/') ? url : '/' + url);
}

/** Trailing-edge debounce. `cancel()` drops a pending call. */
export function debounce<A extends unknown[]>(
	fn: (...args: A) => void,
	ms: number,
): ((...args: A) => void) & { cancel: () => void } {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const wrapped = (...args: A) => {
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			fn(...args);
		}, ms);
	};
	wrapped.cancel = () => {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
	};
	return wrapped;
}

/** Index of the next highlighted item for ArrowDown/ArrowUp, wrapping around. */
export function nextIndex(current: number, delta: 1 | -1, length: number): number {
	if (length <= 0) return -1;
	if (current < 0) return delta === 1 ? 0 : length - 1;
	return (current + delta + length) % length;
}
