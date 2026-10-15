import { Note, splitChapterId } from '$lib/contracts';

/** Root of note files inside the user data repository. */
export const NOTES_ROOT = 'user-data/notes';

export interface NoteFile {
	/** Path relative to the data repository root. */
	path: string;
	/** JSON text, camelCase keys, trailing newline. */
	content: string;
}

/** `user-data/notes/<topic>/<slug>/<ulid>.json`; the chapter id is split into topic and slug. */
export function noteFilePath(note: Pick<Note, 'id' | 'chapter'>): string {
	const { topic, slug } = splitChapterId(note.chapter);
	return `${NOTES_ROOT}/${topic}/${slug}/${note.id}.json`;
}

/** Validates each note with the `Note` schema and renders it as a file. Throws on invalid notes. */
export function notesToFiles(notes: Note[]): NoteFile[] {
	return notes.map((note) => {
		const valid = Note.parse(note);
		return {
			path: noteFilePath(valid),
			content: `${JSON.stringify(valid, null, 2)}\n`,
		};
	});
}
