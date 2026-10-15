/**
 * Graph helpers for the prerequisite graph. Edges point from the node that must come first.
 */

/** Returns one cycle as a list of node ids (first id repeated at the end), or null. */
export function findCycle(
	nodes: readonly string[],
	edges: readonly { from: string; to: string }[],
): string[] | null {
	const next = new Map<string, string[]>();
	for (const node of nodes) next.set(node, []);
	for (const edge of edges) next.get(edge.from)?.push(edge.to);

	const state = new Map<string, 'open' | 'done'>();
	const path: string[] = [];

	const visit = (node: string): string[] | null => {
		state.set(node, 'open');
		path.push(node);
		for (const target of next.get(node) ?? []) {
			const s = state.get(target);
			if (s === 'open') return [...path.slice(path.indexOf(target)), target];
			if (s === undefined) {
				const found = visit(target);
				if (found) return found;
			}
		}
		path.pop();
		state.set(node, 'done');
		return null;
	};

	for (const node of [...nodes].sort()) {
		if (!state.has(node)) {
			const found = visit(node);
			if (found) return found;
		}
	}
	return null;
}

/**
 * Orders `ids` so that every id comes after its prerequisites (`prereqsOf`).
 * Ties go alphabetically. Ids on a cycle are appended at the end in alphabetical order.
 */
export function topoOrder(
	ids: readonly string[],
	prereqsOf: (id: string) => readonly string[],
): string[] {
	const known = new Set(ids);
	const pending = new Map<string, Set<string>>();
	for (const id of ids) {
		pending.set(id, new Set(prereqsOf(id).filter((p) => known.has(p) && p !== id)));
	}
	const order: string[] = [];
	const placed = new Set<string>();
	while (order.length < ids.length) {
		const ready = ids
			.filter((id) => !placed.has(id) && [...(pending.get(id) ?? [])].every((p) => placed.has(p)))
			.sort();
		if (ready.length === 0) break;
		const first = ready[0] as string;
		order.push(first);
		placed.add(first);
	}
	const rest = ids.filter((id) => !placed.has(id)).sort();
	return [...order, ...rest];
}

/** All ids reachable backwards through `prereqsOf` (the transitive prerequisites of `id`). */
export function transitivePrereqs(
	id: string,
	prereqsOf: (id: string) => readonly string[],
): Set<string> {
	const result = new Set<string>();
	const stack = [...prereqsOf(id)];
	while (stack.length > 0) {
		const current = stack.pop() as string;
		if (result.has(current) || current === id) continue;
		result.add(current);
		stack.push(...prereqsOf(current));
	}
	return result;
}
