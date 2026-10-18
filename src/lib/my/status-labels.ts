import type { SituationStatus, WishStatus } from '$lib/contracts/my';
import type { Note } from '$lib/contracts';

/**
 * Status captions for the personal section, the user-data Markdown export and the buffer.
 * One dictionary: lowercase Russian everywhere, so a status reads the same on screen and in files.
 */
export const WISH_STATUS_LABELS: Record<WishStatus, string> = {
	idea: 'идея',
	drafting: 'в работе',
	covered: 'покрыта',
};

export const SITUATION_STATUS_LABELS: Record<SituationStatus, string> = {
	open: 'открыта',
	answered: 'отвечена',
};

export const NOTE_STATUS_LABELS: Record<Note['status'], string> = {
	open: 'открыта',
	answered: 'отвечена',
};
