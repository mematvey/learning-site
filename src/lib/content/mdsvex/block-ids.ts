import { location, type MdNode, type PluginFile, walk } from './tree.ts';

/** Block ids are kebab-case: lowercase latin letters, digits and single dashes. */
export const BLOCK_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Trailing `{#id}` marker at the end of a text node. */
const MARKER_RE = /\s*\{#([^{}\s]*)\}\s*$/;

/** Returns the id or throws a build error with file and line. */
export function checkBlockId(id: string, node: MdNode, file: PluginFile): string {
	if (!BLOCK_ID_RE.test(id)) {
		throw new Error(
			`${location(file, node)}: неверный id блока «${id}»: нужен kebab-case ` +
				`(строчные латинские буквы, цифры и дефисы, например «attention-scale»)`,
		);
	}
	return id;
}

/**
 * Turns a trailing `{#id}` on a paragraph, heading or list item into
 * `id` + `data-block` on the rendered element. List items get the id on `<li>`
 * (tight lists drop `<p>`, so the marker is moved up to the item).
 */
export function remarkBlockIds() {
	return (tree: MdNode, file: PluginFile) => {
		walk(tree, (node, parent) => {
			if (node.type !== 'paragraph' && node.type !== 'heading') return;
			const children = node.children ?? [];
			const last = children[children.length - 1];
			if (!last || last.type !== 'text' || typeof last.value !== 'string') return;

			const match = MARKER_RE.exec(last.value);
			if (!match) return;

			const id = checkBlockId(match[1] ?? '', node, file);
			last.value = last.value.slice(0, match.index);
			if (last.value === '') children.pop();

			const target = node.type === 'paragraph' && parent?.type === 'listItem' ? parent : node;
			target.data = {
				...target.data,
				hProperties: { id, 'data-block': 'true' },
			};
		});
	};
}
