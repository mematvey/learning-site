import type { RoadmapEntry } from '$lib/contracts/roadmap';

export type ChapterStatus = 'new' | 'progress' | 'done';

/** What the progress store knows, reduced to what roadmaps need. */
export interface ProgressSnapshot {
	chapters: Record<string, ChapterStatus>;
	/** Lab ids passed by the learner. */
	labs: Record<string, boolean>;
}

export const EMPTY_SNAPSHOT: ProgressSnapshot = { chapters: {}, labs: {} };

interface ChapterRecord {
	id: string;
	done: boolean;
	visited: string | null;
}
interface LabRecord {
	labId: string;
	passed: boolean;
}

/** Builds a snapshot from `ProgressStore.list()` output. */
export function snapshotFrom(list: {
	chapters: ChapterRecord[];
	labs: LabRecord[];
}): ProgressSnapshot {
	const chapters: Record<string, ChapterStatus> = {};
	for (const c of list.chapters) {
		if (c.done) chapters[c.id] = 'done';
		else if (c.visited !== null) chapters[c.id] = 'progress';
	}
	const labs: Record<string, boolean> = {};
	for (const l of list.labs) if (l.passed) labs[l.labId] = true;
	return { chapters, labs };
}

export function statusOf(snapshot: ProgressSnapshot, chapterId: string): ChapterStatus {
	return snapshot.chapters[chapterId] ?? 'new';
}

/** Chapters done out of all chapters of the route. */
export function roadmapProgress(
	road: Pick<RoadmapEntry, 'steps'>,
	snapshot: ProgressSnapshot,
): { done: number; total: number; fraction: number } {
	const ids = road.steps.flatMap((s) => s.chapters);
	const done = ids.filter((id) => statusOf(snapshot, id) === 'done').length;
	return { done, total: ids.length, fraction: ids.length === 0 ? 0 : done / ids.length };
}

/**
 * First chapter not marked done, skipping optional steps. Returns null when everything
 * required is done.
 */
export function continuePoint(
	road: Pick<RoadmapEntry, 'steps'>,
	snapshot: ProgressSnapshot,
): { step: number; chapter: string } | null {
	for (const [step, s] of road.steps.entries()) {
		if (s.optional) continue;
		const chapter = s.chapters.find((id) => statusOf(snapshot, id) !== 'done');
		if (chapter !== undefined) return { step, chapter };
	}
	return null;
}

/** `95` -> `1 ч 35 мин`, `40` -> `40 мин`, `120` -> `2 ч`. */
export function formatMinutes(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m} мин`;
	return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/** Russian plural of "глава". */
export function chaptersLabel(n: number): string {
	const m10 = n % 10;
	const m100 = n % 100;
	if (m10 === 1 && m100 !== 11) return `${n} глава`;
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} главы`;
	return `${n} глав`;
}
