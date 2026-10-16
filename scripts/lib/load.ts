import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseDocument } from 'yaml';
import type { z } from 'zod';
import { AliasesFile } from '../../src/lib/contracts/aliases';
import { ChapterFrontmatter } from '../../src/lib/contracts/chapter';
import { GlossaryFile, type GlossaryEntry } from '../../src/lib/contracts/glossary';
import { Lab } from '../../src/lib/contracts/lab';
import { Roadmap } from '../../src/lib/contracts/roadmap';
import { Topic } from '../../src/lib/contracts/topic';
import { type Diagnostic, lineOf } from './diagnostics';
import { type SvxScan, scanSvx } from './svx';

export interface LoadedTopic {
	/** Folder name, which must equal `data.id`. */
	dir: string;
	file: string;
	data: Topic;
}

export interface LoadedChapter {
	/** Folder path under `content/`, e.g. `dl/attention`. Must equal `data.id`. */
	dir: string;
	topicDir: string;
	file: string;
	data: ChapterFrontmatter;
	scan: SvxScan;
	/** Line of `id:` in the frontmatter, for diagnostics. */
	idLine: number;
}

export interface LoadedLab {
	/** Folder name under `labs/`, which must equal `data.id`. */
	dir: string;
	file: string;
	data: Lab;
}

export interface LoadedRoadmap {
	/** File name without extension, which must equal `data.id`. */
	name: string;
	file: string;
	text: string;
	data: Roadmap;
}

export interface LoadedGlossaryEntry {
	file: string;
	line: number;
	data: GlossaryEntry;
}

export interface LoadedContent {
	root: string;
	topics: LoadedTopic[];
	chapters: LoadedChapter[];
	labs: LoadedLab[];
	glossary: LoadedGlossaryEntry[];
	roadmaps: LoadedRoadmap[];
	/** Entries of `data/aliases.yaml`: old id -> new id. */
	aliases: Record<string, string>;
	aliasesFile: string;
	diagnostics: Diagnostic[];
}

/** Repo-relative path with forward slashes. */
export function rel(root: string, abs: string): string {
	return relative(root, abs).split(sep).join('/');
}

function subdirs(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => statSync(join(dir, name)).isDirectory())
		.sort();
}

function files(dir: string, pattern: RegExp): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => pattern.test(name) && statSync(join(dir, name)).isFile())
		.sort();
}

/** Describes a schema issue as `path: message`. */
function describe(issue: z.core.$ZodIssue): string {
	const path = issue.path.map(String).join('.');
	return path === '' ? issue.message : `${path}: ${issue.message}`;
}

/** Line of the first YAML key named in an issue path, falling back to `fallback`. */
function issueLine(text: string, issue: z.core.$ZodIssue, fallback: number): number {
	const key = issue.path[0];
	if (typeof key !== 'string') return fallback;
	const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return lineOf(text, new RegExp(`^\\s*(- )?\\s*${escaped}:`), fallback);
}

/** Splits `---` frontmatter from an `.svx` file. Returns null when there is none. */
export function splitFrontmatter(
	text: string,
): { yaml: string; yamlLine: number; body: string; bodyLine: number } | null {
	const lines = text.split('\n');
	if (lines[0] !== '---') return null;
	const end = lines.indexOf('---', 1);
	if (end === -1) return null;
	return {
		yaml: lines.slice(1, end).join('\n'),
		yamlLine: 2,
		body: lines.slice(end + 1).join('\n'),
		bodyLine: end + 2,
	};
}

/** Parses YAML and returns the value, or records diagnostics and returns undefined. */
function parseYaml(
	text: string,
	file: string,
	firstLine: number,
	diagnostics: Diagnostic[],
): unknown | undefined {
	const doc = parseDocument(text, { prettyErrors: false });
	if (doc.errors.length > 0) {
		for (const error of doc.errors) {
			const line = firstLine + (error.linePos?.[0]?.line ?? 1) - 1;
			diagnostics.push({ file, line, message: `YAML: ${error.message.split('\n')[0]}` });
		}
		return undefined;
	}
	return doc.toJS();
}

/** Validates `value` with `schema`; each issue becomes a diagnostic. */
function validate<T>(
	schema: z.ZodType<T>,
	value: unknown,
	file: string,
	text: string,
	fallbackLine: number,
	diagnostics: Diagnostic[],
): T | undefined {
	const result = schema.safeParse(value);
	if (result.success) return result.data;
	for (const issue of result.error.issues) {
		diagnostics.push({
			file,
			line: issueLine(text, issue, fallbackLine),
			message: describe(issue),
		});
	}
	return undefined;
}

/**
 * Reads everything under `root` (`content/`, `labs/`, `data/`) and validates each file
 * against its schema. Cross-file rules live in `check.ts`.
 */
