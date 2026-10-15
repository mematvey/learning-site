import type { ChapterId, ProgressStore } from '$lib/contracts';

export interface TrackOptions {
	/** Element that contains the chapter sections. Default: `document`. */
	root?: ParentNode;
	/** Quiet time before a position write, in ms. */
	debounceMs?: number;
	/** Viewport line (fraction of height) used to pick the reading position. */
	readingLine?: number;
}

/**
 * Records reading progress of one chapter: sections reached (IntersectionObserver over
 * `section[id]`) and the reading position as a block id plus offset inside the block.
 * The first call also marks the chapter as visited. Writes are debounced.
 * Returns a cleanup function that flushes pending data and stops tracking.
 */
export function trackChapter(
	store: ProgressStore,
	id: ChapterId,
	options: TrackOptions = {},
): () => void {
	const root = options.root ?? document;
	const debounceMs = options.debounceMs ?? 500;
	const readingLine = options.readingLine ?? 0.3;

	const reached = new Set<string>();
	let position: { blockId: string; offset: number } | undefined;
	let dirty = false;
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const flush = () => {
		clearTimeout(timer);
		timer = undefined;
		if (stopped || !dirty || store.readOnly) return;
		dirty = false;
		const ts = new Date().toISOString();
		// Errors are ignored on purpose: tracking must never break reading.
		store
			.update({
				chapters: [
					{
						id,
						lastVisit: ts,
						sectionsReached: [...reached],
						...(position ? { scroll: position } : {}),
					},
				],
			})
			.catch(() => {});
	};

	const schedule = () => {
		dirty = true;
		clearTimeout(timer);
		timer = setTimeout(flush, debounceMs);
	};

	const measurePosition = () => {
		const line = window.innerHeight * readingLine;
		let found: { blockId: string; offset: number } | undefined;
		for (const el of root.querySelectorAll<HTMLElement>('[data-block][id]')) {
			const rect = el.getBoundingClientRect();
			if (rect.top > line) break;
			const height = rect.height || 1;
			found = {
				blockId: el.id,
				offset: Math.min(1, Math.max(0, (line - rect.top) / height)),
			};
		}
		if (found && (found.blockId !== position?.blockId || found.offset !== position.offset)) {
			position = found;
			schedule();
		}
	};

	// Initial state: keep earlier sections and mark the first visit.
	store
		.getChapter(id)
		.then((chapter) => {
			if (stopped) return;
			for (const s of chapter?.sectionsReached ?? []) reached.add(s);
			if (!chapter || chapter.visited === null) {
				return store.update({
					chapters: [{ id, visited: new Date().toISOString() }],
				});
			}
		})
		.catch(() => {});

	let observer: IntersectionObserver | undefined;
	if (typeof IntersectionObserver !== 'undefined') {
		observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && entry.target.id && !reached.has(entry.target.id)) {
					reached.add(entry.target.id);
					schedule();
				}
			}
		});
		for (const section of root.querySelectorAll('section[id]')) observer.observe(section);
	}

	const onScroll = () => measurePosition();
	if (typeof window !== 'undefined') {
		window.addEventListener('scroll', onScroll, { passive: true });
	}

	return () => {
		flush();
		stopped = true;
		observer?.disconnect();
		if (typeof window !== 'undefined') window.removeEventListener('scroll', onScroll);
	};
}
