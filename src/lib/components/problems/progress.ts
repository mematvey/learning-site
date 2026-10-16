import type { ChapterId, ProblemProgress, ProgressStore } from '$lib/contracts';
import { ensureProgress } from '$lib/shell.svelte';

/** Flags that can be set for one problem. Omitted flags keep their stored value. */
export interface ProblemFlags {
	solved?: boolean;
	revealed?: boolean;
}

/**
 * Writes are serialized: the read-modify-write of `problems` must not interleave,
 * because `update` replaces the whole `problems` map of the chapter.
 */
let queue: Promise<unknown> = Promise.resolve();

/** Opens the shared store on the client; `null` on the server or if the store is unavailable. */
async function resolveStore(): Promise<ProgressStore | null> {
	if (typeof window === 'undefined') return null;
	try {
		return await ensureProgress();
	} catch {
		return null;
	}
}

/** Problem progress of one chapter, keyed by problem id. Empty without a store. */
export async function getProblems(
	chapterId: ChapterId,
	store?: ProgressStore | null,
): Promise<Record<string, ProblemProgress>> {
	const s = store === undefined ? await resolveStore() : store;
	if (!s) return {};
	const chapter = await s.getChapter(chapterId);
	return chapter?.problems ?? {};
}

/**
 * Sets flags of one problem in the chapter record. Without a store (tests, server) it is a no-op.
 * `now` is injectable for tests.
 */
export function markProblem(
	chapterId: ChapterId,
	problemId: string,
	flags: ProblemFlags,
	store?: ProgressStore | null,
	now: () => string = () => new Date().toISOString(),
): Promise<void> {
	const run = async (): Promise<void> => {
		const s = store === undefined ? await resolveStore() : store;
		if (!s || s.readOnly) return;
		const chapter = await s.getChapter(chapterId);
		const problems: Record<string, ProblemProgress> = { ...(chapter?.problems ?? {}) };
		problems[problemId] = { ...problems[problemId], ...flags, updated: now() };
		await s.update({ chapters: [{ id: chapterId, problems }] });
	};
	const next = queue.then(run, run);
	queue = next.catch(() => undefined);
	return next;
}
