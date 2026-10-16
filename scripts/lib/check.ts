import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Diagnostic, lineOf } from './diagnostics';
import { findCycle, transitivePrereqs } from './graph';
import type { LoadedChapter, LoadedContent } from './load';
import { type Range, within } from './ranges';

/** Chapter id -> chapter, for quick lookups. Duplicates are reported by `checkContent`. */
export function chapterIndex(loaded: LoadedContent): Map<string, LoadedChapter> {
	return new Map(loaded.chapters.map((ch) => [ch.data.id, ch]));
}

/** Prerequisite lookup for chapters that exist (unknown prerequisites are reported separately). */
export function prereqLookup(loaded: LoadedContent): (id: string) => string[] {
	const byId = chapterIndex(loaded);
	return (id) => [...(byId.get(id)?.data.prereqs ?? [])].filter((p) => byId.has(p));
}

/**
 * Merges frontmatter `aliases` into `data/aliases.yaml`. Returns the merged map and problems.
 * An alias must not name an existing chapter, and one old id must not point to two new ids.
 */
export function collectAliases(loaded: LoadedContent): {
	aliases: Record<string, string>;
	diagnostics: Diagnostic[];
} {
	const diagnostics: Diagnostic[] = [];
	const aliases: Record<string, string> = { ...loaded.aliases };
	const chapters = chapterIndex(loaded);

	for (const ch of loaded.chapters) {
		for (const old of ch.data.aliases ?? []) {
			const existing = aliases[old];
			if (chapters.has(old)) {
				diagnostics.push({
					file: ch.file,
					line: ch.idLine,
					message: `alias "${old}" совпадает с существующей главой`,
				});
			} else if (existing !== undefined && existing !== ch.data.id) {
				diagnostics.push({
					file: ch.file,
					line: ch.idLine,
					message: `alias "${old}" уже указывает на "${existing}"`,
				});
			} else {
				aliases[old] = ch.data.id;
			}
		}
	}

	for (const [old, target] of Object.entries(loaded.aliases)) {
		if (chapters.has(old)) {
			diagnostics.push({
				file: loaded.aliasesFile,
				line: lineOf(readLines(loaded, loaded.aliasesFile), new RegExp(`^"?${escapeRe(old)}"?:`)),
				message: `alias "${old}" совпадает с существующей главой`,
			});
		} else if (!chapters.has(target)) {
			diagnostics.push({
				file: loaded.aliasesFile,
				line: lineOf(readLines(loaded, loaded.aliasesFile), new RegExp(`^"?${escapeRe(old)}"?:`)),
				message: `alias "${old}" указывает на несуществующую главу "${target}"`,
			});
		}
	}
	return { aliases: sortKeys(aliases), diagnostics };
}

/**
 * Cross-file checks: ids, references, prerequisite graph, lab files, level rule for terms.
 * Schema problems come from `loadContent` and are included in the result.
 */
