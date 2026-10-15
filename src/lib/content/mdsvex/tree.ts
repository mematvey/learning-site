// Minimal mdast/hast node shape used by the pipeline plugins.
// Kept local on purpose: @types/mdast is not a direct dependency of this project.
export interface MdNode {
	type: string;
	value?: string;
	children?: MdNode[];
	position?: { start: { line: number }; end: { line: number } };
	data?: Record<string, unknown>;
	[key: string]: unknown;
}

// Minimal vfile shape: only the path is needed for error messages.
export interface PluginFile {
	path?: string;
	filename?: string;
}

/** Depth-first walk. `fn` runs on a node before its children are visited. */
export function walk(
	node: MdNode,
	fn: (node: MdNode, parent: MdNode | undefined) => void,
	parent?: MdNode,
): void {
	fn(node, parent);
	for (const child of node.children ?? []) walk(child, fn, node);
}

/** `file.path:line` prefix for build errors. */
export function location(file: PluginFile, node: MdNode): string {
	const line = node.position?.start.line ?? '?';
	const path = file.path ?? file.filename ?? '<input>';
	return `${path}:${line}`;
}
