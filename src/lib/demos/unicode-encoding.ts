/**
 * Math of the text encoding demo: one input string seen as code points, bytes and graphemes.
 * UTF-8 bytes are computed by hand (RFC 3629) so the demo shows the rule, not a library call.
 * Pure functions only: no DOM, no Svelte.
 */

export const DEFAULT_TEXT = 'привет';

/** Presets from the chapter text, so the numbers in the figure can be checked by the reader. */
export const PRESETS: readonly { label: string; text: string }[] = [
	{ label: 'привет', text: 'привет' },
	{ label: 'é (e + U+0301)', text: 'é' },
	{ label: 'ё (U+0451)', text: 'ё' },
	{ label: '👍', text: '\u{1F44D}' },
	{ label: 'семья 👨‍👩‍👧', text: '\u{1F468}‍\u{1F469}‍\u{1F467}' },
];

/** Shows at most this many code points as rows; the totals always cover the whole string. */
export const MAX_ROWS = 24;

export interface CodePointInfo {
	/** The code point value, 0 to 0x10FFFF. */
	cp: number;
	/** Written as U+XXXX, at least four hex digits. */
	hex: string;
	/** The character itself, as a string (may be a combining mark or a control character). */
	ch: string;
	/** UTF-8 bytes of this code point, computed by hand. */
	utf8: number[];
}

export interface EncodingAnalysis {
	/** `length` of the JavaScript string: counts UTF-16 code units. */
	jsLength: number;
	/** Number of Unicode code points (what Python's len() counts). */
	codePointCount: number;
	/** Number of user-perceived characters (grapheme clusters). */
	graphemeCount: number;
	/** Byte count of the UTF-8 encoding. */
	utf8Bytes: number;
	/** Byte count of the UTF-16 (big-endian, no BOM) encoding. */
	utf16Bytes: number;
	/** Byte-level tokenization: one token per UTF-8 byte (no merges). */
	byteTokens: number;
	/** Code point details, in string order. */
	points: CodePointInfo[];
	/** True when `points` was cut to MAX_ROWS. */
	truncated: boolean;
}

/** Hex form of a code point: U+0041, U+1F44D. */
export function toHex(cp: number): string {
	return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * UTF-8 bytes of one code point, by the table in RFC 3629.
 * Values outside 0..0x10FFFF or in the surrogate range D800..DFFF are not characters: they give [].
 */
export function utf8OfCodePoint(cp: number): number[] {
	if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) return [];
	if (cp >= 0xd800 && cp <= 0xdfff) return [];
	if (cp <= 0x7f) return [cp];
	if (cp <= 0x7ff) return [0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)];
	if (cp <= 0xffff) {
		return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)];
	}
	return [
		0xf0 | (cp >> 18),
		0x80 | ((cp >> 12) & 0x3f),
		0x80 | ((cp >> 6) & 0x3f),
		0x80 | (cp & 0x3f),
	];
}

/** Code points of a string, in order. Lone surrogates are kept as their own values. */
export function codePointsOf(s: string): number[] {
	const out: number[] = [];
	for (const ch of s) {
		const cp = ch.codePointAt(0);
		if (cp !== undefined) out.push(cp);
	}
	return out;
}

/** UTF-8 bytes of a whole string, built from the per-code-point rule. */
export function utf8Bytes(s: string): number[] {
	const out: number[] = [];
	for (const cp of codePointsOf(s)) {
		for (const b of utf8OfCodePoint(cp)) out.push(b);
	}
	return out;
}

/** UTF-16 byte count (big-endian, no BOM): two bytes per code unit, four for a surrogate pair. */
export function utf16ByteCount(s: string): number {
	return s.length * 2;
}

/** Rough check for a combining mark or a joiner, used when Intl.Segmenter is missing. */
const EXTEND_RE = /\p{M}|\u200D|\uFE0F|[\u{1F3FB}-\u{1F3FF}]/u;

/**
 * Splits a string into grapheme clusters.
 * Uses Intl.Segmenter when the runtime has it; otherwise a simplified rule:
 * a combining mark, a zero-width joiner, a variation selector or a skin tone attaches to the
 * previous character, and so does the character after a joiner.
 */
export function graphemesOf(s: string, hasSegmenter: boolean = hasIntlSegmenter()): string[] {
	if (s.length === 0) return [];
	if (hasSegmenter) {
		const Seg = (
			Intl as unknown as {
				Segmenter: new (
					locale: string,
					opts: { granularity: 'grapheme' },
				) => { segment(input: string): Iterable<{ segment: string }> };
			}
		).Segmenter;
		const seg = new Seg('ru', { granularity: 'grapheme' });
		return Array.from(seg.segment(s), (part) => part.segment);
	}
	const out: string[] = [];
	let afterJoiner = false;
	for (const ch of s) {
		const attaches = out.length > 0 && (afterJoiner || EXTEND_RE.test(ch));
		if (attaches) {
			out[out.length - 1] += ch;
		} else {
			out.push(ch);
		}
		afterJoiner = ch === '‍';
	}
	return out;
}

export function hasIntlSegmenter(): boolean {
	return typeof Intl !== 'undefined' && 'Segmenter' in Intl;
}

/** Full breakdown of one string. */
export function analyzeText(
	s: string,
	hasSegmenter: boolean = hasIntlSegmenter(),
): EncodingAnalysis {
	const cps = codePointsOf(s);
	const utf8Total = utf8Bytes(s).length;
	const points: CodePointInfo[] = cps.slice(0, MAX_ROWS).map((cp) => ({
		cp,
		hex: toHex(cp),
		ch: String.fromCodePoint(cp),
		utf8: utf8OfCodePoint(cp),
	}));
	return {
		jsLength: s.length,
		codePointCount: cps.length,
		graphemeCount: graphemesOf(s, hasSegmenter).length,
		utf8Bytes: utf8Total,
		utf16Bytes: utf16ByteCount(s),
		byteTokens: utf8Total,
		points,
		truncated: cps.length > MAX_ROWS,
	};
}

/** Hex string of bytes, separated by spaces: "D0 9F". */
export function bytesHex(bytes: number[]): string {
	return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}
