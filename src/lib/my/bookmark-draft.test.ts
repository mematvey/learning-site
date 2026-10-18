// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Bookmark, BookmarkDraft, MyStore } from '$lib/contracts/my';
import {
	bookmarkKey,
	commitBookmark,
	COMMENT_MAX,
	draftFromElement,
	draftFromSelection,
	findBookmarkTargets,
	targetFrom,
	texOf,
} from './bookmark-draft';

const TOPIC = 'dl';
const CHAPTER = 'dl/attention';

function setup(html: string): HTMLElement {
	const root = document.createElement('article');
	root.innerHTML = html;
	document.body.appendChild(root);
	return root;
}

const PAGE = `
<p data-block="true" id="intro">Оценки считаются как скалярное произведение запроса и ключа.</p>
<div class="math-display" id="eq-scores" data-block="true"><span class="katex"><annotation encoding="application/x-tex">QK^T</annotation></span></div>
<p data-block="true" id="para-term">Здесь есть <abbr class="term" data-term="attention-head">голова</abbr> внимания.</p>
<p data-block="true" id="para-inline">Формула <span class="katex" id="inline-f"><math><semantics><annotation encoding="application/x-tex">\\sqrt{d}</annotation></semantics></math>x</span> внутри.</p>
<figure data-figure-id="fig-heads"><figcaption>Рис.</figcaption></figure>
`;

describe('draftFromElement', () => {
	it('builds a block draft from a paragraph with an id', () => {
		const root = setup(PAGE);
		const el = root.querySelector('#intro') as HTMLElement;
		const draft = draftFromElement(el, root, TOPIC, CHAPTER);
		expect(draft).toEqual({
			kind: 'block',
			topic: TOPIC,
			chapter: CHAPTER,
			blockId: 'intro',
			comment: '',
		});
	});

	it('builds a formula draft with TeX as the quote for a display formula', () => {
		const root = setup(PAGE);
		const el = root.querySelector('.katex') as HTMLElement;
		expect(targetFrom(el)?.id).toBe('eq-scores');
		const draft = draftFromElement(targetFrom(el)!, root, TOPIC, CHAPTER);
		expect(draft?.kind).toBe('formula');
		expect(draft?.blockId).toBe('eq-scores');
		expect(draft?.quote).toBe('QK^T');
	});

	it('builds an inline formula draft anchored to the nearest block', () => {
		const root = setup(PAGE);
		const el = root.querySelector('#inline-f') as HTMLElement;
		expect(texOf(el)).toBe('\\sqrt{d}');
		const draft = draftFromElement(targetFrom(el)!, root, TOPIC, CHAPTER);
		expect(draft).toMatchObject({ kind: 'formula', blockId: 'para-inline', quote: '\\sqrt{d}' });
	});

	it('builds a term draft with termId and the nearest block', () => {
		const root = setup(PAGE);
		const el = root.querySelector('[data-term]') as HTMLElement;
		const draft = draftFromElement(targetFrom(el)!, root, TOPIC, CHAPTER);
		expect(draft).toMatchObject({ kind: 'term', termId: 'attention-head', blockId: 'para-term' });
	});

	it('builds a figure draft from data-figure-id', () => {
		const root = setup(PAGE);
		const el = root.querySelector('[data-figure-id]') as HTMLElement;
		const draft = draftFromElement(el, root, TOPIC, CHAPTER);
		expect(draft).toMatchObject({ kind: 'figure', blockId: 'fig-heads' });
	});

	it('returns null for an element outside any block', () => {
		const root = setup('<p>no id here</p>');
		const el = root.querySelector('p') as HTMLElement;
		expect(draftFromElement(el, root, TOPIC, CHAPTER)).toBeNull();
	});
});

describe('draftFromSelection', () => {
	it('takes the selected text as the quote with context', () => {
		const root = setup(PAGE);
		const p = root.querySelector('#intro')!.firstChild!;
		const range = document.createRange();
		range.setStart(p, 0);
		range.setEnd(p, 12);
		const sel = window.getSelection()!;
		sel.removeAllRanges();
		sel.addRange(range);
		const draft = draftFromSelection(sel, root, TOPIC, CHAPTER);
		expect(draft).toMatchObject({ kind: 'block', blockId: 'intro', quote: 'Оценки счита' });
		expect(draft?.suffix).toBe('ются как скалярное произведение ');
		sel.removeAllRanges();
	});

	it('returns null for a collapsed selection', () => {
		const root = setup(PAGE);
		const sel = window.getSelection()!;
		sel.removeAllRanges();
		expect(draftFromSelection(sel, root, TOPIC, CHAPTER)).toBeNull();
	});
});

describe('bookmarkKey and findBookmarkTargets', () => {
	it('separates targets by kind, block, term and quote', () => {
		const a = bookmarkKey({ kind: 'term', blockId: 'para-term', termId: 'attention-head' });
		const b = bookmarkKey({ kind: 'block', blockId: 'para-term' });
		expect(a).not.toBe(b);
	});

	it('finds the block element and the term instances inside it', () => {
		const root = setup(PAGE);
		expect(findBookmarkTargets(root, { blockId: 'intro' })).toHaveLength(1);
		expect(
			findBookmarkTargets(root, { blockId: 'fig-heads' })[0]?.getAttribute('data-figure-id'),
		).toBe('fig-heads');
		expect(
			findBookmarkTargets(root, { blockId: 'para-term', termId: 'attention-head' }),
		).toHaveLength(1);
		expect(findBookmarkTargets(root, { blockId: 'intro', termId: 'attention-head' })).toHaveLength(
			0,
		);
	});
});

/** Minimal in-memory bookmarks collection; enough for the commit path. */
function memoryStore(): { store: MyStore; items: Bookmark[] } {
	const items: Bookmark[] = [];
	let seq = 0;
	const bookmarks = {
		list: async () => items,
		add: async (draft: BookmarkDraft) => {
			seq += 1;
			const b = {
				...draft,
				schemaVersion: 1,
				id: `0000000000000000000000000${seq}`.slice(-26),
				created: '2026-10-18T10:00:00Z',
				updated: '2026-10-18T10:00:00Z',
			} as Bookmark;
			items.push(b);
			return b;
		},
		update: async (id: string, patch: Partial<BookmarkDraft>) => {
			const b = items.find((x) => x.id === id)!;
			Object.assign(b, patch);
			return b;
		},
		remove: async (id: string) => {
			items.splice(
				items.findIndex((x) => x.id === id),
				1,
			);
		},
	};
	return { store: { bookmarks } as unknown as MyStore, items };
}

describe('commitBookmark', () => {
	it('adds a bookmark and cuts the comment to the limit', async () => {
		const { store, items } = memoryStore();
		const draft: BookmarkDraft = {
			kind: 'block',
			topic: TOPIC,
			chapter: CHAPTER,
			blockId: 'intro',
			comment: '',
		};
		await commitBookmark(store, draft, 'я'.repeat(COMMENT_MAX + 10));
		expect(items).toHaveLength(1);
		expect(items[0]?.comment.length).toBe(COMMENT_MAX);
	});

	it('updates the existing bookmark instead of adding a second one', async () => {
		const { store, items } = memoryStore();
		const draft: BookmarkDraft = {
			kind: 'block',
			topic: TOPIC,
			chapter: CHAPTER,
			blockId: 'intro',
			comment: '',
		};
		const first = await commitBookmark(store, draft, 'first');
		await commitBookmark(store, draft, 'second', first);
		expect(items).toHaveLength(1);
		expect(items[0]?.comment).toBe('second');
	});
});
