import type { MdNode } from './tree';

function headingId(node: MdNode): string | undefined {
	const props = node.data?.hProperties as { id?: unknown } | undefined;
	return typeof props?.id === 'string' ? props.id : undefined;
}

/**
 * Wraps each `##` heading and the content up to the next one in `<section class="sec">`
 * (the structure that `prose.css` styles). The id stays on the heading, where notes, the
 * table of contents and reading progress look for it; the section points to it with
 * `aria-labelledby`. Runs after `remarkBlockIds`.
 */
export function remarkSections() {
	return (tree: MdNode) => {
		const children = tree.children ?? [];
		const out: MdNode[] = [];
		let open = false;
		for (const node of children) {
			if (node.type === 'heading' && node.depth === 2) {
				if (open) out.push({ type: 'html', value: '</section>' });
				const id = headingId(node);
				const label = id ? ` aria-labelledby="${id}"` : '';
				out.push({ type: 'html', value: `<section class="sec"${label}>` });
				open = true;
			}
			out.push(node);
		}
		if (open) out.push({ type: 'html', value: '</section>' });
		tree.children = out;
	};
}
