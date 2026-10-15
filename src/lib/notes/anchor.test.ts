// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { ChapterTextIndex, NoteAnchor } from '$lib/contracts';
import { anchorFromSelection, chapterTextIndex, resolveAnchor } from './anchor';
import { clearHighlights, highlightRange } from './highlight';

const TEXT =
	'Оценки считаются как скалярное произведение запроса и ключа. Дальше мы делим на корень из d.';

function setup(html: string): HTMLElement {
	const root = document.createElement('article');
	root.innerHTML = html;
	document.body.appendChild(root);
	return root;
}

function select(node: Node, start: number, end: number): Selection {
	const range = document.createRange();
	range.setStart(node, start);
	range.setEnd(node, end);
	const sel = window.getSelection()!;
	sel.removeAllRanges();
	sel.addRange(range);
	return sel;
}

describe('anchorFromSelection', () => {
	it('builds exact quote, context and block id from a selection', () => {
		const root = setup(`<p data-block id="scores-def">${TEXT}</p>`);
		const p = root.querySelector('p')!.firstChild as Text;
		const start = TEXT.indexOf('скалярное');
		const end = start + 'скалярное произведение запроса и ключа'.length;
		const anchor = anchorFromSelection(select(p, start, end), root);
		expect(anchor).not.toBeNull();
		expect(anchor!.blockId).toBe('scores-def');
		expect(anchor!.exact).toBe('скалярное произведение запроса и ключа');
		expect(anchor!.prefix).toBe('Оценки считаются как ');
		// Context is capped at ANCHOR_CONTEXT_CHARS (32).
		expect(anchor!.suffix).toBe('. Дальше мы делим на корень из d');
		expect(anchor!.figureId).toBeUndefined();
		root.remove();
	});

	it('returns null for a collapsed selection', () => {
		const root = setup(`<p data-block id="a-b">${TEXT}</p>`);
		const p = root.querySelector('p')!.firstChild as Text;
		expect(anchorFromSelection(select(p, 3, 3), root)).toBeNull();
		root.remove();
	});

	it('sets figureId and element inside a figure', () => {
		const root = setup(
			'<figure data-figure-id="attn-map"><figcaption>Подпись матрицы весов</figcaption></figure>',
		);
		const cap = root.querySelector('figcaption')!.firstChild as Text;
		const anchor = anchorFromSelection(select(cap, 0, 7), root);
		expect(anchor?.figureId).toBe('attn-map');
		expect(anchor?.blockId).toBe('attn-map');
		expect(anchor?.exact).toBe('Подпись');
		root.remove();
	});
});

describe('resolveAnchor', () => {
	const base: ChapterTextIndex = {
		blocks: [
			{ id: 'intro', text: 'Введение без нужного текста.' },
			{ id: 'scores-def', text: TEXT },
		],
	};
	const anchor: NoteAnchor = {
		blockId: 'scores-def',
		exact: 'скалярное произведение запроса и ключа',
		prefix: 'Оценки считаются как ',
		suffix: '. Дальше',
	};

	it('finds the quote in its own block', () => {
		const res = resolveAnchor(anchor, base);
		expect(res.status).toBe('found');
		if (res.status === 'found') {
			expect(res.range.blockId).toBe('scores-def');
			expect(res.range.start).toBe(TEXT.indexOf('скалярное'));
		}
	});

	it('re-anchors to another block when the block was moved', () => {
		const moved: ChapterTextIndex = {
			blocks: [{ id: 'intro', text: `Новый абзац. ${TEXT}` }],
		};
		const res = resolveAnchor(anchor, moved);
		expect(res.status).toBe('shifted');
		if (res.status === 'shifted') {
			expect(res.anchor.blockId).toBe('intro');
			expect(res.anchor.exact).toBe(anchor.exact);
			expect(res.score).toBe(1);
		}
	});

	it('re-anchors a slightly edited quote through the fuzzy match', () => {
		const edited: ChapterTextIndex = {
			blocks: [
				{
					id: 'scores-def',
					text: 'Оценки считаются как скалярное произведение запроса и ключей. Дальше',
				},
			],
		};
		const res = resolveAnchor(anchor, edited);
		expect(res.status).toBe('shifted');
		if (res.status === 'shifted') {
			expect(res.score).toBeGreaterThanOrEqual(0.8);
			expect(res.anchor.blockId).toBe('scores-def');
		}
	});

	it('returns orphaned when the quote is gone', () => {
		const other: ChapterTextIndex = {
			blocks: [{ id: 'x-y', text: 'Совсем другой текст про сеть.' }],
		};
		expect(resolveAnchor(anchor, other)).toEqual({ status: 'orphaned' });
	});
});

describe('highlightRange', () => {
	it('wraps a quote in note-hl marks and restores the DOM', () => {
		const root = setup('<p data-block id="p-one">Слова <em>курсив</em> и хвост.</p>');
		const p = root.querySelector('p')!;
		const before = p.innerHTML;
		const range = document.createRange();
		range.setStart(p.firstChild!, 2);
		range.setEnd(p.lastChild!, 4);
		const marks = highlightRange(range);
		expect(marks.length).toBeGreaterThan(0);
		expect(p.querySelectorAll('mark.note-hl').length).toBe(marks.length);
		expect(p.textContent).toBe('Слова курсив и хвост.');
		clearHighlights(root);
		expect(p.querySelectorAll('mark.note-hl').length).toBe(0);
		expect(p.innerHTML).toBe(before);
		root.remove();
	});

	it('wraps a quote that lies inside a single text node', () => {
		const root = setup('<p data-block id="p-one">Простой текст абзаца.</p>');
		const p = root.querySelector('p')!;
		const range = document.createRange();
		range.setStart(p.firstChild!, 0);
		range.setEnd(p.firstChild!, 7);
		expect(highlightRange(range)).toHaveLength(1);
		expect(p.querySelector('mark.note-hl')?.textContent).toBe('Простой');
		root.remove();
	});

	it('chapterTextIndex reads blocks including hidden layers', () => {
		const root = setup(
			'<h2 data-block id="sec-one">Раздел</h2><p data-block id="p-two" hidden>Скрытый</p><figure data-figure-id="fig-a"></figure>',
		);
		expect(chapterTextIndex(root).blocks).toEqual([
			{ id: 'sec-one', text: 'Раздел' },
			{ id: 'p-two', text: 'Скрытый' },
			{ id: 'fig-a', text: '' },
		]);
		root.remove();
	});
});
