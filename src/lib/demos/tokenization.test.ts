import { describe, expect, it } from 'vitest';
import {
	CORPUS,
	MAX_MERGES,
	baseAlphabet,
	corpusSymbolCount,
	corpusTokenCount,
	encodeWord,
	tokenColorIndex,
	tokenizeText,
	trainBpe,
	vocabSize,
} from './tokenization';

const merges = trainBpe(CORPUS, MAX_MERGES);

describe('trainBpe on the chapter corpus', () => {
	it('learns the five merges of the chapter table in order', () => {
		expect(merges.map((m) => [m.left, m.right])).toEqual([
			['e', 's'],
			['es', 't'],
			['est', '</w>'],
			['l', 'o'],
			['lo', 'w'],
		]);
	});

	it('reports the pair frequencies from the chapter table', () => {
		expect(merges.map((m) => m.count)).toEqual([9, 9, 9, 7, 7]);
	});

	it('reports the tie counts: three pairs at step 1, two at step 2, none at step 3, two at step 4', () => {
		expect(merges.map((m) => m.ties)).toEqual([2, 1, 0, 1, 0]);
	});

	it('gives the chapter segmentations after five merges', () => {
		expect(encodeWord('low', merges)).toEqual(['low', '</w>']);
		expect(encodeWord('lower', merges)).toEqual(['low', 'e', 'r', '</w>']);
		expect(encodeWord('newest', merges)).toEqual(['n', 'e', 'w', 'est</w>']);
		expect(encodeWord('widest', merges)).toEqual(['w', 'i', 'd', 'est</w>']);
	});

	it('after the first merge only e and s are joined', () => {
		expect(encodeWord('newest', merges.slice(0, 1))).toEqual(['n', 'e', 'w', 'es', 't', '</w>']);
	});
});

describe('token counts', () => {
	it('starts from the symbol count of the corpus: 95', () => {
		expect(corpusSymbolCount(CORPUS)).toBe(95);
		expect(corpusTokenCount(CORPUS, [])).toBe(95);
	});

	it('each merge removes exactly its pair frequency from the corpus', () => {
		let prev = corpusTokenCount(CORPUS, []);
		for (let k = 1; k <= merges.length; k++) {
			const now = corpusTokenCount(CORPUS, merges.slice(0, k));
			expect(prev - now).toBe(merges[k - 1]?.count);
			prev = now;
		}
		expect(prev).toBe(54);
	});

	it('vocabulary is the base alphabet plus one token per merge', () => {
		expect(baseAlphabet(CORPUS)).toHaveLength(11);
		expect(vocabSize(11, 5)).toBe(16);
	});

	it('unseen words are encoded by characters and then the learned merges', () => {
		expect(encodeWord('lowest', merges)).toEqual(['low', 'est</w>']);
	});

	it('tokenizeText counts the tokens of every word', () => {
		const r = tokenizeText('  lowest   newest ', merges);
		expect(r.words.map((w) => w.word)).toEqual(['lowest', 'newest']);
		expect(r.total).toBe(6);
	});

	it('tokenizeText of an empty string gives no tokens', () => {
		expect(tokenizeText('   ', merges)).toEqual({ words: [], total: 0 });
	});
});

describe('tokenColorIndex', () => {
	it('is stable and within 1..6', () => {
		for (const t of ['low', 'e', '</w>', 'est</w>']) {
			const i = tokenColorIndex(t);
			expect(i).toBeGreaterThanOrEqual(1);
			expect(i).toBeLessThanOrEqual(6);
			expect(tokenColorIndex(t)).toBe(i);
		}
	});
});
