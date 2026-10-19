import type { Clarification, MyTarget, Situation, SituationDraft, Wish } from '$lib/contracts/my';
import { SITUATION_STATUS_LABELS } from './status-labels';

export const SITUATION_TITLE_MAX = 160;

export { SITUATION_STATUS_LABELS };

export interface ChapterRef {
	id: string;
	title: string;
}

export type SituationGroup =
	| {
			kind: 'chapter';
			key: string;
			id: string;
			title: string;
			situations: Situation[];
	  }
	| {
			kind: 'wish';
			key: string;
			id: string;
			title: string;
			situations: Situation[];
	  };

/** Stable key of a target, shared by grouping and clarification matching. */
export function targetKey(target: MyTarget | Clarification['target']): string {
	if (target.kind === 'chapter') return `chapter:${target.chapter}`;
	if (target.kind === 'wish') return `wish:${target.wishId}`;
	return `situation:${target.situationId}`;
}

/** Open situations first, then by creation time (oldest first). */
function compareSituations(a: Situation, b: Situation): number {
	if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
	if (a.created !== b.created) return a.created < b.created ? -1 : 1;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Groups situations of one topic by the chapter or wished chapter they are attached to.
 * Existing chapters come first in reading order, then wished chapters in the given order.
 * Targets that are no longer known are kept at the end under their raw id.
 * Empty groups are omitted.
 */
export function groupSituations(
	situations: readonly Situation[],
	chapters: readonly ChapterRef[],
	wishes: readonly Pick<Wish, 'id' | 'title'>[],
): SituationGroup[] {
	const chapterOrder = new Map(chapters.map((c, i) => [c.id, i]));
	const wishOrder = new Map(wishes.map((w, i) => [w.id, i]));
	const chapterTitle = new Map(chapters.map((c) => [c.id, c.title]));
	const wishTitle = new Map(wishes.map((w) => [w.id, w.title]));

	const groups = new Map<string, SituationGroup>();
	for (const s of situations) {
		const key = targetKey(s.target);
		let group = groups.get(key);
		if (!group) {
			if (s.target.kind === 'chapter') {
				const id = s.target.chapter;
				group = { kind: 'chapter', key, id, title: chapterTitle.get(id) ?? id, situations: [] };
			} else {
				const id = s.target.wishId;
				group = { kind: 'wish', key, id, title: wishTitle.get(id) ?? id, situations: [] };
			}
			groups.set(key, group);
		}
		group.situations.push(s);
	}

	const rank = (g: SituationGroup): [number, number] => {
		if (g.kind === 'chapter') {
			const i = chapterOrder.get(g.id);
			return [0, i ?? Number.MAX_SAFE_INTEGER];
		}
		const i = wishOrder.get(g.id);
		return [1, i ?? Number.MAX_SAFE_INTEGER];
	};

	return [...groups.values()]
		.map((g) => ({ ...g, situations: [...g.situations].sort(compareSituations) }))
		.sort((a, b) => {
			const [ka, ia] = rank(a);
			const [kb, ib] = rank(b);
			if (ka !== kb) return ka - kb;
			return ia - ib;
		});
}

/** Clarifications attached to exactly this target, oldest first. */
export function clarificationsFor(
	clarifications: readonly Clarification[],
	target: Clarification['target'],
): Clarification[] {
	const key = targetKey(target);
	return clarifications
		.filter((c) => targetKey(c.target) === key)
		.sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
}

export interface SituationFormValues {
	title: string;
	situation: string;
	goal: string;
}

/** Returns an error message for the form, or `null` when the situation can be saved. */
export function validateSituationForm(values: SituationFormValues): string | null {
	if (!values.title.trim()) return 'Укажите короткое название ситуации.';
	if (values.title.trim().length > SITUATION_TITLE_MAX)
		return `Название не длиннее ${SITUATION_TITLE_MAX} символов.`;
	if (!values.situation.trim()) return 'Опишите ситуацию.';
	return null;
}

export function situationDraftFromForm(
	topic: string,
	target: MyTarget,
	values: SituationFormValues,
): SituationDraft {
	return {
		topic,
		target,
		title: values.title.trim(),
		situation: values.situation.trim(),
		goal: values.goal.trim(),
	};
}
