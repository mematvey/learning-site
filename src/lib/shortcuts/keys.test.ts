import { describe, expect, it } from 'vitest';
import { detectPlatform, formatKbd } from './keys';

describe('formatKbd', () => {
	it('renders mod as ⌘ on mac and Ctrl on win, in fixed order', () => {
		expect(formatKbd('mod+k', 'mac')).toBe('⌘K');
		expect(formatKbd('mod+k', 'win')).toBe('Ctrl+K');
		expect(formatKbd('mod+shift+backspace', 'mac')).toBe('⌘⇧⌫');
		expect(formatKbd('mod+shift+backspace', 'win')).toBe('Ctrl+Shift+Backspace');
	});

	it('renders key sequences separated by spaces', () => {
		expect(formatKbd('g h', 'win')).toBe('G H');
		expect(formatKbd('g h', 'mac')).toBe('G H');
	});

	it('capitalises single letters and named keys', () => {
		expect(formatKbd('?', 'win')).toBe('?');
		expect(formatKbd('esc', 'mac')).toBe('Esc');
		expect(formatKbd('mod+enter', 'mac')).toBe('⌘↵');
	});
});

describe('detectPlatform', () => {
	it('prefers userAgentData, then platform, then userAgent', () => {
		expect(detectPlatform({ userAgentData: { platform: 'macOS' } })).toBe('mac');
		expect(detectPlatform({ platform: 'Win32' })).toBe('win');
		expect(detectPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17)' })).toBe('mac');
		expect(detectPlatform(undefined)).toBe('win');
	});
});