export function checkContent(loaded: LoadedContent): Diagnostic[] {
	const out: Diagnostic[] = [...loaded.diagnostics];
	const chapters = chapterIndex(loaded);
	const topicIds = new Set<string>();
	const labIds = new Set<string>();
	const glossary = new Map(loaded.glossary.map((g) => [g.data.id, g.data]));
	const prereqsOf = prereqLookup(loaded);

	for (const topic of loaded.topics) {
		if (topicIds.has(topic.data.id)) {
			out.push({ file: topic.file, line: 1, message: `тема "${topic.data.id}" определена дважды` });
		}
		topicIds.add(topic.data.id);
		if (topic.data.id !== topic.dir) {
			out.push({
				file: topic.file,
				line: lineOf(readLines(loaded, topic.file), /^id:/, 1),
				message: `id "${topic.data.id}" не совпадает с папкой "${topic.dir}"`,
			});
		}
	}

	for (const ch of loaded.chapters) {
		if (chapters.get(ch.data.id) !== ch) {
			out.push({
				file: ch.file,
				line: ch.idLine,
				message: `глава "${ch.data.id}" определена дважды`,
			});
		}
	}

	for (const lab of loaded.labs) {
		if (labIds.has(lab.data.id)) {
			out.push({ file: lab.file, line: 1, message: `лаб "${lab.data.id}" определён дважды` });
		}
		labIds.add(lab.data.id);
		if (lab.data.id !== lab.dir) {
			out.push({
				file: lab.file,
				line: 1,
				message: `id "${lab.data.id}" не совпадает с папкой "${lab.dir}"`,
			});
		}
		if (!chapters.has(lab.data.chapter)) {
			out.push({
				file: lab.file,
				line: lineOf(readLines(loaded, lab.file), /^chapter:/, 1),
				message: `глава "${lab.data.chapter}" не найдена`,
			});
		}
		for (const [key, path] of labFiles(lab.data)) {
			if (!existsSync(join(loaded.root, 'labs', lab.dir, path))) {
				out.push({
					file: lab.file,
					line: lineOf(readLines(loaded, lab.file), new RegExp(`^\\s*${key}:`), 1),
					message: `файл "${path}" не найден в labs/${lab.dir}/`,
				});
			}
		}
	}

	const conceptOwner = new Map<string, string>();
	for (const ch of loaded.chapters) {
		const lines = readLines(loaded, ch.file);
		const fmLine = (pattern: RegExp) => lineOf(lines, pattern, ch.idLine);
		const data = ch.data;

		if (!topicIds.has(data.topic)) {
			out.push({
				file: ch.file,
				line: fmLine(/^topic:/),
				message: `тема "${data.topic}" не найдена (нет topic.yaml)`,
			});
		}
		for (const p of data.prereqs) {
			if (!chapters.has(p)) {
				out.push({
					file: ch.file,
					line: fmLine(/^prereqs:/),
					message: `пререквизит "${p}" не найден`,
				});
			}
		}
		for (const lab of data.labs ?? []) {
			if (!labIds.has(lab)) {
				out.push({
					file: ch.file,
					line: fmLine(/^labs:/),
					message: `лаб "${lab}" не найден в labs/`,
				});
			}
		}
		const sourceIds = new Set<string>();
		for (const source of data.sources ?? []) {
			if (sourceIds.has(source.id)) {
				out.push({
					file: ch.file,
					line: fmLine(new RegExp(`id: ${source.id}$`)),
					message: `источник "${source.id}" повторяется`,
				});
			}
			sourceIds.add(source.id);
		}
		for (const concept of data.concepts ?? []) {
			const owner = conceptOwner.get(concept.id);
			if (owner !== undefined) {
				out.push({
					file: ch.file,
					line: fmLine(new RegExp(`id: ${concept.id}\\b`)),
					message: `понятие "${concept.id}" уже введено в "${owner}"`,
				});
			} else {
				conceptOwner.set(concept.id, data.id);
			}
		}

		out.push(...checkBlocks(ch));
		out.push(...checkSources(ch, lines));
		out.push(...checkTextAttrs(ch));
		out.push(...checkAbsoluteLinks(ch, lines));
		out.push(...checkTerms(ch, glossary, prereqsOf, lines));
	}

	for (const g of loaded.glossary) {
		if (g.data.chapter !== undefined && !chapters.has(g.data.chapter)) {
			out.push({
				file: g.file,
				line: g.line,
				message: `термин "${g.data.id}": глава "${g.data.chapter}" не найдена`,
			});
		}
	}
	const glossaryFirst = new Map<string, string>();
	for (const g of loaded.glossary) {
		const seen = glossaryFirst.get(g.data.id);
		if (seen !== undefined) {
			out.push({
				file: g.file,
				line: g.line,
				message: `термин "${g.data.id}" уже определён в ${seen}`,
			});
		} else {
			glossaryFirst.set(g.data.id, g.file);
		}
	}

	for (const topic of loaded.topics) {
		for (const slug of topic.data.chapters ?? []) {
			if (!chapters.has(`${topic.data.id}/${slug}`)) {
				out.push({
					file: topic.file,
					line: lineOf(readLines(loaded, topic.file), /^chapters:/, 1),
					message: `глава "${topic.data.id}/${slug}" из списка chapters не найдена`,
				});
			}
		}
		for (const featured of topic.data.featured ?? []) {
			if (!chapters.has(featured) || !featured.startsWith(`${topic.data.id}/`)) {
				out.push({
					file: topic.file,
					line: lineOf(readLines(loaded, topic.file), /^featured:/, 1),
					message: `featured "${featured}" не найден в теме "${topic.data.id}"`,
				});
			}
		}
	}

	out.push(...collectAliases(loaded).diagnostics);
	out.push(...checkGraph(loaded, chapters, prereqsOf));
	out.push(...checkUserDataNotTracked(loaded.root));
	return out;
}

