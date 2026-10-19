import type { MyTarget, Wish, WishDraft, WishStatus } from '$lib/contracts/my';

export const WISH_TITLE_MAX = 160;

import { WISH_STATUS_LABELS } from './status-labels';

export { WISH_STATUS_LABELS };

/** Splits a free-form list (one item per line, or comma / semicolon separated), dropping duplicates. */
export function splitList(input: string): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of input.split(/[\n,;]/)) {
		const item = raw.trim();
		if (item && !seen.has(item)) {
			seen.add(item);
			out.push(item);
		}
	}
	return out;
}

/** Inverse of `splitList` for a textarea: one item per line. */
export function joinList(items: readonly string[]): string {
	return items.join('\n');
}

export interface WishFormValues {
	title: string;
	question: string;
	sections: string;
	terms: string;
	notes: string;
	status: WishStatus;
}

/** Returns an error message for the form, or `null` when the wish can be saved. */
export function validateWishForm(values: Pick<WishFormValues, 'title'>): string | null {
	const title = values.title.trim();
	if (!title) return 'Укажите название желаемой главы.';
	if (title.length > WISH_TITLE_MAX) return `Название не длиннее ${WISH_TITLE_MAX} символов.`;
	return null;
}

export function wishDraftFromForm(topic: string, values: WishFormValues): WishDraft {
	return {
		topic,
		title: values.title.trim(),
		question: values.question.trim(),
		wantedSections: splitList(values.sections),
		wantedTerms: splitList(values.terms),
		notes: values.notes.trim(),
		status: values.status,
	};
}

export function wishFormFromWish(wish?: Wish): WishFormValues {
	return {
		title: wish?.title ?? '',
		question: wish?.question ?? '',
		sections: wish ? joinList(wish.wantedSections) : '',
		terms: wish ? joinList(wish.wantedTerms) : '',
		notes: wish?.notes ?? '',
		status: wish?.status ?? 'idea',
	};
}

/**
 * Markdown draft of a future chapter, used as the task for an agent
 * ("Скопировать как задание агенту") and as the content of `wishes.md`.
 */
export function buildWishTask(
	wish: Pick<Wish, 'title' | 'question' | 'wantedSections' | 'wantedTerms' | 'notes' | 'status'>,
): string {
	const list = (items: readonly string[]) =>
		items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '_не указано_';
	const text = (value: string) => (value.trim() ? value.trim() : '_не указано_');
	return [
		`# ${wish.title}`,
		'',
		`Статус: ${WISH_STATUS_LABELS[wish.status]}`,
		'',
		'## Вопрос',
		'',
		text(wish.question),
		'',
		'## Желаемые разделы',
		'',
		list(wish.wantedSections),
		'',
		'## Желаемые термины',
		'',
		list(wish.wantedTerms),
		'',
		'## Заметки',
		'',
		text(wish.notes),
		'',
	].join('\n');
}

/** File name for a wish draft: `wish-<slug>.md`, the slug keeps letters of any alphabet. */
export function wishFileName(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/, '');
	return `wish-${slug || 'untitled'}.md`;
}

/** Where a new situation is attached: this chapter, another chapter of the topic, or a wished chapter. */
export type TargetChoice = 'this' | 'chapter' | 'wish';

export const TARGET_CHOICE_LABELS: Record<TargetChoice, string> = {
	this: 'Эта глава',
	chapter: 'Другая глава темы',
	wish: 'Желаемая глава',
};

export interface TargetPick {
	choice: TargetChoice;
	/** The chapter the button sits in. */
	chapterId: string;
	/** Required for `choice: 'chapter'`. */
	otherChapterId?: string;
	/** Required for `choice: 'wish'`. */
	wishId?: string;
}

/** Turns the picker state into a `MyTarget`, or `null` while the picker is incomplete. */
export function resolveTarget(pick: TargetPick): MyTarget | null {
	switch (pick.choice) {
		case 'this':
			return { kind: 'chapter', chapter: pick.chapterId };
		case 'chapter':
			return pick.otherChapterId ? { kind: 'chapter', chapter: pick.otherChapterId } : null;
		case 'wish':
			return pick.wishId ? { kind: 'wish', wishId: pick.wishId } : null;
	}
}
