import type { Theme } from '$lib/contracts/progress';

/** Theme actually applied to the page. */
export type ResolvedTheme = 'light' | 'dark';

/** localStorage key for the saved theme choice. */
export const THEME_STORAGE_KEY = 'learning-site:theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Minimal storage surface, so tests can pass a fake. */
export interface ThemeStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

function isTheme(value: unknown): value is Theme {
	return value === 'light' || value === 'dark' || value === 'system';
}

function defaultStorage(): ThemeStorage | undefined {
	try {
		return typeof localStorage === 'undefined' ? undefined : localStorage;
	} catch {
		// Access can throw in sandboxed or private contexts.
		return undefined;
	}
}

/** Saved choice; `system` when nothing valid is saved or storage is unavailable. */
export function readStoredTheme(storage: ThemeStorage | undefined = defaultStorage()): Theme {
	try {
		const value = storage?.getItem(THEME_STORAGE_KEY);
		return isTheme(value) ? value : 'system';
	} catch {
		return 'system';
	}
}

/** Saves the choice. Returns `false` when storage is unavailable. */
export function writeStoredTheme(
	theme: Theme,
	storage: ThemeStorage | undefined = defaultStorage(),
): boolean {
	try {
		storage?.setItem(THEME_STORAGE_KEY, theme);
		return storage !== undefined;
	} catch {
		return false;
	}
}

/** Maps the saved choice (`light | dark | system`) to the applied theme. */
export function resolveTheme(theme: Theme, systemDark: boolean): ResolvedTheme {
	if (theme === 'system') return systemDark ? 'dark' : 'light';
	return theme;
}

/** The theme the toggle switches to. */
export function toggleTheme(current: ResolvedTheme): ResolvedTheme {
	return current === 'dark' ? 'light' : 'dark';
}

/** Current `prefers-color-scheme: dark` value; `false` without `matchMedia`. */
export function systemPrefersDark(): boolean {
	try {
		return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
	} catch {
		return false;
	}
}

/**
 * Calls `onChange` immediately and on every system scheme change.
 * Returns the cleanup function.
 */
export function watchSystemDark(onChange: (dark: boolean) => void): () => void {
	onChange(systemPrefersDark());
	if (typeof matchMedia !== 'function') return () => {};
	let query: MediaQueryList;
	try {
		query = matchMedia(DARK_QUERY);
	} catch {
		return () => {};
	}
	const handler = (event: MediaQueryListEvent) => onChange(event.matches);
	query.addEventListener('change', handler);
	return () => query.removeEventListener('change', handler);
}

/** Sets `data-theme` on the root element. */
export function applyTheme(
	theme: ResolvedTheme,
	root: HTMLElement = document.documentElement,
): void {
	root.setAttribute('data-theme', theme);
}

/** Sets `data-topic` on the root element; `undefined` removes it. */
export function applyTopic(
	topic: string | undefined,
	root: HTMLElement = document.documentElement,
): void {
	if (topic === undefined) root.removeAttribute('data-topic');
	else root.setAttribute('data-topic', topic);
}

/**
 * Inline script for `app.html`: sets `data-theme` before first paint.
 * Self-contained (no imports); every access is wrapped in try/catch.
 */
export const THEME_INIT_SCRIPT = `(function () {
	var saved = null;
	try { saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch (e) {}
	var system = false;
	try { system = window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches; } catch (e) {}
	var dark = saved === 'dark' || (saved !== 'light' && system);
	document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();`;