/** Block ids: format, uniqueness inside the chapter (`{#id}` markers and `Figure id`). */
function checkBlocks(ch: LoadedChapter): Diagnostic[] {
	const out: Diagnostic[] = [];
	for (const bad of ch.scan.invalidBlocks) {
		out.push({
			file: ch.file,
			line: bad.line,
			message: `неверный формат id блока "${bad.raw}": нужен kebab-case`,
		});
	}
	const seen = new Map<string, number>();
	const all = [...ch.scan.blocks, ...ch.scan.figures].sort((a, b) => a.line - b.line);
	for (const block of all) {
		const first = seen.get(block.id);
		if (first !== undefined) {
			out.push({
				file: ch.file,
				line: block.line,
				message: `id блока "${block.id}" уже использован на строке ${first}`,
			});
		} else {
			seen.set(block.id, block.line);
		}
	}
	for (const bad of ch.scan.badLevelTags) {
		out.push({
			file: ch.file,
			line: bad.line,
			message: `некорректные атрибуты уровня: ${bad.text}`,
		});
	}
	return out;
}

/**
 * `sources[].supports`: every id must be a block or figure of this chapter (error);
 * a source with `supports` should be cited in the text with `<Cite id>` (warning).
 */
function checkSources(ch: LoadedChapter, lines: string[]): Diagnostic[] {
	const out: Diagnostic[] = [];
	const targets = new Set([...ch.scan.blocks, ...ch.scan.figures].map((b) => b.id));
	const cited = new Set(ch.scan.cites.map((c) => c.id));
	for (const source of ch.data.sources ?? []) {
		if (!source.supports || source.supports.length === 0) continue;
		const line = supportsLine(lines, source.id, ch.idLine);
		for (const id of source.supports) {
			if (!targets.has(id)) {
				out.push({
					file: ch.file,
					line,
					message: `источник "${source.id}": supports ссылается на блок "${id}", которого нет в главе`,
				});
			}
		}
		if (!cited.has(source.id)) {
			out.push({
				file: ch.file,
				line,
				message: `источник "${source.id}" указан в supports, но в тексте нет <Cite id="${source.id}" />`,
				severity: 'warning',
			});
		}
	}
	return out;
}

/** Line of `supports:` for the source `id` in the frontmatter; falls back to the `id:` line. */
function supportsLine(lines: string[], id: string, fallback: number): number {
	const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const start = lines.findIndex((text) =>
		new RegExp(`^\\s*-?\\s*id:\\s*${escaped}\\s*$`).test(text),
	);
	if (start === -1) return fallback;
	for (let i = start + 1; i < lines.length; i++) {
		const text = lines[i] ?? '';
		if (/^\s*-?\s*id:/.test(text) || text.trim() === '---') break;
		if (/^\s*supports:/.test(text)) return i + 1;
	}
	return start + 1;
}

/** Text attributes (`q`, `caption`, `notice`, `alt`) must be plain text: no TeX, no braces. */
function checkTextAttrs(ch: LoadedChapter): Diagnostic[] {
	return ch.scan.badAttrs.map((bad) => ({
		file: ch.file,
		line: bad.line,
		message: `атрибут ${bad.attr} содержит TeX или фигурные скобки ("${bad.value}"): текст без формул, формулы пишите в тексте главы`,
	}));
}

