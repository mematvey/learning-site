import katex from 'katex';

/** Svelte action: renders `source` with KaTeX into the node; hides the node when there is no formula. */
export function tex(node: HTMLElement, source: string | undefined) {
	let current: string | undefined;

	const draw = (src: string | undefined): void => {
		current = src;
		node.textContent = '';
		node.hidden = !src;
		if (!src) return;
		try {
			katex.render(src, node, { throwOnError: false, displayMode: true, strict: 'ignore' });
		} catch {
			node.textContent = src;
		}
	};

	draw(source);
	return {
		update(next: string | undefined) {
			if (next !== current) draw(next);
		},
	};
}
