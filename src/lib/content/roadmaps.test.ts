import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildRegistries } from '../../../scripts/lib/build';
import { checkContent } from '../../../scripts/lib/check';
import { loadContent } from '../../../scripts/lib/load';
import { RoadmapsRegistry } from '../contracts/roadmap';

const FIXTURE = resolve(process.cwd(), 'scripts/__fixtures__/valid');

const VALID = `id: demo
title: Demo
summary: Demo route
audience: Everyone
goal: Learn
steps:
  - title: Start
    description: First
    chapters: [dl/softmax]
  - title: Next
    description: Second
    chapters: [dl/attention]
    labs: [dl-attention-numpy]
`;

let root: string;

function roadmap(name: string, text: string): void {
	mkdirSync(join(root, 'data', 'roadmaps'), { recursive: true });
	writeFileSync(join(root, 'data', 'roadmaps', `${name}.yaml`), text);
}

function messages(): string[] {
	return checkContent(loadContent(root)).map((d) => d.message);
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'roadmaps-'));
	cpSync(FIXTURE, root, { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('roadmaps check', () => {
	it('accepts a valid roadmap and builds the registry entry', () => {
		roadmap('demo', VALID);
		expect(messages()).toEqual([]);
		const built = buildRegistries(loadContent(root)).roadmaps;
		expect(() => RoadmapsRegistry.parse(built)).not.toThrow();
		expect(built).toHaveLength(1);
		expect(built[0]).toMatchObject({ id: 'demo', chapterCount: 2, estimatedMinutes: 23 });
	});

	it('reports unknown chapters and labs', () => {
		roadmap(
			'demo',
			VALID.replace('[dl/softmax]', '[dl/nope]').replace('[dl-attention-numpy]', '[dl-nope-lab]'),
		);
		const out = messages();
		expect(out.some((m) => m.includes('глава "dl/nope" не найдена'))).toBe(true);
		expect(out.some((m) => m.includes('лаб "dl-nope-lab" не найден'))).toBe(true);
	});

	it('reports a chapter listed twice', () => {
		roadmap('demo', VALID.replace('[dl/attention]', '[dl/softmax, dl/attention]'));
		expect(messages().some((m) => m.includes('дважды'))).toBe(true);
	});

	it('reports an order that contradicts prerequisites', () => {
		roadmap(
			'demo',
			VALID.replace('[dl/softmax]', '[dl/attention]').replace(
				'[dl/attention]\n    labs: [dl-attention-numpy]',
				'[dl/softmax]',
			),
		);
		expect(messages().some((m) => m.includes('цикл'))).toBe(true);
	});

	it('requires the id to match the file name', () => {
		roadmap('other', VALID);
		expect(messages().some((m) => m.includes('не совпадает с именем файла'))).toBe(true);
	});
});
