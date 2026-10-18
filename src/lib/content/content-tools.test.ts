import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseArgs } from '../../../scripts/lib/args';
import { buildRegistries } from '../../../scripts/lib/build';
import { checkContent } from '../../../scripts/lib/check';
import { formatDiagnostic, isError, type Diagnostic } from '../../../scripts/lib/diagnostics';
import { findCycle, topoOrder, transitivePrereqs } from '../../../scripts/lib/graph';
import { loadContent } from '../../../scripts/lib/load';
import { within } from '../../../scripts/lib/ranges';
import { scanSvx } from '../../../scripts/lib/svx';

const FIXTURE = resolve(process.cwd(), 'scripts/__fixtures__/valid');

let root: string;

/** Copies the valid fixture into a temp folder so a test can break one file. */
function freshRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), 'content-'));
	cpSync(FIXTURE, dir, { recursive: true });
	return dir;
}

function edit(file: string, from: string, to: string): void {
	const abs = join(root, file);
	const text = readFileSync(abs, 'utf8');
	if (!text.includes(from)) throw new Error(`fixture edit: "${from}" not found in ${file}`);
	writeFileSync(
		abs,
		text.replace(from, () => to),
	);
}

function check(): Diagnostic[] {
	return checkContent(loadContent(root));
}

function messages(diagnostics: Diagnostic[]): string[] {
	return diagnostics.map((d) => d.message);
}

