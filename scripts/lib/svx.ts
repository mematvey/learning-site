import { type AxisRange, fullRange, intersect, type Range } from './ranges';

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export interface SvxSection {
	id: string;
	title: string;
	level: 2 | 3;
	line: number;
}

export interface SvxItem {
	id: string;
	line: number;
}

export interface SvxTerm extends SvxItem {
	/** Level layer in which the mention is visible (intersection of enclosing Level/Variant). */
	layer: AxisRange;
}

export interface SvxScan {
	sections: SvxSection[];
	/** Valid `{#id}` markers (paragraphs, headings, list items, formulas). */
	blocks: SvxItem[];
	/** `{#...}` markers whose content is not kebab-case. */
	invalidBlocks: (SvxItem & { raw: string })[];
	/** `Figure id` props. */
	figures: SvxItem[];
	/** `Term id` mentions with their level layer. */
	terms: SvxTerm[];
	/** Level/Variant tags whose attributes could not be read. */
	badLevelTags: { line: number; text: string }[];
}

interface StackEntry {
	layer: AxisRange;
	tag: 'Level' | 'Variant';
}

const TAG = /<(\/?)(Level|Variant)\b([^>]*)>/g;
const LEVEL_ATTR = /\b([cd])=\{(\d+)\}/;
const VARIANT_ATTR = /\b([cd])="([^"]*)"/;

/**
 * Scans the body of an `index.svx` (frontmatter already removed).
 * `firstLine` is the 1-based line number of `body`'s first line in the file.
 */
export function scanSvx(body: string, firstLine: number): SvxScan {
	const scan: SvxScan = {
		sections: [],
		blocks: [],
		invalidBlocks: [],
		figures: [],
		terms: [],
		badLevelTags: [],
	};
	const stack: StackEntry[] = [];
	let inFence = false;

	body.split('\n').forEach((text, index) => {
		const line = firstLine + index;

		if (/^\s*```/.test(text)) {
			inFence = !inFence;
			return;
		}
		if (inFence) return;

		const marker = /\{#([^}]*)\}\s*$/.exec(text);
		if (marker) {
			const raw = marker[1] ?? '';
			if (KEBAB.test(raw)) scan.blocks.push({ id: raw, line });
			else scan.invalidBlocks.push({ id: raw, raw, line });
		}

		const heading = /^(#{2,3})\s+(.*?)\s*(\{#[^}]*\})?\s*$/.exec(text);
		if (heading && marker && KEBAB.test(marker[1] ?? '')) {
			scan.sections.push({
				id: marker[1] ?? '',
				title: heading[2] ?? '',
				level: heading[1]?.length === 2 ? 2 : 3,
				line,
			});
		}

		for (const figure of text.matchAll(/<Figure\b[^>]*?\sid="([^"]+)"/g)) {
			scan.figures.push({ id: figure[1] ?? '', line });
		}

		for (const term of text.matchAll(/<Term\b[^>]*?\bid="([^"]+)"/g)) {
			scan.terms.push({ id: term[1] ?? '', line, layer: currentLayer(stack) });
		}

		for (const tag of text.matchAll(TAG)) {
			const [, closing, name, attrs = ''] = tag;
			if (closing) {
				const at = stack.map((e) => e.tag).lastIndexOf(name as StackEntry['tag']);
				if (at !== -1) stack.splice(at, 1);
				continue;
			}
			if (attrs.trimEnd().endsWith('/')) continue;
			const layer = readLayer(name as StackEntry['tag'], attrs);
			if (layer === null) {
				scan.badLevelTags.push({ line, text: tag[0] });
				stack.push({ tag: name as StackEntry['tag'], layer: fullRange() });
			} else {
				stack.push({ tag: name as StackEntry['tag'], layer });
			}
		}
	});

	return scan;
}

function currentLayer(stack: readonly StackEntry[]): AxisRange {
	return stack.reduce<AxisRange>((acc, entry) => intersect(acc, entry.layer), fullRange());
}

/** `Level c={3}` -> c from 3 up (additive). `Variant c="2-4"` -> exactly that range. */
function readLayer(tag: StackEntry['tag'], attrs: string): AxisRange | null {
	if (tag === 'Level') {
		const range: AxisRange = fullRange();
		const matches = [...attrs.matchAll(new RegExp(LEVEL_ATTR.source, 'g'))];
		if (matches.length === 0) return range;
		for (const [, axis, value] of matches) {
			const n = Number(value);
			if (axis === 'c') range.c = { min: n, max: 4 };
			else range.d = { min: n, max: 3 };
		}
		return range;
	}
	const range: AxisRange = fullRange();
	const matches = [...attrs.matchAll(new RegExp(VARIANT_ATTR.source, 'g'))];
	if (matches.length === 0) return null;
	for (const [, axis, value] of matches) {
		const parsed = parseSpan(value ?? '');
		if (!parsed) return null;
		if (axis === 'c') range.c = parsed;
		else range.d = parsed;
	}
	return range;
}

function parseSpan(text: string): Range | null {
	const m = /^(\d+)(?:-(\d+))?$/.exec(text.trim());
	if (!m) return null;
	const min = Number(m[1]);
	const max = m[2] === undefined ? min : Number(m[2]);
	return min <= max ? { min, max } : null;
}
