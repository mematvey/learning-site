export interface SectionCount {
	/** Sections checked by hand that exist in the chapter. */
	done: number;
	/** All sections of the chapter (unique ids). */
	total: number;
}

/**
 * Counts manually checked sections: "n of m". Marks of sections that no longer exist in the
 * chapter are ignored, so a renamed or removed section never inflates the count.
 */
export function countSectionsDone(
	sectionIds: readonly string[],
	sectionsDone: readonly string[] | undefined,
): SectionCount {
	const ids = new Set(sectionIds);
	const marks = new Set(sectionsDone ?? []);
	let done = 0;
	for (const id of ids) if (marks.has(id)) done++;
	return { done, total: ids.size };
}

/** Sums counts of several chapters ("n of m" for a topic). */
export function sumCounts(counts: readonly SectionCount[]): SectionCount {
	return counts.reduce((acc, c) => ({ done: acc.done + c.done, total: acc.total + c.total }), {
		done: 0,
		total: 0,
	});
}
