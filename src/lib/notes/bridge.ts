import type { ImportMode, Note } from '$lib/contracts';
import { createNotesStore, type OpenNotesStore } from './store';

let opening: Promise<OpenNotesStore> | undefined;

/** The notes database, opened once for export and import. Rejects when IndexedDB is unavailable. */
export function sharedNotesStore(): Promise<OpenNotesStore> {
	opening ??= createNotesStore().catch((error: unknown) => {
		opening = undefined;
		throw error;
	});
	return opening;
}

/**
 * Notes hooks for the progress store: `export()` includes every note, `import()` writes the
 * notes of the file into the notes database.
 */
export function progressNotesOptions(): {
	notes: () => Promise<Note[]>;
	importNotes: (notes: Note[], mode: ImportMode) => Promise<void>;
} {
	return {
		notes: async () => (await sharedNotesStore()).list(),
		importNotes: async (notes, mode) => {
			await (await sharedNotesStore()).importNotes(notes, mode);
		},
	};
}
