// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type {
	AnchorResolution,
	ChapterTextIndex,
	Note,
	NoteAnchor,
	NotesStore,
} from '$lib/contracts';
import { anchorFromSelection, chapterTextIndex, resolveAnchor } from './anchor';
import { rangeInBlock } from './highlight';
import { currentBlockId, isMoved, persistReanchors } from './reanchor';
import { visibleText } from './text';

const TEXT =
	'Оценки считаются как скалярное произведение запроса и ключа. Дальше мы делим на корень из d.';

const anchor: NoteAnchor = {
	blockId: 'scores-def',
	exact: 'скалярное произведение запроса и ключа',
	prefix: 'Оценки считаются как ',
	suffix: '. Дальше',
};

const note = (overrides: Partial<Note> = {}): Note =>
	({
		schemaVersion: 1,
		id: '01JC3X4N8Q0Z9M7K2V5R6T1WYA',
		chapter: 'dl/attention',
		anchor,
		text: 'Вопрос',
		tags: [],
		status: 'open',
		created: '2026-01-01T00:00:00.000Z',
		updated: '2026-01-01T00:00:00.000Z',
		...overrides,
	}) as Note;

function fakeStore(): NotesStore & { update: ReturnType<typeof vi.fn> } {
	return {
		update: vi.fn(async () => note()),
		listByChapter: async () => [],
		list: async () => [],
		get: async () => undefined,
		create: async () => note(),
		delete: async () => {},
		subscribe: () => () => {},
	} as unknown as NotesStore & { update: ReturnType<typeof vi.fn> };
}

function setup(html: string): HTMLElement {
	const root = document.createElement('article');
	root.innerHTML = html;
	document.body.appendChild(root);
	return root;
}

function select(start: Node, startOffset: number, end: Node, endOffset: number): Selection {
	const range = document.createRange();
	range.setStart(start, startOffset);
	range.setEnd(end, endOffset);
	const sel = window.getSelection()!;
	sel.removeAllRanges();
	sel.addRange(range);
	return sel;
}

describe('re-anchoring', () => {
	const base: ChapterTextIndex = {
		blocks: [
			{ id: 'intro', text: 'Введение без нужного текста.' },
			{ id: 'scores-def', text: TEXT },
		],
	};

	it('a match inside the same block is not a move', () => {
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
		expect(isMoved(note(), res)).toBe(false);
	});

	it('an exact quote found in another block is a move and is reported, not hidden', () => {
		const moved: ChapterTextIndex = { blocks: [{ id: 'intro', text: `Новый абзац. ${TEXT}` }] };
		const res = resolveAnchor(anchor, moved);
		expect(res.status).toBe('shifted');
		expect(isMoved(note(), res)).toBe(true);
		expect(currentBlockId(note(), res)).toBe('intro');
	});

	it('the original block wins over a same phrase elsewhere in the chapter', () => {
		const duplicated: ChapterTextIndex = {
			blocks: [
				{ id: 'intro', text: `Фраза: ${anchor.exact}. Конец.` },
				{ id: 'scores-def', text: TEXT },
			],
		};
		const res = resolveAnchor(anchor, duplicated);
		expect(res.status).toBe('found');
		expect(isMoved(note(), res)).toBe(false);
	});

	it('a quote edited by a few words is found through a window of another length', () => {
		const longer: ChapterTextIndex = {
			blocks: [
				{
					id: 'intro',
					text: 'Оценки считаются как скалярное произведение запроса и ключа в модели. Дальше',
				},
			],
		};
		const res = resolveAnchor(anchor, longer);
		expect(res.status).toBe('shifted');
		if (res.status === 'shifted') expect(res.score).toBeGreaterThanOrEqual(0.8);
	});

	it('orphaned notes are never persisted', async () => {
		const store = fakeStore();
		const gone: ChapterTextIndex = { blocks: [{ id: 'x-y', text: 'Совсем другой текст.' }] };
		const resolutions: Record<string, AnchorResolution> = {
			'01JC3X4N8Q0Z9M7K2V5R6T1WYA': resolveAnchor(anchor, gone),
		};
		await persistReanchors(store, [note()], resolutions);
		expect(store.update).not.toHaveBeenCalled();
	});

	it('a confident same-block re-anchor is written to the store', async () => {
		const store = fakeStore();
		const edited: ChapterTextIndex = {
			blocks: [
				{
					id: 'scores-def',
					text: 'Оценки считаются как скалярное произведение запроса и ключей. Дальше',
				},
			],
		};
		const res = resolveAnchor(anchor, edited);
		await persistReanchors(store, [note()], { [note().id]: res });
		expect(store.update).toHaveBeenCalledTimes(1);
		const [id, patch] = store.update.mock.calls[0] as unknown as [string, { anchor: NoteAnchor }];
		expect(id).toBe(note().id);
		expect(patch.anchor.blockId).toBe('scores-def');
		expect(patch.anchor.exact).toContain('скалярное произведение запроса');
	});

	it('a move to another block is not written silently', async () => {
		const store = fakeStore();
		const res = resolveAnchor(anchor, {
			blocks: [{ id: 'intro', text: `Новый абзац. ${TEXT}` }],
		});
		await persistReanchors(store, [note()], { [note().id]: res });
		expect(store.update).not.toHaveBeenCalled();
	});

	it('found anchors are not rewritten', async () => {
		const store = fakeStore();
		const res = resolveAnchor(anchor, base);
		await persistReanchors(store, [note()], { [note().id]: res });
		expect(store.update).not.toHaveBeenCalled();
	});
});