beforeEach(() => {
	root = freshRoot();
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('valid fixture', () => {
	it('passes all checks', () => {
		expect(check()).toEqual([]);
	});

	it('builds registries in reading order with prev/next and blocks', () => {
		const r = buildRegistries(loadContent(root));
		const attention = r.chapters.find((c) => c.id === 'dl/attention');
		const softmax = r.chapters.find((c) => c.id === 'dl/softmax');
		expect(r.topics[0]?.chapterIds).toEqual(['dl/softmax', 'dl/attention']);
		expect(softmax?.next).toBe('dl/attention');
		expect(attention?.prev).toBe('dl/softmax');
		expect(attention?.href).toBe('/dl/attention/');
		expect(attention?.blocks).toEqual(['idea', 'variance-note', 'math-scale', 'fig-arcs']);
		expect(attention?.sections.map((s) => s.id)).toEqual(['idea', 'math-scale']);
	});

	it('adds starter hash and topic to labs', () => {
		const r = buildRegistries(loadContent(root));
		const lab = r.labs[0];
		expect(lab?.topic).toBe('dl');
		expect(lab?.dir).toBe('labs/dl-attention-numpy');
		expect(lab?.starterHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('merges frontmatter and file aliases', () => {
		const r = buildRegistries(loadContent(root));
		expect(r.aliases).toEqual({
			'dl/old-softmax': 'dl/softmax',
			'dl/scaled-attention': 'dl/attention',
		});
	});

	it('builds the prerequisite graph with prereq, introduces and requires edges', () => {
		const r = buildRegistries(loadContent(root));
		const kinds = r.prereqGraph.edges.map((e) => `${e.kind}:${e.from}>${e.to}`).sort();
		expect(kinds).toEqual([
			'introduces:dl/attention>attention-scores',
			'introduces:dl/softmax>softmax',
			'prereq:dl/softmax>dl/attention',
			'requires:softmax>dl/attention',
		]);
	});
});

describe('check-content errors', () => {
	it('rejects a block id that is not kebab-case', () => {
		edit('content/dl/softmax/index.svx', '{#softmax-sum}', '{#Softmax_Sum}');
		const d = check();
		expect(messages(d)).toContainEqual('неверный формат id блока "Softmax_Sum": нужен kebab-case');
		expect(formatDiagnostic(d[0] as Diagnostic)).toMatch(/^content\/dl\/softmax\/index\.svx:\d+: /);
	});

	it('rejects a duplicate block id inside one chapter', () => {
		edit('content/dl/attention/index.svx', '{#variance-note}', '{#idea}');
		expect(messages(check()).some((m) => m.startsWith('id блока "idea" уже использован'))).toBe(
			true,
		);
	});

	it('rejects a prerequisite cycle', () => {
		edit('content/dl/softmax/index.svx', 'prereqs: []', 'prereqs: [dl/attention]');
		expect(messages(check()).some((m) => m.startsWith('цикл в графе пререквизитов'))).toBe(true);
	});

	it('rejects a missing prerequisite', () => {
		edit('content/dl/attention/index.svx', 'prereqs: [dl/softmax]', 'prereqs: [dl/nope]');
		expect(messages(check())).toContain('пререквизит "dl/nope" не найден');
	});

	it('rejects a lab file that does not exist', () => {
		rmSync(join(root, 'labs/dl-attention-numpy/solution.py'));
		expect(messages(check())).toContain('файл "solution.py" не найден в labs/dl-attention-numpy/');
	});

	it('rejects a term used above the level where it is defined', () => {
		edit('content/dl/attention/index.svx', '<Level c={3}>', '<Level c={2}>');
		expect(messages(check()).some((m) => m.startsWith('термин "variance" используется'))).toBe(
			true,
		);
	});

	it('rejects a Term that is not in the glossary', () => {
		edit(
			'content/dl/attention/index.svx',
			'<Term id="softmax"></Term>',
			'<Term id="ghost"></Term>',
		);
		expect(messages(check())).toContain('термин "ghost" не найден в data/glossary');
	});

	it('rejects a frontmatter id that does not match its folder', () => {
		edit('content/dl/softmax/index.svx', 'id: dl/softmax', 'id: dl/other');
		expect(messages(check())).toContain('id "dl/other" не совпадает с путём "dl/softmax"');
	});

	it('reports schema problems with file and line', () => {
		edit('content/dl/topic.yaml', 'order: 1', 'order: -1');
		const d = check();
		const hit = d.find((x) => x.file === 'content/dl/topic.yaml');
		expect(hit?.line).toBe(4);
		expect(hit?.message).toMatch(/^order:/);
	});

	it('rejects an alias that names an existing chapter', () => {
		edit('data/aliases.yaml', 'dl/old-softmax: dl/softmax', 'dl/attention: dl/softmax');
		expect(messages(check()).some((m) => m.includes('совпадает с существующей главой'))).toBe(true);
	});
});

describe('sources, citations and text attributes', () => {
	const ATTENTION = 'content/dl/attention/index.svx';
	const FENCE = '```';

	it('rejects supports that names a block missing from the chapter', () => {
		edit(ATTENTION, 'supports: [math-scale]', 'supports: [math-missing]');
		const errors = check().filter(isError);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toContain('"math-missing"');
		expect(errors[0]?.file).toBe(ATTENTION);
		expect(errors[0]?.line).toBe(
			readFileSync(join(root, ATTENTION), 'utf8')
				.split('\n')
				.findIndex((l) => l.includes('supports: [math-missing]')) + 1,
		);
	});

	it('accepts supports that names a figure id', () => {
		edit(ATTENTION, 'supports: [math-scale]', 'supports: [fig-arcs]');
		expect(check()).toEqual([]);
	});

	it('warns, without an error, when a source with supports is never cited', () => {
		edit(ATTENTION, '<Cite id="vaswani2017" />', '');
		const d = check();
		expect(d).toHaveLength(1);
		expect(d[0]?.severity).toBe('warning');
		expect(d[0]?.message).toContain('<Cite id="vaswani2017" />');
		expect(d.filter(isError)).toEqual([]);
		expect(formatDiagnostic(d[0] as Diagnostic)).toMatch(/: предупреждение: /);
	});

	it('does not count a Cite that sits inside fenced code', () => {
		edit(ATTENTION, '<Cite id="vaswani2017" />', '');
		appendFileSync(join(root, ATTENTION), `\n${FENCE}\n<Cite id="vaswani2017" />\n${FENCE}\n`);
		const d = check();
		expect(d.map((x) => x.severity)).toEqual(['warning']);
	});

	it('rejects TeX in an alt attribute', () => {
		edit(ATTENTION, 'alt="Шесть токенов в ряд."', 'alt="Вес $\\alpha$ токена."');
		const errors = check().filter(isError);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toContain('атрибут alt');
		expect(errors[0]?.line).toBe(
			readFileSync(join(root, ATTENTION), 'utf8')
				.split('\n')
				.findIndex((l) => l.includes('alt="Вес')) + 1,
		);
	});

	it('rejects braces in a caption attribute, on the line of the attribute of a multi-line tag', () => {
		edit(
			ATTENTION,
			'<Figure id="fig-arcs" caption="Веса внимания" alt="Шесть токенов в ряд.">',
			'<Figure id="fig-arcs"\n  caption="Веса {внимания}"\n  alt="Шесть токенов в ряд.">',
		);
		const errors = check().filter(isError);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toContain('атрибут caption');
		expect(errors[0]?.line).toBe(
			readFileSync(join(root, ATTENTION), 'utf8')
				.split('\n')
				.findIndex((l) => l.includes('caption="Веса {')) + 1,
		);
	});

	it('rejects a backslash in a notice attribute', () => {
		edit(
			ATTENTION,
			'<Figure id="fig-arcs" caption="Веса внимания" alt="Шесть токенов в ряд.">',
			'<Figure id="fig-arcs" caption="Веса внимания" alt="Шесть токенов в ряд." notice="сумма \\alpha = 1">',
		);
		const errors = check().filter(isError);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toContain('атрибут notice');
	});

	it('ignores TeX-like text inside fenced code', () => {
		appendFileSync(
			join(root, ATTENTION),
			`\n${FENCE}\n<Figure id="fig-code" alt="$x^2$ {y}">\n${FENCE}\n`,
		);
		expect(check()).toEqual([]);
	});

	it('accepts plain text in q, caption, notice and alt', () => {
		edit(
			ATTENTION,
			'<Figure id="fig-arcs" caption="Веса внимания" alt="Шесть токенов в ряд.">',
			'<Figure id="fig-arcs" caption="Веса внимания: строка 1" alt="Шесть токенов в ряд." notice="сумма по строке равна 1">',
		);
		expect(check()).toEqual([]);
	});
});

describe('control characters', () => {
	const ATTENTION = 'content/dl/attention/index.svx';
	const FENCE = '```';

	it('rejects a control character in formula text, with file and line', () => {
		appendFileSync(join(root, ATTENTION), '\nПример: $a \x07pprox 1$.\n');
		const d = check().filter((x) => x.file === ATTENTION);
		expect(messages(d)).toContainEqual(expect.stringContaining('управляющий символ U+0007'));
		expect(d.some((x) => x.line > 1)).toBe(true);
	});

	it('rejects CR and form feed in a chapter', () => {
		appendFileSync(join(root, ATTENTION), '\nЧисло $\\frac12\x0c$ и $x\r$.\n');
		const found = messages(check()).filter((m) => m.includes('управляющий символ'));
		expect(found).toHaveLength(2);
		expect(found.join('\n')).toContain('U+000C');
		expect(found.join('\n')).toContain('U+000D');
	});

	it('rejects a TAB outside fenced code', () => {
		appendFileSync(join(root, ATTENTION), '\n$Q K^\top$ в тексте.\n');
		expect(messages(check())).toContain(
			'символ TAB вне блока кода: в тексте главы используйте пробелы',
		);
	});

	it('allows TAB and control characters inside fenced code', () => {
		appendFileSync(join(root, ATTENTION), `\n${FENCE}\n\tx = 1\n${FENCE}\n`);
		expect(check()).toEqual([]);
	});

	it('rejects a control character in a glossary file', () => {
		appendFileSync(join(root, 'data/glossary/dl.yaml'), '# заметка \x08eta\n');
		expect(messages(check())).toContainEqual(expect.stringContaining('управляющий символ U+0008'));
	});
});

describe('level scanning', () => {
	it('intersects Level and Variant layers and reports Term layers', () => {
		const scan = scanSvx(
			[
				'<Level c={3}>',
				'<Variant d="2-3">',
				'<Term id="x"></Term>',
				'</Variant>',
				'</Level>',
				'<Term id="y"></Term>',
			].join('\n'),
			1,
		);
		const [x, y] = scan.terms;
		expect(x?.layer).toEqual({ c: { min: 3, max: 4 }, d: { min: 2, max: 3 } });
		expect(y?.layer).toEqual({ c: { min: 1, max: 4 }, d: { min: 1, max: 3 } });
	});

	it('ignores fenced code and flags bad Variant ranges', () => {
		const scan = scanSvx(
			['```', '{#in-code}', '```', '<Variant c="4-2">', '</Variant>'].join('\n'),
			1,
		);
		expect(scan.blocks).toEqual([]);
		expect(scan.badLevelTags).toHaveLength(1);
	});
});

describe('graph and range helpers', () => {
	it('finds a cycle and returns it closed', () => {
		const cycle = findCycle(
			['a', 'b', 'c'],
			[
				{ from: 'a', to: 'b' },
				{ from: 'b', to: 'c' },
				{ from: 'c', to: 'a' },
			],
		);
		expect(cycle?.[0]).toBe(cycle?.at(-1));
		expect(findCycle(['a', 'b'], [{ from: 'a', to: 'b' }])).toBeNull();
	});

	it('orders prerequisites first with alphabetical ties and keeps cyclic ids at the end', () => {
		const deps: Record<string, string[]> = { c: ['a'], b: [], a: [], x: ['y'], y: ['x'] };
		expect(topoOrder(Object.keys(deps), (id) => deps[id] ?? [])).toEqual(['a', 'b', 'c', 'x', 'y']);
	});

	it('collects transitive prerequisites', () => {
		const deps: Record<string, string[]> = { c: ['b'], b: ['a'], a: [] };
		expect([...transitivePrereqs('c', (id) => deps[id] ?? [])].sort()).toEqual(['a', 'b']);
	});

	it('checks range containment', () => {
		expect(within({ min: 3, max: 4 }, { min: 2, max: 4 })).toBe(true);
		expect(within({ min: 1, max: 4 }, { min: 3, max: 4 })).toBe(false);
	});

	it('parses CLI flags with defaults relative to the root', () => {
		const args = parseArgs(['--root', 'x'], '/base');
		expect(args.root).toMatch(/x$/);
		expect(args.out).toMatch(/src[\\/]generated$/);
	});
});
