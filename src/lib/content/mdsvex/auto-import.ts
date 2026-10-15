import { type MdNode, walk } from './tree';

/** Component tag name → import path under `$lib/components/`. */
export const COMPONENT_IMPORTS: Record<string, string> = {
	Level: 'Level.svelte',
	Variant: 'Variant.svelte',
	Term: 'Term.svelte',
	Ref: 'Ref.svelte',
	DemoLink: 'DemoLink.svelte',
	Figure: 'Figure.svelte',
	Callout: 'Callout.svelte',
	Aside: 'Aside.svelte',
	StepCards: 'StepCards.svelte',
	Quiz: 'Quiz.svelte',
	Cite: 'Cite.svelte',
	CodeLab: 'CodeLab.svelte',
	AttentionDemo: 'demos/AttentionDemo.svelte',
};

const SCRIPT_OPEN_RE = /<script(?:\s[^>]*)?>/;

/** Names of known components that occur as tags in raw html nodes. */
function usedComponents(tree: MdNode): Set<string> {
	const used = new Set<string>();
	walk(tree, (node) => {
		// Inline tags with Svelte-style attributes (`state={{ a: 1 }}`) are not valid HTML for the
		// markdown parser and stay in text nodes, so both node types are scanned.
		if ((node.type !== 'html' && node.type !== 'text') || typeof node.value !== 'string') return;
		for (const name of Object.keys(COMPONENT_IMPORTS)) {
			if (new RegExp(`<${name}(?=[\\s/>])`).test(node.value)) used.add(name);
		}
	});
	return used;
}

/**
 * Adds `import X from '$lib/components/...'` for every known component used in the page.
 * Extends an existing top-level `<script>` (no duplicate imports), or creates one.
 */
export function remarkAutoImport() {
	return (tree: MdNode) => {
		const used = usedComponents(tree);
		if (used.size === 0) return;

		const children = tree.children ?? [];
		const script = children.find(
			(child) =>
				child.type === 'html' &&
				typeof child.value === 'string' &&
				SCRIPT_OPEN_RE.test(child.value) &&
				!/context\s*=\s*["']?module/.test(child.value),
		);
		const existing = script && typeof script.value === 'string' ? script.value : '';

		const lines: string[] = [];
		for (const name of used) {
			// Skip components the author already imports or references in <script>.
			if (new RegExp(`\\b${name}\\b`).test(existing)) continue;
			const path = COMPONENT_IMPORTS[name];
			lines.push(`import ${name} from '$lib/components/${path}';`);
		}
		if (lines.length === 0) return;

		if (script && typeof script.value === 'string') {
			script.value = script.value.replace(SCRIPT_OPEN_RE, (open) => `${open}\n${lines.join('\n')}`);
		} else {
			children.unshift({
				type: 'html',
				value: `<script>\n${lines.join('\n')}\n</script>`,
			});
		}
		tree.children = children;
	};
}
