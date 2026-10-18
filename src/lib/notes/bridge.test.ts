import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { ChapterId } from '$lib/contracts';
import { openProgressStore } from '$lib/progress/store';
import { progressNotesOptions, sharedNotesStore } from './bridge';

describe('progress export and import with notes', () => {
	it('export includes the notes; import writes them back into the notes database', async () => {
		const notes = await sharedNotesStore();
		const created = await notes.create({
			chapter: 'dl/attention' as ChapterId,
			anchor: { blockId: 'scores-def', exact: 'скалярное', prefix: 'как ', suffix: ' про' },
			text: 'Вопрос про масштаб',
		});

		const source = await openProgressStore({
			dbName: 'bridge-test-source',
			...progressNotesOptions(),
		});
		const exported = await source.export();
		expect(exported.notes.map((n) => n.id)).toEqual([created.id]);

		// Delete the note, then import the file: the note comes back with the same id.
		await notes.delete(created.id);
		const target = await openProgressStore({
			dbName: 'bridge-test-target',
			...progressNotesOptions(),
		});
		const report = await target.import(exported, 'merge');
		expect(report.notes).toBe(1);
		expect((await notes.get(created.id))?.text).toBe('Вопрос про масштаб');

		source.close();
		target.close();
	});
});
