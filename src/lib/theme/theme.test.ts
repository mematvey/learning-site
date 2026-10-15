import { afterEach, describe, expect, it } from 'vitest';
import {
	THEME_INIT_SCRIPT,
	THEME_STORAGE_KEY,
	applyTheme,
	readStoredTheme,
	resolveTheme,
	toggleTheme,
	writeStoredTheme,
	type ThemeStorage,
} from './theme';

function memoryStorage(initial: Record<string, string> = {}): ThemeStorage & {
	data: Record<string, string>;
} {
	const data = { ...initial };
	return {
		data,
		getItem: (key) => data[key] ?? null,
		setItem: (key, value) => {
			data[key] = value;
		},
	};
}

const throwingStorage: ThemeStorage = {
	getItem: () => {
		throw new Error('denied');
	},
	setItem: () => {
		throw new Error('denied');
	},
};

type MatchMediaStub = (query: string) => { matches: boolean };

function stubMatchMedia(dark: boolean): void {
	const stub: MatchMediaStub = () => ({ matches: dark });
	(window as unknown as { matchMedia: MatchMediaStub }).matchMedia = stub;
}

afterEach(() => {
	delete (window as unknown as { matchMedia?: MatchMediaStub }).matchMedia;
	document.documentElement.removeAttribute('data-theme');
	localStorage.clear();
});

describe('theme choice', () => {
	it('resolves system choice from the OS preference', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});

	it('toggles the resolved theme', () => {
		expect(toggleTheme('light')).toBe('dark');
		expect(toggleTheme('dark')).toBe('light');
	});

	it('reads a valid saved choice and falls back to system', () => {
		expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
		expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: 'nope' }))).toBe('system');
		expect(readStoredTheme(memoryStorage())).toBe('system');
		expect(readStoredTheme(throwingStorage)).toBe('system');
		expect(readStoredTheme(undefined)).toBe('system');
	});

	it('writes the choice and reports storage failures', () => {
		const storage = memoryStorage();
		expect(writeStoredTheme('light', storage)).toBe(true);
		expect(storage.data[THEME_STORAGE_KEY]).toBe('light');
		expect(writeStoredTheme('dark', throwingStorage)).toBe(false);
		// Without an argument the default is the global localStorage.
		expect(writeStoredTheme('dark')).toBe(true);
		expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
	});
});

describe('applyTheme', () => {
	it('sets data-theme on the root element', () => {
		applyTheme('dark');
		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
		applyTheme('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});
});

describe('THEME_INIT_SCRIPT', () => {
	const run = () => new Function(THEME_INIT_SCRIPT)();

	it('applies the saved explicit choice', () => {
		stubMatchMedia(true);
		localStorage.setItem(THEME_STORAGE_KEY, 'light');
		run();
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});

	it('follows the system preference when nothing valid is saved', () => {
		stubMatchMedia(true);
		run();
		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
		localStorage.setItem(THEME_STORAGE_KEY, 'garbage');
		stubMatchMedia(false);
		run();
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});

	it('does not throw without matchMedia or storage', () => {
		expect(() => run()).not.toThrow();
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});
});
