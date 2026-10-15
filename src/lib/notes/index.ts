export {
	anchorFromSelection,
	chapterTextIndex,
	resolveAnchor,
	similarity,
	FUZZY_THRESHOLD,
} from './anchor';
export { clearHighlights, highlightRange, NOTE_HL_CLASS } from './highlight';
export { createNotesStore, type NotesStoreOptions, type OpenNotesStore } from './store';
export { NOTES_ROOT, noteFilePath, notesToFiles, type NoteFile } from './export';
