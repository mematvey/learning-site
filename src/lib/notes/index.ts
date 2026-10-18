export {
	anchorFromSelection,
	chapterTextIndex,
	resolveAnchor,
	similarity,
	FUZZY_THRESHOLD,
} from './anchor';
export { clearHighlights, highlightRange, rangeInBlock, NOTE_HL_CLASS } from './highlight';
export { createNotesStore, type NotesStoreOptions, type OpenNotesStore } from './store';
export { NOTES_ROOT, noteFilePath, notesToFiles, type NoteFile } from './export';
export { isMoved, currentBlockId, persistReanchors } from './reanchor';
export { progressNotesOptions, sharedNotesStore } from './bridge';
export { visibleText, isVisibleText } from './text';
