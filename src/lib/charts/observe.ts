import type { Theme } from './colors';

/**
 * Svelte action: reports the element's content width and keeps reporting it on resize.
 * Calls `onSize` once synchronously when the element is measurable.
 */
export function observeSize(
	node: HTMLElement,
	onSize: (width: number) => void,
): { update(next: (width: number) => void): void; destroy(): void } {
	let cb = onSize;
	const report = () => {
		const w = Math.floor(node.clientWidth);
		if (w > 0) cb(w);
	};
	report();
	if (typeof ResizeObserver === 'undefined') {
		return { update: (next) => (cb = next), destroy: () => {} };
	}
	const ro = new ResizeObserver(report);
	ro.observe(node);
	return {
		update: (next) => (cb = next),
		destroy: () => ro.disconnect(),
	};
}

/** Current theme from `data-theme` on `<html>`, falling back to the OS preference. */
export function currentTheme(): Theme {
	if (typeof document === 'undefined') return 'light';
	const attr = document.documentElement.dataset.theme;
	if (attr === 'dark' || attr === 'light') return attr;
	return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light';
}

/** Calls `cb` with the theme whenever `data-theme` changes. Returns the unsubscribe function. */
export function watchTheme(cb: (theme: Theme) => void): () => void {
	if (typeof MutationObserver === 'undefined') return () => {};
	const mo = new MutationObserver(() => cb(currentTheme()));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	return () => mo.disconnect();
}

let counter = 0;

/** Unique id for `<title>`/`<desc>` references. */
export function uid(prefix = 'chart'): string {
	counter += 1;
	return `${prefix}-${counter}`;
}
