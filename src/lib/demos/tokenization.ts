/**
 * Math of the tokenization demo: byte pair encoding (BPE) on the four-word corpus from the chapter.
 * Words are split into characters with an end-of-word marker; each step merges the most frequent
 * adjacent pair. Ties are broken by the first occurrence of the pair in the corpus scan
 * (words in corpus order, left to right), which is the order the chapter table shows.
 * Pure functions only: no DOM, no Svelte.
 */

/** End-of-word marker, appended to every word before merging. */
export const END_OF_WORD = '</w>';

export interface CorpusWord {
	word: string;
	/** How many times the word occurs in the corpus. */
	freq: number;
}

/** The chapter corpus: low 5, lower 2, newest 6, widest 3. */
export const CORPUS: readonly CorpusWord[] = [
	{ word: 'low', freq: 5 },
	{ word: 'lower', freq: 2 },
	{ word: 'newest', freq: 6 },
	{ word: 'widest', freq: 3 },
];

/** Number of merges the demo offers. */
export const MAX_MERGES = 5;

/** Longest text the demo tokenizes. */
export const MAX_INPUT_LENGTH = 120;

export interface Merge {
	left: string;
	right: string;
	/** Frequency of the merged pair in the corpus at this step. */
	count: number;
	/** Other pairs with the same frequency at this step (ties that were not chosen). */
	ties: number;
}

interface Sequence {
	tokens: string[];
	freq: number;
}

interface PairStat {
	left: string;
	right: string;
	count: number;
}

/** Splits a word into characters and appends the end-of-word marker. */
export function splitWord(word: string): string[] {
	return [...Array.from(word), END_OF_WORD];
}

/**
 * Counts adjacent pairs over weighted sequences. Returns the pairs in first-occurrence order,
 * which is the tie-break order.
 */
function countPairs(seqs: readonly Sequence[]): PairStat[] {
	const stats = new Map<string, PairStat>();
	for (const { tokens, freq } of seqs) {
		for (let i = 0; i + 1 < tokens.length; i++) {
			const left = tokens[i] ?? '';
			const right = tokens[i + 1] ?? '';
			const key = `${left}\u0000${right}`;
			const s = stats.get(key);
			if (s) s.count += freq;
			else stats.set(key, { left, right, count: freq });
		}
	}
	return [...stats.values()];
}

/** Replaces every non-overlapping occurrence of `left right`, scanning left to right. */
export function mergeSymbols(tokens: readonly string[], left: string, right: string): string[] {
	const out: string[] = [];
	for (let i = 0; i < tokens.length; i++) {
		if (i + 1 < tokens.length && tokens[i] === left && tokens[i + 1] === right) {
			out.push(left + right);
			i++;
		} else {
			out.push(tokens[i] ?? '');
		}
	}
	return out;
}

/** Learns up to `steps` merges on the corpus. Stops early if no pair is left. */
export function trainBpe(corpus: readonly CorpusWord[], steps: number): Merge[] {
	let seqs: Sequence[] = corpus.map(({ word, freq }) => ({ tokens: splitWord(word), freq }));
	const merges: Merge[] = [];
	for (let k = 0; k < steps; k++) {
		const stats = countPairs(seqs);
		const [first, ...rest] = stats;
		if (!first) break;
		let best = first;
		for (const s of rest) if (s.count > best.count) best = s;
		const ties = stats.filter((s) => s.count === best.count).length - 1;
		merges.push({ left: best.left, right: best.right, count: best.count, ties });
		seqs = seqs.map(({ tokens, freq }) => ({
			tokens: mergeSymbols(tokens, best.left, best.right),
			freq,
		}));
	}
	return merges;
}

/** Encodes one word: characters first, then the merges in the order they were learned. */
export function encodeWord(word: string, merges: readonly Merge[]): string[] {
	let tokens = splitWord(word);
	for (const m of merges) tokens = mergeSymbols(tokens, m.left, m.right);
	return tokens;
}

/** Size of the initial alphabet: distinct symbols of the corpus after splitting, end marker included. */
export function baseAlphabet(corpus: readonly CorpusWord[]): string[] {
	const seen = new Set<string>();
	for (const { word } of corpus) for (const s of splitWord(word)) seen.add(s);
	return [...seen];
}

/** Vocabulary size: the base alphabet plus one token per merge. */
export function vocabSize(baseSize: number, merges: number): number {
	return baseSize + merges;
}

/** Total symbols in the corpus before any merge, weighted by word frequency. */
export function corpusSymbolCount(corpus: readonly CorpusWord[]): number {
	return corpus.reduce((s, { word, freq }) => s + freq * splitWord(word).length, 0);
}

/** Total tokens in the corpus after applying the given merges, weighted by word frequency. */
export function corpusTokenCount(corpus: readonly CorpusWord[], merges: readonly Merge[]): number {
	return corpus.reduce((s, { word, freq }) => s + freq * encodeWord(word, merges).length, 0);
}

/** Splits free text on whitespace and encodes every non-empty word. */
export function tokenizeText(
	text: string,
	merges: readonly Merge[],
): { words: { word: string; tokens: string[] }[]; total: number } {
	const words = text
		.split(/\s+/)
		.filter((w) => w.length > 0)
		.map((word) => ({ word, tokens: encodeWord(word, merges) }));
	const total = words.reduce((s, w) => s + w.tokens.length, 0);
	return { words, total };
}

/** Index 1..6 of a data color for a token: the same token always gets the same color. */
export function tokenColorIndex(token: string): number {
	let h = 0;
	for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
	return (h % 6) + 1;
}
