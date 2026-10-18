import { describe, expect, it } from 'vitest';
import {
	analyzeText,
	bytesHex,
	codePointsOf,
	graphemesOf,
	toHex,
	utf16ByteCount,
	utf8Bytes,
	utf8OfCodePoint,
} from './unicode-encoding';

const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}';
const E_ACUTE = 'é';
const THUMB = '\u{1F44D}';

describe('utf8OfCodePoint', () => {
	it('uses one byte for ASCII and two for Cyrillic', () => {
		expect(utf8OfCodePoint(0x41)).toEqual([0x41]);
		// П (U+041F) is D0 9F, as in the chapter
		expect(utf8OfCodePoint(0x41f)).toEqual([0xd0, 0x9f]);
	});

	it('uses four bytes for the thumbs-up emoji', () => {
		expect(bytesHex(utf8OfCodePoint(0x1f44d))).toBe('F0 9F 91 8D');
	});

	it('rejects surrogates and values above U+10FFFF', () => {
		expect(utf8OfCodePoint(0xd800)).toEqual([]);
		expect(utf8OfCodePoint(0x110000)).toEqual([]);
	});

	it('matches TextEncoder on every range boundary', () => {
		const enc = new TextEncoder();
		for (const cp of [0x7f, 0x80, 0x7ff, 0x800, 0xffff, 0x10000, 0x10ffff]) {
			expect(utf8OfCodePoint(cp)).toEqual(Array.from(enc.encode(String.fromCodePoint(cp))));
		}
	});
});

describe('utf8Bytes', () => {
	it('gives 12 bytes for «привет» (6 letters, 2 bytes each)', () => {
		expect(utf8Bytes('привет')).toHaveLength(12);
	});

	it('agrees with TextEncoder on mixed text', () => {
		const s = `Hi, ${'привет'} ${THUMB} ${FAMILY} ${E_ACUTE}`;
		expect(utf8Bytes(s)).toEqual(Array.from(new TextEncoder().encode(s)));
	});
});

describe('code points and length', () => {
	it('counts 6 code points in «привет»', () => {
		expect(codePointsOf('привет')).toHaveLength(6);
		expect(toHex(0x43f)).toBe('U+043F');
	});

	it('counts 2 code points in e + combining acute', () => {
		expect(E_ACUTE.length).toBe(2);
		expect(codePointsOf(E_ACUTE)).toHaveLength(2);
	});

	it('counts 5 code points in the family emoji', () => {
		expect(codePointsOf(FAMILY)).toHaveLength(5);
	});
});

describe('graphemes', () => {
	it('joins e and the combining mark into one grapheme (Intl.Segmenter)', () => {
		expect(graphemesOf(E_ACUTE)).toHaveLength(1);
	});

	it('joins the family emoji into one grapheme', () => {
		expect(graphemesOf(FAMILY)).toHaveLength(1);
	});

	it('gives the same results with the simplified fallback', () => {
		expect(graphemesOf(E_ACUTE, false)).toHaveLength(1);
		expect(graphemesOf(FAMILY, false)).toHaveLength(1);
		expect(graphemesOf('привет', false)).toHaveLength(6);
		expect(graphemesOf('', false)).toEqual([]);
	});
});

describe('UTF-16 bytes', () => {
	it('uses four bytes for the thumbs-up (a surrogate pair)', () => {
		expect(utf16ByteCount(THUMB)).toBe(4);
	});

	it('uses two bytes per letter for Cyrillic', () => {
		expect(utf16ByteCount('привет')).toBe(12);
	});
});

describe('analyzeText', () => {
	it('reports the chapter numbers for «привет»', () => {
		const a = analyzeText('привет', true);
		expect(a.codePointCount).toBe(6);
		expect(a.jsLength).toBe(6);
		expect(a.utf8Bytes).toBe(12);
		expect(a.byteTokens).toBe(12);
		expect(a.graphemeCount).toBe(6);
	});

	it('reports len 2, one grapheme for «é» written as e + U+0301', () => {
		const a = analyzeText(E_ACUTE, true);
		expect(a.jsLength).toBe(2);
		expect(a.graphemeCount).toBe(1);
		expect(a.utf8Bytes).toBe(3);
	});

	it('reports 4 UTF-8 bytes, 4 UTF-16 bytes and 1 grapheme for the thumbs-up', () => {
		const a = analyzeText(THUMB, true);
		expect(a.codePointCount).toBe(1);
		expect(a.utf8Bytes).toBe(4);
		expect(a.utf16Bytes).toBe(4);
		expect(a.graphemeCount).toBe(1);
	});

	it('reports 5 code points and 1 grapheme for the family emoji', () => {
		const a = analyzeText(FAMILY, true);
		expect(a.codePointCount).toBe(5);
		expect(a.graphemeCount).toBe(1);
		expect(a.utf8Bytes).toBe(18);
		expect(a.byteTokens).toBe(18);
	});

	it('cuts the row list but keeps the totals for long input', () => {
		const a = analyzeText('а'.repeat(40), true);
		expect(a.points).toHaveLength(24);
		expect(a.truncated).toBe(true);
		expect(a.codePointCount).toBe(40);
		expect(a.utf8Bytes).toBe(80);
	});

	it('returns zeros for the empty string', () => {
		const a = analyzeText('', true);
		expect(a.codePointCount).toBe(0);
		expect(a.graphemeCount).toBe(0);
		expect(a.utf8Bytes).toBe(0);
		expect(a.points).toEqual([]);
	});
});
