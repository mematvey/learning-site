/** Short status toast at the bottom of the page («Тема: тёмная»). Markup and styles: `.kbd-toast` in ShortcutsHelp. */

const TOAST_MS = 1500;

let el: HTMLDivElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string): void {
	if (typeof document === 'undefined') return;
	if (!el) {
		el = document.createElement('div');
		el.className = 'kbd-toast';
		el.setAttribute('role', 'status');
		el.setAttribute('aria-live', 'polite');
		document.body.appendChild(el);
	}
	el.textContent = text;
	el.classList.add('is-on');
	clearTimeout(timer);
	timer = setTimeout(() => el?.classList.remove('is-on'), TOAST_MS);
}
