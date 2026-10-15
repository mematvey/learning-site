import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installShortcuts, isEditableTarget } from './index';

function press(
	key: string,
	target: EventTarget = document,
	init: KeyboardEventInit = {},
): KeyboardEvent {
	const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(ev);
	return ev;
}

describe('installShortcuts', () => {
	let uninstall: () => void;
	let toast: (text: string) => void;

	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
		toast = vi.fn<(text: string) => void>();
		uninstall = installShortcuts({ platform: 'win', toast });
	});

	afterEach(() => {
		uninstall();
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('G then H within one second clicks the home link', () => {
		document.body.innerHTML = '<a data-home href="#home">home</a>';
		const home = document.querySelector('a[data-home]') as HTMLAnchorElement;
		const onClick = vi.fn((e: Event) => e.preventDefault());
		home.addEventListener('click', onClick);

		press('g');
		vi.advanceTimersByTime(500);
		press('h');
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('H alone, or G followed too late by H, does nothing', () => {
		document.body.innerHTML = '<a data-home href="#home">home</a>';
		const onClick = vi.fn((e: Event) => e.preventDefault());
		document.querySelector('a[data-home]')!.addEventListener('click', onClick);

		press('h');
		press('g');
		vi.advanceTimersByTime(1500);
		press('h');
		expect(onClick).not.toHaveBeenCalled();
	});

	it('single-letter shortcuts are ignored inside input, textarea and contenteditable', () => {
		document.body.innerHTML =
			'<input id="f" /><textarea id="t"></textarea><div id="c" contenteditable="true"></div>';
		const onClick = vi.fn();
		document.body.insertAdjacentHTML('beforeend', '<button data-theme-toggle>x</button>');
		document.querySelector('[data-theme-toggle]')!.addEventListener('click', onClick);

		for (const id of ['f', 't', 'c']) {
			const ev = press('t', document.getElementById(id)!);
			expect(ev.defaultPrevented).toBe(false);
		}
		expect(onClick).not.toHaveBeenCalled();
	});

	it('modifier combinations are not handled as single letters', () => {
		document.body.innerHTML = '<button data-theme-toggle>x</button>';
		const onClick = vi.fn();
		document.querySelector('[data-theme-toggle]')!.addEventListener('click', onClick);
		press('t', document, { ctrlKey: true });
		expect(onClick).not.toHaveBeenCalled();
	});

	it('forwards ? to onHelp and ignores keys while help is open', () => {
		let open = false;
		const onHelp = vi.fn<() => void>(() => {
			open = true;
		});
		uninstall();
		uninstall = installShortcuts({ platform: 'win', toast, onHelp, isHelpOpen: () => open });

		press('?');
		expect(onHelp).toHaveBeenCalledTimes(1);

		document.body.innerHTML = '<button data-theme-toggle>x</button>';
		const onClick = vi.fn();
		document.querySelector('[data-theme-toggle]')!.addEventListener('click', onClick);
		press('t');
		expect(onClick).not.toHaveBeenCalled();
	});

	it('uninstall removes the listener', () => {
		document.body.innerHTML = '<button data-theme-toggle>x</button>';
		const onClick = vi.fn();
		document.querySelector('[data-theme-toggle]')!.addEventListener('click', onClick);
		uninstall();
		press('t');
		expect(onClick).not.toHaveBeenCalled();
	});

	it('isEditableTarget matches form fields and contenteditable only', () => {
		document.body.innerHTML = '<input id="i" /><div id="d"></div>';
		expect(isEditableTarget(document.getElementById('i'))).toBe(true);
		expect(isEditableTarget(document.getElementById('d'))).toBe(false);
		expect(isEditableTarget(document)).toBe(false);
	});
});
