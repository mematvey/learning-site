import katex from 'katex';
import { checkBlockId } from './block-ids';
import { type MdNode, type PluginFile, walk } from './tree';

/** Inline `$...$`: no leading `$` (so `$$` is left to the block rule), escapes allowed. */
const INLINE_RE = /^\$((?:\\.|[^$\\\n])+)\$/;

/**
 * Display `$$...$$` as a block: the closing `$$` ends the line, and an optional
 * next line `{#id}` gives the id of the formula block.
 */
const BLOCK_RE = /^\$\$([\s\S]*?)\$\$[ \t]*(?:\n[ \t]*\{#([^}\n]*)\}[ \t]*)?(?![^\n])/;

type Eat = (subvalue: string) => (node: MdNode) => MdNode;

interface Tokenizer {
	(eat: Eat, value: string, silent?: boolean): MdNode | boolean | undefined;
	locator?: (value: string, fromIndex: number) => number;
}

interface ParserPrototype {
	blockTokenizers: Record<string, Tokenizer>;
	blockMethods: string[];
	inlineTokenizers: Record<string, Tokenizer>;
	inlineMethods: string[];
}

function inlineMath(eat: Eat, value: string, silent?: boolean) {
	const match = INLINE_RE.exec(value);
	if (!match) return undefined;
	if (silent) return true;
	return eat(match[0])({ type: 'math', value: match[1] ?? '', display: false });
}
inlineMath.locator = (value: string, fromIndex: number) => value.indexOf('$', fromIndex);

function blockMath(eat: Eat, value: string, silent?: boolean) {
	const match = BLOCK_RE.exec(value);
	if (!match || (match[1] ?? '').trim() === '') return undefined;
	if (silent) return true;
	return eat(match[0])({
		type: 'math',
		value: (match[1] ?? '').trim(),
		display: true,
		blockId: match[2] ?? null,
	});
}

/** Escapes braces so Svelte does not read them as expressions. */
export function renderFormula(tex: string, display: boolean): string {
	const html = katex.renderToString(tex, {
		displayMode: display,
		throwOnError: false,
		trust: true,
	});
	return html.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

/**
 * Parser: registers `$...$` and `$$...$$` tokenizers (remark-parse 8 API used by mdsvex 0.12).
 * Transform: replaces math nodes with KaTeX HTML at build time.
 */
export function remarkMath(this: { Parser?: unknown }) {
	const Parser = this.Parser as { prototype: ParserPrototype } | undefined;
	if (Parser) {
		const proto = Parser.prototype;
		proto.blockTokenizers.math = blockMath;
		proto.blockMethods.splice(proto.blockMethods.indexOf('paragraph'), 0, 'math');
		proto.inlineTokenizers.math = inlineMath;
		const escapeAt = proto.inlineMethods.indexOf('escape');
		proto.inlineMethods.splice(escapeAt + 1, 0, 'math');
	}

	return (tree: MdNode, file: PluginFile) => {
		walk(tree, (node) => {
			if (!node.children) return;
			node.children = node.children.map((child) => {
				if (child.type !== 'math') return child;
				return mathToHtml(child, file);
			});
		});
	};
}

function mathToHtml(node: MdNode, file: PluginFile): MdNode {
	const tex = typeof node.value === 'string' ? node.value : '';
	if (node.display !== true) {
		return { type: 'html', value: renderFormula(tex, false) };
	}

	const rawId = typeof node.blockId === 'string' ? node.blockId : null;
	const attrs = rawId === null ? '' : ` id="${checkBlockId(rawId, node, file)}" data-block="true"`;
	return {
		type: 'html',
		value: `<div class="math-display"${attrs}>${renderFormula(tex, true)}</div>`,
	};
}
