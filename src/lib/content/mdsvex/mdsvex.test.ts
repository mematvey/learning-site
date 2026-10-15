import { compile as compileSvelte } from 'svelte/compiler';
import { compile } from 'mdsvex';
import { describe, expect, it } from 'vitest';
import { remarkPlugins, rehypePlugins } from './index';

async function build(source: string, filename = 'test.svx'): Promise<string> {
	const result = await compile(source, { filename, remarkPlugins, rehypePlugins });
	if (!result) throw new Error('mdsvex returned no result');
	return result.code;
}

/** The output must be valid Svelte, otherwise the page would fail at build time. */
function assertSvelteValid(code: string): void {
	compileSvelte(code, { generate: 'server' });
}

describe('formulas', () => {
	it('renders inline math as KaTeX HTML and escapes braces', async () => {
		const code = await build('Значение $\frac{1}{2}$ здесь.\n');
		expect(code).toContain('katex');
		expect(code).toContain('&#123;');
		expect(code).toContain('&#125;');
		expect(code).not.toMatch(/\frac\{1\}/);
		assertSvelteValid(code);
	});

	it('keeps underscores inside math out of emphasis', async () => {
		const code = await build('Пусть $a_1 * b_2$ и $c_3$.\n');
		expect(code).not.toContain('<em>');
		expect(code).toContain('katex');
		assertSvelteValid(code);
	});

	it('wraps display math in div.math-display', async () => {
		const code = await build('Текст\n\n$$\n\\sum_{i} x_i\n$$\n\nДалее.\n');
		expect(code).toContain('<div class="math-display"');
		expect(code).not.toContain('data-block');
		assertSvelteValid(code);
	});

	it('puts a {#id} line after $$ on the math-display div', async () => {
		const code = await build('$$\nX = 1\n$$\n{#eq-variance}\n');
		expect(code).toMatch(/<div class="math-display" id="eq-variance" data-block="true">/);
		expect(code).not.toContain('{#eq-variance}');
		assertSvelteValid(code);
	});

	it('keeps $ in plain text when it is not a formula', async () => {
		const code = await build('Цена \\$5 и заметка.\n');
		expect(code).toContain('$5');
		expect(code).not.toContain('katex');
	});
});

describe('block ids', () => {
	it('moves a trailing {#id} from a paragraph to the element', async () => {
		const code = await build('Абзац текста. {#scale-note}\n');
		expect(code).toMatch(/<p id="scale-note" data-block="true">Абзац текста\.<\/p>/);
		expect(code).not.toContain('{#');
		assertSvelteValid(code);
	});

	it('puts the id on a heading', async () => {
		const code = await build('## Заголовок {#intro}\n');
		expect(code).toMatch(/<h2 id="intro" data-block="true">Заголовок<\/h2>/);
		assertSvelteValid(code);
	});

	it('puts the id on a list item, including tight lists', async () => {
		const code = await build('- первый\n- второй {#item-two}\n');
		expect(code).toMatch(/<li id="item-two" data-block="true">второй<\/li>/);
		expect(code).not.toContain('{#');
		assertSvelteValid(code);
	});

	it('fails the build with file and line on a bad id', async () => {
		const source = 'Первая строка.\n\nВторая {#Bad_Id}\n';
		await expect(build(source, 'dl/attention/index.svx')).rejects.toThrow(
			/dl\/attention\/index\.svx:3: неверный id блока «Bad_Id»/,
		);
	});
});

describe('sections', () => {
	it('wraps each h2 and its content in section.sec', async () => {
		const code = await build('## Один {#one}\n\nТекст.\n\n## Два {#two}\n\nЕщё.\n');
		expect(code.match(/<section class="sec"/g)).toHaveLength(2);
		expect(code).toContain('aria-labelledby="one"');
		expect(code.match(/<\/section>/g)).toHaveLength(2);
		assertSvelteValid(code);
	});
});

describe('component auto-import', () => {
	it('adds imports for used components to a new script', async () => {
		const code = await build('<Level c={3}>\n\nВывод.\n\n</Level>\n');
		expect(code).toContain("import Level from '$lib/components/Level.svelte';");
		expect(code).toContain('<script>');
		assertSvelteValid(code);
	});

	it('extends an existing script without duplicating imports', async () => {
		const source =
			'<script>\n\timport Level from "$lib/components/Level.svelte";\n</script>\n\n' +
			'<Level c={3}>\n\nТекст.\n\n</Level>\n\n<Callout kind="warn">Осторожно.</Callout>\n';
		const code = await build(source);
		const occurrences = code.match(/import Level /g) ?? [];
		expect(occurrences).toHaveLength(1);
		expect(code).toContain("import Callout from '$lib/components/Callout.svelte';");
		assertSvelteValid(code);
	});

	it('maps AttentionDemo to the demos folder and leaves unknown tags alone', async () => {
		const code = await build('<AttentionDemo />\n\n<Unknown />\n');
		expect(code).toContain(
			"import AttentionDemo from '$lib/components/demos/AttentionDemo.svelte';",
		);
		expect(code).not.toContain('import Unknown');
	});
});
