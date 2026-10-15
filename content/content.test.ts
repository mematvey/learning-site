import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ChapterFrontmatter } from '../src/lib/contracts/chapter';
import { GlossaryFile } from '../src/lib/contracts/glossary';
import { Topic } from '../src/lib/contracts/topic';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(ROOT);
const GLOSSARY_DIR = join(ROOT, '..', 'data', 'glossary');
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const TOPICS = ['dl', 'classic-ml', 'mlops', 'cs', 'compute'];

function readText(path: string): string {
	return readFileSync(path, 'utf8');
}

function frontmatterOf(source: string): unknown {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
	if (!m) throw new Error('missing frontmatter');
	return parse(m[1]);
}

function loadGlossary() {
	const entries = [];
	for (const file of readdirSync(GLOSSARY_DIR).filter((f) => f.endsWith('.yaml'))) {
		entries.push(...GlossaryFile.parse(parse(readText(join(GLOSSARY_DIR, file)))));
	}
	return entries;
}

describe('topics', () => {
	it.each(TOPICS)('%s/topic.yaml matches the Topic schema and folder name', (topic) => {
		const path = join(CONTENT, topic, 'topic.yaml');
		expect(existsSync(path)).toBe(true);
		const parsed = Topic.parse(parse(readText(path)));
		expect(parsed.id).toBe(topic);
	});
});

describe('chapter dl/attention', () => {
	const chapterDir = join(CONTENT, 'dl', 'attention');
	const source = readText(join(chapterDir, 'index.svx'));
	const front = ChapterFrontmatter.parse(frontmatterOf(source));
	const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

	it('frontmatter id matches the folder path', () => {
		expect(relative(CONTENT, chapterDir).replace(/\\/g, '/')).toBe(front.id);
	});

	it('block ids are kebab-case and unique', () => {
		const ids = [...body.matchAll(/\{#([^}]+)\}/g)].map((m) => m[1]);
		expect(ids.length).toBeGreaterThan(0);
		for (const id of ids) expect(id).toMatch(KEBAB);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('every source.supports refers to an existing block id', () => {
		const ids = new Set([...body.matchAll(/\{#([^}]+)\}/g)].map((m) => m[1]));
		for (const s of front.sources ?? []) {
			for (const b of s.supports ?? []) expect(ids.has(b), `${s.id} -> ${b}`).toBe(true);
		}
	});

	it('every <Cite id> refers to a source', () => {
		const sourceIds = new Set((front.sources ?? []).map((s) => s.id));
		for (const m of body.matchAll(/<Cite id="([^"]+)"/g)) expect(sourceIds.has(m[1])).toBe(true);
	});

	it('concepts and <Term id> exist in the glossary', () => {
		const termIds = new Set(loadGlossary().map((e) => e.id));
		for (const c of front.concepts ?? []) expect(termIds.has(c.id), c.id).toBe(true);
		for (const m of body.matchAll(/<Term id="([^"]+)"/g))
			expect(termIds.has(m[1]), m[1]).toBe(true);
	});

	it('Variant ranges of the chapter cover c=1..4 without gaps or overlaps', () => {
		const covered = new Map<number, number>();
		for (const m of body.matchAll(/<Variant c="(\d)(?:-(\d))?"/g)) {
			const a = Number(m[1]);
			const b = m[2] ? Number(m[2]) : a;
			for (let c = a; c <= b; c++) covered.set(c, (covered.get(c) ?? 0) + 1);
		}
		for (let c = 1; c <= 4; c++) expect(covered.get(c), `c=${c}`).toBe(1);
	});

	it('a term defined only at a deeper level is not used outside that level', () => {
		const glossary = loadGlossary();
		const levelRanges: Array<{ axis: 'c' | 'd'; value: number; from: number; to: number }> = [];
		const re = /<Level (c|d)=\{(\d)\}>([\s\S]*?)<\/Level>/g;
		for (const m of body.matchAll(re)) {
			const from = m.index ?? 0;
			levelRanges.push({
				axis: m[1] as 'c' | 'd',
				value: Number(m[2]),
				from,
				to: from + m[0].length,
			});
		}
		for (const entry of glossary.filter((e) => e.layer)) {
			const layer = entry.layer!;
			for (const m of body.matchAll(new RegExp(`<Term id="${entry.id}"`, 'g'))) {
				const pos = m.index ?? 0;
				const inside = levelRanges.filter((r) => pos >= r.from && pos < r.to);
				const ok =
					(layer.c === 1 && layer.d === 1) ||
					inside.some(
						(r) =>
							(r.axis === 'c' && layer.c > 1 && r.value >= layer.c) ||
							(r.axis === 'd' && layer.d > 1 && r.value >= layer.d),
					);
				expect(ok, `${entry.id} used above its defining level`).toBe(true);
			}
		}
	});
});

describe('glossary', () => {
	it('entries are valid and ids are unique', () => {
		const ids = loadGlossary().map((e) => e.id);
		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