export function loadContent(root: string): LoadedContent {
	const diagnostics: Diagnostic[] = [];
	const loaded: LoadedContent = {
		root,
		topics: [],
		chapters: [],
		labs: [],
		glossary: [],
		roadmaps: [],
		aliases: {},
		aliasesFile: 'data/aliases.yaml',
		diagnostics,
	};

	for (const topicDir of subdirs(join(root, 'content'))) {
		const file = `content/${topicDir}/topic.yaml`;
		const abs = join(root, file);
		if (!existsSync(abs)) {
			diagnostics.push({
				file: `content/${topicDir}`,
				line: 1,
				message: 'папка темы без topic.yaml',
			});
			continue;
		}
		const text = readFileSync(abs, 'utf8');
		const value = parseYaml(text, file, 1, diagnostics);
		if (value === undefined) continue;
		const data = validate(Topic, value, file, text, 1, diagnostics);
		if (data) loaded.topics.push({ dir: topicDir, file, data });

		for (const slug of subdirs(join(root, 'content', topicDir))) {
			const chapterFile = `content/${topicDir}/${slug}/index.svx`;
			if (!existsSync(join(root, chapterFile))) {
				diagnostics.push({
					file: `content/${topicDir}/${slug}`,
					line: 1,
					message: 'нет index.svx',
				});
				continue;
			}
			const chapter = loadChapter(root, `${topicDir}/${slug}`, topicDir, chapterFile, diagnostics);
			if (chapter) loaded.chapters.push(chapter);
		}
	}

	for (const labDir of subdirs(join(root, 'labs'))) {
		const file = `labs/${labDir}/lab.yaml`;
		if (!existsSync(join(root, file))) {
			diagnostics.push({ file: `labs/${labDir}`, line: 1, message: 'папка лаба без lab.yaml' });
			continue;
		}
		const text = readFileSync(join(root, file), 'utf8');
		const value = parseYaml(text, file, 1, diagnostics);
		if (value === undefined) continue;
		const data = validate(Lab, value, file, text, 1, diagnostics);
		if (data) loaded.labs.push({ dir: labDir, file, data });
	}

	for (const name of files(join(root, 'data', 'glossary'), /\.ya?ml$/)) {
		const file = `data/glossary/${name}`;
		const text = readFileSync(join(root, file), 'utf8');
		const value = parseYaml(text, file, 1, diagnostics);
		if (value === undefined) continue;
		const entries = validate(GlossaryFile, value, file, text, 1, diagnostics);
		for (const entry of entries ?? []) {
			const line = lineOf(text, new RegExp(`id:\\s*${entry.id}\\s*$`), 1);
			loaded.glossary.push({ file, line, data: entry });
		}
	}

	for (const name of files(join(root, 'data', 'roadmaps'), /\.ya?ml$/)) {
		const file = `data/roadmaps/${name}`;
		const text = readFileSync(join(root, file), 'utf8');
		const value = parseYaml(text, file, 1, diagnostics);
		if (value === undefined) continue;
		const data = validate(Roadmap, value, file, text, 1, diagnostics);
		if (data) loaded.roadmaps.push({ name: name.replace(/\.ya?ml$/, ''), file, text, data });
	}

	if (existsSync(join(root, loaded.aliasesFile))) {
		const text = readFileSync(join(root, loaded.aliasesFile), 'utf8');
		const value = parseYaml(text, loaded.aliasesFile, 1, diagnostics);
		if (value !== undefined) {
			const map = validate(AliasesFile, value, loaded.aliasesFile, text, 1, diagnostics);
			if (map) loaded.aliases = { ...map };
		}
	}

	return loaded;
}

function loadChapter(
	root: string,
	dir: string,
	topicDir: string,
	file: string,
	diagnostics: Diagnostic[],
): LoadedChapter | undefined {
	const text = readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n');
	const parts = splitFrontmatter(text);
	if (!parts) {
		diagnostics.push({ file, line: 1, message: 'нет frontmatter (--- ... ---)' });
		return undefined;
	}
	const value = parseYaml(parts.yaml, file, parts.yamlLine, diagnostics);
	if (value === undefined) return undefined;
	const data = validate(ChapterFrontmatter, value, file, parts.yaml, parts.yamlLine, diagnostics);
	if (!data) return undefined;
	const idLine = lineOf(parts.yaml, /^id:/, parts.yamlLine);
	if (data.id !== dir) {
		diagnostics.push({
			file,
			line: idLine,
			message: `id "${data.id}" не совпадает с путём "${dir}"`,
		});
	}
	if (data.topic !== topicDir) {
		diagnostics.push({
			file,
			line: lineOf(parts.yaml, /^topic:/, parts.yamlLine),
			message: `topic "${data.topic}" не совпадает с папкой "${topicDir}"`,
		});
	}
	return {
		dir,
		topicDir,
		file,
		data,
		scan: scanSvx(parts.body, parts.bodyLine),
		idLine,
	};
}