describe('formulas', () => {
	// KaTeX output: visible glyphs in `.katex-html`, a hidden MathML copy in `.katex-mathml`.
	const FORMULA =
		'<span class="katex"><span class="katex-mathml"><math><semantics><mi>d</mi>' +
		'<annotation encoding="application/x-tex">d_k</annotation></semantics></math></span>' +
		'<span class="katex-html">d</span></span>';

	it('the text index counts the visible formula once, without TeX source', () => {
		const root = setup(`<p data-block id="f-1">Ошибка ${FORMULA} мала</p>`);
		const block = root.querySelector('p')!;
		expect(visibleText(block)).toBe('Ошибка d мала');
		expect(chapterTextIndex(root).blocks).toEqual([{ id: 'f-1', text: 'Ошибка d мала' }]);
		root.remove();
	});

	it('an anchor after a formula has the same context the reader sees', () => {
		const root = setup(`<p data-block id="f-1">Ошибка ${FORMULA} мала на выборке.</p>`);
		const p = root.querySelector('p')!;
		const after = p.lastChild as Text;
		const sel = select(after, 1, after, 5);
		const anchor = anchorFromSelection(sel, root);
		expect(anchor).not.toBeNull();
		expect(anchor!.exact).toBe('мала');
		expect(anchor!.prefix).toBe('Ошибка d ');
		root.remove();
	});

	it('a range that starts inside the formula maps back to visible offsets', () => {
		const root = setup(`<p data-block id="f-1">Ошибка ${FORMULA} мала</p>`);
		const p = root.querySelector('p')!;
		const html = p.querySelector('.katex-html')!.firstChild!;
		const end = p.lastChild as Text;
		const sel = select(html, 0, end, 5);
		const anchor = anchorFromSelection(sel, root);
		expect(anchor).not.toBeNull();
		expect(anchor!.exact).toBe('d мала');
		root.remove();
	});

	it('rangeInBlock skips the MathML copy when mapping visible offsets', () => {
		const root = setup(`<p data-block id="f-1">Ошибка ${FORMULA} мала</p>`);
		const p = root.querySelector('p')!;
		const range = rangeInBlock(p, 7, 13);
		expect(range).not.toBeNull();
		expect(range!.toString()).toBe('d мала');
		root.remove();
	});

	it('an anchor made from a formula resolves in its own block', () => {
		const root = setup(`<p data-block id="f-1">Ошибка ${FORMULA} мала на выборке.</p>`);
		const p = root.querySelector('p')!;
		const after = p.lastChild as Text;
		const made = anchorFromSelection(select(after, 1, after, 5), root)!;
		const res = resolveAnchor(made, chapterTextIndex(root));
		expect(res.status).toBe('found');
		root.remove();
	});
});