/** Markdown links must not start with `/`: the site can be served under a base path (GitHub Pages). */
function checkAbsoluteLinks(ch: LoadedChapter, lines: string[]): Diagnostic[] {
	const out: Diagnostic[] = [];
	lines.forEach((text, i) => {
		if (/\]\(\/(?!\/)/.test(text)) {
			out.push({
				file: ch.file,
				line: i + 1,
				message:
					'ссылка начинается с "/": не работает под base-путём Pages, используйте относительную (../slug/)',
			});
		}
	});
	return out;
}

/** `<Term id>`: the term exists, and it is not used on a level where its definition is hidden. */
function checkTerms(
	ch: LoadedChapter,
	glossary: Map<
		string,
		{ chapter?: string | undefined; layer?: { c: number; d: number } | undefined }
	>,
	prereqsOf: (id: string) => readonly string[],
	lines: string[],
): Diagnostic[] {
	const out: Diagnostic[] = [];
	const prereqs = transitivePrereqs(ch.data.id, prereqsOf);
	for (const term of ch.scan.terms) {
		const entry = glossary.get(term.id);
		if (!entry) {
			out.push({
				file: ch.file,
				line: term.line,
				message: `термин "${term.id}" не найден в data/glossary`,
			});
			continue;
		}
		if (entry.chapter !== undefined && prereqs.has(entry.chapter)) continue;
		if (entry.layer === undefined) continue;
		const defC: Range = { min: entry.layer.c, max: 4 };
		const defD: Range = { min: entry.layer.d, max: 3 };
		if (!within(term.layer.c, defC) || !within(term.layer.d, defD)) {
			out.push({
				file: ch.file,
				line: lineOf(lines, new RegExp(`id="${term.id}"`), term.line),
				message:
					`термин "${term.id}" используется на c=${term.layer.c.min}-${term.layer.c.max}, d=${term.layer.d.min}-${term.layer.d.max}, ` +
					`а определён только с c>=${entry.layer.c}, d>=${entry.layer.d}`,
			});
		}
	}
	return out;
}

/** Prerequisite graph: chapter prereqs, concept introduction and requirement, no cycles. */
function checkGraph(
	loaded: LoadedContent,
	chapters: Map<string, LoadedChapter>,
	prereqsOf: (id: string) => readonly string[],
): Diagnostic[] {
	const out: Diagnostic[] = [];
	const nodes = new Set<string>(chapters.keys());
	const edges: { from: string; to: string }[] = [];
	const concepts = new Map<string, string>();
	for (const ch of loaded.chapters) {
		for (const concept of ch.data.concepts ?? []) {
			nodes.add(concept.id);
			concepts.set(concept.id, ch.data.id);
			edges.push({ from: ch.data.id, to: concept.id });
		}
	}
	for (const ch of loaded.chapters) {
		for (const p of prereqsOf(ch.data.id)) edges.push({ from: p, to: ch.data.id });
		for (const term of ch.data.requires ?? []) {
			if (concepts.has(term)) {
				edges.push({ from: term, to: ch.data.id });
			} else if (!loaded.glossary.some((g) => g.data.id === term)) {
				out.push({
					file: ch.file,
					line: lineOf(readLines(loaded, ch.file), /^requires:/, ch.idLine),
					message: `requires: понятие "${term}" не введено ни одной главой и не найдено в глоссарии`,
				});
			}
		}
	}
	const cycle = findCycle([...nodes], edges);
	if (cycle) {
		const file = chapters.get(cycle[0] ?? '')?.file ?? 'content';
		out.push({ file, line: 1, message: `цикл в графе пререквизитов: ${cycle.join(' -> ')}` });
	}
	out.push(...checkRoadmaps(loaded));
	return out;
}

/**
 * Roadmap rules: id equals file name and is unique; chapters and labs exist; no chapter or lab
 * is listed twice; a lab belongs to a chapter of its own step; the order never puts a chapter
 * before its prerequisite that is also on the route (that would be a cycle with the graph).
 */
