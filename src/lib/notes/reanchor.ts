import type { AnchorResolution, Note, NotesStore } from '$lib/contracts';

/** Notes whose store write is in flight; a re-anchor is written once at a time. */
const inFlight = new Set<string>();

/**
 * True when the quote was found in a block other than the one the note was made in. Such a
 * move is shown to the author and never written silently.
 */
export function isMoved(note: Note, resolution: AnchorResolution | undefined): boolean {
	return resolution?.status === 'shifted' && resolution.range.blockId !== note.anchor.blockId;
}

/** Block where the note's quote is now; the stored block when the position is unknown. */
export function currentBlockId(note: Note, resolution: AnchorResolution | undefined): string {
	return resolution && resolution.status !== 'orphaned'
		? resolution.range.blockId
		: note.anchor.blockId;
}

/**
 * Saves the re-anchored position of notes whose quote moved within their own block (a confident
 * match). Notes moved to another block keep their stored anchor, and orphaned notes are never
 * rewritten. Failures are retried on the next resolution.
 */
export async function persistReanchors(
	store: NotesStore,
	notes: Note[],
	resolutions: Record<string, AnchorResolution>,
): Promise<void> {
	for (const note of notes) {
		const resolution = resolutions[note.id];
		if (resolution?.status !== 'shifted' || isMoved(note, resolution)) continue;
		if (inFlight.has(note.id)) continue;
		inFlight.add(note.id);
		try {
			await store.update(note.id, { anchor: resolution.anchor });
		} catch {
			/* kept as is; the next resolution tries again */
		} finally {
			inFlight.delete(note.id);
		}
	}
}
