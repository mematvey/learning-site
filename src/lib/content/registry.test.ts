import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRegistries } from '../../../scripts/lib/build';
import { loadContent } from '../../../scripts/lib/load';
import { makeRegistry } from './registry';

const FIXTURE = resolve(process.cwd(), 'scripts/__fixtures__/valid');

/** Registry built from the fixture tree, without touching `src/generated`. */
function fixtureRegistry() {
	const built = buildRegistries(loadContent(FIXTURE));
	return makeRegistry({
		topics: built.topics,
		chapters: built.chapters,
		labs: built.labs,
		glossary: built.glossary,
		prereqGraph: built.prereqGraph,
		aliases: built.aliases,
	});
}

describe('makeRegistry accessors', () => {
	it('returns topics, chapters by topic in reading order, and labs', () => {
		const r = fixtureRegistry();
		expect(r.getTopics().map((t) => t.id)).toEqual(['dl']);
		expect(r.getChaptersByTopic('dl').map((c) => c.id)).toEqual(['dl/softmax', 'dl/attention']);
		expect(r.getChaptersByTopic('nope')).toEqual([]);
		expect(r.getChapter('dl/attention')?.title).toBe('Scaled dot-product attention');
		expect(r.getLab('dl-attention-numpy')?.chapter).toBe('dl/attention');
		expect(r.getLab('missing')).toBeUndefined();
	});

	it('resolves old chapter ids through aliases', () => {
		const r = fixtureRegistry();
		expect(r.resolveChapterId('dl/scaled-attention')).toBe('dl/attention');
		expect(r.resolveChapterId('dl/old-softmax')).toBe('dl/softmax');
		expect(r.resolveChapterId('dl/attention')).toBe('dl/attention');
	});

	it('exposes the glossary and the prerequisite graph', () => {
		const r = fixtureRegistry();
		expect(Object.keys(r.getGlossary()).sort()).toEqual(['attention', 'softmax', 'variance']);
		expect(r.getPrereqGraph().edges.length).toBe(4);
	});
});