export function checkRoadmaps(loaded: LoadedContent): Diagnostic[] {
	const out: Diagnostic[] = [];
	const chapters = chapterIndex(loaded);
	const labs = new Map(loaded.labs.map((lab) => [lab.data.id, lab.data]));
	const seenIds = new Set<string>();

	for (const road of loaded.roadmaps) {
		const lines = road.text.split(/\r?\n/);
		const at = (pattern: RegExp) => lineOf(lines, pattern, 1);
		const add = (pattern: RegExp, message: string) =>
			out.push({ file: road.file, line: at(pattern), message });

		if (road.data.id !== road.name) {
			add(/^id:/, `id "${road.data.id}" не совпадает с именем файла "${road.name}"`);
		}
		if (seenIds.has(road.data.id)) {
			add(/^id:/, `маршрут "${road.data.id}" определён дважды`);
		}
		seenIds.add(road.data.id);

		const position = new Map<string, number>();
		const seenLabs = new Set<string>();
		let index = 0;
		for (const step of road.data.steps) {
			const stepSet = new Set<string>(step.chapters);
			for (const id of step.chapters) {
				const pattern = itemPattern(id);
				if (!chapters.has(id)) add(pattern, `глава "${id}" не найдена`);
				if (position.has(id)) add(pattern, `глава "${id}" встречается в маршруте дважды`);
				position.set(id, index++);
			}
			for (const labId of step.labs ?? []) {
				const pattern = itemPattern(labId);
				const lab = labs.get(labId);
				if (!lab) add(pattern, `лаб "${labId}" не найден`);
				else if (!stepSet.has(lab.chapter)) {
					add(pattern, `лаб "${labId}" относится к главе "${lab.chapter}", которой нет в этапе`);
				}
				if (seenLabs.has(labId)) add(pattern, `лаб "${labId}" встречается в маршруте дважды`);
				seenLabs.add(labId);
			}
		}
		for (const [id, pos] of position) {
			for (const prereq of chapters.get(id)?.data.prereqs ?? []) {
				const prereqPos = position.get(prereq);
				if (prereqPos !== undefined && prereqPos > pos) {
					add(
						itemPattern(id),
						`порядок маршрута образует цикл: "${id}" стоит раньше своего пререквизита "${prereq}"`,
					);
				}
			}
		}
	}
	return out;
}

/** `user-data/` must not be tracked by this repository (only checked when git is available). */
function checkUserDataNotTracked(root: string): Diagnostic[] {
	if (!existsSync(join(root, 'user-data'))) return [];
	try {
		const tracked = execFileSync('git', ['ls-files', '--', 'user-data'], {
			cwd: root,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
		if (tracked === '') return [];
		return [
			{
				file: 'user-data',
				line: 1,
				message: 'папка user-data отслеживается git (должна быть в .gitignore)',
			},
		];
	} catch {
		return [];
	}
}

function labFiles(lab: {
	starter?: string;
	solution?: string;
	tests?: { visible?: string; hidden?: string };
}): [string, string][] {
	const out: [string, string][] = [];
	if (lab.starter) out.push(['starter', lab.starter]);
	if (lab.solution) out.push(['solution', lab.solution]);
	if (lab.tests?.visible) out.push(['visible', lab.tests.visible]);
	if (lab.tests?.hidden) out.push(['hidden', lab.tests.hidden]);
	return out;
}

const fileCache = new WeakMap<LoadedContent, Map<string, string[]>>();

/** Lines of a repo file, cached per loaded content. Missing files give no lines. */
function readLines(loaded: LoadedContent, file: string): string[] {
	let cache = fileCache.get(loaded);
	if (!cache) {
		cache = new Map();
		fileCache.set(loaded, cache);
	}
	const hit = cache.get(file);
	if (hit) return hit;
	const abs = join(loaded.root, file);
	const lines = existsSync(abs) ? readFileSync(abs, 'utf8').replace(/\r\n/g, '\n').split('\n') : [];
	cache.set(file, lines);
	return lines;
}

function escapeRe(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sortKeys(map: Record<string, string>): Record<string, string> {
	return Object.fromEntries(Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Matches a YAML list item holding exactly `id` (for diagnostic line numbers). */
function itemPattern(id: string): RegExp {
	return new RegExp(String.raw`(^|\s|-)${escapeRe(id)}\s*$`);
}
