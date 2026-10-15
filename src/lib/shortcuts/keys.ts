/** Keyboard notation: formatting of `mod+k`-style specs for macOS and Windows/Linux. */

export type Platform = 'mac' | 'win';

export interface NavigatorLike {
	userAgentData?: { platform?: string };
	platform?: string;
	userAgent?: string;
}

const SYM_MAC: Record<string, string> = {
	mod: '⌘',
	shift: '⇧',
	alt: '⌥',
	ctrl: '⌃',
	enter: '↵',
	backspace: '⌫',
	esc: 'Esc',
	space: 'Space',
	tab: '⇥',
	up: '↑',
	down: '↓',
	left: '←',
	right: '→',
};

const SYM_WIN: Record<string, string> = {
	mod: 'Ctrl',
	ctrl: 'Ctrl',
	alt: 'Alt',
	shift: 'Shift',
	enter: 'Enter',
	backspace: 'Backspace',
	esc: 'Esc',
	space: 'Space',
	tab: 'Tab',
	up: '↑',
	down: '↓',
	left: '←',
	right: '→',
};

const ORDER_MAC = ['mod', 'shift', 'alt', 'ctrl'];
const ORDER_WIN = ['mod', 'ctrl', 'alt', 'shift'];

/** Platform detection: `userAgentData.platform ?? platform`, falling back to the user agent. */
export function detectPlatform(nav: NavigatorLike | undefined = globalThis.navigator): Platform {
	if (!nav) return 'win';
	const p = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
	return /mac|iphone|ipad|ipod/i.test(p) ? 'mac' : 'win';
}

function keyLabel(key: string, table: Record<string, string>): string {
	const named = table[key];
	if (Object.prototype.hasOwnProperty.call(table, key) && named !== undefined) return named;
	return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * formatKbd('mod+shift+backspace') -> '⌘⇧⌫' (mac) or 'Ctrl+Shift+Backspace' (win).
 * A space separates a key sequence: 'g h' -> 'G H'.
 * Without `platform`, the current platform is detected.
 */
export function formatKbd(spec: string, platform: Platform = detectPlatform()): string {
	const win = platform === 'win';
	const table = win ? SYM_WIN : SYM_MAC;
	const order = win ? ORDER_WIN : ORDER_MAC;
	return String(spec)
		.trim()
		.split(/\s+/)
		.map((chord) => {
			const parts = chord.toLowerCase().split('+');
			const key = parts.pop() ?? '';
			const labels = order
				.filter((m) => parts.includes(m))
				.map((m) => table[m])
				.filter((l, i, arr) => arr.indexOf(l) === i);
			const k = keyLabel(key, table);
			return win ? [...labels, k].join('+') : labels.join('') + k;
		})
		.join(' ');
}
