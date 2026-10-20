import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildRegistries } from '../../../scripts/lib/build';
import { checkContent } from '../../../scripts/lib/check';
import { loadContent } from '../../../scripts/lib/load';

const FIXTURE = resolve(process.cwd(), 'scripts/__fixtures__/valid');

let root: string;

/** Copies the valid fixture into a temp folder; experimental chapters are added there, never in content/. */
function freshRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), 'experimental-'));
	cpSync(FIXTURE, dir, { recursive: true });
	return dir;
}

function addChapter(id: string, extra: string): void {
	const slug = id.split('/')[1] ?? '';
	const dir = join(root, 'content', 'dl', slug);
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, 'index.svx'),
		[
			'---',
			`id: ${id}`,
			'title: Experimental chapter',
			'topic: dl',
			'summary: Временная экспериментальная глава.',
			'prereqs: [dl/softmax]',
			'keywords: [test]',
			'minutes: 5',
			extra,
			'---',
			'',
			'## Идея {#idea}',
			'',
			'Текст. {#idea-text}',
			'',
		].join('\n'),
	);
}

beforeEach(() => {
	root = freshRoot();
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('experimental chapters in the registry', () => {
	it('keeps an experimental chapter out of the main sequence', () => {
		addChapter('dl/robust', 'experimental: true');
		const r = buildRegistries(loadContent(root));
		const topic = r.topics[0];
		const robust = r.chapters.find((c) => c.id === 'dl/robust');
		const softmax = r.chapters.find((c) => c.id === 'dl/softmax');
		const attention = r.chapters.find((c) => c.id === 'dl/attention');

		expect(topic?.chapterIds).toEqual(['dl/softmax', 'dl/attention']);
		expect(topic?.experimentalIds).toEqual(['dl/robust']);
		expect(robust?.experimental).toBe(true);
		expect(robust?.prev).toBeNull();
		expect(robust?.next).toBeNull();
		expect(softmax?.next).toBe('dl/attention');
		expect(attention?.prev).toBe('dl/softmax');
		expect(attention?.index).toBe(1);
	});

	it('treats a chapter without the flag as main', () => {
		const r = buildRegistries(loadContent(root));
		const topic = r.topics[0];
		expect(topic?.experimentalIds).toEqual([]);
		expect(r.chapters.every((c) => c.experimental === false)).toBe(true);
	});

	it('exposes experimental chapters in the prerequisite graph as marked nodes', () => {
		addChapter('dl/robust', 'experimental: true');
		const r = buildRegistries(loadContent(root));
		const node = r.prereqGraph.nodes.find((n) => n.id === 'dl/robust');
		expect(node?.experimental).toBe(true);
		expect(r.prereqGraph.edges).toContainEqual({
			from: 'dl/softmax',
			to: 'dl/robust',
			kind: 'prereq',
		});
	});

	it('rejects a main chapter that depends on an experimental one', () => {
		addChapter('dl/robust', 'experimental: true');
		const attentionFile = join(root, 'content', 'dl', 'attention', 'index.svx');
		const text = readFileSync(attentionFile, 'utf8');
		writeFileSync(attentionFile, text.replace(/^prereqs:.*$/m, 'prereqs: [dl/robust]'));
		const messages = checkContent(loadContent(root)).map((d) => d.message);
		expect(messages.some((m) => m.includes('экспериментальный'))).toBe(true);
	});
});
