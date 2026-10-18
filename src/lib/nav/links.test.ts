import { describe, expect, it } from 'vitest';
import { chapterBlockHref, parseBlockHash, QUOTE_MAX_CHARS } from './links';

describe('chapterBlockHref', () => {
	it('builds a chapter link without a block', () => {
		expect(chapterBlockHref('dl/attention')).toBe('/dl/attention');
	});

	it('adds the block id as the fragment', () => {
		expect(chapterBlockHref('dl/attention', 'attn-formula')).toBe('/dl/attention#attn-formula');
	});

	it('encodes a Cyrillic quote and cuts it to the limit', () => {
		const quote = 'внимание'.repeat(20);
		const href = chapterBlockHref('dl/attention', 'attn-formula', quote);
		expect(href.startsWith('/dl/attention#attn-formula~q=')).toBe(true);
		expect(href).not.toContain(' ');
		expect(href).not.toContain('в');
		expect(parseBlockHash(href.slice(href.indexOf('#')))?.quote).toBe(
			Array.from(quote).slice(0, QUOTE_MAX_CHARS).join(''),
		);
	});
});

describe('parseBlockHash', () => {
	it('returns the block id from a plain hash', () => {
		expect(parseBlockHash('#idea')).toEqual({ blockId: 'idea' });
		expect(parseBlockHash('idea')).toEqual({ blockId: 'idea' });
	});

	it('returns null for empty or unusable hashes', () => {
		expect(parseBlockHash('')).toBeNull();
		expect(parseBlockHash('#')).toBeNull();
		expect(parseBlockHash('#~q=abc')).toBeNull();
		expect(parseBlockHash('#idea~q=%E0%A4%A')).toBeNull();
	});

	it('treats an empty quote as no quote', () => {
		expect(parseBlockHash('#idea~q=')).toEqual({ blockId: 'idea' });
	});

	it('decodes a percent-encoded hash as the browser keeps it', () => {
		expect(parseBlockHash('#%D0%B8%D0%B4%D0%B5%D1%8F')).toEqual({ blockId: 'идея' });
	});

	it('keeps a literal tilde and equals sign inside the quote', () => {
		const quote = 'a~q=b ~ c';
		const href = chapterBlockHref('dl/attention', 'idea', quote);
		expect(parseBlockHash(href.slice(href.indexOf('#')))).toEqual({ blockId: 'idea', quote });
	});
});

describe('round trip', () => {
	it.each([
		['dl/attention', 'idea', undefined],
		['dl/attention', 'attn-formula', 'softmax(QKᵀ / √d)'],
		['classic-ml/trees', 'split-gain', 'Джини = 1 − Σ pᵢ²'],
		['dl/attention', 'idea', 'вопрос?# & %20 +плюс'],
	])('chapter %s block %s quote %s', (chapter, block, quote) => {
		const href = chapterBlockHref(chapter, block, quote);
		const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
		const parsed = parseBlockHash(hash);
		expect(parsed?.blockId).toBe(block);
		expect(parsed?.quote).toBe(quote);
	});
});
