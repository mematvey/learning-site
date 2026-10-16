import { describe, expect, it } from 'vitest';
import type { ChapterProgress, ProgressPatch, ProgressStore } from '$lib/contracts';
import { getProblems, markProblem } from './progress';

/** In-memory store: enough of `ProgressStore` for read-modify-write of one chapter. */
function fakeStore(initial?: Partial<ChapterProgress>) {
	let chapter: ChapterProgress | undefined = initial
		? ({
				schemaVersion: 1,
				id: 'stats/classical-probability',
				updated: '2026-01-01T00:00:00.000Z',
				visited: null,
				sectionsReached: [],
				levels: { c: 1, d: 1 },
				done: false,
				...initial,
			} as ChapterProgress)
		: undefined;
	const patches: ProgressPatch[] = [];
	const store = {
		readOnly: false,
		async getChapter() {
			return chapter ? structuredClone(chapter) : undefined;
		},
		async update(patch: ProgressPatch) {
			patches.push(patch);
			for (const c of patch.chapters ?? []) {
				// Like the real store: the given fields replace the stored ones.
				chapter = { ...(chapter as ChapterProgress), ...c } as ChapterProgress;
			}
		},
	};
	return { store: store as unknown as ProgressStore, patches, peek: () => chapter };
}

const ID = 'stats/classical-probability' as ChapterProgress['id'];
const NOW = () => '2026-02-02T10:00:00.000Z';

describe('markProblem', () => {
	it('creates the problems map on a chapter without progress', async () => {
		const f = fakeStore();
		await markProblem(ID, 'p1', { solved: true }, f.store, NOW);
		expect(f.peek()?.problems).toEqual({
			p1: { solved: true, updated: '2026-02-02T10:00:00.000Z' },
		});
	});

	it('keeps other problems and the other flag when one flag changes', async () => {
		const f = fakeStore({
			problems: {
				p1: { solved: true, updated: '2026-01-01T00:00:00.000Z' },
				p2: { revealed: true },
			},
		});
		await markProblem(ID, 'p1', { revealed: true }, f.store, NOW);
		expect(f.peek()?.problems).toEqual({
			p1: { solved: true, revealed: true, updated: '2026-02-02T10:00:00.000Z' },
			p2: { revealed: true },
		});
	});

	it('serializes concurrent marks so neither is lost', async () => {
		const f = fakeStore({ problems: {} });
		await Promise.all([
			markProblem(ID, 'p1', { solved: true }, f.store, NOW),
			markProblem(ID, 'p2', { revealed: true }, f.store, NOW),
			markProblem(ID, 'p3', { revealed: true }, f.store, NOW),
		]);
		expect(Object.keys(f.peek()?.problems ?? {}).sort()).toEqual(['p1', 'p2', 'p3']);
	});

	it('is a no-op without a store and on a read-only store', async () => {
		await expect(markProblem(ID, 'p1', { solved: true }, null, NOW)).resolves.toBeUndefined();
		const f = fakeStore();
		(f.store as { readOnly: boolean }).readOnly = true;
		await markProblem(ID, 'p1', { solved: true }, f.store, NOW);
		expect(f.patches).toHaveLength(0);
	});
});

describe('getProblems', () => {
	it('returns stored problem flags or an empty map', async () => {
		const f = fakeStore({ problems: { p4: { solved: true } } });
		expect(await getProblems(ID, f.store)).toEqual({ p4: { solved: true } });
		expect(await getProblems(ID, fakeStore().store)).toEqual({});
		expect(await getProblems(ID, null)).toEqual({});
	});
});
