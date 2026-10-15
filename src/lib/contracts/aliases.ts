import { z } from 'zod';
import { ChapterId } from './ids';

/** `data/aliases.yaml`: `old-id: new-id`. Applied to links, progress, notes and URLs. */
export const AliasesFile = z
	.record(ChapterId, ChapterId)
	.refine(
		(map) => Object.keys(map).every((old) => map[old] !== old),
		'alias must not point to itself',
	);
export type AliasesFile = z.infer<typeof AliasesFile>;

/** Follows the alias chain to the canonical id (cycle-safe: stops after the map size). */
export function resolveAlias(id: ChapterId, aliases: AliasesFile): ChapterId {
	let current = id;
	for (let i = 0; i <= Object.keys(aliases).length; i++) {
		const next = aliases[current];
		if (next === undefined) return current;
		current = next;
	}
	return current;
}
