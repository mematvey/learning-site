import { HEAD_OFFSET, SEQUENCE_WINDOW_MS, TARGET } from './table';
import { showToast } from './toast';
import { detectPlatform, type Platform } from './keys';

export { formatKbd, detectPlatform, type Platform } from './keys';
export { SHORTCUT_GROUPS } from './table';
export { showToast } from './toast';

export interface ShortcutOptions {
	/** Notation for mod-keys. Default: detected platform. */
	platform?: Platform;
	/** Called on `?`. The help window itself is owned by ShortcutsHelp. */
	onHelp?: () => void;
	/** While true, single-letter shortcuts are ignored (e.g. the help window is open). */
	isHelpOpen?: () => boolean;
	/** Status messages. Default: built-in toast. */
	toast?: (text: string) => void;
}

/** Single-letter shortcuts must not fire while the user types. */
export function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	return target.matches(
		'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
	);
}

function clickEl(selector: string): boolean {
	const el = document.querySelector<HTMLElement>(selector);
	if (!el) return false;
	el.click();
	return true;
}

function focusSearch(): boolean {
	const el = document.querySelector<HTMLElement & { select?: () => void }>(TARGET.search);
	if (!el) return false;
	// A search field is focused; the header search button opens the search dialog.
	if (el instanceof HTMLButtonElement) el.click();
	else {
		el.focus();
		el.select?.();
	}
	return true;
}

function sectionTitle(sec: Element): string {
	const h = sec.matches('h1, h2, h3') ? sec : sec.querySelector('h1, h2, h3');
	return h?.textContent?.trim() || sec.id;
}

function jumpSection(dir: 1 | -1, toast: (t: string) => void): void {
	const secs = Array.from(document.querySelectorAll<HTMLElement>(TARGET.section));
	if (!secs.length) return;
	let cur = -1;
	secs.forEach((s, i) => {
		if (s.getBoundingClientRect().top <= HEAD_OFFSET + 8) cur = i;
	});
	const target = dir > 0 ? secs[cur + 1] : secs[cur > 0 ? cur - 1 : 0];
	if (!target) return;
	const top = window.scrollY + target.getBoundingClientRect().top - HEAD_OFFSET;
	const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
	toast('Раздел: ' + sectionTitle(target));
}

/**
 * Installs the global keyboard handler. Returns the uninstall function.
 * Shortcuts act only through data attributes on the page.
 */
export function installShortcuts(options: ShortcutOptions = {}): () => void {
	const platform = options.platform ?? detectPlatform();
	const isMac = platform === 'mac';
	const toast = options.toast ?? showToast;
	let gUntil = 0;

	function toggleTheme(): void {
		if (!clickEl(TARGET.themeToggle)) return;
		setTimeout(() => {
			const dark = document.documentElement.getAttribute('data-theme') === 'dark';
			toast('Тема: ' + (dark ? 'тёмная' : 'светлая'));
		}, 0);
	}

	function onKeyDown(e: KeyboardEvent): void {
		const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

		if (options.isHelpOpen?.()) return;

		// Mod+K also works inside input fields.
		const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
		if (mod && !e.altKey && key === 'k') {
			if (focusSearch()) e.preventDefault();
			return;
		}

		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (isEditableTarget(e.target)) return;

		if (e.key === '/') {
			if (focusSearch()) e.preventDefault();
			return;
		}
		if (e.key === '?') {
			e.preventDefault();
			options.onHelp?.();
			return;
		}

		// G then H within one second: go home.
		if (key === 'g') {
			gUntil = Date.now() + SEQUENCE_WINDOW_MS;
			return;
		}
		if (key === 'h' && Date.now() < gUntil) {
			gUntil = 0;
			if (clickEl(TARGET.home)) e.preventDefault();
			return;
		}
		gUntil = 0;

		let handled = true;
		switch (key) {
			case 't':
				toggleTheme();
				break;
			case 'l':
				clickEl(TARGET.levelsToggle);
				break;
			case '[':
				clickEl(TARGET.prev);
				break;
			case ']':
				clickEl(TARGET.next);
				break;
			case 'n':
				clickEl(TARGET.noteButton);
				break;
			case 'm':
				clickEl(TARGET.markDone);
				break;
			case 'j':
				jumpSection(1, toast);
				break;
			case 'k':
				jumpSection(-1, toast);
				break;
			default:
				handled = false;
		}
		if (handled) e.preventDefault();
	}

	document.addEventListener('keydown', onKeyDown);
	return () => document.removeEventListener('keydown', onKeyDown);
}
